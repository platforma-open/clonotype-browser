<script setup lang="ts">
import { PlBtnGhost } from "@platforma-sdk/ui-vue";
import { useApp } from "../app";

withDefaults(
  defineProps<{
    showSettings?: boolean;
    showAnnotations?: boolean;
  }>(),
  {
    showSettings: true,
    showAnnotations: true,
  },
);

const app = useApp();

function openAnnotations() {
  app.uiState.isAnnotationModalOpen = true;
}

function openSettings() {
  app.model.data.settingsOpen = true;
}
</script>

<template>
  <PlBtnGhost v-if="showAnnotations" icon="annotate" @click.stop="openAnnotations">
    Annotations
  </PlBtnGhost>
  <PlBtnGhost v-if="showSettings" icon="settings" @click.stop="openSettings"> Settings </PlBtnGhost>
</template>
