<script setup lang="ts">
import type { AnnotationStep } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import { PlBtnDanger } from '@platforma-sdk/ui-vue';

defineEmits<{
  (e: 'delete'): void;
}>();

defineProps<{
  step: AnnotationStep;
}>();
</script>

<template>
  <div :class="$style.step" class="text-s">
    <span>{{ step.label }}</span>
    <PlBtnDanger @click.stop="$emit('delete')">Delete</PlBtnDanger>
  </div>
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
