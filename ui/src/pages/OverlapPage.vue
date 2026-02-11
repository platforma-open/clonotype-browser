<script setup lang="ts">
import { PlAgDataTableV2, PlBlockPage, usePlDataTableSettingsV2 } from "@platforma-sdk/ui-vue";
import { useApp } from "../app";
import AnnotationModal from "../components/AnnotationModal.vue";
import BlockActions from "../components/BlockActions.vue";
import SettingsModal from "../components/SettingsModal.vue";

const app = useApp();

const tableSettings = usePlDataTableSettingsV2({
  sourceId: () => app.model.args.inputAnchor,
  model: () => app.model.outputs.overlapTable,
});
</script>

<template>
  <PlBlockPage>
    <template #title> Overlap Clonotypes Browser </template>
    <template #append>
      <BlockActions show-export />
    </template>
    <PlAgDataTableV2
      key="overlap-table"
      ref="tableInstance"
      v-model="app.model.ui.overlapTable.tableState"
      v-model:selection="app.selectedColumns"
      :settings="tableSettings"
    />
  </PlBlockPage>
  <SettingsModal />
  <AnnotationModal />
</template>
