<script setup lang="ts">
import { PlAgDataTableV2, PlBlockPage, usePlDataTableSettingsV2 } from "@platforma-sdk/ui-vue";
import { useApp } from "../app";
import AnnotationModal from "../components/AnnotationModal.vue";
import BlockActions from "../components/BlockActions.vue";
import SettingsModal from "../components/SettingsModal.vue";

const app = useApp();

const tableSettings = usePlDataTableSettingsV2({
  sourceId: () => app.model.data.inputAnchor,
  sheets: () => app.model.outputs.sampleTableSheets,
  model: () => app.model.outputs.sampleTable,
});
</script>

<template>
  <PlBlockPage>
    <template #title> Sample Clonotypes Browser </template>
    <template #append>
      <BlockActions />
    </template>
    <PlAgDataTableV2
      key="sample-table"
      ref="tableInstance"
      v-model="app.model.data.sampleTableState"
      :settings="tableSettings"
    />
  </PlBlockPage>
  <SettingsModal />
  <AnnotationModal />
</template>
