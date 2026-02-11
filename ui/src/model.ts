import type {
  AnnotationSpec,
  AnnotationSpecUi,
  BlockArgs,
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
  getArgs: () => BlockArgs,
  getInputOptions: () => undefined | Option[],
) {
  watch(
    () => [getArgs().inputAnchor, getInputOptions()] as const,
    ([inputAnchor, inputOptions]) => {
      getArgs().datasetTitle = inputAnchor
        ? inputOptions?.find(({ ref }) => plRefsEqual(ref, inputAnchor))?.label
        : undefined;
    },
  );
}

export function syncTableInputs(
  getArgs: () => BlockArgs,
  getTableInputs: () => undefined | TableInputs,
) {
  watch(
    () => [getTableInputs(), getArgs().inputAnchor] as const,
    ([tableInputs, inputAnchor]) => {
      getArgs().tableInputs = inputAnchor
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
