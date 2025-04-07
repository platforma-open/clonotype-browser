import argparse
import msgspec
import polars as pl
from polars.exceptions import ColumnNotFoundError
from typing import List, Optional, Union, Literal, Annotated, Dict, Set, Tuple, Type
import sys
import os

# --- Constants ---
NA_STRING_VALUE = "__NA__" # String representation for NA/null in input string columns

# --- Schema Loading ---

class ColumnSchema(msgspec.Struct, frozen=True):
    column: str
    type: Literal['Int', 'Long', 'Float', 'Double', 'String']

SCHEMA_TO_POLARS_TYPE: Dict[str, Type[pl.DataType]] = {
    'Int': pl.Int32,
    'Long': pl.Int64,
    'Float': pl.Float32,
    'Double': pl.Float64,
    'String': pl.String,
}

def load_schema(schema_path: str) -> Dict[str, Type[pl.DataType]]:
    """Loads schema JSON and converts it to a Polars dtype dictionary."""
    print(f"Loading schema from: {schema_path}")
    try:
        with open(schema_path, "rb") as f:
            decoder = msgspec.json.Decoder(List[ColumnSchema])
            schema_list = decoder.decode(f.read())
            dtypes = {
                item.column: SCHEMA_TO_POLARS_TYPE[item.type]
                for item in schema_list
            }
            print(f"Schema loaded successfully for {len(dtypes)} columns.")
            return dtypes
    except FileNotFoundError:
        print(f"Error: Schema file not found at {schema_path}", file=sys.stderr)
        sys.exit(1)
    except (msgspec.DecodeError, KeyError) as e:
        print(f"Error: Failed to decode schema {schema_path}. Invalid JSON, structure, or type: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred while loading schema {schema_path}: {e}", file=sys.stderr)
        sys.exit(1)


# --- Type Definitions based on filter.ts ---

class Base(msgspec.Struct, tag_field="type", tag=None, omit_defaults=True, frozen=True):
    pass

# Pattern Predicates
class PatternPredicateEquals(Base, tag='equals'):
    value: str

    def apply_to_column(self, col_expr: pl.Expr) -> pl.Expr:
        return col_expr == pl.lit(self.value)

class PatternPredicateContainSubsequence(Base, tag='containSubsequence'):
    value: str

    def apply_to_column(self, col_expr: pl.Expr) -> pl.Expr:
        return col_expr.str.contains(self.value, literal=True)

PatternPredicate = Annotated[
    Union[PatternPredicateEquals, PatternPredicateContainSubsequence],
    msgspec.Meta(extra={'frozen': True})
]


# Column Transformers
class ValueRank(Base, tag='rank', tag_field="transformer"):
    column: str
    descending: Optional[bool] = False # Default: rank lowest value as 1

    def get_source_column(self) -> str:
        return self.column

    def generate_expression(self, lf: pl.LazyFrame, group_by_col: Optional[str], unique_key_col: str) -> pl.Expr:
        """Generates the ranking expression, potentially grouped."""
        rank_col_expr = pl.col(self.column).rank(method='ordinal', descending=self.descending or False)
        # Add unique key for stable ranking
        stable_rank_col_expr = pl.col(self.column, unique_key_col).rank(method='ordinal', descending=self.descending or False)

        if group_by_col:
            return stable_rank_col_expr.over(group_by_col)
        else:
            # When not grouping by sample, ranking applies globally.
            # Ensure global sort order includes the unique key for stability.
            # Note: This requires careful consideration if lf is already sorted differently.
            # A potentially safer approach involves pre-sorting or window functions if global stability is critical without group_by.
            # For now, assume stability within rank is sufficient if not grouping.
            # Revisit if global strict ordering matters more than simple ordinal rank.
             return rank_col_expr # Simpler for global case, relying on Polars default stability if any.


