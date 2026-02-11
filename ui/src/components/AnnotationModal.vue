<script setup lang="ts">
import { PlAnnotationsModal } from "@platforma-sdk/ui-vue";
import { useApp } from "../app";
import { getDefaultAnnotationScript } from "../utils";
import { useColumnSuggestion } from "../composition/useColumnSuggestion";

const app = useApp();
const suggest = useColumnSuggestion();

// Actions
async function handleDeleteSchema() {
  Object.assign(app.model.ui.annotationSpec, getDefaultAnnotationScript());
}
</script>

<template>
  <PlAnnotationsModal
    v-model:opened="app.isAnnotationModalOpen"
    v-model:annotation="app.model.ui.annotationSpec"
    :columns="app.model.outputs.overlapColumns?.columns ?? []"
    :hasSelectedColumns="app.hasSelectedColumns"
    :getValuesForSelectedColumns="app.getValuesForSelectedColumns"
    :getSuggestOptions="suggest"
    :onDeleteSchema="handleDeleteSchema"
  />
</template>
