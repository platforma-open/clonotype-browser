<script setup lang="ts">
import { PlBtnGhost } from "@platforma-sdk/ui-vue";
import { useApp } from "../app";
import ExportBtn from "./ExportBtn.vue";

withDefaults(
  defineProps<{
    showExport?: boolean;
    showSettings?: boolean;
    showAnnotations?: boolean;
  }>(),
  {
    showExport: false,
    showSettings: true,
    showAnnotations: true,
  },
);

const app = useApp();

function openAnnotations() {
  app.isAnnotationModalOpen = true;
}

function openSettings() {
  app.model.ui.settingsOpen = true;
}
</script>

<template>
  <ExportBtn v-if="showExport" />
  <PlBtnGhost v-if="showAnnotations" icon="annotate" @click.stop="openAnnotations">
    Annotations
  </PlBtnGhost>
  <PlBtnGhost v-if="showSettings" icon="settings" @click.stop="openSettings"> Settings </PlBtnGhost>
</template>