class SortedCumulativeSum(Base, tag='sortedCumulativeSum', tag_field="transformer"):
    column: str
    descending: Optional[bool] = False # Default: sort ascending

    def get_source_column(self) -> str:
        return self.column

    def generate_expression(self, lf: pl.LazyFrame, group_by_col: Optional[str], unique_key_col: str) -> pl.Expr:
        """Generates the cumulative sum expression after sorting, potentially grouped."""
        # Sorting must happen within the group or globally
        sort_by_cols = [pl.col(self.column), pl.col(unique_key_col)] # Add unique key for stable sort
        sorted_expr = pl.col(self.column).sort(descending=self.descending or False)

        if group_by_col:
            # Sort within each group, then calculate cumulative sum
            # return pl.col(self.column).sort(by=sort_by_cols, descending=self.descending or False).over(group_by_col).cumsum().over(group_by_col)
            # The above might be complex for polars, let's try sorting within the cumsum window
            # return pl.col(self.column).sort(descending=self.descending or False).over(group_by_col).cum_sum() # Simpler, relies on window function ordering
            # Let's try explicit sort within window if needed:
            # return pl.col(self.column).sort_by(sort_by_cols, descending=self.descending or False).over(group_by_col).cum_sum()
            # Safest: Calculate cumsum over pre-sorted expression within the group
            return pl.col(self.column).sort_by(sort_by_cols, descending=self.descending or False).over(group_by_col).cum_sum()

        else:
            # Global sort and cumulative sum
             # Sort globally first, then compute cumulative sum
            # lf_sorted = lf.sort(sort_by_cols, descending=self.descending or False) # This materializes sort early
            # return lf_sorted.select(pl.col(self.column).cum_sum()) # Does not work well with lazy
            # Try using window function for global case
             return pl.col(self.column).sort_by(sort_by_cols, descending=self.descending or False).cum_sum()


class Log10(Base, tag='log10', tag_field="transformer"):
    column: str

    def get_source_column(self) -> str:
        return self.column

    def generate_expression(self, lf: pl.LazyFrame, group_by_col: Optional[str], unique_key_col: str) -> pl.Expr:
        """Generates the log10 expression. Grouping doesn't affect log10."""
        return pl.col(self.column).log10()

TransformedColumn = Annotated[
    Union[ValueRank, SortedCumulativeSum, Log10],
    msgspec.Meta(extra={'frozen': True})
]

# Helper type for column references in filters
ColumnRef = Union[str, TransformedColumn]

def get_source_column(ref: ColumnRef) -> str:
    """Gets the original source column name from a ColumnRef."""
    if isinstance(ref, str):
        return ref
    else:
        # For TransformedColumn, delegate to its method
        return ref.get_source_column()

def get_required_source_columns_from_ref(ref: ColumnRef) -> Set[str]:
    """Gets all source columns needed for a ColumnRef (just the column itself)."""
    return {get_source_column(ref)}

def get_transformed_column_name(ref: TransformedColumn) -> str:
    """Creates a unique, predictable name for a transformed column."""
    if isinstance(ref, ValueRank):
        return f"{ref.column}_rank_{'desc' if ref.descending else 'asc'}"
    elif isinstance(ref, SortedCumulativeSum):
        return f"{ref.column}_cumsum_{'desc' if ref.descending else 'asc'}"
    elif isinstance(ref, Log10):
        return f"{ref.column}_log10"
    raise TypeError("Unknown transformer type")

def get_polars_expr_for_ref(ref: Union[ColumnRef, float], transformed_cols: Dict[str, pl.Expr]) -> pl.Expr:
    """Gets the Polars expression for a ColumnRef or a literal number."""
    if isinstance(ref, (float, int)):
        return pl.lit(ref, dtype=pl.Float64) # Promote literals to float for comparisons
    elif isinstance(ref, str):
        return pl.col(ref)
    else: # TransformedColumn
        t_name = get_transformed_column_name(ref)
        if t_name not in transformed_cols:
             # This should not happen if pre-calculation is done correctly
            raise ValueError(f"Transformed column '{t_name}' expression not found.")
        # We don't return the expression directly, but a reference to the pre-calculated column
        return pl.col(t_name)


# Filter Types
class PatternFilter(Base, tag='pattern'):
    column: str
    predicate: PatternPredicate

    def to_polars_expr(self, transformed_cols: Dict[str, pl.Expr]) -> pl.Expr:
        col_expr = get_polars_expr_for_ref(self.column, transformed_cols)
        return self.predicate.apply_to_column(col_expr) & col_expr.is_not_null() # Ensure NA results in false

    def get_required_source_columns(self) -> set[str]:
        return {self.column}

    def get_required_transformed_columns(self) -> Set[TransformedColumn]:
        return set()


