<script setup lang="ts">
import type { PlRef, PTableColumnSpec } from '@platforma-sdk/model';
import { plRefsEqual } from '@platforma-sdk/model';
import {
  PlBlockPage,
  PlBtnGhost,
  PlDropdownRef,
  PlSlideModal,
  PlTableFilters,
  type PlAgDataTableSettings,
  PlAgDataTableToolsPanel,
  PlAgDataTableV2 as PlAgDataTable,
} from '@platforma-sdk/ui-vue';
import { computed, ref } from 'vue';
import { useApp } from './app';
import { AnnotationsModal } from './Annotations';

const app = useApp();

function setAnchorColumn(ref: PlRef | undefined) {
  app.model.args.inputAnchor = ref;
}

const tableSettings = computed<PlAgDataTableSettings | undefined>(() =>
  app.model.args.inputAnchor
    ? {
        sourceType: 'ptable',
        model: app.model.outputs.perSampleTable,
        sheets: app.model.outputs.perSampleTableSheets,
      }
    : undefined,
);
const columns = ref<PTableColumnSpec[]>([]);
</script>

<template>
  <PlBlockPage>
    <template #title>
      Per Sample Clonotype Browser
    </template>
    <template #append>
      <PlAgDataTableToolsPanel>
        <PlTableFilters v-model="app.model.ui.perSampleTable.filterModel" :columns="columns" />
      </PlAgDataTableToolsPanel>
      <PlBtnGhost icon="settings" @click.stop="app.isAnnotationModalOpen = true">
        Annotations
      </PlBtnGhost>
      <PlBtnGhost icon="settings" @click.exact.stop="() => (app.model.ui.settingsOpen = true)">
        Settings
      </PlBtnGhost>
    </template>
    <div style="flex: 1">
      <PlAgDataTable
        ref="tableInstance"
        v-model="app.model.ui.perSampleTable.tableState"
        :settings="tableSettings"
        show-columns-panel
        show-export-button
        @columns-changed="(newColumns) => (columns = newColumns)"
      />
    </div>
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
  <AnnotationsModal />
</template>
