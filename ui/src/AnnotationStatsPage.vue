<script setup lang="ts">
import {
  PlBlockPage,
  PlBtnGhost,
  PlAgDataTableV2,
  usePlDataTableSettingsV2,
} from '@platforma-sdk/ui-vue';
import { useApp } from './app';
import AnnotationsModal from './Annotations/AnnotationsModal.vue';

const app = useApp();

const tableSettings = usePlDataTableSettingsV2({
  sourceId: () => app.model.args.annotationScript.steps.length > 0 ? app.model.args.annotationScript.steps : undefined,
  model: () => app.model.outputs.statsTable,
});
</script>

<template>
  <PlBlockPage>
    <template #title>
      Annotation Stats - {{ app.model.args.annotationScript.title }}
    </template>
    <template #append>
      <PlBtnGhost icon="settings" @click.stop="app.isAnnotationModalOpen = true">
        Annotations
      </PlBtnGhost>
    </template>
    <PlAgDataTableV2
      ref="tableInstance"
      v-model="app.model.ui.statsTable.tableState"
      :settings="tableSettings"
      show-export-button
    />
  </PlBlockPage>
  <AnnotationsModal />
</template>
