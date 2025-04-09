<script setup lang="ts">
import type { PTableColumnSpec } from '@platforma-sdk/model';
import {
  PlAgDataTable,
  PlBlockPage,
  PlTableFilters,
  type PlDataTableSettings,
  PlAgDataTableToolsPanel,
} from '@platforma-sdk/ui-vue';
import { computed, ref } from 'vue';
import { useApp } from './app';

const app = useApp();

const tableSettings = computed<PlDataTableSettings | undefined>(() =>
  app.model.args.annotationScript.steps.length > 0
    ? {
        sourceType: 'ptable',
        pTable: app.model.outputs.statsTable,
      }
    : undefined,
);
const columns = ref<PTableColumnSpec[]>([]);
</script>

<template>
  <PlBlockPage>
    <template #title>
      Annotation Stats{{ app.model.ui.title ? ` - ${app.model.ui.title}` : '' }}
    </template>
    <template #append>
      <PlAgDataTableToolsPanel>
        <PlTableFilters v-model="app.model.ui.statsTable.filterModel" :columns="columns" />
      </PlAgDataTableToolsPanel>
    </template>
    <div style="flex: 1">
      <PlAgDataTable
        ref="tableInstance"
        v-model="app.model.ui.statsTable.tableState"
        :settings="tableSettings"
        show-columns-panel
        show-export-button
        @columns-changed="(newColumns) => (columns = newColumns)"
      />
    </div>
  </PlBlockPage>
</template>
