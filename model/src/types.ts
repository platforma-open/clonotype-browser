import type {
  AnnotationSpecUi as _AnnotationSpecUi,
  FilterSpec as _FilterSpec,
  FilterSpecUi as _FilterSpecUI,
  FilterSpecLeaf,
  PlDataTableStateV2,
  PlRef,
} from "@platforma-sdk/model";
import type { AnnotationSpec as _AnnotationSpec } from "@platforma-sdk/model";
import type { LinkedColumnEntry } from "./column_utils";

export type { FilterSpecType } from "@platforma-sdk/model";

export type FilterSpec = _FilterSpec<
  FilterSpecLeaf,
  { id: number; name?: string; isExpanded?: boolean }
>;

export type FilterSpecUI = _FilterSpecUI<Extract<FilterSpec, { type: "and" | "or" }>> & {
  id: number;
};

export type AnnotationSpecUi = _AnnotationSpecUi<FilterSpecUI> & { defaultValue?: string };

export type AnnotationSpec = _AnnotationSpec & { defaultValue?: string };

export type TableInputs = {
  byClonotypeLabels: Record<string, string>;
  linkedColumns: Record<string, LinkedColumnEntry>;
};

/** Unified data model for V3 (replaces separate BlockArgs + UiState) */
export type BlockData = {
  inputAnchor?: PlRef;
  datasetTitle?: string;
  annotationSpec: AnnotationSpec;
  runExportAll: boolean;
  tableInputs?: TableInputs;
  settingsOpen: boolean;
  overlapTableState: PlDataTableStateV2;
  sampleTableState: PlDataTableStateV2;
  statsTableState: PlDataTableStateV2;
  annotationSpecUi: AnnotationSpecUi;
};

/** Legacy args type for upgrade migration */
export type LegacyBlockArgs = {
  inputAnchor?: PlRef;
  datasetTitle?: string;
  annotationSpec: AnnotationSpec;
  runExportAll: boolean;
  tableInputs?: TableInputs;
};

/** Legacy UI state type for upgrade migration */
export type LegacyUiState = {
  settingsOpen: boolean;
  overlapTable: { tableState: PlDataTableStateV2 };
  sampleTable: { tableState: PlDataTableStateV2 };
  statsTable: { tableState: PlDataTableStateV2 };
  annotationSpec: AnnotationSpecUi;
};
