<script setup lang="ts">
import { PlAnnotationsModal } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from '../app';
import { getDefaultAnnotationScript } from '../utils';
import AnnotationCreateDialog from './AnnotationCreateDialog.vue';

const app = useApp();

// State
const hasAnnotation = computed(() => app.model.ui.annotationSpec.isCreated === true);

const openedDialog = computed({
  get: () => !hasAnnotation.value && app.isAnnotationModalOpen,
  set: (value: boolean) => (app.isAnnotationModalOpen = value),
});
const openedModal = computed({
  get: () => hasAnnotation.value && app.isAnnotationModalOpen,
  set: (value: boolean) => (app.isAnnotationModalOpen = value),
});

// Actions
function handleCreateAnnotation(props: { title: string }) {
  app.model.ui.annotationSpec.isCreated = true;
  app.model.ui.annotationSpec.title = props.title;
  app.model.ui.annotationSpec.steps = [];
}

async function handleDeleteSchema() {
  Object.assign(app.model.ui.annotationSpec, getDefaultAnnotationScript());
}

</script>

<template>
  <AnnotationCreateDialog
    v-model:opened="openedDialog"
    :onSubmit="handleCreateAnnotation"
  />
  <PlAnnotationsModal
    v-model:opened="openedModal"
    v-model:annotation="app.model.ui.annotationSpec"
    :columns="app.filterColumns"
    :hasSelectedColumns="app.hasSelectedColumns"
    :getValuesForSelectedColumns="app.getValuesForSelectedColumns"
    :onDeleteSchema="handleDeleteSchema"
  />
</template>
