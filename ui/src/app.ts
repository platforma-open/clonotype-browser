import type { Platforma } from "@platforma-open/milaboratories.clonotype-browser-3.model";
import { platforma } from "@platforma-open/milaboratories.clonotype-browser-3.model";
import type { PlSelectionModel } from "@platforma-sdk/model";
import { defineAppV3 } from "@platforma-sdk/ui-vue";
import { computed, ref } from "vue";
import { processAnnotationUiStateToArgsState, syncDatasetTitle, syncTableInputs } from "./model";
import { getValuesForSelectedColumns } from "./utils";

import AnnotationStatsPage from "./pages/AnnotationStatsPage.vue";
import OverlapPage from "./pages/OverlapPage.vue";
import SamplePage from "./pages/SamplePage.vue";
import { stateMigration } from "./migration";

export const sdkPlugin = defineAppV3(
  platforma as Platforma,
  (app) => {
    stateMigration(app.model.data);
    syncDatasetTitle(
      () => app.model.data,
      () => app.model.outputs.inputOptions,
    );
    syncTableInputs(
      () => app.model.data,
      () => app.model.outputs.tableInputs,
    );
    processAnnotationUiStateToArgsState(
      () => app.model.data.annotationSpecUi,
      () => app.model.data.annotationSpec,
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
