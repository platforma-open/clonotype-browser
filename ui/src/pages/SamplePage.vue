<script setup lang="ts">
import { upgradePlDataTableStateV2 } from "@platforma-sdk/model";
import {
  PlAgDataTableV2,
  PlBlockPage,
  PlBtnGhost,
  usePlDataTableSettingsV2,
} from "@platforma-sdk/ui-vue";
import { computed, shallowRef } from "vue";
import { useApp } from "../app";
import AnnotationModal from "../components/AnnotationModal.vue";
import BlockActions from "../components/BlockActions.vue";
import SampleExportModal from "../components/SampleExportModal.vue";
import SettingsModal from "../components/SettingsModal.vue";

const app = useApp();

const exportOpen = shallowRef(false);

const tableSettings = usePlDataTableSettingsV2({
  sourceId: () => app.model.data.inputAnchor,
  sheets: () => app.model.outputs.sampleTableSheets,
  model: () => app.model.outputs.sampleTable,
});

/** The sample the table's sheet shows: the user's pick, else the sheet's default. */
const currentSampleId = computed(() => {
  const state = upgradePlDataTableStateV2(app.model.data.sampleTableState);
  const sourceId = state.pTableParams.sourceId;
  const picked = state.stateCache.find((e) => e.sourceId === sourceId)?.sheetsState[0]?.value;
  const sheet = app.model.outputs.sampleTableSheets?.[0];
  const value = picked ?? sheet?.defaultValue ?? sheet?.options[0]?.value;
  return value === undefined ? undefined : String(value);
});
</script>

<template>
  <PlBlockPage>
    <template #title>Sequence Browser</template>
    <template #append>
      <PlBtnGhost
        icon="export"
        :disabled="!app.model.outputs.sampleTableSheets"
        @click.stop="exportOpen = true"
      >
        Export
      </PlBtnGhost>
      <BlockActions />
    </template>
    <PlAgDataTableV2
      key="sample-table"
      ref="tableInstance"
      v-model="app.model.data.sampleTableState"
      :settings="tableSettings"
    />
  </PlBlockPage>
  <SampleExportModal v-model="exportOpen" :current-sample-id="currentSampleId" />
  <SettingsModal />
  <AnnotationModal />
</template>
