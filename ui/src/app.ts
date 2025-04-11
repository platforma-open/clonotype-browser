import { platforma } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import BrowserPage from './BrowserPage.vue';
import AnnotationStatsPage from './AnnotationStatsPage.vue';
import { ref } from 'vue';

export const sdkPlugin = defineApp(platforma, (_app) => {
  const isAnnotationModalOpen = ref(false);

  return {
    isAnnotationModalOpen,
    routes: {
      '/': () => BrowserPage,
      '/stats': () => AnnotationStatsPage,
    },
  };
}, { debug: true });

export const useApp = sdkPlugin.useApp;
