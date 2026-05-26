<script setup lang="ts">
import { PlDropdownRef, PlSlideModal } from "@platforma-sdk/ui-vue";
import { computed } from "vue";
import { useApp } from "../app";

const app = useApp();

// Dataset anchor options for the input dropdown — translate `getColumnOptions`
// `{ id, label }` shape into `{ value, label }` accepted by `PlDropdownRef`'s
// generic `ListOption<M>` slot.
const inputAnchorOptions = computed(() =>
  app.model.outputs.inputOptions?.map((o) => ({ value: o.id, label: o.label })),
);
</script>

<template>
  <PlSlideModal v-model="app.model.data.settingsOpen" :close-on-outside-click="true">
    <template #title>Settings</template>
    <PlDropdownRef
      v-model="app.model.data.inputAnchor"
      :options="inputAnchorOptions"
      label="Select dataset"
      clearable
    />
  </PlSlideModal>
</template>
