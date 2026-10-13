<script setup lang="ts">
import type { SampleExportSelection } from "@platforma-open/milaboratories.clonotype-browser-3.model";
import type { PlDataTableModel } from "@platforma-sdk/model";
import {
  PlAlert,
  PlBtnGhost,
  PlBtnPrimary,
  PlCheckbox,
  PlDialogModal,
  PlDropdownMulti,
} from "@platforma-sdk/ui-vue";
import { until } from "@vueuse/core";
import { computed, shallowRef, watch } from "vue";
import { useApp } from "../app";
import { exportSampleTable } from "../sampleExport";

const props = defineProps<{
  /** The sample the By sample table shows, picked when the modal opens. */
  currentSampleId: undefined | string;
}>();

const open = defineModel<boolean>({ required: true });

const app = useApp();

const allSamples = shallowRef(false);
const sampleIds = shallowRef<string[]>([]);
const exporting = shallowRef(false);
const error = shallowRef<undefined | string>();

const sampleOptions = computed(
  () =>
    app.model.outputs.sampleTableSheets?.[0]?.options.map((o) => ({
      value: String(o.value),
      label: o.label,
    })) ?? [],
);

const canExport = computed(() => allSamples.value || sampleIds.value.length > 0);

watch(open, (isOpen) => {
  if (!isOpen) return;
  allSamples.value = false;
  sampleIds.value = props.currentSampleId === undefined ? [] : [props.currentSampleId];
  error.value = undefined;
});

async function runExport() {
  const selection: SampleExportSelection = allSamples.value
    ? { type: "all" }
    : { type: "samples", sampleIds: sampleIds.value };
  exporting.value = true;
  error.value = undefined;
  try {
    app.model.data.sampleExport = selection;
    const table = await exportTableFor(selection);
    await exportSampleTable(app.services, table);
    open.value = false;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    exporting.value = false;
  }
}

/** The export table once the model has rebuilt it for `selection`. */
async function exportTableFor(selection: SampleExportSelection): Promise<PlDataTableModel> {
  const built = await until(() => builtExportTable(selection)).not.toBeUndefined();
  if (built instanceof Error) throw built;
  return built;
}

/**
 * The export table the model has built for `selection`, the error it failed
 * with, or `undefined` while it is not there yet. Reads every field it compares,
 * so a watcher re-runs when any of them changes.
 */
function builtExportTable(selection: SampleExportSelection): undefined | Error | PlDataTableModel {
  const outputError = app.model.outputErrors.sampleExportTable;
  if (outputError !== undefined) return outputError;
  const output = app.model.outputs.sampleExportTable;
  if (output === undefined || !output.ok) return undefined;
  const { selection: built, table } = output.value;
  if (!isSameSelection(built, selection) || table.visibleTableHandle === undefined)
    return undefined;
  return table;
}

function isSameSelection(a: SampleExportSelection, b: SampleExportSelection): boolean {
  if (a.type === "all" || b.type === "all") return a.type === b.type;
  return (
    a.sampleIds.length === b.sampleIds.length && a.sampleIds.every((id, i) => id === b.sampleIds[i])
  );
}
</script>

<template>
  <PlDialogModal v-model="open" :close-on-outside-click="!exporting">
    <template #title>Export samples</template>
    <div :class="$style.content">
      <PlCheckbox v-model="allSamples" :disabled="exporting">All samples</PlCheckbox>
      <PlDropdownMulti
        v-model="sampleIds"
        :options="sampleOptions"
        :disabled="allSamples || exporting"
        label="Samples"
        placeholder="Choose samples"
      />
      <PlAlert v-if="error" type="error">{{ error }}</PlAlert>
    </div>
    <template #actions>
      <PlBtnPrimary :disabled="!canExport" :loading="exporting" @click="runExport">
        Export
      </PlBtnPrimary>
      <PlBtnGhost :disabled="exporting" @click="open = false">Cancel</PlBtnGhost>
    </template>
  </PlDialogModal>
</template>

<style module>
.content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
