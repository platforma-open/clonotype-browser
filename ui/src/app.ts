import { platforma } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import BrowserPage from './BrowserPage.vue';
import AnnotationStatsPage from './AnnotationStatsPage.vue';
import { ref, computed } from 'vue';

export const sdkPlugin = defineApp(platforma, (_app) => {
  const isAnnotationModalOpen = ref(false);

  const columns = computed(() => {
    return _app.model.outputs.byClonotypeColumns ?? [];
  });

  const columnsOptions = computed(() => columns.value.map((c) => ({ label: c.label, value: c.id })));

  return {
    isAnnotationModalOpen,
    columns,
    columnsOptions,
    routes: {
      '/': () => BrowserPage,
      '/stats': () => AnnotationStatsPage,
    },
  };
}, { debug: true });

export const useApp = sdkPlugin.useApp;
