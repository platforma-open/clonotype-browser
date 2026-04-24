<script setup lang="ts">
import { getRawPlatformaInstance, upgradePlDataTableStateV2 } from "@platforma-sdk/model";
import { PlBtnGhost } from "@platforma-sdk/ui-vue";
import { computed, ref } from "vue";
import { useApp } from "../app";

const app = useApp();
const exporting = ref(false);

type PTableColumnSpecLike = {
  type: "column" | "axis";
  spec?: { name?: string; annotations?: Record<string, string> };
};

function extractKey(spec: PTableColumnSpecLike | undefined): string | null {
  if (!spec || spec.type !== "column" || !spec.spec?.name) return null;
  const label = spec.spec.annotations?.["pl7.app/label"] ?? "";
  return `${spec.spec.name}\t${label}`;
}

function collectHiddenKeys(): string[] {
  const normalized = upgradePlDataTableStateV2(app.model.data.overlapTableState);
  const sourceId = normalized.pTableParams.sourceId;
  // Collect hidden ids across all cache entries as a fallback in case the
  // current sourceId entry is missing — the UI persists hidden state per
  // source, but the export should not silently drop user-hidden columns.
  const keys = new Set<string>();
  for (const entry of normalized.stateCache) {
    if (sourceId && entry.sourceId !== sourceId) continue;
    const hidden = entry.gridState?.columnVisibility?.hiddenColIds ?? [];
    for (const raw of hidden) {
      try {
        const parsed = JSON.parse(raw) as
          | { source?: PTableColumnSpecLike; labeled?: PTableColumnSpecLike }
          | PTableColumnSpecLike;
        const key =
          extractKey((parsed as { source?: PTableColumnSpecLike }).source) ??
          extractKey(parsed as PTableColumnSpecLike);
        if (key) keys.add(key);
      } catch {
        // ignore malformed entries
      }
    }
  }
  return [...keys];
}

async function exportTsv() {
  if (!app.model.data.runExportAll) {
    app.model.data.exportHiddenKeys = collectHiddenKeys();
    app.model.data.runExportAll = true;
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
    app.model.data.runExportAll = false;
  }
}

const disabled = computed(() => {
  if (!app.model.data.inputAnchor) return true;
  return app.model.data.runExportAll ? app.model.outputs.exportedTsvZip === null : false;
});

const loading = computed(() => {
  if (exporting.value) return true;
  return app.model.data.runExportAll
    ? app.model.outputs.exportedTsvZip?.handle === undefined &&
        app.model.outputs.exportedTsvZip !== null
    : false;
});
</script>

<template>
  <PlBtnGhost
    :icon="
      app.model.data.runExportAll
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
