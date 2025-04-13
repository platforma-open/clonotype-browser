<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { computed, watch } from 'vue';
import type { SUniversalPColumnId } from '@platforma-sdk/model';
import { PlTextField, PlDropdown, PlNumberField, PlCheckbox } from '@platforma-sdk/ui-vue';
import type { AnyForm, FilterUiType } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import { getFilterUiTypeOptions, getFilterUiMetadata } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import { useApp } from '../app';

const app = useApp();

const formData = defineModel<{
  column?: SUniversalPColumnId | undefined;
  type?: FilterUiType | undefined;
  [key: string]: any;
}>({ default: () => ({}) });

const columnSpecRef = computed(() => {
  const value = formData.value;
  if ('column' in value) {
    return app.columns.find((c) => c.id === value.column)?.obj;
  }
  return undefined;
});

const typeMetadataRef = computed(() => {
  const value = formData.value;
  if (value.type && typeof value.type === 'string') {
    return getFilterUiMetadata(value.type);
  }
  return undefined;
});

const filterUiTypeOptions = computed(() => {
  return getFilterUiTypeOptions(columnSpecRef.value);
});

const secondColumnOptions = computed(() => {
  const typeMetadata = typeMetadataRef.value;
  const columnSpec = columnSpecRef.value;
  if (typeMetadata && columnSpec) {
    return app.columns.filter((c) => typeMetadata.supportedFor(columnSpec, c.obj)).map((c) => ({
      label: c.label,
      value: c.id,
    }));
  }
  return [];
});

const props = defineProps<{
  form: AnyForm;
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
},
{ immediate: true, deep: true },
);
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
      <template v-else-if="field.fieldType === 'FilterUiType'">
        <PlDropdown
          :model-value="formData[fieldName] as string"
          :label="field.label ?? fieldName"
          :options="filterUiTypeOptions"
          @update:model-value="setFieldValue(fieldName, $event)"
        />
      </template>
      <template v-else-if="field.fieldType === 'string'">
        <PlTextField
          :model-value="formData[fieldName] as string"
          :label="field.label ?? fieldName"
          @update:model-value="setFieldValue(fieldName, $event)"
        />
      </template>
      <template v-else-if="field.fieldType === 'SUniversalPColumnId'">
        <PlDropdown
          :model-value="formData[fieldName] as string"
          :label="field.label ?? fieldName"
          :options="fieldName === 'column' ? app.columnsOptions : secondColumnOptions"
          @update:model-value="setFieldValue(fieldName, $event)"
        />
      </template>
      <template v-else-if="field.fieldType === 'number'">
        <PlNumberField
          :model-value="formData[fieldName] as number"
          :label="field.label ?? fieldName"
          @update:model-value="setFieldValue(fieldName, $event)"
        />
      </template>
      <template v-else-if="field.fieldType === 'number?'">
        <PlNumberField
          :model-value="formData[fieldName]"
          :label="field.label ?? fieldName"
          :clearable="true"
          @update:model-value="setFieldValue(fieldName, $event)"
        />
      </template>
      <template v-else-if="field.fieldType === 'boolean' || field.fieldType === 'boolean?'">
        <PlCheckbox
          :model-value="formData[fieldName] as boolean"
          :label="field.label ?? fieldName"
          @update:model-value="setFieldValue(fieldName, $event)"
        >
          {{ field.label ?? fieldName }}
        </PlCheckbox>
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
