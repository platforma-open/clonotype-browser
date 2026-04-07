import type {
  AnnotationSpec,
  AnnotationSpecUi,
  BlockData,
  TableInputs,
} from "@platforma-open/milaboratories.clonotype-browser-3.model";
import {
  convertFilterSpecsToExpressionSpecs,
  type Option,
  plRefsEqual,
} from "@platforma-sdk/model";
import { watchDebounced } from "@vueuse/core";
import { watch } from "vue";

export function syncDatasetTitle(
  getData: () => BlockData,
  getInputOptions: () => undefined | Option[],
) {
  watch(
    () => [getData().inputAnchor, getInputOptions()] as const,
    ([inputAnchor, inputOptions]) => {
      getData().datasetTitle = inputAnchor
        ? inputOptions?.find(({ ref }) => plRefsEqual(ref, inputAnchor))?.label
        : undefined;
    },
  );
}

export function syncTableInputs(
  getData: () => BlockData,
  getTableInputs: () => undefined | TableInputs,
) {
  watch(
    () => [getTableInputs(), getData().inputAnchor] as const,
    ([tableInputs, inputAnchor]) => {
      getData().tableInputs = inputAnchor
        ? (tableInputs ?? { byClonotypeLabels: {}, linkedColumns: {} })
        : undefined;
    },
  );
}

export function processAnnotationUiStateToArgsState(
  getUiState: () => AnnotationSpecUi,
  getArgsState: () => AnnotationSpec,
) {
  watchDebounced(
    getUiState,
    () => {
      try {
        const uiState = getUiState();
        const argsState = getArgsState();

        argsState.title = uiState.title;
        argsState.steps = convertFilterSpecsToExpressionSpecs(uiState.steps);
        argsState.defaultValue = uiState.defaultValue;
      } catch (err) {
        console.error("Error while compiling annotation UI state to Args:", err);
      }
    },
    { deep: true, debounce: 1000 },
  );
}
