<script setup lang="ts">
import {
  PlAgDataTableV2,
  PlAlert,
  PlBlockPage,
  PlBtnGhost,
  usePlDataTableSettingsV2,
} from "@platforma-sdk/ui-vue";
import { computed, shallowRef } from "vue";
import { useApp } from "../app";
import AnnotationModal from "../components/AnnotationModal.vue";
import BlockActions from "../components/BlockActions.vue";
import SettingsModal from "../components/SettingsModal.vue";
import { exportSampleTable } from "../sampleExport";

const app = useApp();

const tableSettings = usePlDataTableSettingsV2({
  sourceId: () => app.model.data.inputAnchor,
  sheets: () => app.model.outputs.sampleTableSheets,
  model: () => app.model.outputs.sampleTable,
});

/**
 * The table on screen, once the model has built it for the samples picked on
 * the sheet and its data can be read.
 */
const exportTable = computed(() => {
  const output = app.model.outputs.sampleTable;
  if (output === undefined || !output.ok || !output.stable) return undefined;
  const table = output.value;
  return table?.visibleTableHandle === undefined ? undefined : table;
});

const exporting = shallowRef(false);
const exportError = shallowRef<undefined | string>();

async function runExport() {
  const table = exportTable.value;
  if (table === undefined) return;
  exporting.value = true;
  exportError.value = undefined;
  try {
    await exportSampleTable(app.services, table);
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : String(e);
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <PlBlockPage>
    <template #title>Sequence Browser</template>
    <template #append>
      <PlBtnGhost
        icon="export"
        :disabled="exportTable === undefined"
        :loading="exporting"
        @click.stop="runExport"
      >
        Export
      </PlBtnGhost>
      <BlockActions />
    </template>
    <PlAlert
      v-if="exportError"
      type="error"
      closeable
      @update:model-value="exportError = undefined"
    >
      {{ exportError }}
    </PlAlert>
    <PlAgDataTableV2
      key="sample-table"
      ref="tableInstance"
      v-model="app.model.data.sampleTableState"
      :settings="tableSettings"
    />
  </PlBlockPage>
  <SettingsModal />
  <AnnotationModal />
</template>
