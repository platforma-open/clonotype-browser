<script setup lang="ts">
import {
  PlAgDataTableV2,
  PlBlockPage,
  PlBtnGroup,
  usePlDataTableSettingsV2,
} from "@platforma-sdk/ui-vue";
import { ref } from "vue";
import { useApp } from "../app";
import AnnotationModal from "../components/AnnotationModal.vue";
import BlockActions from "../components/BlockActions.vue";
import SettingsModal from "../components/SettingsModal.vue";

const app = useApp();

/**
 * "single" shows one sample at a time via the sample sheet; "all" drops the
 * sheet so sampleId becomes a regular column the user can filter and export.
 */
type SampleMode = "single" | "all";

const sampleMode = ref<SampleMode>("single");

const sampleModeOptions = [
  { value: "single", label: "One sample" },
  { value: "all", label: "All samples" },
] satisfies { value: SampleMode; label: string }[];

const tableSettings = usePlDataTableSettingsV2({
  sourceId: () => app.model.data.inputAnchor,
  sheets: () => (sampleMode.value === "all" ? [] : app.model.outputs.sampleTableSheets),
  model: () => app.model.outputs.sampleTable,
});
</script>

<template>
  <PlBlockPage>
    <template #title>Sequence Browser</template>
    <template #append>
      <BlockActions />
    </template>
    <PlAgDataTableV2
      key="sample-table"
      ref="tableInstance"
      v-model="app.model.data.sampleTableState"
      :settings="tableSettings"
      show-export-button
    >
      <template #before-sheets>
        <PlBtnGroup v-model="sampleMode" :options="sampleModeOptions" compact />
      </template>
    </PlAgDataTableV2>
  </PlBlockPage>
  <SettingsModal />
  <AnnotationModal />
</template>
