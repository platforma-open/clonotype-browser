<script setup lang="ts">
import { PlDropdownRef, PlSlideModal } from "@platforma-sdk/ui-vue";
import { useApp } from "../app";

const app = useApp();
</script>

<template>
  <PlSlideModal v-model="app.model.ui.settingsOpen" :close-on-outside-click="true">
    <template #title>Settings</template>
    <PlDropdownRef
      v-model="app.model.args.inputAnchor"
      :options="app.model.outputs.inputOptions"
      label="Select dataset"
      clearable
    />
  </PlSlideModal>
</template>