class NumericalComparisonFilter(Base, tag='numericalComparison'):
    lhs: Union[ColumnRef, float] # Allow literal number on LHS
    rhs: Union[ColumnRef, float] # Allow literal number on RHS
    minDiff: Optional[float] = None
    allowEqual: Optional[bool] = False

    def to_polars_expr(self, transformed_cols: Dict[str, pl.Expr]) -> pl.Expr:
        lhs_expr = get_polars_expr_for_ref(self.lhs, transformed_cols)
        rhs_expr = get_polars_expr_for_ref(self.rhs, transformed_cols)
        min_diff = self.minDiff if self.minDiff is not None else 0.0

        # Basic comparison: lhs > rhs + min_diff or lhs >= rhs + min_diff
        # Note: filter.ts docs say lhs + minDiff < rhs, let's adjust
        # Formula: rhs > lhs + minDiff  OR  rhs >= lhs + minDiff
        if self.allowEqual:
             # comparison_expr = (lhs_expr - rhs_expr) >= min_diff # Original interpretation
             comparison_expr = rhs_expr >= (lhs_expr + min_diff) # Based on filter.ts comment
        else:
             # comparison_expr = (lhs_expr - rhs_expr) > min_diff # Original interpretation
             comparison_expr = rhs_expr > (lhs_expr + min_diff) # Based on filter.ts comment

        # Handle nulls: Comparison with null should yield null, which we then fill with False
        return comparison_expr.fill_null(False) # Explicitly handle nulls resulting from arithmetic or comparison

    def get_required_source_columns(self) -> set[str]:
        cols = set()
        if not isinstance(self.lhs, (float, int)): cols.update(get_required_source_columns_from_ref(self.lhs))
        if not isinstance(self.rhs, (float, int)): cols.update(get_required_source_columns_from_ref(self.rhs))
        return cols

    def get_required_transformed_columns(self) -> Set[TransformedColumn]:
        cols = set()
        if isinstance(self.lhs, Base) and isinstance(self.lhs, (ValueRank, SortedCumulativeSum, Log10)): cols.add(self.lhs)
        if isinstance(self.rhs, Base) and isinstance(self.rhs, (ValueRank, SortedCumulativeSum, Log10)): cols.add(self.rhs)
        return cols


class IsNA(Base, tag='isNA'):
    column: str # Can this be a transformed column? Assuming source column for now.

    def to_polars_expr(self, transformed_cols: Dict[str, pl.Expr]) -> pl.Expr:
        # Check the source column for null
        return pl.col(self.column).is_null()

    def get_required_source_columns(self) -> set[str]:
        return {self.column}

    def get_required_transformed_columns(self) -> Set[TransformedColumn]:
        return set()


# Forward references for logical filters
AnnotationFilter = None # Placeholder

class OrFilter(Base, tag='or'):
    filters: List['AnnotationFilter']

    def to_polars_expr(self, transformed_cols: Dict[str, pl.Expr]) -> pl.Expr:
        if not self.filters:
            return pl.lit(False)
        expr = self.filters[0].to_polars_expr(transformed_cols)
        for f in self.filters[1:]:
            expr = expr | f.to_polars_expr(transformed_cols)
        return expr # Nulls should propagate correctly with |

    def get_required_source_columns(self) -> set[str]:
        required = set()
        for f in self.filters: required.update(f.get_required_source_columns())
        return required

    def get_required_transformed_columns(self) -> Set[TransformedColumn]:
        required = set()
        for f in self.filters: required.update(f.get_required_transformed_columns())
        return required

class AndFilter(Base, tag='and'):
    filters: List['AnnotationFilter']

    def to_polars_expr(self, transformed_cols: Dict[str, pl.Expr]) -> pl.Expr:
        if not self.filters:
            return pl.lit(True)
        expr = self.filters[0].to_polars_expr(transformed_cols)
        for f in self.filters[1:]:
            expr = expr & f.to_polars_expr(transformed_cols)
        return expr # Nulls should propagate correctly with &

    def get_required_source_columns(self) -> set[str]:
        required = set()
        for f in self.filters: required.update(f.get_required_source_columns())
        return required

    def get_required_transformed_columns(self) -> Set[TransformedColumn]:
        required = set()
        for f in self.filters: required.update(f.get_required_transformed_columns())
        return required

