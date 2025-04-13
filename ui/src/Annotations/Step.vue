<script setup lang="ts">
import { ref } from 'vue';
import type { AnnotationStepUi, FilterUi } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import { PlBtnDanger, PlSlideModal, PlTextField, PlBtnSecondary } from '@platforma-sdk/ui-vue';
import FilterForm from './FilterForm.vue';
import AddFilterForm from './AddFilterForm.vue';

defineEmits<{
  (e: 'delete'): void;
}>();

const props = defineProps<{
  step: AnnotationStepUi;
}>();

const isEditStepModalOpen = ref(false);
const isAddFilterModalOpen = ref(false);

const addFilter = () => {
  isAddFilterModalOpen.value = true;
};

const saveFilter = (filter: Record<string, unknown>) => {
  props.step.filter.filters.push(filter as FilterUi);
  isAddFilterModalOpen.value = false;
};

const updateFilter = (index: number, filter: FilterUi) => {
  console.log('updateFilter', index, filter);
  props.step.filter.filters[index] = filter;
};
</script>

<template>
  <div :class="$style.step" class="text-s" @click.stop="isEditStepModalOpen = true">
    <span>{{ step.label }}</span>
    <PlBtnDanger @click.stop="$emit('delete')">Delete</PlBtnDanger>
  </div>
  <PlSlideModal v-model="isEditStepModalOpen" :close-on-outside-click="false">
    <template #title>Edit step 2</template>
    <template v-if="step">
      <PlTextField v-model="step.label" label="Label" />
      <FilterForm v-for="(filter, i) in step.filter.filters" :key="i" :model-value="filter" @update:model-value="updateFilter(i, $event)" />
      <PlBtnSecondary icon="add" @click.stop="addFilter">Add filter</PlBtnSecondary>
    </template>
  </PlSlideModal>
  <PlSlideModal v-model="isAddFilterModalOpen" :close-on-outside-click="false">
    <template #title>Add filter</template>
    <AddFilterForm @save-filter="saveFilter" />
  </PlSlideModal>
</template>

<style module>
.step {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 320px;
  height: 40px;
  padding: 0 16px;
  flex-shrink: 0;

  border-radius: 6px;
  border: 1px solid #e1e3eb;
  background: #f7f8fa;
}
</style>
