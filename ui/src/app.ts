import { platforma } from '@platforma-open/milaboratories.clonotype-tagger.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import BrowserPage from './BrowserPage.vue';

export const sdkPlugin = defineApp(platforma, (app) => {
  return {
    routes: {
      '/': () => BrowserPage,
    },
  };
});

export const useApp = sdkPlugin.useApp;
