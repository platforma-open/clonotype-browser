import type { AnnotationSpec, AnnotationSpecUi } from '@platforma-open/milaboratories.clonotype-browser-3.model';
import { convertFilterSpecsToExpressionSpecs } from '@platforma-sdk/model';
import { watchDebounced } from '@vueuse/core';

export function processAnnotationUiStateToArgsState(
  getUiState: () => AnnotationSpecUi,
  getArgsState: () => AnnotationSpec,
) {
  watchDebounced(getUiState, () => {
    try {
      const uiState = getUiState();
      const argsState = getArgsState();

      argsState.title = uiState.title;
      argsState.steps = convertFilterSpecsToExpressionSpecs(uiState.steps);
      argsState.defaultValue = uiState.defaultValue;
    } catch (err) {
      console.error('Error while compiling annotation UI state to Args:', err);
    }
  }, { deep: true, debounce: 1000 });
}
