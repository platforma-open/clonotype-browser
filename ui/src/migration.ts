import { isNil, randomInt } from '@milaboratories/helpers';
import type { UiState } from '@platforma-open/milaboratories.clonotype-browser-3.model';

export function migrateUiState(uiState: UiState) {
  if (uiState != null && 'selectedColumns' in uiState) {
    delete uiState.selectedColumns;
  }

  migrateToWithId(uiState.annotationScript.steps);
  uiState.annotationScript.steps.forEach((step) => {
    migrateToWithId(step.filter.filters);
  });
}

function migrateToWithId(items: { id?: number }[]) {
  for (let i = 0; i < items.length; i++) {
    if (isNil(items[i].id)) {
      items[i].id = randomInt();
    }
  }
}
