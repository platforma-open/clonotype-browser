import type {
  InferHrefType,
  PlDataTableState,
  PlRef,
  PlTableFiltersModel } from '@platforma-sdk/model';
import {
  BlockModel,
  createPlDataTable,
  type InferOutputsType,
} from '@platforma-sdk/model';
import type { AnnotationScript } from './filter';

type BlockArgs = {
  /** Anchor column from the clonotyping output (must have sampleId and clonotypeKey axes) */
  inputAnchor?: PlRef;
  /** Annotation script to apply to the input anchor */
  annotationScript: AnnotationScript;
};

export type UiState = {
  title?: string;
  settingsOpen: boolean;
  filterModel: PlTableFiltersModel;
  tableState: PlDataTableState;
};

export const platforma = BlockModel.create('Heavy')

  .withArgs<BlockArgs>({
    annotationScript: {
      steps: [],
    },
  })

  .withUiState<UiState>({
    title: 'Clonotype Browser V2',
    settingsOpen: true,
    filterModel: {},
    tableState: {
      gridState: {},
    },
  })

  .output('inputOptions', (ctx) =>
    ctx.resultPool.getOptions([{
      axes: [
        { name: 'pl7.app/sampleId' },
        { name: 'pl7.app/vdj/clonotypeKey' },
      ],
      annotations: { 'pl7.app/isAnchor': 'true' },
    }, {
      axes: [
        { name: 'pl7.app/sampleId' },
        { name: 'pl7.app/vdj/scClonotypeKey' },
      ],
      annotations: { 'pl7.app/isAnchor': 'true' },
    }]),
  )

  .output('metaColumnOptions', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;

    return ctx.resultPool.getCanonicalOptions(
      { main: ctx.args.inputAnchor },
      {
        type: ['String', 'Int', 'Long'],
        axes: [{ anchor: 'main', name: 'pl7.app/sampleId' }],
      },
    );
  })

  .output('abundanceColumnOptions', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;

    return ctx.resultPool.getCanonicalOptions(
      { main: ctx.args.inputAnchor },
      {
        annotations: { 'pl7.app/isAbundance': 'true' },
        domainAnchor: 'main',
        axes: [
          { split: true },
          { anchor: 'main', idx: 1 },
        ],
      },
    );
  })

  .output('clonotypeColumnOptions', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;

    return ctx.resultPool.getCanonicalOptions(
      { main: ctx.args.inputAnchor },
      {
        domainAnchor: 'main',
        axes: [
          { anchor: 'main', idx: 1 },
        ],
        annotations: {
          'pl7.app/table/visibility': 'default',
        },
      },
    );
  })

  .output('table', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;

    const columns = ctx.resultPool.getAnchoredPColumns(
      { main: ctx.args.inputAnchor },
      [{
        annotations: { 'pl7.app/isAbundance': 'true' },
        domainAnchor: 'main',
        axes: [
          { split: true },
          { anchor: 'main', idx: 1 },
        ],
      }, {
        domainAnchor: 'main',
        axes: [
          { anchor: 'main', idx: 1 },
        ],
        annotations: {
          'pl7.app/table/visibility': 'default',
        },
      }],
    );
    if (!columns) return undefined;
    return createPlDataTable(ctx, columns, ctx.uiState.tableState, {
      filters: ctx.uiState.filterModel?.filters,
    });
  })

  .output('filterColumn', (ctx) =>
    ctx.prerun?.resolve({ field: 'filterColumn', assertFieldType: 'Input', allowPermanentAbsence: true })?.getFileContentAsString())

  .output('fullScript', (ctx) =>
    ctx.prerun?.resolve({ field: 'fullScript', assertFieldType: 'Input', allowPermanentAbsence: true })?.getDataAsJson())

  .sections((_ctx) => {
    return [{ type: 'link', href: '/', label: 'Main' }];
  })

  .argsValid((ctx) => false)

  .title((ctx) => 'Clonotype Browser')

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export { BlockArgs };

export * from './filter';
