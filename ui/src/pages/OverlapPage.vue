<script setup lang="ts">
import { PlAgDataTableV2, PlBlockPage, usePlDataTableSettingsV2 } from "@platforma-sdk/ui-vue";
import { useApp } from "../app";
import AnnotationModal from "../components/AnnotationModal.vue";
import BlockActions from "../components/BlockActions.vue";
import SettingsModal from "../components/SettingsModal.vue";

const app = useApp();

const tableSettings = usePlDataTableSettingsV2({
  sourceId: () => app.model.data.inputAnchor,
  model: () => app.model.outputs.overlapTable,
});
</script>

<template>
  <PlBlockPage>
    <template #title> Overlap Clonotypes Browser </template>
    <template #append>
      <BlockActions />
    </template>
    <PlAgDataTableV2
      v-model="app.model.data.overlapTableState"
      v-model:selection="app.selectedColumns"
      :settings="tableSettings"
      show-export-button
    />
  </PlBlockPage>
  <SettingsModal />
  <AnnotationModal />
</template>
