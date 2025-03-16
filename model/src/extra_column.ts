export type AggregationOperation = 'count' | 'sum' | 'mean' | 'median' | 'min' | 'max';

export type ECAggregatedByMetadata = {
  operation: AggregationOperation;
  metaColumn: string;
  targetColumn: string;
};

export type ExtraColumnSpec = ECAggregatedByMetadata;
