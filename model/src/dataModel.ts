import {
  createGlobalPObjectId,
  createPlDataTableStateV2,
  DataModelBuilder,
  type ColumnUniversalId,
  type PlDataTableStateV2,
  type PlRef,
} from "@platforma-sdk/model";
import { kind } from "@platforma-open/milaboratories.clonotype-browser-3.kind";
import type { AnnotationSpecUi, BlockData, LegacyBlockArgs, LegacyUiState } from "./types";

/**
 * Stored shape at Ver_2026_04_07. `inputAnchor` was a `PlRef` and
 * `sampleTableState` could be absent for early data of this version.
 */
type StoredV1 = {
  inputAnchor?: PlRef;
  settingsOpen: boolean;
  overlapTableState: PlDataTableStateV2;
  sampleTableState?: PlDataTableStateV2;
  statsTableState: PlDataTableStateV2;
  annotationSpecUi: AnnotationSpecUi;
};

/** Stored shape at Ver_2026_04_14: same as V1 but `sampleTableState` is required. */
type StoredV2 = Omit<StoredV1, "sampleTableState"> & {
  sampleTableState: PlDataTableStateV2;
};

/**
 * Legacy `inputAnchor` was a `PlRef`. The new `BlockData` carries a
 * `ColumnUniversalId` (canonical stringified id). For result-pool leaves the
 * conversion is `createGlobalPObjectId` of the ref's `(blockId, name)`.
 */
function plRefToUniversalId(ref: PlRef | undefined): ColumnUniversalId | undefined {
  return ref ? createGlobalPObjectId(ref.blockId, ref.name) : undefined;
}

export const blockDataModel = new DataModelBuilder({ kind })
  .from<StoredV1>("Ver_2026_04_07")
  .upgradeLegacy<LegacyBlockArgs, LegacyUiState>(({ args, uiState }) => ({
    inputAnchor: args.inputAnchor,
    settingsOpen: uiState?.settingsOpen ?? true,
    overlapTableState: uiState?.overlapTable?.tableState ?? createPlDataTableStateV2(),
    sampleTableState: uiState?.sampleTable?.tableState ?? createPlDataTableStateV2(),
    statsTableState: uiState?.statsTable?.tableState ?? createPlDataTableStateV2(),
    annotationSpecUi: uiState?.annotationSpec ?? { title: "", steps: [] },
  }))
  .migrate<StoredV2>("Ver_2026_04_14", (prev) => ({
    ...prev,
    sampleTableState: prev.sampleTableState ?? createPlDataTableStateV2(),
  }))
  .migrate<BlockData>("Ver_2026_05_28", (prev) => ({
    ...prev,
    inputAnchor: plRefToUniversalId(prev.inputAnchor),
  }))
  // Both init params are stored exactly as they arrive. `params` is absent for a
  // block created from the UI, so each keeps its empty default — a fresh browser
  // with nothing picked and nothing annotated.
  .init(({ params }) => ({
    inputAnchor: params?.inputAnchor,
    settingsOpen: true,
    overlapTableState: createPlDataTableStateV2(),
    sampleTableState: createPlDataTableStateV2(),
    statsTableState: createPlDataTableStateV2(),
    annotationSpecUi: params?.annotationSpecUi ?? { title: "", steps: [] },
  }));
