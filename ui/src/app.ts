import type { Platforma } from '@platforma-open/milaboratories.clonotype-browser-3.model';
import { platforma } from '@platforma-open/milaboratories.clonotype-browser-3.model';
import type { PlSelectionModel } from '@platforma-sdk/model';
import { defineApp } from '@platforma-sdk/ui-vue';
import { computed, ref } from 'vue';
import AnnotationStatsPage from './components/AnnotationStatsPage.vue';
import OverlapPage from './components/OverlapPage.vue';
import { processAnnotationUiStateToArgsState } from './model';
import { getValuesForSelectedColumns } from './utils';

export const sdkPlugin = defineApp(platforma as Platforma, (app) => {
  processAnnotationUiStateToArgsState(
    () => app.model.ui.annotationSpec,
    () => app.model.args.annotationSpec,
  );

  const selectedColumns = ref({
    axesSpec: [],
    selectedKeys: [],
  } satisfies PlSelectionModel);

  const isAnnotationModalOpen = ref(false);
  const hasSelectedColumns = computed(() => {
    return selectedColumns.value.selectedKeys.length > 0;
  });

  return {
    progress: () => app.model.outputs.annotationsIsComputing ?? false,
    selectedColumns,
    hasSelectedColumns,
    isAnnotationModalOpen,
    routes: {
      '/': () => OverlapPage,
      '/stats': () => AnnotationStatsPage,
    },
    getValuesForSelectedColumns: () => {
      const pFrame = app.model.outputs.overlapColumns?.pFrame;
      return pFrame == null ? Promise.resolve(undefined) : getValuesForSelectedColumns(selectedColumns.value, [pFrame]);
    },
  };
}, { debug: false });

export const useApp = sdkPlugin.useApp;
