import type { AnnotationScriptUi } from '@platforma-open/milaboratories.clonotype-browser-2.model';

export function getDefaultAnnotationScript(): AnnotationScriptUi {
  return {
    title: 'My Annotation',
    mode: 'byClonotype',
    steps: [],
  };
}
