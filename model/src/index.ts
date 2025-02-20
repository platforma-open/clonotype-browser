import {
  AxisSpec,
  BlockModel,
  type InferHrefType,
  type InferOutputsType,
  type PColumnSpec,
  type PlDataTableState,
  PlRef,
  type PlTableFiltersModel,
  createPlDataTable,
  createPlDataTableSheet,
  getUniquePartitionKeys,
  isPColumn,
  isPColumnSpec
} from '@platforma-sdk/model';

export function getCloneIdAxis(spec: PColumnSpec): AxisSpec | undefined {
  if (
    (spec.axesSpec.length === 3 &&
      spec.axesSpec[0].name === 'pl7.app/sampleId' &&
      spec.axesSpec[1].name === 'pl7.app/vdj/chain' &&
      spec.axesSpec[2].name === 'pl7.app/vdj/cloneId') ||
    (spec.axesSpec.length === 4 &&
      spec.axesSpec[0].name === 'pl7.app/sampleId' &&
      spec.axesSpec[1].name === 'pl7.app/vdj/chain' &&
      spec.axesSpec[2].name === 'pl7.app/vdj/cloneId' &&
      spec.axesSpec[3].name === 'pl7.app/vdj/tagValueCELL')
  )
    return spec.axesSpec[2];
  if (
    spec.axesSpec.length === 3 &&
    spec.axesSpec[0].name === 'pl7.app/sampleId' &&
    spec.axesSpec[1].name === 'pl7.app/vdj/cloneId' &&
    spec.axesSpec[2].name === 'pl7.app/vdj/tagValueCELL'
  )
    return spec.axesSpec[1];
  return undefined;
}

export function isCloneColumn(spec: PColumnSpec): boolean {
  return getCloneIdAxis(spec) !== undefined;
}

export type UiState = {
  title?: string;
  settingsOpen: boolean;
  anchorColumn?: PlRef;
  filterModel: PlTableFiltersModel;
  tableState: PlDataTableState;
};

export const model = BlockModel.create()
  .withArgs({})
  .withUiState<UiState>({
    settingsOpen: true,
    filterModel: {},
    tableState: {
      gridState: {}
    }
  })
  .sections([{ type: 'link', href: '/', label: 'Browser' }])

  .retentiveOutput('inputOptions', (ctx) => {
    return ctx.resultPool.getOptions((spec) => {
      if (!isPColumnSpec(spec)) return false;
      return (
        spec.name === 'pl7.app/vdj/sequence' &&
        spec.domain?.['pl7.app/vdj/feature'] === 'CDR3' &&
        spec.domain?.['pl7.app/alphabet'] === 'nucleotide'
      );
    });
  })

  .output('sheets', (ctx) => {
    if (!ctx.uiState?.anchorColumn) return undefined;

    const anchor = ctx.resultPool.getPColumnByRef(ctx.uiState.anchorColumn);
    if (!anchor) return undefined;

    const r = getUniquePartitionKeys(anchor.data);
    if (!r) return undefined;
    return r.map((values, i) => createPlDataTableSheet(ctx, anchor.spec.axesSpec[i], values));
  })

  .output('pt', (ctx) => {
    const anchorColumn = ctx.uiState?.anchorColumn;
    if (!anchorColumn) return undefined;

    // wait until sheet filters are set
    const sheetFilters = ctx.uiState.tableState.pTableParams?.filters;
    if (!sheetFilters) return undefined;

    const anchorSpec = ctx.resultPool.getSpecByRef(anchorColumn);
    if (!anchorSpec || !isPColumnSpec(anchorSpec)) {
      return undefined;
    }

    const anchorCloneId = getCloneIdAxis(anchorSpec);
    if (!anchorCloneId) {
      return undefined;
    }

    const columns = ctx.resultPool
      .getData()
      .entries.map((o) => o.obj)
      .filter(isPColumn)
      .filter((col) => {
        if (!isPColumnSpec(col.spec)) return false;

        const cloneId = getCloneIdAxis(col.spec);
        if (!cloneId) return false;
        return cloneId.domain?.['pl7.app/blockId'] === anchorCloneId.domain?.['pl7.app/blockId'];
      });

    return createPlDataTable(ctx, columns, ctx.uiState.tableState, {
      filters: ctx.uiState.filterModel?.filters
    });
  })

  .title((ctx) =>
    ctx.uiState?.title ? `Clonotype Browser - ${ctx.uiState?.title}` : 'Clonotype Browser'
  )

  .done();

export type BlockOutputs = InferOutputsType<typeof model>;

export type NavigationHref = InferHrefType<typeof model>;