class NotFilter(Base, tag='not'):
    filter: 'AnnotationFilter'

    def to_polars_expr(self, transformed_cols: Dict[str, pl.Expr]) -> pl.Expr:
        # NOT(null) is null. Need fill_null(False) inside NOT if we want NOT(NA) -> True
        # Or handle nulls in the inner expression first.
        # Let's assume inner expressions handle their nulls to False.
        inner_expr = self.filter.to_polars_expr(transformed_cols)
        # If inner_expr yields False or Null, NOT should yield True
        # If inner_expr yields True, NOT should yield False
        # Polars ~ operator handles this correctly: ~True=False, ~False=True, ~Null=Null
        # So we need to handle the Null case if filters don't guarantee non-null boolean output
        # Let's mandate inner expressions convert nulls to False first.
        return ~inner_expr # Assumes inner_expr is boolean (non-null)

    def get_required_source_columns(self) -> set[str]:
        return self.filter.get_required_source_columns()

    def get_required_transformed_columns(self) -> Set[TransformedColumn]:
         return self.filter.get_required_transformed_columns()


# Define AnnotationFilter union now that all types are declared
AnnotationFilter = Annotated[
    Union[PatternFilter, NumericalComparisonFilter, IsNA, OrFilter, AndFilter, NotFilter],
    msgspec.Meta(extra={'frozen': True})
]

# Define AnnotationMode literal type
AnnotationMode = Literal['byClonotype', 'bySampleAndClonotype']

# Annotation Step and Script
class AnnotationStep(msgspec.Struct, omit_defaults=True, frozen=True):
    filter: AnnotationFilter
    label: str

class AnnotationScript(msgspec.Struct, omit_defaults=True, frozen=True):
    mode: AnnotationMode
    steps: List[AnnotationStep]
    clonotypeKeyColumn: str
    sampleKeyColumn: Optional[str] = None # Only present & required if mode is 'bySampleAndClonotype'

# --- Main Script Logic ---

def get_all_required_columns(script: AnnotationScript) -> Tuple[Set[str], Set[TransformedColumn]]:
    """Collects all unique source and transformed columns required by the script."""
    source_cols = {script.clonotypeKeyColumn} # Clonotype key is always needed for structure
    # Sample key is only added if present in the script (validated elsewhere)
    if script.sampleKeyColumn:
        source_cols.add(script.sampleKeyColumn)

    transformed_cols: Set[TransformedColumn] = set()

    for step in script.steps:
        source_cols.update(step.filter.get_required_source_columns())
        transformed_cols.update(step.filter.get_required_transformed_columns())

    # Add source columns needed by transformations themselves
    for t_col in transformed_cols:
        source_cols.add(t_col.get_source_column())

    return source_cols, transformed_cols


def validate_script_and_inputs(
    script: AnnotationScript,
    clonotype_data_path: Optional[str],
    sample_clonotype_data_path: Optional[str]
):
    """Validates consistency between script mode and provided files/keys."""
    if script.mode == 'bySampleAndClonotype':
        if not script.sampleKeyColumn:
            print(f"Error: 'sampleKeyColumn' must be specified in the script when mode is 'bySampleAndClonotype'.", file=sys.stderr)
            sys.exit(1)
        # Crucial: sample-clonotype data is MANDATORY in this mode
        if not sample_clonotype_data_path:
            print(f"Error: Sample-clonotype data file (--sample-clonotype-data) must be provided when mode is 'bySampleAndClonotype'.", file=sys.stderr)
            sys.exit(1)
        print(f"Mode 'bySampleAndClonotype' selected. Using sample key '{script.sampleKeyColumn}'.")
        if clonotype_data_path:
             print("Clonotype data file provided and will be joined.")
        else:
             print("Clonotype data file not provided; only sample-clonotype data will be used.")

    elif script.mode == 'byClonotype':
        # Crucial: clonotype data is MANDATORY in this mode
        if not clonotype_data_path:
            print(f"Error: Clonotype data file (--clonotype-data) must be provided when mode is 'byClonotype'.", file=sys.stderr)
            sys.exit(1)
        if script.sampleKeyColumn:
            print(f"Warning: 'sampleKeyColumn' ('{script.sampleKeyColumn}') is specified in the script but mode is 'byClonotype'. It will be ignored.", file=sys.stderr)
        if sample_clonotype_data_path:
            print(f"Warning: Sample-clonotype data file ('{sample_clonotype_data_path}') is provided but mode is 'byClonotype'. It will be ignored.", file=sys.stderr)
        print("Mode 'byClonotype' selected.")
    else:
        # Should be caught by msgspec decoding, but belt-and-suspenders
        print(f"Error: Unknown annotation mode '{script.mode}'. Must be 'byClonotype' or 'bySampleAndClonotype'.", file=sys.stderr)
        sys.exit(1)


