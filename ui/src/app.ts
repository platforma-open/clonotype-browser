import { platforma } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import BrowserPage from './BrowserPage.vue';
import AnnotationStatsPage from './AnnotationStatsPage.vue';

export const sdkPlugin = defineApp(platforma, (app) => {
  return {
    routes: {
      '/': () => BrowserPage,
      '/stats': () => AnnotationStatsPage,
    },
  };
});

export const useApp = sdkPlugin.useApp;
