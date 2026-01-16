<script setup lang="ts">
import type { PlRef } from '@platforma-sdk/model';
import { PlDropdownRef, PlSlideModal } from '@platforma-sdk/ui-vue';
import { useApp } from '../app';

const app = useApp();

function setAnchorColumn(ref: PlRef | undefined) {
  app.model.args.inputAnchor = ref;
}
</script>

<template>
  <PlSlideModal v-model="app.model.ui.settingsOpen" :close-on-outside-click="true">
    <template #title>Settings</template>
    <PlDropdownRef
      :options="app.model.outputs.inputOptions"
      :model-value="app.model.args.inputAnchor"
      label="Select dataset"
      clearable
      @update:model-value="setAnchorColumn"
    />
  </PlSlideModal>
</template>
