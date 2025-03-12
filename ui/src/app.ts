import { platforma } from '@platforma-open/milaboratories.clonotype-tagger.model';
import { defineApp } from '@platforma-sdk/ui-vue';
import MainPage from './MainPage.vue';

export const sdkPlugin = defineApp(platforma, (app) => {
  return {
    routes: {
      '/': () => MainPage,
    },
  };
});

export const useApp = sdkPlugin.useApp;
