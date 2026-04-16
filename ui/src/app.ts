import type { Platforma } from "@platforma-open/milaboratories.clonotype-browser-3.model";
import { platforma } from "@platforma-open/milaboratories.clonotype-browser-3.model";
import type { PlSelectionModel } from "@platforma-sdk/model";
import { defineAppV3 } from "@platforma-sdk/ui-vue";
import { computed, reactive, ref } from "vue";
import { getValuesForSelectedColumns } from "./utils";

import AnnotationStatsPage from "./pages/AnnotationStatsPage.vue";
import OverlapPage from "./pages/OverlapPage.vue";
import SamplePage from "./pages/SamplePage.vue";

export const sdkPlugin = defineAppV3(
  platforma as Platforma,
  (app) => {
    const selectedColumns = ref({
      axesSpec: [],
      selectedKeys: [],
    } satisfies PlSelectionModel);

    const uiState = reactive({
      isAnnotationModalOpen: false,
    });

    const hasSelectedColumns = computed(() => {
      return selectedColumns.value.selectedKeys.length > 0;
    });

    return {
      progress: () => app.model.outputs.annotationsIsComputing ?? false,
      selectedColumns,
      uiState,
      hasSelectedColumns,
      routes: {
        "/": () => OverlapPage,
        "/sample": () => SamplePage,
        "/stats": () => AnnotationStatsPage,
      },
      getValuesForSelectedColumns: () => {
        const pFrame = app.model.outputs.overlapColumns?.pFrame;
        return pFrame == null
          ? Promise.resolve(undefined)
          : getValuesForSelectedColumns(selectedColumns.value, [pFrame]);
      },
    };
  },
  { debug: false },
);

export const useApp = sdkPlugin.useApp;
