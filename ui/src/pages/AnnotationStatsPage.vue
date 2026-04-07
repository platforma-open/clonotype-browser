<script setup lang="ts">
import { PlAgDataTableV2, PlBlockPage, usePlDataTableSettingsV2 } from "@platforma-sdk/ui-vue";
import { useApp } from "../app";
import AnnotationModal from "../components/AnnotationModal.vue";
import BlockActions from "../components/BlockActions.vue";

const app = useApp();

const tableSettings = usePlDataTableSettingsV2({
  sourceId: () =>
    app.model.data.annotationSpec.steps.length > 0
      ? app.model.data.annotationSpec.steps
      : undefined,
  model: () => app.model.outputs.statsTable,
});
</script>

<template>
  <PlBlockPage>
    <template #title> Annotation Stats - {{ app.model.data.annotationSpec.title }} </template>
    <template #append>
      <BlockActions />
    </template>
    <PlAgDataTableV2
      ref="tableInstance"
      v-model="app.model.data.statsTableState"
      :settings="tableSettings"
      show-export-button
    />
  </PlBlockPage>
  <AnnotationModal />
</template>
