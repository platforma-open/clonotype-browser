import argparse
import msgspec
import polars as pl
from typing import List, Optional, Union, Literal, Annotated

# --- Type Definitions based on filter.ts ---

# Base class for msgspec polymorphism detection
class Base(msgspec.Struct, tag_field="type", tag=None, omit_defaults=True):
    pass

# Pattern Predicates
class PatternPredicateEquals(Base, tag='equals'):
    value: str

    def apply_to_column(self, col_expr: pl.Expr) -> pl.Expr:
        """Applies the equals condition to a Polars column expression."""
        # Ensure comparison is done with the correct type if the column is not string
        # Polars might handle this, but explicit casting could be safer if needed.
        return col_expr == pl.lit(self.value)

class PatternPredicateContainSubsequence(Base, tag='containSubsequence'):
    value: str

    def apply_to_column(self, col_expr: pl.Expr) -> pl.Expr:
        """Applies the contains subsequence condition to a Polars column expression."""
        # Use literal=True for exact substring matching, not regex
        return col_expr.str.contains(self.value, literal=True)

PatternPredicate = Annotated[
    Union[PatternPredicateEquals, PatternPredicateContainSubsequence],
    msgspec.Meta()
]


# Filter Types
class PatternFilter(Base, tag='pattern'):
    # Assuming SUniversalPColumnId is just a string column name for now
    column: str
    predicate: PatternPredicate

    def to_polars_expr(self) -> pl.Expr:
        """Generates a Polars expression by applying the predicate to the column."""
        col_expr = pl.col(self.column)
        # Delegate expression generation to the specific predicate object
        return self.predicate.apply_to_column(col_expr)

    def get_required_columns(self) -> set[str]:
        """Returns the set of column names required by this filter."""
        return {self.column}

class UnaryNumericalFilter(Base, tag='numericalRange'):
    column: str
    min: Optional[float] = None
    max: Optional[float] = None

    def to_polars_expr(self) -> pl.Expr:
        col_expr = pl.col(self.column)
        expr = pl.lit(True) # Start with an always true expression
        if self.min is not None:
            expr = expr & (col_expr >= self.min)
        if self.max is not None:
            expr = expr & (col_expr <= self.max)
        # Handle case where column might be null if filter is applied
        return expr & col_expr.is_not_null()

    def get_required_columns(self) -> set[str]:
        """Returns the set of column names required by this filter."""
        return {self.column}

class GtNumericalFilter(Base, tag='numericalComparison'):
    column1: str
    column2: str
    minDiff: Optional[float] = None
    allowEqual: Optional[bool] = False

    def to_polars_expr(self) -> pl.Expr:
        col1_expr = pl.col(self.column1)
        col2_expr = pl.col(self.column2)
        min_diff = self.minDiff if self.minDiff is not None else 0.0

        comparison_expr = (col1_expr - col2_expr) >= min_diff if self.allowEqual else (col1_expr - col2_expr) > min_diff

        # Ensure comparison only happens if both columns are not null
        return comparison_expr & col1_expr.is_not_null() & col2_expr.is_not_null()

    def get_required_columns(self) -> set[str]:
        """Returns the set of column names required by this filter."""
        return {self.column1, self.column2}

# Forward references for logical filters
AnnotationFilter = None # Placeholder

class OrFilter(Base, tag='or'):
    filters: List['AnnotationFilter']

    def to_polars_expr(self) -> pl.Expr:
        if not self.filters:
            return pl.lit(False) # OR of empty set is false
        # Start with the first filter's expression
        expr = self.filters[0].to_polars_expr()
        # Combine subsequent filters using OR
        for f in self.filters[1:]:
            expr = expr | f.to_polars_expr()
        return expr

    def get_required_columns(self) -> set[str]:
        """Returns the set of column names required by this filter."""
        required = set()
        for f in self.filters:
            required.update(f.get_required_columns())
        return required

class AndFilter(Base, tag='and'):
    filters: List['AnnotationFilter']

    def to_polars_expr(self) -> pl.Expr:
        if not self.filters:
            return pl.lit(True) # AND of empty set is true
        # Start with the first filter's expression
        expr = self.filters[0].to_polars_expr()
        # Combine subsequent filters using AND
        for f in self.filters[1:]:
            expr = expr & f.to_polars_expr()
        return expr

    def get_required_columns(self) -> set[str]:
        """Returns the set of column names required by this filter."""
        required = set()
        for f in self.filters:
            required.update(f.get_required_columns())
        return required

class NotFilter(Base, tag='not'):
    filter: 'AnnotationFilter'

    def to_polars_expr(self) -> pl.Expr:
        # Apply NOT to the inner filter's expression
        return ~self.filter.to_polars_expr()

    def get_required_columns(self) -> set[str]:
        """Returns the set of column names required by this filter."""
        return self.filter.get_required_columns()

