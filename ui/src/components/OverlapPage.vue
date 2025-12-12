<script setup lang="ts">
import type { PlRef } from '@platforma-sdk/model';

import { isAnnotationScriptValid } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import {
  PlAgDataTableV2,
  PlAlert,
  PlAnnotationsModal,
  PlBlockPage,
  PlBtnGhost,
  PlDropdownRef,
  PlSlideModal,
  usePlDataTableSettingsV2,
} from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from '../app';
import ExportBtn from './ExportBtn.vue';

const app = useApp();

const isScriptValid = computed(() => isAnnotationScriptValid(app.model.args.annotationScript));

function setAnchorColumn(ref: PlRef | undefined) {
  app.model.args.inputAnchor = ref;
}

const tableSettings = usePlDataTableSettingsV2({
  sourceId: () => app.model.args.inputAnchor,
  model: () => app.model.outputs.overlapTable,
});
</script>

<template>
  <PlBlockPage>
    <template #title>
      Overlap Clonotypes Browser
    </template>
    <template #append>
      <ExportBtn />
      <PlBtnGhost icon="settings" @click.stop="app.isAnnotationModalOpen = true">
        Annotations
      </PlBtnGhost>
      <PlBtnGhost icon="settings" @click.exact.stop="() => (app.model.ui.settingsOpen = true)">
        Settings
      </PlBtnGhost>
    </template>
    <PlAlert v-if="!isScriptValid" type="warn">
      {{ "Warning: When annotating in 'Per Sample' mode, at least one filter must use a property that is specific to each sample. Please adjust your filter settings." }}
    </PlAlert>
    <PlAgDataTableV2
      ref="tableInstance"
      v-model="app.model.ui.overlapTable.tableState"
      v-model:selection="app.selectedColumns"
      :settings="tableSettings"
    />
  </PlBlockPage>
  <PlSlideModal v-model="app.model.ui.settingsOpen" :close-on-outside-click="true">
    <template #title>Settings</template>
    <PlDropdownRef
      :options="app.model.outputs.inputOptions"
      :model-value="app.model.args.inputAnchor"
      label="Select dataset"
      clearable
      @update:model-value="setAnchorColumn"
    />
  </PlSlideModal>
  <PlAnnotationsModal
    v-model:annotation="app.model.ui.annotationScript"
    v-model:opened="app.isAnnotationModalOpen"
    :columns="app.filterColumns"
    :hasSelectedColumns="app.hasSelectedColumns"
    :getValuesForSelectedColumns="app.getValuesForSelectedColumns"
    :getSuggestOptions="app.getSuggestOptions"
  />
</template>
