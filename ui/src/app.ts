import { platforma } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import BrowserPage from './BrowserPage.vue';
import AnnotationStatsPage from './AnnotationStatsPage.vue';
import { ref, computed } from 'vue';

export const sdkPlugin = defineApp(platforma, (_app) => {
  const isAnnotationModalOpen = ref(false);

  const filterColumns = computed(() => {
    if (_app.model.args.annotationScript.mode === 'bySampleAndClonotype') {
      const { bySampleAndClonotypeColumns, byClonotypeColumns } = _app.model.outputs;

      if (!bySampleAndClonotypeColumns || !byClonotypeColumns) {
        return undefined;
      }

      return [...bySampleAndClonotypeColumns, ...byClonotypeColumns];
    }

    return _app.model.outputs.byClonotypeColumns ?? [];
  });

  const filterColumnsOptions = computed(() => filterColumns.value?.map((c) => ({ label: c.label, value: c.id })));

  return {
    isAnnotationModalOpen,
    filterColumns,
    filterColumnsOptions,
    routes: {
      '/': () => BrowserPage,
      '/stats': () => AnnotationStatsPage,
    },
  };
}, { debug: true });

export const useApp = sdkPlugin.useApp;
