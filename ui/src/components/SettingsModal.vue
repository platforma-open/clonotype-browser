<script setup lang="ts">
import {
  plRefToUniversalId,
  universalIdToPlRef,
} from "@platforma-open/milaboratories.clonotype-browser-3.model";
import type { DatasetSelection } from "@platforma-sdk/model";
import { createDatasetSelection, createPrimaryRef } from "@platforma-sdk/model";
import { PlDatasetSelector, PlSlideModal } from "@platforma-sdk/ui-vue";
import { computed } from "vue";
import { useApp } from "../app";

const app = useApp();

// The selector picks a dataset, or a dataset narrowed by one of its subset columns. Clearing
// it clears both.
const datasetSelection = computed<DatasetSelection | undefined>({
  get: () => {
    const { inputAnchor, filterRef } = app.model.data;
    const dataset = inputAnchor === undefined ? undefined : universalIdToPlRef(inputAnchor);
    if (dataset === undefined) return undefined;
    const filter = filterRef === undefined ? undefined : universalIdToPlRef(filterRef);
    return createDatasetSelection(createPrimaryRef(dataset, filter));
  },
  set: (selection) => {
    const dataset = selection?.primary.column;
    const filter = selection?.primary.filter;
    app.model.data.inputAnchor = dataset === undefined ? undefined : plRefToUniversalId(dataset);
    app.model.data.filterRef = filter === undefined ? undefined : plRefToUniversalId(filter);
  },
});
</script>

<template>
  <PlSlideModal v-model="app.model.data.settingsOpen" :close-on-outside-click="true">
    <template #title>Settings</template>
    <PlDatasetSelector
      v-model="datasetSelection"
      :options="app.model.outputs.datasetOptions"
      label="Select dataset"
      clearable
    />
  </PlSlideModal>
</template>