def validate_columns_exist(
    required_cols: Set[str],
    clono_schema: Optional[Dict[str, Type[pl.DataType]]], # Now optional
    sample_schema: Optional[Dict[str, Type[pl.DataType]]],
    clonotype_data_path: Optional[str], # Used for error messages
    sample_clonotype_data_path: Optional[str] # Used for error messages
):
    """Checks if all required source columns are present in the provided schemas."""
    available_cols = set()
    clono_keys = set(clono_schema.keys()) if clono_schema else set()
    sample_keys = set(sample_schema.keys()) if sample_schema else set()

    if clono_schema and sample_schema:
        overlap = clono_keys.intersection(sample_keys)
        if overlap:
            # Allow overlap, especially for key columns used in join.
            print(f"Warning: The following columns appear in both clonotype and sample-clonotype schemas: {overlap}. Ensure this is intended.", file=sys.stderr)

    available_cols.update(clono_keys)
    available_cols.update(sample_keys)

    missing_cols = required_cols - available_cols
    if missing_cols:
        print(f"Error: The following columns required by the script are missing from the input schemas:", file=sys.stderr)
        print(f"  Missing: {missing_cols}", file=sys.stderr)
        if clonotype_data_path and clono_schema:
            print(f"  Available in {os.path.basename(clonotype_data_path)}: {clono_keys}", file=sys.stderr)
        elif clonotype_data_path:
             print(f"  Clonotype data file provided ({os.path.basename(clonotype_data_path)}) but schema is missing or failed to load.", file=sys.stderr)
        if sample_clonotype_data_path and sample_schema:
            print(f"  Available in {os.path.basename(sample_clonotype_data_path)}: {sample_keys}", file=sys.stderr)
        elif sample_clonotype_data_path:
             print(f"  Sample-clonotype data file provided ({os.path.basename(sample_clonotype_data_path)}) but schema is missing or failed to load.", file=sys.stderr)

        sys.exit(1)
    print(f"All required source columns ({required_cols}) validated against provided schemas.")


