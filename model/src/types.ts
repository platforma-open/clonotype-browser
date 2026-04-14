import type {
  AnnotationSpec as _AnnotationSpec,
  AnnotationSpecUi as _AnnotationSpecUi,
  FilterSpec as _FilterSpec,
  FilterSpecLeaf,
  FilterSpecUi as _FilterSpecUI,
  PlDataTableStateV2,
  PlRef,
} from "@platforma-sdk/model";

export type FilterSpec = _FilterSpec<
  FilterSpecLeaf,
  { id: number; name?: string; isExpanded?: boolean }
>;

export type FilterSpecUI = _FilterSpecUI<Extract<FilterSpec, { type: "and" | "or" }>> & {
  id: number;
};

export type AnnotationSpecUi = _AnnotationSpecUi<FilterSpecUI> & { defaultValue?: string };
export type AnnotationSpec = _AnnotationSpec & { defaultValue?: string };

/** Args passed to the workflow — the output shape of `.args(...)`. */
export type BlockArgs = {
  inputAnchor?: PlRef;
  annotationSpec: AnnotationSpec;
  runExportAll: boolean;
};

/** Unified V3 data model: block args plus UI state in one object. */
export type BlockData = {
  inputAnchor?: PlRef;
  runExportAll: boolean;
  settingsOpen: boolean;
  overlapTableState: PlDataTableStateV2;
  sampleTableState: PlDataTableStateV2;
  statsTableState: PlDataTableStateV2;
  annotationSpecUi: AnnotationSpecUi;
};

/**
 * Pre-V3 args shape — frozen snapshot consumed by the data-model upgrade.
 * Keep independent from BlockArgs so that future migrations can freeze the
 * current args shape under a new Legacy* name without disturbing this one.
 */
export type LegacyBlockArgs = {
  inputAnchor?: PlRef;
  datasetTitle?: string;
  annotationSpec: AnnotationSpec;
  runExportAll: boolean;
};

/** Pre-V3 UI state shape — frozen snapshot consumed by the data-model upgrade. */
export type LegacyUiState = {
  settingsOpen: boolean;
  overlapTable: { tableState: PlDataTableStateV2 };
  sampleTable: { tableState: PlDataTableStateV2 };
  statsTable: { tableState: PlDataTableStateV2 };
  annotationSpec: AnnotationSpecUi;
};
