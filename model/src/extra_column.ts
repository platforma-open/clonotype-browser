import type { CanonicalPColumnId } from '@platforma-sdk/model';

/**
 * Represents the available aggregation operations that can be performed on columns.
 * These operations are used to aggregate data based on metadata relationships.
 */
export type AggregationOperation = 'count' | 'sum' | 'mean' | 'median' | 'min' | 'max';

/**
 * Defines the configuration for aggregating a target column based on grouping by metadata.
 * This type is used to specify how to aggregate values from a target column based on
 * grouping by a metadata column.
 */
export type ExtraColumnAggregatedByMetadata = {
  /** The aggregation operation to perform (e.g., count, sum, mean) */
  operation: AggregationOperation;
  /** The metadata column that defines the grouping for aggregation */
  metaColumn: CanonicalPColumnId;
  /** The column whose values will be aggregated */
  targetColumn: CanonicalPColumnId;
};

/**
 * Represents the specification for an extra column in the dataset.
 * Currently supports aggregation based on metadata relationships.
 * This type can be extended in the future to support other types of extra columns.
 */
export type ExtraColumnSpec = ExtraColumnAggregatedByMetadata;