def main(
    script_path: str,
    output_path: str,
    clonotype_data: Optional[str] = None, # Now optional
    clonotype_schema_path: Optional[str] = None, # Now optional
    sample_clonotype_data: Optional[str] = None,
    sample_clonotype_schema_path: Optional[str] = None,
):
    # 0. Basic Input Checks (ensure at least one data file is present)
    if not clonotype_data and not sample_clonotype_data:
        print("Error: At least one data input (--clonotype-data or --sample-clonotype-data) must be provided.", file=sys.stderr)
        return 1
    if clonotype_data and not clonotype_schema_path:
        print("Error: --clonotype-schema must be provided if --clonotype-data is used.", file=sys.stderr)
        return 1
    if sample_clonotype_data and not sample_clonotype_schema_path:
        print("Error: --sample-clonotype-schema must be provided if --sample-clonotype-data is used.", file=sys.stderr)
        return 1
    # Ensure schema isn't provided without data (less critical, but good practice)
    if clonotype_schema_path and not clonotype_data:
         print("Warning: --clonotype-schema provided without --clonotype-data. It will be ignored.", file=sys.stderr)
         clonotype_schema_path = None # Ensure it's not used later
    if sample_clonotype_schema_path and not sample_clonotype_data:
         print("Warning: --sample-clonotype-schema provided without --sample-clonotype-data. It will be ignored.", file=sys.stderr)
         sample_clonotype_schema_path = None # Ensure it's not used later


    # 1. Load Annotation Script
    print(f"Loading annotation script from: {script_path}")
    try:
        with open(script_path, "rb") as f:
            decoder = msgspec.json.Decoder(AnnotationScript)
            script = decoder.decode(f.read())
            print("Annotation script loaded successfully.")
    except FileNotFoundError:
        print(f"Error: Annotation script file not found at {script_path}", file=sys.stderr)
        return 1
    except msgspec.DecodeError as e:
        print(f"Error: Failed to decode annotation script {script_path}. Invalid JSON or structure: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"An unexpected error occurred while reading the script: {e}", file=sys.stderr)
        return 1


    # 2. Validate Script Mode vs Inputs (Ensures mandatory files for mode are present)
    validate_script_and_inputs(script, clonotype_data, sample_clonotype_data)
    # Redundant check for sample schema if sample data exists (already checked above, but safe)
    if script.mode == 'bySampleAndClonotype' and sample_clonotype_data and not sample_clonotype_schema_path:
         print(f"Internal Error: Sample schema missing despite sample data being present for bySampleAndClonotype mode.", file=sys.stderr)
         return 1


    # 3. Load Schemas (only for provided files)
    clono_schema: Optional[Dict[str, Type[pl.DataType]]] = None
    if clonotype_data and clonotype_schema_path:
        clono_schema = load_schema(clonotype_schema_path) # Exits on error

    sample_schema: Optional[Dict[str, Type[pl.DataType]]] = None
    if sample_clonotype_data and sample_clonotype_schema_path:
        sample_schema = load_schema(sample_clonotype_schema_path) # Exits on error

    # Key Column Validation within available schemas
    if clono_schema and script.clonotypeKeyColumn not in clono_schema:
        print(f"Error: Clonotype key column '{script.clonotypeKeyColumn}' defined in script not found in clonotype schema '{clonotype_schema_path}'.", file=sys.stderr)
        return 1
    if sample_schema:
        if script.mode == 'bySampleAndClonotype':
            if script.sampleKeyColumn not in sample_schema:
                 print(f"Error: Sample key column '{script.sampleKeyColumn}' defined in script not found in sample schema '{sample_clonotype_schema_path}'.", file=sys.stderr)
                 return 1
            # If clono data is absent, the clono key *must* be in sample data
            if not clono_schema and script.clonotypeKeyColumn not in sample_schema:
                 print(f"Error: Clonotype key column '{script.clonotypeKeyColumn}' defined in script not found in sample schema '{sample_clonotype_schema_path}' (and clonotype data was not provided).", file=sys.stderr)
                 return 1
    elif script.mode == 'bySampleAndClonotype':
         # This case should be caught by validate_script_and_inputs ensuring sample_data exists
         print(f"Internal Error: Sample schema is missing in bySampleAndClonotype mode.", file=sys.stderr)
         return 1


    # 4. Identify All Required Columns from Script
    required_source_cols, required_transformed_cols = get_all_required_columns(script)
    print(f"Required source columns: {required_source_cols}")
    print(f"Required transformed columns: {required_transformed_cols}")


    # 5. Validate Required Columns Exist in Schemas
    validate_columns_exist(required_source_cols, clono_schema, sample_schema, clonotype_data, sample_clonotype_data)


    # 6. Load Data Tables (Lazy, only for provided files)
    lf_clono: Optional[pl.LazyFrame] = None
    if clonotype_data and clono_schema: # Check schema too, as load depends on it
        print(f"Scanning clonotype data table (lazily) from: {clonotype_data}")
        try:
            lf_clono = pl.scan_csv(
                clonotype_data,
                separator='\t',
                schema_overrides=clono_schema, # Renamed from dtypes
                null_values={col: "" for col, dtype in clono_schema.items() if dtype != pl.String} | \
                            {col: NA_STRING_VALUE for col, dtype in clono_schema.items() if dtype == pl.String},
                try_parse_dates=False
            )
            # Performance warning fix: Use collect_schema()
            clono_collected_schema = lf_clono.collect_schema()
            print(f"Clonotype data schema: {clono_collected_schema}")
        except Exception as e:
            print(f"Error reading or scanning clonotype data table {clonotype_data}: {e}", file=sys.stderr)
            return 1

    lf_sample: Optional[pl.LazyFrame] = None
    if sample_clonotype_data and sample_schema: # Check schema too
        print(f"Scanning sample-clonotype data table (lazily) from: {sample_clonotype_data}")
        try:
            lf_sample = pl.scan_csv(
                sample_clonotype_data,
                separator='\t',
                schema_overrides=sample_schema, # Renamed from dtypes
                 null_values={col: "" for col, dtype in sample_schema.items() if dtype != pl.String} | \
                             {col: NA_STRING_VALUE for col, dtype in sample_schema.items() if dtype == pl.String},
                 try_parse_dates=False
            )
            # Performance warning fix: Use collect_schema()
            sample_collected_schema = lf_sample.collect_schema()
            print(f"Sample-clonotype data schema: {sample_collected_schema}")
        except Exception as e:
            print(f"Error reading or scanning sample-clonotype data table {sample_clonotype_data}: {e}", file=sys.stderr)
            return 1


    # 7. Prepare Transformed Columns (Before Join, only on loaded data)
    print("Preparing transformed column expressions...")
    transformed_exprs: Dict[str, pl.Expr] = {}
    lf_clono_transformed = lf_clono # Start with original or None
    lf_sample_transformed = lf_sample # Start with original or None

    # Performance warning fix: Use collect_schema().names
    clono_cols_available = set(lf_clono.collect_schema().names()) if lf_clono is not None else set()
    sample_cols_available = set(lf_sample.collect_schema().names()) if lf_sample is not None else set()

    # Separate transformations based on which dataframe they apply to
    clono_transforms = {t for t in required_transformed_cols if t.get_source_column() in clono_cols_available}
    sample_transforms = {t for t in required_transformed_cols if t.get_source_column() in sample_cols_available}

    # Apply clonotype-level transformations (only if lf_clono exists)
    if clono_transforms and lf_clono_transformed is not None:
        print(f"  Applying {len(clono_transforms)} transformations to clonotype data...")
        transform_selects = []
        for t_col in clono_transforms:
            t_name = get_transformed_column_name(t_col)
            # Pass lf_clono here, as transformation is on the base clonotype table
            expr = t_col.generate_expression(lf_clono, group_by_col=None, unique_key_col=script.clonotypeKeyColumn)
            transform_selects.append(expr.alias(t_name))
            transformed_exprs[t_name] = pl.col(t_name) # Store ref for later use
            print(f"    - {t_name} based on {t_col.get_source_column()}")
        if transform_selects:
            lf_clono_transformed = lf_clono.with_columns(transform_selects)

    # Apply sample-clonotype-level transformations (only if lf_sample exists)
    if sample_transforms and lf_sample_transformed is not None and script.mode == 'bySampleAndClonotype':
        print(f"  Applying {len(sample_transforms)} transformations to sample-clonotype data (grouped by {script.sampleKeyColumn})...")
        transform_selects = []
        for t_col in sample_transforms:
            t_name = get_transformed_column_name(t_col)
             # Pass lf_sample here, as transformation is on the base sample table
            expr = t_col.generate_expression(lf_sample, group_by_col=script.sampleKeyColumn, unique_key_col=script.clonotypeKeyColumn)
            transform_selects.append(expr.alias(t_name))
            transformed_exprs[t_name] = pl.col(t_name) # Store ref for later use
            print(f"    - {t_name} based on {t_col.get_source_column()}")
        if transform_selects:
            # Apply transformation to lf_sample, update lf_sample_transformed
            lf_sample_transformed = lf_sample.with_columns(transform_selects)


    # 8. Define the Base LazyFrame and Join if Necessary (Lazy)
    lf: Optional[pl.LazyFrame] = None
    if script.mode == 'bySampleAndClonotype':
        # Base is the sample data (must exist in this mode)
        lf = lf_sample_transformed
        if lf is None: # Should have been caught earlier
             print("Internal Error: Sample LazyFrame is missing in bySampleAndClonotype mode after transformations.", file=sys.stderr)
             return 1

        # If clonotype data also exists, perform the join
        if lf_clono_transformed is not None:
            print(f"Performing left join on '{script.clonotypeKeyColumn}'...")
            # Select only necessary columns from clono table
            clono_join_cols_needed = {script.clonotypeKeyColumn}
            # Add source columns required by filters IF they come from the clono table
            for src_col in required_source_cols:
                 if src_col in clono_cols_available:
                      clono_join_cols_needed.add(src_col)
            # Add transformed columns derived from the clono table
            for t_col in clono_transforms:
                 clono_join_cols_needed.add(get_transformed_column_name(t_col))

            # Filter out any columns that might accidentally be in lf_clono_transformed but not needed
            clono_cols_to_select = [c for c in clono_join_cols_needed if c in lf_clono_transformed.columns]


            lf = lf.join(
                lf_clono_transformed.select(clono_cols_to_select),
                on=script.clonotypeKeyColumn,
                how="left"
            )
            # Performance warning fix: Use collect_schema()
            joined_collected_schema = lf.collect_schema()
            print(f"Joined table schema: {joined_collected_schema}")
        else:
             print("Using only sample-clonotype data (no join).")
             # Performance warning fix: Use collect_schema()
             sample_only_collected_schema = lf.collect_schema()
             print(f"Schema: {sample_only_collected_schema}")

    elif script.mode == 'byClonotype':
        # Base is the clonotype data (must exist in this mode)
        lf = lf_clono_transformed
        if lf is None: # Should have been caught earlier
             print("Internal Error: Clonotype LazyFrame is missing in byClonotype mode after transformations.", file=sys.stderr)
             return 1
        # Performance warning fix: Use collect_schema()
        clono_only_collected_schema = lf.collect_schema()
        print(f"Using clonotype table directly. Schema: {clono_only_collected_schema}")

    # Final check if lf was assigned
    if lf is None:
         print("Internal Error: Main LazyFrame (lf) was not assigned.", file=sys.stderr)
         return 1


    # 9. Apply Annotation Steps Lazily
    print("Applying annotation steps...")
    # Initialize the label column with nulls
    labeled_lf = lf.with_columns(pl.lit(None, dtype=pl.String).alias("label"))

    try:
        for i, step in enumerate(script.steps):
            print(f"  Applying step {i+1}/{len(script.steps)}: label='{step.label}'")
            # Pass the dict of transformed column expressions (actually just column refs now)
            filter_expr = step.filter.to_polars_expr(transformed_exprs)
            # Fill nulls resulting from the filter expression itself with False
            filter_expr_no_null = filter_expr.fill_null(False)

            labeled_lf = labeled_lf.with_columns(
                pl.when(filter_expr_no_null)
                .then(pl.lit(step.label))
                .otherwise(pl.col("label")) # Keep existing label if filter is false
                .alias("label")
            )
    except Exception as e:
        print(f"\nError applying annotation step {i+1} (label '{step.label}'): {e}", file=sys.stderr)
        try:
             print(f"Problematic filter structure: {step.filter}", file=sys.stderr)
        except:
             pass # Ignore if printing filter fails
        print("Consider checking column names, types, and filter logic in the script.", file=sys.stderr)
        return 1
    print("Annotation steps prepared.")


    # 10. Filter for Labeled Rows, Select Columns, and Write Output
    print("Filtering for labeled rows and selecting output columns...")
    final_lf = labeled_lf.filter(pl.col("label").is_not_null())

    # Select output columns based on mode
    output_columns: List[str] = []
    if script.mode == 'bySampleAndClonotype' and script.sampleKeyColumn:
        output_columns = [script.sampleKeyColumn, script.clonotypeKeyColumn, "label"]
    else: # byClonotype mode
        output_columns = [script.clonotypeKeyColumn, "label"]

    final_lf = final_lf.select(output_columns)

    print(f"Output columns: {output_columns}")
    print(f"Writing output to: {output_path}")
    try:
        df_final = final_lf.collect(streaming=True)
        df_final.write_csv(output_path, separator='\t', null_value=NA_STRING_VALUE)
        print(f"Output successfully written to {output_path}")
        print(f"Number of labeled rows written: {len(df_final)}")
    except ColumnNotFoundError as e: # Use imported exception
         print(f"Error during final selection or writing: Column not found. This might indicate an issue with column naming or joining. {e}", file=sys.stderr)
         return 1
    except Exception as e:
        print(f"Error during final processing or writing output file {output_path}: {e}", file=sys.stderr)
        return 1

    return 0 # Indicate success


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Apply an annotation script (JSON) to clonotype and optional sample-clonotype data tables (TSV) using Polars.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    # Make clonotype args optional
    parser.add_argument(
        "--clonotype-data",
        required=False, # Now optional
        help="Path to the input clonotype properties TSV file."
    )
    parser.add_argument(
        "--clonotype-schema",
        required=False, # Now optional
        help="Path to the JSON schema file for the clonotype properties data."
    )
    # Sample args remain optional at CLI level, but validated based on mode later
    parser.add_argument(
        "--sample-clonotype-data",
        required=False,
        help="Path to the optional input sample-clonotype properties TSV file (required for 'bySampleAndClonotype' mode)."
    )
    parser.add_argument(
        "--sample-clonotype-schema",
        required=False,
        help="Path to the JSON schema file for the sample-clonotype properties data (required if --sample-clonotype-data is provided)."
    )
    parser.add_argument(
        "--script",
        required=True,
        help="Path to the annotation script JSON file."
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Path for the output labeled TSV file."
    )

    args = parser.parse_args()

    # Basic CLI validation happens inside main() now, as it depends on script content too.

    print("-- Starting Annotator --")
    exit_code = main(
        # Pass all args, main will handle optionality and validation
        clonotype_data=args.clonotype_data,
        clonotype_schema_path=args.clonotype_schema,
        sample_clonotype_data=args.sample_clonotype_data,
        sample_clonotype_schema_path=args.sample_clonotype_schema,
        script_path=args.script,
        output_path=args.output,
    )
    print(f"-- Annotator Finished (Exit Code: {exit_code}) --")
    sys.exit(exit_code)
