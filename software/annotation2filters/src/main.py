import argparse
import msgspec
import polars as pl
import sys
import os
from typing import List, Dict, Type, Union, Literal, Annotated, Optional

# --- Constants ---
NA_STRING_VALUE = "__NA__"  # String representation for NA/null in input string columns


# --- Schema Loading (Adapted from annotator/src/main.py) ---

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

JSON_TYPE_TO_SCHEMA_TYPE: Dict[type, Literal['Int', 'Long', 'Float', 'Double', 'String']] = {
    int: 'Long',  # Map Python int to schema's Long/Int64 for simplicity
    float: 'Double', # Map Python float to schema's Double/Float64
    str: 'String',
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

def get_schema_type_map(schema_path: str) -> Dict[str, str]:
    """Loads schema JSON and returns a map of column name to schema type string."""
    print(f"Loading schema types from: {schema_path}")
    try:
        with open(schema_path, "rb") as f:
            decoder = msgspec.json.Decoder(List[ColumnSchema])
            schema_list = decoder.decode(f.read())
            type_map = {item.column: item.type for item in schema_list}
            print(f"Schema types loaded successfully for {len(type_map)} columns.")
            return type_map
    except FileNotFoundError:
        print(f"Error: Schema file not found at {schema_path}", file=sys.stderr)
        sys.exit(1)
    except msgspec.DecodeError as e:
        print(f"Error: Failed to decode schema {schema_path}. Invalid JSON or structure: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred while loading schema {schema_path}: {e}", file=sys.stderr)
        sys.exit(1)


# --- Filter Channel Definition ---

# Define allowed label types for filter channels explicitly
FilterLabelType = Union[str, int, float]

class FilterChannel(msgspec.Struct, frozen=True):
    label: FilterLabelType
    file: str


# --- Main Script Logic ---

def main(
    input_path: str,
    schema_path: str,
    label_column: str,
    filter_channels_path: str,
    ignore_columns: Optional[List[str]] = None
):
    # 1. Load Schema
    schema_dtypes = load_schema(schema_path)
    schema_type_map = get_schema_type_map(schema_path) # For type checking

    # 2. Validate Label Column
    if label_column not in schema_dtypes:
        print(f"Error: Label column '{label_column}' not found in the schema file '{schema_path}'.", file=sys.stderr)
        print(f"Available columns: {list(schema_dtypes.keys())}", file=sys.stderr)
        return 1
    label_column_schema_type = schema_type_map[label_column]
    label_column_polars_type = schema_dtypes[label_column]
    print(f"Using label column '{label_column}' with schema type '{label_column_schema_type}' (Polars: {label_column_polars_type}).")

    # Validate Ignore Columns
    ignored_cols_set = set(ignore_columns) if ignore_columns else set()
    if ignored_cols_set:
        print(f"Ignoring columns specified via --ignore-column: {ignored_cols_set}")
        invalid_ignored_cols = ignored_cols_set - set(schema_dtypes.keys())
        if invalid_ignored_cols:
            print(f"Error: The following columns specified via --ignore-column do not exist in the schema: {invalid_ignored_cols}", file=sys.stderr)
            print(f"Available columns: {list(schema_dtypes.keys())}", file=sys.stderr)
            return 1
        if label_column in ignored_cols_set:
             print(f"Warning: The label column '{label_column}' was also specified in --ignore-column. It will be excluded anyway.", file=sys.stderr)
             # No need to remove it from the set, it just won't be in the initial output_columns list

    # 3. Load Filter Channels
    print(f"Loading filter channels from: {filter_channels_path}")
    try:
        with open(filter_channels_path, "rb") as f:
            # Use Annotated to handle the union type correctly
            decoder = msgspec.json.Decoder(List[FilterChannel])
            filter_channels = decoder.decode(f.read())
            print(f"Loaded {len(filter_channels)} filter channels.")
    except FileNotFoundError:
        print(f"Error: Filter channels file not found at {filter_channels_path}", file=sys.stderr)
        return 1
    except msgspec.DecodeError as e:
        print(f"Error: Failed to decode filter channels file {filter_channels_path}. Invalid JSON or structure: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"An unexpected error occurred while reading the filter channels file: {e}", file=sys.stderr)
        return 1

    # 4. Validate Filter Channels
    print("Validating filter channels...")
    valid_channels: List[FilterChannel] = []
    output_files = set()
    for i, channel in enumerate(filter_channels):
        is_valid = True
        # Check output file extension
        if not channel.file.lower().endswith(".tsv"):
            print(f"Error: Channel {i+1} - Output file '{channel.file}' must have a .tsv extension.", file=sys.stderr)
            is_valid = False

        # Check for duplicate output file paths
        if channel.file in output_files:
             print(f"Error: Channel {i+1} - Duplicate output file path '{channel.file}' found in channels.", file=sys.stderr)
             is_valid = False
        else:
            output_files.add(channel.file)

        # Check label type consistency
        channel_label_type = type(channel.label)
        expected_schema_type = JSON_TYPE_TO_SCHEMA_TYPE.get(channel_label_type)

        # Handle potential type mismatches (e.g., JSON int vs schema Float/Double)
        # Allow int from JSON to match Float/Double in schema, but not vice versa easily.
        # Allow int/float from JSON to match String in schema (will cast)
        type_match = False
        if expected_schema_type == label_column_schema_type:
             type_match = True
        elif channel_label_type is int and label_column_schema_type in ('Float', 'Double'):
             type_match = True # Allow int -> float/double comparison
             print(f"Warning: Channel {i+1} - Label type 'int' will be compared against schema type '{label_column_schema_type}'. Casting may occur.")
        elif channel_label_type in (int, float) and label_column_schema_type == 'String':
             type_match = True # Allow numeric -> string comparison (Polars handles casting)
             print(f"Warning: Channel {i+1} - Label type '{channel_label_type.__name__}' will be compared against schema type 'String'. Casting will occur.")

        if not type_match:
            print(f"Error: Channel {i+1} - Label type '{channel_label_type.__name__}' (value: {channel.label}) is incompatible with label column '{label_column}' schema type '{label_column_schema_type}'.", file=sys.stderr)
            is_valid = False


        if is_valid:
            valid_channels.append(channel)
        else:
            # If any channel is invalid, stop processing
            print("Filter channel validation failed. Exiting.", file=sys.stderr)
            return 1

    if not valid_channels:
        print("No valid filter channels found after validation. Exiting.", file=sys.stderr)
        return 1
    print("Filter channels validated successfully.")


    # 5. Load Input Data (Lazy)
    print(f"Scanning input data table (lazily) from: {input_path}")
    try:
        # Determine null values based on schema type
        null_value_dict = {}
        for col, dtype in schema_dtypes.items():
            if dtype == pl.String:
                null_value_dict[col] = NA_STRING_VALUE
            else:
                # Polars usually infers numeric nulls well, but empty strings are common
                null_value_dict[col] = "" # Treat empty string as null for non-string cols

        lf_input = pl.scan_csv(
            input_path,
            separator='	',
            schema_overrides=schema_dtypes,
            null_values=null_value_dict,
            try_parse_dates=False
        )
        # Verify schema after scan
        input_schema = lf_input.collect_schema()
        print(f"Input data schema verified: {input_schema}")

    except Exception as e:
        print(f"Error reading or scanning input data table {input_path}: {e}", file=sys.stderr)
        return 1

    # 6. Process Each Filter Channel
    print("Processing filters and writing output files...")
    output_columns = [col for col in schema_dtypes if col != label_column]

    # Filter out ignored columns
    if ignored_cols_set:
        original_output_columns = set(output_columns)
        output_columns = [col for col in output_columns if col not in ignored_cols_set]
        removed_count = len(original_output_columns) - len(output_columns)
        if removed_count > 0:
             print(f"  Excluded {removed_count} column(s) based on --ignore-column flags.")

    if not output_columns:
         print(f"Warning: No columns remain after excluding the label column '{label_column}' and ignored columns. Output files will only contain the 'one' column.", file=sys.stderr)

    total_rows_written = 0
    files_written = 0

    for i, channel in enumerate(valid_channels):
        print(f"  Processing channel {i+1}/{len(valid_channels)}: label='{channel.label}', output='{channel.file}'")
        try:
            # Ensure output directory exists
            output_dir = os.path.dirname(channel.file)
            if output_dir and not os.path.exists(output_dir):
                print(f"    Creating output directory: {output_dir}")
                os.makedirs(output_dir)

            # Build lazy query
            lf_filtered = lf_input.filter(pl.col(label_column) == pl.lit(channel.label))

            # Select columns and add the 'one' column
            if output_columns:
                 lf_output = lf_filtered.select(output_columns).with_columns(pl.lit(1, dtype=pl.Int32).alias("one"))
                 final_output_columns = output_columns + ["one"]
            else:
                 # Handle edge case where only the 'one' column remains
                 lf_output = lf_filtered.select(pl.lit(1, dtype=pl.Int32).alias("one"))
                 final_output_columns = ["one"]

            # Collect results and write to file
            df_output = lf_output.collect(streaming=True)
            num_rows = len(df_output)

            # Always write the file, even if empty (will contain header only)
            print(f"    Writing {num_rows} rows with columns {final_output_columns} to {channel.file}")
            df_output.write_csv(channel.file, separator='	', quote_style='never')
            total_rows_written += num_rows
            files_written += 1

        except Exception as e:
            print(f"Error processing channel {i+1} (label '{channel.label}', file '{channel.file}'): {e}", file=sys.stderr)
            # Optionally decide whether to stop or continue with other channels
            # For now, let's stop on error during processing/writing
            return 1

    print("-" * 20)
    print(f"Processing finished.")
    print(f"Total rows written across all files: {total_rows_written}")
    print(f"Number of output files created: {files_written}")
    print("-" * 20)

    return 0 # Indicate success


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Create filtered TSV files based on labels in a specific column.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Path to the input TSV data file."
    )
    parser.add_argument(
        "--schema",
        required=True,
        help="Path to the JSON schema file for the input data (same format as annotator)."
    )
    parser.add_argument(
        "--label-column",
        required=True,
        help="Name of the column in the input TSV containing the labels for filtering."
    )
    parser.add_argument(
        "--filter-channels",
        required=True,
        help="Path to the JSON file defining filter channels ([{label: value, file: 'output.tsv'}, ...])."
    )
    parser.add_argument(
        "--ignore-column",
        action='append',
        help="Specify a column header to exclude from the output files. Can be used multiple times.",
        default=[] # Initialize as an empty list if not provided
    )

    args = parser.parse_args()

    print("-- Starting Filter Generator --")
    exit_code = main(
        input_path=args.input,
        schema_path=args.schema,
        label_column=args.label_column,
        filter_channels_path=args.filter_channels,
        ignore_columns=args.ignore_column # Pass the list of ignored columns
    )
    print(f"-- Filter Generator Finished (Exit Code: {exit_code}) --")
    sys.exit(exit_code)
