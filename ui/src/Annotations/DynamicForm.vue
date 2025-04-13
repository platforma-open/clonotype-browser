<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { watch } from 'vue';
import { PlTextField, PlDropdown } from '@platforma-sdk/ui-vue';
import type { FormField } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import { useApp } from '../app';

const app = useApp();

const formData = defineModel<Record<string, any>>({ default: () => ({}) });

const props = defineProps<{
  form: Record<string, FormField>;
}>();

const setFieldValue = (fieldName: string, value: any) => {
  const newFormData = { ...formData.value };
  newFormData[fieldName] = value;
  formData.value = newFormData;
};

watch(() => props.form, (newForm) => {
  for (const [fieldName, field] of Object.entries(newForm)) {
    if (formData.value[fieldName] === undefined) {
      formData.value[fieldName] = field.defaultValue();
    }
  }
}, { immediate: true });
</script>

<template>
  <div v-if="form" :class="$style.form">
    <template v-for="(field, fieldName) in form" :key="fieldName">
      <template v-if="field.fieldType === 'form' && field.form">
        <DynamicForm
          :model-value="formData[fieldName]"
          :form="field.form"
          @update:model-value="setFieldValue(fieldName, $event)"
        />
      </template>
      <template v-else-if="field.fieldType === 'string'">
        <PlTextField
          :model-value="formData[fieldName] as string"
          :label="fieldName"
          @update:model-value="setFieldValue(fieldName, $event)"
        />
      </template>
      <template v-else-if="field.fieldType === 'SUniversalPColumnId'">
        <PlDropdown
          :model-value="formData[fieldName] as string"
          :label="fieldName"
          :options="app.columnsOptions"
          @update:model-value="setFieldValue(fieldName, $event)"
        />
      </template>
      <template v-else>
        <pre>TODO:{{ field.fieldType }}</pre>
      </template>
    </template>
  </div>
</template>

<style module>
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
