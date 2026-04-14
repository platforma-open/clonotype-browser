import {
  createPlDataTableStateV2,
  DataModelBuilder,
  type PlDataTableStateV2,
} from "@platforma-sdk/model";
import type { BlockData, LegacyBlockArgs, LegacyUiState } from "./types";

/** V1 schema: sampleTableState could be absent for early Ver_2026_04_07 data. */
type BlockDataV1 = Omit<BlockData, "sampleTableState"> & {
  sampleTableState?: PlDataTableStateV2;
};

export const blockDataModel = new DataModelBuilder()
  .from<BlockDataV1>("Ver_2026_04_07")
  .upgradeLegacy<LegacyBlockArgs, LegacyUiState>(({ args, uiState }) => ({
    inputAnchor: args.inputAnchor,
    runExportAll: args.runExportAll ?? false,
    tableInputs: args.tableInputs ?? { byClonotypeLabels: {}, linkedColumns: {} },
    settingsOpen: uiState?.settingsOpen ?? true,
    overlapTableState: uiState?.overlapTable?.tableState ?? createPlDataTableStateV2(),
    sampleTableState: uiState?.sampleTable?.tableState ?? createPlDataTableStateV2(),
    statsTableState: uiState?.statsTable?.tableState ?? createPlDataTableStateV2(),
    annotationSpecUi: uiState?.annotationSpec ?? { title: "", steps: [] },
  }))
  .migrate<BlockData>("Ver_2026_04_14", (prev) => ({
    ...prev,
    sampleTableState: prev.sampleTableState ?? createPlDataTableStateV2(),
  }))
  .init(() => ({
    runExportAll: false,
    tableInputs: { byClonotypeLabels: {}, linkedColumns: {} },
    settingsOpen: true,
    overlapTableState: createPlDataTableStateV2(),
    sampleTableState: createPlDataTableStateV2(),
    statsTableState: createPlDataTableStateV2(),
    annotationSpecUi: { title: "", steps: [] },
  }));
