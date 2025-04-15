<script setup lang="ts">
import type { PlRef, PTableColumnSpec } from '@platforma-sdk/model';
import { plRefsEqual } from '@platforma-sdk/model';
import {
  PlBlockPage,
  PlBtnGhost,
  PlDropdownRef,
  PlSlideModal,
  PlTableFilters,
  type PlDataTableSettings,
  PlAgDataTableToolsPanel,
} from '@platforma-sdk/ui-vue';
import { computed, ref } from 'vue';
import { useApp } from './app';
import { AnnotationsModal } from './Annotations';
import { generateAnnotationScript, generateDemo2Aging } from './demo';
import { default as PlAgDataTable } from './PlAgDataTable/PlAgDataTable.vue';

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

function setDemoAnnotationScript1() {
  const byClonotypeColumns = app.model.outputs.byClonotypeColumns;
  const bySampleAndClonotypeColumns = app.model.outputs.bySampleAndClonotypeColumns;
  if (!byClonotypeColumns || !bySampleAndClonotypeColumns) return;

  console.dir(byClonotypeColumns, { depth: null });
  console.dir(bySampleAndClonotypeColumns, { depth: null });

  app.model.args.annotationScript = generateAnnotationScript(byClonotypeColumns, bySampleAndClonotypeColumns);
}

function setDemoAnnotationScript2() {
  const mainAbundance = app.model.outputs.mainAbundanceColumn;
  if (!mainAbundance) return;

  app.model.args.annotationScript = generateDemo2Aging(mainAbundance.value);
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
      <PlBtnGhost icon="settings" @click.stop="app.isAnnotationModalOpen = true">
        Annotations
      </PlBtnGhost>
      <PlBtnGhost icon="settings" @click.shift.stop="setDemoAnnotationScript2" @click.alt.stop="setDemoAnnotationScript1" @click.exact.stop="() => (app.model.ui.settingsOpen = true)">
        Settings
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
  <AnnotationsModal />
</template>
