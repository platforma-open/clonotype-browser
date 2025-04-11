<script setup lang="ts">
import type { AnnotationFilter } from '@platforma-open/milaboratories.clonotype-browser-2.model';

defineProps<{
  filter: AnnotationFilter;
}>();
</script>

<template>
  <div :class="$style['filter-form']">
    <pre>{{ filter }}</pre>
  </div>
</template>

<style module>
.filter-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  outline: 1px solid red;
  padding: 10px;
}
</style>
