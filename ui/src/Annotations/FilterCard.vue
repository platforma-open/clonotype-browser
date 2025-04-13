<script setup lang="ts">
import { computed, ref } from 'vue';
import { useApp } from '../app';
import type { FilterUi, AnyForm } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import { getFilterUiMetadata } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import DynamicForm from './DynamicForm.vue';
import { PlIcon16, PlMaskIcon16 } from '@platforma-sdk/ui-vue';

defineEmits<{
  (e: 'delete'): void;
}>();

const app = useApp();

const model = defineModel<FilterUi>({ default: () => ({}) });

const isExpanded = ref(false);

const columnLabel = computed(() => {
  return app.columnsOptions.find((c) => {
    if ('column' in model.value) {
      return c.value === model.value.column;
    }
    return false;
  })?.label ?? model.value.type;
});

const form = computed(() => {
  return getFilterUiMetadata(model.value.type).form as AnyForm;
});
</script>

<template>
  <div :class="$style.card">
    <div :class="[$style.header, { [$style.expanded]: isExpanded }]" @click="isExpanded = !isExpanded">
      <div :class="$style.icon">
        <PlIcon16 v-if="!isExpanded" name="chevron-right" />
        <PlIcon16 v-else name="chevron-down" />
      </div>
      <div>{{ columnLabel }}</div>
      <PlMaskIcon16 :class="$style.delete" name="close" @click.stop="$emit('delete')" />
    </div>
    <div v-if="isExpanded" :class="$style.content">
      <DynamicForm v-model="model" :form="form" />
    </div>
  </div>
</template>

<style module>
.card {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: 6px;
  border: 1px solid #E1E3EB;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  min-height: 40px;
  padding: 0 12px;
  cursor: pointer;
  border-radius: 6px 6px 0 0;
  overflow: hidden;
  color: var(--txt-01, #110529);
  font-size: 14px;
  font-weight: 600;
  user-select: none;
  &.expanded {
    background: linear-gradient(180deg, #EBFFEB 0%, #FFF 100%);
    border-bottom: 1px solid #E1E3EB;
  }
}

.content {
  padding: 24px;
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  min-height: 16px;
}

.delete {
  margin-left: auto;
  cursor: pointer;
  background-color: #CFD1DB;
  &:hover {
    background-color: var(--txt-01);
  }
}
</style>
