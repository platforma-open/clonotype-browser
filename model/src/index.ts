import type {
  AnchoredPColumnSelector,
  InferHrefType,
  InferOutputsType,
  PColumn,
  PColumnDataUniversal,
  PColumnEntryUniversal,
  PlDataTableStateV2,
  PlRef,
  PObjectId,
  SimplifiedUniversalPColumnEntry,
} from '@platforma-sdk/model';
import {
  BlockModel,
  createPlDataTableStateV2,
  createPlDataTableV2,
  PColumnCollection,
} from '@platforma-sdk/model';
import omit from 'lodash.omit';
import type { AnnotationSpec, AnnotationSpecUi } from './types';

type BlockArgs = {
  inputAnchor?: PlRef;
  datasetTitle?: string;
  annotationSpec: AnnotationSpec;
};

export type UiState = {
  settingsOpen: boolean;
  overlapTable: {
    tableState: PlDataTableStateV2;
  };
  statsTable: {
    tableState: PlDataTableStateV2;
  };
  annotationSpec: AnnotationSpecUi;
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
      ? omit(entry.spec.annotations, excludedAnnotationKeys)
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

const commonExcludes: AnchoredPColumnSelector[] = [
  { name: 'pl7.app/vdj/sequence/annotation' },
  { annotations: { 'pl7.app/isSubset': 'true' } },
];

export const platforma = BlockModel.create('Heavy')

  .withArgs<BlockArgs>({
    annotationSpec: {
      title: 'My Annotation',
      steps: [],
    },
  })

  .withUiState<UiState>({
    settingsOpen: true,
    overlapTable: {
      tableState: createPlDataTableStateV2(),
    },
    statsTable: {
      tableState: createPlDataTableStateV2(),
    },
    annotationSpec: {
      isCreated: false,
      title: 'My Annotation',
      steps: [],
    } satisfies AnnotationSpecUi,
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
    }], {
      refsWithEnrichments: true,
    }),
  )

  .output('overlapColumns', (ctx) => {
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
          annotations: {
            'pl7.app/isAbundance': 'true',
          },
        }],
        { anchorCtx },
      );
    return {
      columns: simplifyColumnEntries(entries),
      pFrame: ctx.createPFrame(entries
        ?.map((e) => {
          return {
            id: e.id as PObjectId,
            spec: e.spec,
            data: e.data(),
          };
        }).filter((e): e is PColumn<PColumnDataUniversal> => e.data !== undefined) ?? []),
    };
  })

  .output('overlapTable', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;

    const anchorCtx = ctx.resultPool.resolveAnchorCtx({ main: ctx.args.inputAnchor });
    if (!anchorCtx) return undefined;

    const collection = new PColumnCollection();

    const annotation = ctx.prerun?.resolve({ field: 'annotationPf', assertFieldType: 'Input', allowPermanentAbsence: true })?.getPColumns();
    if (annotation) collection.addColumns(annotation);

    // result pool is added after the pre-run ouptus so that pre-run results take precedence
    collection
      .addColumnProvider(ctx.resultPool)
      .addAxisLabelProvider(ctx.resultPool);

    const columns = collection.getColumns(
      [{
        domainAnchor: 'main',
        axes: [
          { split: true },
          { anchor: 'main', idx: 1 },
        ],
        annotations: {
          'pl7.app/isAbundance': 'true',
        },
      }, {
        domainAnchor: 'main',
        axes: [
          { anchor: 'main', idx: 1 },
        ],
      }],
      { anchorCtx, exclude: commonExcludes },
    );

    if (!columns) return undefined;

    return createPlDataTableV2(
      ctx,
      columns,
      ctx.uiState.overlapTable.tableState,
    );
  })

  .output('statsTable', (ctx) => {
    const allColumns = [];
    const annotationStatsPf = ctx.prerun?.resolve({ field: 'annotationStatsPf', assertFieldType: 'Input', allowPermanentAbsence: true });
    if (annotationStatsPf && annotationStatsPf.getIsReadyOrError()) {
      const columns = annotationStatsPf.getPColumns();
      if (columns) {
        allColumns.push(columns);
      }
    }
    const sampleStatsPf = ctx.prerun?.resolve({ field: 'sampleStatsPf', assertFieldType: 'Input', allowPermanentAbsence: true });
    if (sampleStatsPf && sampleStatsPf.getIsReadyOrError()) {
      const columns = sampleStatsPf.getPColumns();
      if (columns) {
        allColumns.push(columns);
      }
    }

    if (allColumns.length !== 2) return undefined;

    const collection = new PColumnCollection()
      .addAxisLabelProvider(ctx.resultPool);

    for (const cols of allColumns) {
      collection.addColumns(cols);
    }

    const columnsAfterSplitting = collection
      .getColumns([
        // annotationStatsPf without split
        { axes: [{}] },
        // sampleStatsPf with split sampleId
        { axes: [{ split: true }, {}] },
      ]);

    if (columnsAfterSplitting === undefined) return undefined;

    return createPlDataTableV2(
      ctx,
      columnsAfterSplitting,
      ctx.uiState.statsTable.tableState,
    );
  })

  .output('exportedTsvZip', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;
    const tsvResource = ctx.prerun?.resolve({ field: 'tsvZip', assertFieldType: 'Input', allowPermanentAbsence: true });
    if (!tsvResource) return undefined;
    if (!tsvResource.getIsReadyOrError())
      return undefined;
    if (tsvResource.resourceType.name === 'Null')
      return null;
    return tsvResource.getRemoteFileHandle();
  })

  .sections((ctx) => {
    return [
      { type: 'link', href: '/', label: 'Annotation' } as const,
      ...(ctx.args.annotationSpec.steps.length > 0
        ? [{ type: 'link', href: '/stats', label: 'Stats' } as const]
        : []),
    ];
  })

  .argsValid((ctx) => ctx.args.inputAnchor !== undefined && ctx.args.annotationSpec.steps.length > 0)

  // We enrich the input, only if we produce annotations
  .enriches((args) => args.inputAnchor !== undefined && args.annotationSpec.steps.length > 0 ? [args.inputAnchor] : [])

  .title((ctx) => ctx.args.annotationSpec.steps.length > 0
    ? `Annotation - ${ctx.args.annotationSpec.title}`
    : ctx.args.datasetTitle
      ? `Clonotype Browser - ${ctx.args.datasetTitle}`
      : 'Clonotype Browser')

  .done(2);

export type Platforma = typeof platforma;

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export * from './types';
export type { BlockArgs };

