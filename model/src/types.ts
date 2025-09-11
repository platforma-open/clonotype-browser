import type { AnnotationSpecUi as _AnnotationSpecUi, FilterSpecUi as _FilterSpecUi } from '@platforma-sdk/model';

export type FilterSpecUi = _FilterSpecUi & { id: number };
export type AnnotationSpecUi = _AnnotationSpecUi<FilterSpecUi> & { isCreated: boolean };

export type { AnnotationSpec, ExpressionSpec } from '@platforma-sdk/model';
