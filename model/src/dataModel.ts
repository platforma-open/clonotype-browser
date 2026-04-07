import { createPlDataTableStateV2, DataModelBuilder } from "@platforma-sdk/model";
import type { BlockData, LegacyBlockArgs, LegacyUiState } from "./types";

export const blockDataModel = new DataModelBuilder()
  .from<BlockData>("Ver_2026_04_07")
  .upgradeLegacy<LegacyBlockArgs, LegacyUiState>(({ args, uiState }) => ({
    inputAnchor: args.inputAnchor,
    datasetTitle: args.datasetTitle,
    annotationSpec: args.annotationSpec ?? { title: "", steps: [] },
    runExportAll: args.runExportAll ?? false,
    tableInputs: args.tableInputs ?? { byClonotypeLabels: {}, linkedColumns: {} },
    settingsOpen: uiState?.settingsOpen ?? true,
    overlapTableState: uiState?.overlapTable?.tableState ?? createPlDataTableStateV2(),
    sampleTableState: uiState?.sampleTable?.tableState ?? createPlDataTableStateV2(),
    statsTableState: uiState?.statsTable?.tableState ?? createPlDataTableStateV2(),
    annotationSpecUi: uiState?.annotationSpec ?? { title: "", steps: [] },
  }))
  .init(() => ({
    annotationSpec: { title: "", steps: [] },
    runExportAll: false,
    tableInputs: { byClonotypeLabels: {}, linkedColumns: {} },
    settingsOpen: true,
    overlapTableState: createPlDataTableStateV2(),
    sampleTableState: createPlDataTableStateV2(),
    statsTableState: createPlDataTableStateV2(),
    annotationSpecUi: { title: "", steps: [] },
  }));
