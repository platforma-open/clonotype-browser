<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  PlSlideModal,
  PlBtnGroup,
  PlBtnPrimary,
  PlTextField,
  listToOptions,
  PlBtnSecondary,
} from '@platforma-sdk/ui-vue';
import type { AndFilter, AnnotationStep } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import { useApp } from '../app';
import Step from './Step.vue';
import FilterForm from './FilterForm.vue';

const app = useApp();

const currentStep = ref<{
  label: string;
  filter: AndFilter;
} | null>(null);

const a = computed({
  get() {
    return app.model.args.annotationScript;
  },
  set(value) {
    app.model.args.annotationScript = value;
  },
});

const addStep = () => {
  a.value.steps.push({
    label: 'New step',
    filter: {
      type: 'and',
      filters: [],
    },
  });
};

const removeStep = (index: number) => {
  a.value.steps = a.value.steps.filter((_, i) => i !== index);
};

const setCurrentStep = (step: AnnotationStep) => {
  if (step.filter.type === 'and') {
    currentStep.value = {
      label: step.label,
      filter: step.filter,
    };
  } else {
    alert('Not implemented');
  }
};

const addFilter = () => {
  // if (currentStep.value) {

  // }
  alert('Not implemented');
};
</script>

<template>
  <PlSlideModal v-model="app.isAnnotationModalOpen" :close-on-outside-click="false">
    <template #title>Annotations</template>
    <PlBtnGroup v-model="a.mode" :options="listToOptions(['byClonotype', 'bySampleAndClonotype'])" />
    <Step v-for="(step, i) in a.steps" :key="i" :step="step" @click.stop="setCurrentStep(step)" @delete="removeStep(i)" />
    <PlBtnPrimary @click="addStep">Add step</PlBtnPrimary>
  </PlSlideModal>
  <PlSlideModal :model-value="currentStep !== null" @update:model-value="currentStep = null">
    <template #title>Edit step</template>
    <template v-if="currentStep">
      <PlTextField v-model="currentStep.label" label="Label" />
      <FilterForm v-for="(filter, i) in currentStep.filter.filters" :key="i" :filter="filter" />
      <PlBtnSecondary icon="add" @click="addFilter">Add filter</PlBtnSecondary>
    </template>
  </PlSlideModal>
</template>
