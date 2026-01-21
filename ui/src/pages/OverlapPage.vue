<script setup lang="ts">
import {
  PlAgDataTableV2,
  PlBlockPage,
  usePlDataTableSettingsV2,
} from '@platforma-sdk/ui-vue';
import { plRefsEqual } from '@platforma-sdk/model';
import { watchEffect } from 'vue';
import { useApp } from '../app';
import AnnotationModal from '../components/AnnotationModal.vue';
import BlockActions from '../components/BlockActions.vue';
import SettingsModal from '../components/SettingsModal.vue';

const app = useApp();

watchEffect(() => {
  const inputRef = app.model.args.inputAnchor;
  if (inputRef) {
    app.model.args.defaultBlockLabel = app.model.outputs.inputOptions?.find((o) => plRefsEqual(o.ref, inputRef))?.label ?? '';
  } else {
    app.model.args.defaultBlockLabel = 'Select dataset';
  }
});

const tableSettings = usePlDataTableSettingsV2({
  sourceId: () => app.model.args.inputAnchor,
  model: () => app.model.outputs.overlapTable,
});
</script>

<template>
  <PlBlockPage
    title="Overlap Clonotypes Browser"
  >
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
