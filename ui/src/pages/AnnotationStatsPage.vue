<script setup lang="ts">
import {
  PlAgDataTableV2,
  PlBlockPage,
  usePlDataTableSettingsV2,
} from '@platforma-sdk/ui-vue';
import { useApp } from '../app';
import AnnotationModal from '../components/AnnotationModal.vue';
import BlockActions from '../components/BlockActions.vue';

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
      <BlockActions />
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
