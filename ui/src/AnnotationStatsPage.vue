<script setup lang="ts">
import { canonicalizeJson, type PTableColumnSpec } from '@platforma-sdk/model';
import {
  PlBlockPage,
  PlTableFilters,
  type PlDataTableSettingsV2,
  PlAgDataTableToolsPanel,
  PlBtnGhost,
  PlAgDataTableV2,
} from '@platforma-sdk/ui-vue';
import { computed, ref } from 'vue';
import { useApp } from './app';
import AnnotationsModal from './Annotations/AnnotationsModal.vue';

const app = useApp();

const tableSettings = computed<PlDataTableSettingsV2>(() =>
  app.model.args.annotationScript.steps.length > 0
    ? {
        sourceId: canonicalizeJson(app.model.args.annotationScript.steps),
        sheets: [],
        model: app.model.outputs.statsTable,
      }
    : { sourceId: null },
);
const columns = ref<PTableColumnSpec[]>([]);
</script>

<template>
  <PlBlockPage>
    <template #title>
      Annotation Stats - {{ app.model.args.annotationScript.title }}
    </template>
    <template #append>
      <PlAgDataTableToolsPanel>
        <PlTableFilters v-model="app.model.ui.statsTable.filterModel" :columns="columns" />
      </PlAgDataTableToolsPanel>
      <PlBtnGhost icon="settings" @click.stop="app.isAnnotationModalOpen = true">
        Annotations
      </PlBtnGhost>
    </template>
    <div style="flex: 1">
      <PlAgDataTableV2
        ref="tableInstance"
        v-model="app.model.ui.statsTable.tableState"
        :settings="tableSettings"
        show-columns-panel
        show-export-button
        @columns-changed="(info) => (columns = info.columns)"
      />
    </div>
  </PlBlockPage>
  <AnnotationsModal />
</template>