# Define AnnotationFilter union now that all types are declared
AnnotationFilter = Annotated[
    Union[PatternFilter, UnaryNumericalFilter, GtNumericalFilter, OrFilter, AndFilter, NotFilter],
    msgspec.Meta()
]

# Annotation Step and Script
class AnnotationStep(msgspec.Struct, omit_defaults=True):
    filter: AnnotationFilter
    label: str

class AnnotationScript(msgspec.Struct, omit_defaults=True):
    keyColumn: str
    steps: List[AnnotationStep]


# --- Main Script Logic ---

def main(data_path: str, script_path: str, output_path: str):
    # 1. Load Annotation Script
    print(f"Loading annotation script from: {script_path}")
    try:
        with open(script_path, "rb") as f:
            decoder = msgspec.json.Decoder(AnnotationScript)
            script = decoder.decode(f.read())
            print("Annotation script loaded successfully.")
    except FileNotFoundError:
        print(f"Error: Annotation script file not found at {script_path}")
        return 1 # Indicate error
    except msgspec.DecodeError as e:
        print(f"Error: Failed to decode annotation script {script_path}. Invalid JSON or structure mismatch: {e}")
        return 1
    except Exception as e:
        print(f"An unexpected error occurred while reading the script: {e}")
        return 1

    # 2. Load Data Table (Lazy)
    print(f"Scanning data table (lazily) from: {data_path}")
    try:
        # Try to infer types, increase schema length if needed for complex files
        lf = pl.scan_csv(data_path, separator='\t', infer_schema_length=1000, null_values=["", "NA", "NULL"])
        print(f"Data table schema scanned. Columns: {lf.columns}")
    except FileNotFoundError:
        print(f"Error: Data table file not found at {data_path}")
        return 1
    except Exception as e: # Catch Polars exceptions (e.g., ComputeError, NoDataError)
        print(f"Error reading or scanning data table {data_path}: {e}")
        return 1

    # 3. Validate Columns
    print("Validating required columns...")
    required_columns = {script.keyColumn}
    try:
        for step in script.steps:
            # Use the polymorphic method on the filter object
            required_columns.update(step.filter.get_required_columns())
    except Exception as e:
        # This might happen if the script structure itself is invalid or a filter is malformed
        print(f"Error processing filter definitions in the script while collecting columns: {e}")
        return 1

    available_columns = set(lf.columns)
    missing_cols = required_columns - available_columns
    if missing_cols:
        print(f"Error: The following columns required by the script are missing in the data table ({data_path}): {missing_cols}")
        print(f"Available columns: {available_columns}")
        return 1
    print(f"All required columns ({required_columns}) are present.")


    # 4. Apply Annotation Steps Lazily
    print("Applying annotation steps...")
    # Initialize the label column
    labeled_lf = lf.with_columns(pl.lit(None, dtype=pl.String).alias("label"))

    try:
        for i, step in enumerate(script.steps):
            print(f"  Applying step {i+1}/{len(script.steps)}: label='{step.label}'")
            filter_expr = step.filter.to_polars_expr()
            labeled_lf = labeled_lf.with_columns(
                pl.when(filter_expr.fill_null(False)) # Treat null results from filter as False
                .then(pl.lit(step.label))
                .otherwise(pl.col("label"))
                .alias("label")
            )
    except Exception as e:
        # Catch potential errors during polars expression generation or application within a step
        print(f"Error applying annotation step {i+1} (label '{step.label}'): {e}")
        # Consider providing more context, e.g., which column or filter type caused it, if possible from the exception
        return 1
    print("Annotation steps applied.")

    # 5. Filter for Labeled Rows, Select Columns, and Write Output
    print("Filtering for labeled rows and selecting output columns...")
    final_lf = (
        labeled_lf
        .filter(pl.col("label").is_not_null())
        .select([script.keyColumn, "label"])
    )

    print(f"Writing output to: {output_path}")
    try:
        # Collect triggers the computation
        df_final = final_lf.collect()
        df_final.write_csv(output_path, separator='\t')
        print(f"Output successfully written to {output_path}")
        print(f"Number of labeled rows written: {len(df_final)}")
    except pl.ColumnNotFoundError as e:
         print(f"Error during final selection or writing: Column not found. This shouldn't happen after validation. {e}")
         return 1
    except Exception as e:
        # Catch errors during collect() or write_csv()
        print(f"Error during final processing or writing output file {output_path}: {e}")
        return 1

    return 0 # Indicate success


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Apply an annotation script (JSON) to a data table (TSV) using Polars and output labeled rows.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument("data_file", help="Path to the input data TSV file.")
    parser.add_argument("script_file", help="Path to the annotation script JSON file.")
    parser.add_argument("output_file", help="Path for the output labeled TSV file.")

    args = parser.parse_args()

    print("-- Starting Clonotype Tagger --")
    exit_code = main(args.data_file, args.script_file, args.output_file)
    print(f"-- Clonotype Tagger Finished (Exit Code: {exit_code}) --")
    exit(exit_code)
