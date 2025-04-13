<script setup lang="ts">
import { computed } from 'vue';
import type { FilterUi, FormField } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import { getFilterUiMetadata } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import DynamicForm from './DynamicForm.vue';

const model = defineModel<FilterUi>({ default: () => ({}) });

const form = computed(() => {
  return getFilterUiMetadata(model.value.type).form;
});
</script>

<template>
  <div :class="$style['filter-form']">
    <DynamicForm v-model="model" :form="form as Record<string, FormField>" />
  </div>
</template>

<style module>
.filter-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  outline: 1px solid #ccc;
  padding: 10px;
  pre {
    max-width: 100%;
    overflow: auto;
  }
}
</style>
