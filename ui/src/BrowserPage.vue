<script setup lang="ts">
import type { PlRef, PTableColumnSpec } from '@platforma-sdk/model';
import { plRefsEqual } from '@platforma-sdk/model';
import {
  PlAgDataTable,
  PlBlockPage,
  PlBtnGhost,
  PlDropdownRef,
  PlMaskIcon24,
  PlSlideModal,
  PlTableFilters,
  type PlDataTableSettings,
  PlAgDataTableToolsPanel,
} from '@platforma-sdk/ui-vue';
import { computed, ref } from 'vue';
import { useApp } from './app';
import { generateAnnotationScript } from './demo';

const app = useApp();

function setAnchorColumn(ref: PlRef | undefined) {
  app.model.args.inputAnchor = ref;
  app.model.ui.title = ref
    ? app.model.outputs.inputOptions?.find((o) =>
      plRefsEqual(o.ref, ref),
    )?.label
    : undefined;
}

const tableSettings = computed<PlDataTableSettings | undefined>(() =>
  app.model.args.inputAnchor
    ? {
        sourceType: 'ptable',
        pTable: app.model.outputs.table,
      }
    : undefined,
);
const columns = ref<PTableColumnSpec[]>([]);

function setDemoAnnotationScript() {
  const byClonotypeColumns = app.model.outputs.byClonotypeColumns;
  const bySampleAndClonotypeColumns = app.model.outputs.bySampleAndClonotypeColumns;
  if (!byClonotypeColumns || !bySampleAndClonotypeColumns) return;

  console.dir(byClonotypeColumns, { depth: null });
  console.dir(bySampleAndClonotypeColumns, { depth: null });

  app.model.args.annotationScript = generateAnnotationScript(byClonotypeColumns, bySampleAndClonotypeColumns);
}
</script>

<template>
  <PlBlockPage>
    <template #title>
      Clonotype Browser{{ app.model.ui.title ? ` - ${app.model.ui.title}` : '' }}
    </template>
    <template #append>
      <PlAgDataTableToolsPanel>
        <PlTableFilters v-model="app.model.ui.filterModel" :columns="columns" />
      </PlAgDataTableToolsPanel>
      <PlBtnGhost @click.shift.stop="setDemoAnnotationScript" @click.exact.stop="() => (app.model.ui.settingsOpen = true)">
        Settings
        <template #append>
          <PlMaskIcon24 name="settings" />
        </template>
      </PlBtnGhost>
    </template>
    <div style="flex: 1">
      <PlAgDataTable
        ref="tableInstance"
        v-model="app.model.ui.tableState"
        :settings="tableSettings"
        show-columns-panel
        show-export-button
        @columns-changed="(newColumns) => (columns = newColumns)"
      />
    </div>
  </PlBlockPage>
  <PlSlideModal v-model="app.model.ui.settingsOpen" :close-on-outside-click="true">
    <template #title>Settings</template>
    <PlDropdownRef
      :options="app.model.outputs.inputOptions"
      :model-value="app.model.args.inputAnchor"
      label="Select dataset"
      clearable
      @update:model-value="setAnchorColumn"
    />
  </PlSlideModal>
</template>
