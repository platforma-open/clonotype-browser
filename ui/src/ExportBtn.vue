<script setup lang="ts">
import { getRawPlatformaInstance } from '@platforma-sdk/model';
import { PlBtnGhost } from '@platforma-sdk/ui-vue';
import { ref } from 'vue';
import { useApp } from './app';

const app = useApp();
const exporting = ref(false);

async function exportTsv() {
  exporting.value = true;
  try {
    const handle = app.model.outputs.exportedTsv?.handle;
    if (handle !== undefined) {
      const pl = getRawPlatformaInstance();
      const contentArray = await pl.blobDriver.getContent(handle);
      const contentBlob = new Blob([contentArray], { type: 'text/tab-separated-values' });
      const url = URL.createObjectURL(contentBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'clones.tsv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <PlBtnGhost
    :icon="app.model.outputs.exportedTsv === null ? 'close' : 'download'"
    :disabled="app.model.outputs.exportedTsv === null"
    :loading="exporting || (app.model.outputs.exportedTsv?.handle === undefined && app.model.outputs.exportedTsv !== null)"
    @click.stop="exportTsv"
  >
    Export All
  </PlBtnGhost>
</template>
