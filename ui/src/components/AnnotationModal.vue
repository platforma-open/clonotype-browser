<script setup lang="ts">
import { PlAnnotationsModal } from "@platforma-sdk/ui-vue";
import { useApp } from "../app";
import { getDefaultAnnotationScript } from "../utils";
import { useColumnSuggestion } from "../composition/useColumnSuggestion";
import type { AnnotationSpecUi } from "@platforma-sdk/model";

const app = useApp();
const suggest = useColumnSuggestion();

async function handleDeleteSchema() {
  Object.assign(app.model.data.annotationSpecUi, getDefaultAnnotationScript());
}

function handleUpdateAnnotation(value: AnnotationSpecUi) {
  app.model.data.annotationSpecUi = value as typeof app.model.data.annotationSpecUi;
}

function handleUpdateOpened(value: boolean) {
  app.uiState.isAnnotationModalOpen = value;
}
</script>

<template>
  <PlAnnotationsModal
    :opened="app.uiState.isAnnotationModalOpen"
    :annotation="app.model.data.annotationSpecUi"
    :columns="app.model.outputs.overlapColumns?.columns ?? []"
    :hasSelectedColumns="app.hasSelectedColumns"
    :getValuesForSelectedColumns="app.getValuesForSelectedColumns"
    :getSuggestOptions="suggest"
    :onDeleteSchema="handleDeleteSchema"
    :onUpdateAnnotation="handleUpdateAnnotation"
    :onUpdateOpened="handleUpdateOpened"
  />
</template>
