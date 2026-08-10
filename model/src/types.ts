import type {
  AnnotationSpec as _AnnotationSpec,
  ColumnUniversalId,
  PlDataTableStateV2,
  PlRef,
} from "@platforma-sdk/model";
import type { AnnotationSpecUi } from "@platforma-open/milaboratories.clonotype-browser-3.kind";

/**
 * The annotation shapes are the block's init-params contract, so they are defined
 * in the kind and re-exported here — the model depends on the kind, never the
 * reverse, and one definition keeps the contract and the stored state identical.
 */
export type {
  AnnotationSpecUi,
  FilterSpec,
  FilterSpecUI,
} from "@platforma-open/milaboratories.clonotype-browser-3.kind";

/** The compiled form the workflow consumes — filters lowered to expressions. */
export type AnnotationSpec = _AnnotationSpec & { defaultValue?: string };

/**
 * Args passed to the workflow — the output shape of `.args(...)`.
 * `inputAnchor` is a `PlRef` (not the UI-facing `ColumnUniversalId`): the
 * workflow resolves the anchor by reference (blockId + name) via the bundle
 * builder, which requires a ref map, not an opaque universal id string.
 */
export type BlockArgs = {
  inputAnchor?: PlRef;
  annotationSpec: AnnotationSpec;
};

/** Unified V3 data model: block args plus UI state in one object. */
export type BlockData = {
  inputAnchor?: ColumnUniversalId;
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
