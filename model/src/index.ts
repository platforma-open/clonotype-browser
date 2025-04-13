import type {
  InferHrefType,
  PlDataTableState,
  PlRef,
  PlTableFiltersModel,
  PColumnSpec,
  DataInfo,
  TreeNodeAccessor,
  PColumn,
  SUniversalPColumnId,
  PColumnEntryUniversal,
} from '@platforma-sdk/model';
import {
  BlockModel,
  createPlDataTable,
  PColumnCollection,
  type InferOutputsType,
} from '@platforma-sdk/model';
import * as R from 'remeda';
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
  statsTable: {
    tableState: PlDataTableState;
    filterModel: PlTableFiltersModel;
  };
  annotationScript?: AnnotationScript;
};

export type SimplifiedPColumnSpec = Pick<PColumnSpec, 'valueType' | 'annotations'>;

export type SimplifiedUniversalPColumnEntry = {
  id: SUniversalPColumnId;
  label: string;
  obj: SimplifiedPColumnSpec;
};

const excludedAnnotationKeys = [
  'pl7.app/table/orderPriority',
  'pl7.app/table/visibility',
  'pl7.app/trace',
];

const simplifyColumnEntries = (
  entries: PColumnEntryUniversal[] | undefined,
): SimplifiedUniversalPColumnEntry[] | undefined => {
  if (!entries) {
    return undefined;
  }

  const ret = entries.map((entry) => {
    const filteredAnnotations = entry.spec.annotations
      ? R.omit(entry.spec.annotations, excludedAnnotationKeys)
      : undefined;

    return {
      id: entry.id,
      label: entry.label,
      obj: {
        valueType: entry.spec.valueType,
        annotations: filteredAnnotations,
      },
    };
  });

  ret.sort((a, b) => a.label.localeCompare(b.label));

  return ret;
};

export const platforma = BlockModel.create('Heavy')

  .withArgs<BlockArgs>({
    annotationScript: {
      mode: 'byClonotype',
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
    statsTable: {
      tableState: {
        gridState: {},
      },
      filterModel: {},
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

  // .output('metaColumnOptions', (ctx) => {
  //   if (ctx.args.inputAnchor === undefined)
  //     return undefined;

  //   return ctx.resultPool.getCanonicalOptions(
  //     { main: ctx.args.inputAnchor },
  //     {
  //       type: ['String', 'Int', 'Long'],
  //       axes: [{ anchor: 'main', name: 'pl7.app/sampleId' }],
  //     },
  //   );
  // })

  .output('byClonotypeColumns', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;
    const anchorCtx = ctx.resultPool.resolveAnchorCtx({ main: ctx.args.inputAnchor });
    if (!anchorCtx) return undefined;

    const entries = new PColumnCollection()
      .addColumnProvider(ctx.resultPool)
      .addAxisLabelProvider(ctx.resultPool)
      .getUniversalEntries(
        [{
          domainAnchor: 'main',
          axes: [
            { anchor: 'main', idx: 1 },
          ],
        }, {
          domainAnchor: 'main',
          axes: [
            { split: true },
            { anchor: 'main', idx: 1 },
          ],
        }],
        { anchorCtx },
      );
    return simplifyColumnEntries(entries);
  })

  .output('bySampleAndClonotypeColumns', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;
    const anchorCtx = ctx.resultPool.resolveAnchorCtx({ main: ctx.args.inputAnchor });
    if (!anchorCtx) return undefined;

    const entries = new PColumnCollection()
      .addColumnProvider(ctx.resultPool)
      .addAxisLabelProvider(ctx.resultPool)
      .getUniversalEntries(
        {
          domainAnchor: 'main',
          axes: [
            { anchor: 'main', idx: 0 },
            { anchor: 'main', idx: 1 },
          ],
        },
        { anchorCtx },
      );
    return simplifyColumnEntries(entries);
  })

  .output('mainAbundanceColumn', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;

    const ops = ctx.resultPool.getCanonicalOptions(
      { main: ctx.args.inputAnchor },
      {
        axes: [
          { anchor: 'main', idx: 0 },
          { anchor: 'main', idx: 1 },
        ],
        annotations: {
          'pl7.app/isAbundance': 'true',
          'pl7.app/abundance/normalized': 'true',
          'pl7.app/abundance/isPrimary': 'true',
        },
      },
    );
    if (ops === undefined || ops.length === 0) return undefined;
    return ops[0];
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
      }],
    ) as (PColumn<DataInfo<TreeNodeAccessor>> | PColumn<TreeNodeAccessor>)[];
    if (!columns) return undefined;

    const annotationPf = ctx.prerun?.resolve({ field: 'annotationPf', assertFieldType: 'Input', allowPermanentAbsence: true });
    if (annotationPf && annotationPf.getIsReadyOrError()) {
      const labelColumns = annotationPf.getPColumns();
      if (labelColumns) {
        columns.push(...labelColumns);
      }
    }

    return createPlDataTable(ctx, columns, ctx.uiState.tableState, {
      filters: ctx.uiState.filterModel?.filters,
    });
  })

  .output('statsTable', (ctx) => {
    const statsPf = ctx.prerun?.resolve({ field: 'statsPf', assertFieldType: 'Input', allowPermanentAbsence: true });
    if (statsPf && statsPf.getIsReadyOrError()) {
      const columns = statsPf.getPColumns();
      if (!columns) return undefined;

      const columnsAfterSplitting = new PColumnCollection()
        .addAxisLabelProvider(ctx.resultPool)
        .addColumns(columns)
        .getColumns({ axes: [{ split: true }, { }] });

      if (columnsAfterSplitting === undefined) return undefined;

      return createPlDataTable(ctx, columnsAfterSplitting, ctx.uiState.statsTable.tableState, {
        filters: ctx.uiState.statsTable.filterModel?.filters,
      });
    }
    return undefined;
  })

  // .output('filterColumn', (ctx) =>
  //   ctx.prerun?.resolve({ field: 'filterColumn', assertFieldType: 'Input', allowPermanentAbsence: true })?.getFileContentAsString())

  // .output('fullScript', (ctx) =>
  //   ctx.prerun?.resolve({ field: 'fullScript', assertFieldType: 'Input', allowPermanentAbsence: true })?.getDataAsJson())

  .sections((ctx) => {
    return [
      { type: 'link', href: '/', label: 'Main' } as const,
      ...(ctx.args.annotationScript.steps.length > 0
        ? [{ type: 'link', href: '/stats', label: 'Stats' } as const]
        : []),
    ];
  })

  .argsValid((ctx) => ctx.args.inputAnchor !== undefined && ctx.args.annotationScript.steps.length > 0)

  .title((_ctx) => 'Clonotype Browser')

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export { BlockArgs };

export * from './filter';
export * from './ui_simple';
