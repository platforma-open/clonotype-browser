import type { AnnotationScript, AnnotationScriptUi } from '@platforma-sdk/model';
import { compileAnnotationScript } from '@platforma-sdk/model';
import { watchDebounced } from '@vueuse/core';

export function processAnnotatiuoUiStateToArgs(
  getUiState: () => AnnotationScriptUi,
  getArgsState: () => AnnotationScript,
) {
  watchDebounced(getUiState, (value) => {
    try {
      Object.assign(getArgsState(), compileAnnotationScript(value));
    } catch (err) {
      console.error('Error while compiling annotation UI state to Args:', err);
    }
  }, { deep: true, debounce: 1000 });
}
