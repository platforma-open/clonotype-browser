import type { UiState } from "@platforma-open/milaboratories.clonotype-browser-3.model";
import { createPlDataTableStateV2 } from "@platforma-sdk/model";

export function stateMigration(state: UiState) {
  state.sampleTable ??= { tableState: createPlDataTableStateV2() };
}
