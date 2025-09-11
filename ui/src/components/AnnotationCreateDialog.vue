<script setup lang="ts">
import { PlBtnGhost, PlBtnPrimary, PlDialogModal, PlTextField } from '@platforma-sdk/ui-vue';
import { computed, ref } from 'vue';

// Models
const opened = defineModel<boolean>('opened', { required: true });
// Props
const props = defineProps<{
  onSubmit: (props: { title: string }) => void;
}>();

const modalState = ref({
  title: '',
});

const isValidForm = computed(() => {
  return modalState.value.title.length > 3;
});

const handleSubmit = () => {
  if (isValidForm.value) {
    props.onSubmit(modalState.value);
  }
};

const handleCancel = () => {
  opened.value = false;
};
</script>

<template>
  <PlDialogModal v-model="opened" width="600px">
    <template #title>
      Set the Annotation Scheme title
    </template>
    <template #default>
      <PlTextField
        v-model="modalState.title"
        label="Name your Scheme"
        min-length="3"
        max-length="40"
        placeholder="Annotation Name"
        autofocus
        required
      />
    </template>
    <template #actions>
      <PlBtnPrimary :disabled="!isValidForm" @click.stop="handleSubmit">Apply</PlBtnPrimary>
      <PlBtnGhost @click.stop="handleCancel">Cancel</PlBtnGhost>
    </template>
  </PlDialogModal>
</template>
