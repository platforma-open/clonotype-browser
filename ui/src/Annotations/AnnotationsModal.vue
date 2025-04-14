<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  PlSlideModal,
  PlBtnGroup,
  PlBtnSecondary,
  listToOptions,
  PlIcon16,
} from '@platforma-sdk/ui-vue';
import type { AnnotationScriptUi } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import { useApp } from '../app';
import Step from './Step.vue';
import { compileAnnotationScript } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import { getDefaultAnnotationScript } from './getDefaultAnnotationScript';
import { watchDebounced } from '@vueuse/core';

const app = useApp();

const form = ref<AnnotationScriptUi>();

watch(() => app.model.ui.annotationScript, (annotationScript) => {
  if (annotationScript === undefined) {
    annotationScript = getDefaultAnnotationScript();
  }
  form.value = JSON.parse(JSON.stringify(annotationScript));
}, { immediate: true, deep: true });

watchDebounced(form, (value, oldValue) => {
  if (value && (value === oldValue)) { // same ref
    try {
      const compiled = compileAnnotationScript(value);
      app.model.ui.annotationScript = value;
      app.model.args.annotationScript = compiled;
    } catch (e) {
      console.error(e);
    }
  }
}, { deep: true, debounce: 2000 });

const addStep = () => {
  if (!form.value) {
    return;
  }

  form.value.steps.push({
    label: 'New step',
    filter: {
      type: 'and',
      filters: [],
    },
  });
};

const removeStep = (index: number) => {
  if (!form.value) {
    return;
  }
  form.value.steps = form.value.steps.filter((_, i) => i !== index);
};
</script>

<template>
  <PlSlideModal v-model="app.isAnnotationModalOpen" :close-on-outside-click="false">
    <template #title>Annotations</template>
    <template v-if="form">
      <PlBtnGroup v-model="form.mode" :options="listToOptions(['byClonotype', 'bySampleAndClonotype'])" />
      <div :class="$style.steps">
        <Step v-for="(step, i) in form.steps" :key="i" :step="step" @delete="removeStep(i)" />
        <PlBtnSecondary @click="addStep">
          <PlIcon16 name="add" style="margin-right: 8px;" />
          Add annotation
        </PlBtnSecondary>
      </div>
    </template>
  </PlSlideModal>
</template>

<style module>
.steps {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
