import type { AnnotationScript } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import type { SUniversalPColumnId } from '@platforma-sdk/model';

export function getDefaultAnnotationScript(): AnnotationScript {
  return {
    mode: 'byClonotype',
    steps: [{
      filter: {
        filters: [
          {
            column: '{"axes":[{"anchor":"main","idx":1}],"domain":{"pl7.app/vdj/gene":"J"},"name":"pl7.app/vdj/sequence/aaMutationsRate"}' as SUniversalPColumnId,
            predicate: {
              type: 'equals',
              value: 'test1',
            },
            type: 'pattern',
          },
        ],
        type: 'and',
      },
      label: 'root',
    }],
  };
}
