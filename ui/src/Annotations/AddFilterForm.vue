<script setup lang="ts">
import { computed, ref } from 'vue';
import type { FilterUiType, FormField } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import type { SimplifiedUniversalPColumnEntry } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import { PlDropdown, PlBtnPrimary, type ListOption } from '@platforma-sdk/ui-vue';
import { filterUiMetadata, getFilterUiMetadata } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import DynamicForm from './DynamicForm.vue';
import { useApp } from '../app';

const emit = defineEmits<{
  (e: 'save-filter', filter: Record<string, unknown>): void;
}>();

const app = useApp();

const selectedColumn = ref<SimplifiedUniversalPColumnEntry>();
const selectedFilterType = ref<FilterUiType>();

const columnsOptions = computed(() => app.columns.map((c) => ({ label: c.label, value: c })));

const metadata = computed(() => {
  if (!selectedFilterType.value) {
    return undefined;
  }
  return getFilterUiMetadata(selectedFilterType.value);
});

const form = computed(() => {
  return metadata.value?.form;
});

const availableFilters = computed<ListOption<FilterUiType>[]>(() => {
  const spec = selectedColumn.value?.obj;
  if (!spec) {
    return [];
  }
  return Object.entries(filterUiMetadata)
    .filter(([_type, it]) => it.supportedFor(spec))
    .map(([type, it]) => ({ label: it.label, value: type as FilterUiType }));
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const localModel = ref<Record<keyof any, unknown>>({});

const saveFilter = () => {
  emit('save-filter', localModel.value);
};
</script>

<template>
  <div :class="$style['filter-form']">
    <PlDropdown v-model="selectedColumn" label="Column" :options="columnsOptions" />
    <PlDropdown v-model="selectedFilterType" label="Filter" :options="availableFilters" />
    <template v-if="form">
      <DynamicForm v-model="localModel" :form="form as Record<string, FormField>" />
    </template>
    <pre>{{ localModel }}</pre>
    <PlBtnPrimary @click="saveFilter">Save filter</PlBtnPrimary>
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
    font-size: 8px;
    overflow: auto;
    max-height: 100px;
  }
}
</style>
