import type { AnnotationSpecUi as _AnnotationSpecUi, FilterSpec as _FilterSpec, FilterSpecUi as _FilterSpecUI, FilterSpecLeaf } from '@platforma-sdk/model';
export type { AnnotationSpec, FilterSpecType } from '@platforma-sdk/model';

export type FilterSpec = _FilterSpec<FilterSpecLeaf, { id?: number; name?: string; isExpanded?: boolean }>;

export type FilterSpecUI = _FilterSpecUI<Extract<FilterSpec, { type: 'and' | 'or' }>> & {
    id: number;
};

export type AnnotationSpecUi = _AnnotationSpecUi<FilterSpecUI> & { isCreated: boolean };
