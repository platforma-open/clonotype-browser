import type { SUniversalPColumnId } from '@platforma-sdk/model';
import type { AnnotationMode, AnnotationScript, IsNA } from './filter';

export type IsNAUI = IsNA;

export type IsNotNAUI = {
  type: 'not';
  filter: IsNA;
};

export type LessThenUI = {
  type: 'numericalComparison';
  lhs: SUniversalPColumnId;
  rhs: number;
};

export type FilterUI = IsNAUI | IsNotNAUI | LessThenUI;

export interface AnnotationFilterList {
  type: 'and';
    /** Array of filters to combine with AND logic */
  filters: FilterUI[];
}

export type AnnotationStepUI = {
  /** The filter to apply for selecting records */
  filter: AnnotationFilterList;
  /** The label to assign to records that match the filter */
  label: string;
};

export type AnnotationScriptUI = {
  /** The mode of annotation to apply */
  mode: AnnotationMode;
  /** Ordered list of annotation steps to apply */
  steps: AnnotationStepUI[];
};

type CheckTrue<_T extends true> = true;

type _C = CheckTrue<AnnotationScriptUI extends AnnotationScript ? true : false>;
