<script setup lang="ts">
import {
  PlAgDataTableV2,
  PlBlockPage,
  PlBtnGhost,
  usePlDataTableSettingsV2,
} from '@platforma-sdk/ui-vue';
import { useApp } from '../app';
import AnnotationModal from './AnnotationModal.vue';

const app = useApp();

const tableSettings = usePlDataTableSettingsV2({
  sourceId: () => app.model.args.annotationSpec.steps.length > 0 ? app.model.args.annotationSpec.steps : undefined,
  model: () => app.model.outputs.statsTable,
});
</script>

<template>
  <PlBlockPage>
    <template #title>
      Annotation Stats - {{ app.model.args.annotationSpec.title }}
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
  <AnnotationModal />
</template>
