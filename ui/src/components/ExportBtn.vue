<script setup lang="ts">
import { getRawPlatformaInstance } from "@platforma-sdk/model";
import { PlBtnGhost } from "@platforma-sdk/ui-vue";
import { computed, ref } from "vue";
import { useApp } from "../app";

const app = useApp();
const exporting = ref(false);

async function exportTsv() {
  if (!app.model.args.runExportAll) {
    app.model.args.runExportAll = true;
    return;
  }
  exporting.value = true;
  try {
    const handle = app.model.outputs.exportedTsvZip?.handle;
    if (handle !== undefined) {
      const pl = getRawPlatformaInstance();
      const contentArray = (await pl.blobDriver.getContent(handle)) as BlobPart;
      const contentBlob = new Blob([contentArray], { type: "application/zip" });
      const url = URL.createObjectURL(contentBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "clones.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } finally {
    exporting.value = false;
  }
}

const disabled = computed(() => {
  return app.model.args.runExportAll ? app.model.outputs.exportedTsvZip === null : false;
});

const loading = computed(() => {
  if (exporting.value) return true;
  return app.model.args.runExportAll
    ? app.model.outputs.exportedTsvZip?.handle === undefined &&
        app.model.outputs.exportedTsvZip !== null
    : false;
});
</script>

<template>
  <PlBtnGhost
    :icon="
      app.model.args.runExportAll
        ? app.model.outputs.exportedTsvZip === null
          ? 'close'
          : 'download'
        : 'play'
    "
    :disabled="disabled"
    :loading="loading"
    @click.stop="exportTsv"
  >
    Export All
  </PlBtnGhost>
</template>
