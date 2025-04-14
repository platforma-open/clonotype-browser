import type { AnnotationScriptUi } from '@platforma-open/milaboratories.clonotype-browser-2.model';

export function getDefaultAnnotationScript(): AnnotationScriptUi {
  return {
    mode: 'byClonotype',
    steps: [],
  };
}
