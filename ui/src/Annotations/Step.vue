<script setup lang="ts">
import { onUnmounted, ref, useTemplateRef } from 'vue';
import type { AnnotationStepUi, FilterUi } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import { PlSlideModal, PlTextField, PlBtnPrimary, PlBtnSecondary, PlBtnDanger, PlIcon24 } from '@platforma-sdk/ui-vue';
import FilterCard from './FilterCard.vue';
import AddFilterForm from './AddFilterForm.vue';

const emit = defineEmits<{
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

const updateFilter = (index: number, filter: FilterUi) => {
  console.log('updateFilter', index, filter);
  props.step.filter.filters[index] = filter;
};

const deleteFilter = (index: number) => {
  props.step.filter.filters.splice(index, 1);
};

const addFilterModal = useTemplateRef('addFilterModal');

const saveFilter = () => {
  const filter = addFilterModal.value?.localModel;
  if (!filter) {
    return;
  }
  props.step.filter.filters.push(filter as FilterUi);
  isAddFilterModalOpen.value = false;
};

const deleteStep = () => {
  emit('delete');
  isEditStepModalOpen.value = false;
  isAddFilterModalOpen.value = false;
};

onUnmounted(() => {
  isEditStepModalOpen.value = false;
  isAddFilterModalOpen.value = false;
});
</script>

<template>
  <div :class="$style.step" class="text-s" @click.stop="isEditStepModalOpen = true">
    <span>{{ step.label }}</span>
    <PlIcon24 name="chevron-right" />
  </div>
  <PlSlideModal v-model="isEditStepModalOpen" :close-on-outside-click="false">
    <template #title>{{ step.label }}</template>
    <template v-if="step">
      <PlTextField v-model="step.label" label="Label" />
      <div :class="$style.filters">
        <FilterCard
          v-for="(filter, i) in step.filter.filters"
          :key="i"
          :model-value="filter"
          @update:model-value="updateFilter(i, $event)"
          @delete="deleteFilter(i)"
        />
        <PlBtnSecondary icon="add" @click.stop="addFilter">Add filter</PlBtnSecondary>
      </div>
    </template>
    <template #actions>
      <PlBtnDanger icon="close" @click="deleteStep">Delete step</PlBtnDanger>
    </template>
  </PlSlideModal>
  <PlSlideModal v-model="isAddFilterModalOpen" :close-on-outside-click="false">
    <template #title>Add filter</template>
    <AddFilterForm v-if="isAddFilterModalOpen" ref="addFilterModal" @close="isAddFilterModalOpen = false" />
    <template #actions>
      <PlBtnPrimary @click="saveFilter">Save filter</PlBtnPrimary>
      <PlBtnSecondary @click="isAddFilterModalOpen = false">Cancel</PlBtnSecondary>
    </template>
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
  flex-shrink: 0;
  padding: 8px 12px;
  gap: 8px;
  align-self: stretch;
  cursor: pointer;

  border-radius: 6px;
  border: 1px solid #E1E3EB;
  background: #F7F8FA;

  &:hover {
    background: #fff;
  }
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
