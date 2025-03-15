import type { ValueType } from '@platforma-sdk/model';

export type PColumnSelector = {
  name: string;
  type?: ValueType;
  domain?: Record<string, string>;
};

export type AggregationOperation = 'count' | 'sum' | 'mean' | 'median' | 'min' | 'max';

export type ECAggregatedByMetadata = {
  operation: AggregationOperation;
  metaColumn: PColumnSelector;
  targetColumn: PColumnSelector;
};

export type ExtraColumnSpec = ECAggregatedByMetadata;
