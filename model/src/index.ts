import type {
  AxesSpec,
  InferHrefType,
  InferOutputsType,
  PColumnEntryUniversal,
  PlDataTableStateV2,
  PlRef,
} from '@platforma-sdk/model';
import {
  Annotation,
  BlockModel,
  canonicalizeJson,
  createPlDataTableStateV2,
  createPlDataTableV2,
  PColumnCollection,
  PColumnName,
} from '@platforma-sdk/model';
import type { AnnotationSpec, AnnotationSpecUi } from './types';
import {
  addLinkedColumnsToArray,
  commonExcludes,
  getLinkedColumnsForArgs,
  type LinkedColumnEntry,
} from './column_utils';

export type { LinkedColumnEntry } from './column_utils';

export type TableInputs = {
  byClonotypeLabels: Record<string, string>; // Map from deterministic column key (name|domain) to derived label
  linkedColumns: Record<string, LinkedColumnEntry>;
};

type BlockArgs = {
  inputAnchor?: PlRef;
  datasetTitle?: string;
  annotationSpec: AnnotationSpec;
  /** Enables export all */
  runExportAll: boolean;
  /** Table export inputs: labels and linked columns */
  tableInputs?: TableInputs;
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

function getLabelColumns(entries: PColumnEntryUniversal[]) {
  const labelColumns: PColumnEntryUniversal[] = [];

  for (const entry of entries) {
    if (entry.spec.name === PColumnName.Label) {
      labelColumns.push(entry);
    }
  }

  return labelColumns;
}

function prepareToAdvancedFilters(
  entries: PColumnEntryUniversal[],
  anchorAxesSpec: AxesSpec,
) {
  const labelColumns = getLabelColumns(entries);
  const ret = entries.map((entry) => {
    const axesSpec = entry.spec.axesSpec;
    return {
      id: entry.id,
      spec: entry.spec,
      label: entry.label,
      axesToBeFixed: axesSpec.length > anchorAxesSpec.length
        ? axesSpec.slice(anchorAxesSpec.length).map((axis, i) => {
          const labelColumn = labelColumns.find((c) => {
            return c.spec.axesSpec[0].name === axis.name;
          });

          return {
            idx: anchorAxesSpec.length + i,
            label: labelColumn?.label ?? axis.annotations?.[Annotation.Label] ?? axis.name,
          };
        })
        : undefined,
    };
  });

  ret.sort((a, b) => a.label.localeCompare(b.label));

  return ret;
};

export const platforma = BlockModel.create('Heavy')

  .withArgs<BlockArgs>({
    annotationSpec: {
      title: '',
      steps: [],
    },
    runExportAll: false,
    tableInputs: {
      byClonotypeLabels: {},
      linkedColumns: {},
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
      title: '',
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

  .output('annotationsIsComputing', (ctx) => {
    if (ctx.args.inputAnchor === undefined) return false;
    if (ctx.args.annotationSpec.steps.length === 0) return false;

    const annotationsPf = ctx.prerun?.resolve('annotationsPf');

    return annotationsPf === undefined;
  })

  .output('tableInputs', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;

    const anchorSpec = ctx.resultPool.getPColumnSpecByRef(ctx.args.inputAnchor);
    if (!anchorSpec) return undefined;

    // Get linked columns
    const linkedColumns = getLinkedColumnsForArgs(ctx, ctx.args.inputAnchor, anchorSpec);

    // Build byClonotypeLabels map using getUniversalEntries with overrideLabelAnnotation
    const byClonotypeLabels: Record<string, string> = {};
    const anchorCtx = ctx.resultPool.resolveAnchorCtx({ main: ctx.args.inputAnchor });
    if (anchorCtx) {
      const collection = new PColumnCollection();
      collection
        .addColumnProvider(ctx.resultPool)
        .addAxisLabelProvider(ctx.resultPool);

      // Use getUniversalEntries() with overrideLabelAnnotation: true
      // This applies the same label derivation as UI tables without loading data
      const entries = collection.getUniversalEntries(
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
        {
          anchorCtx,
          exclude: commonExcludes,
          overrideLabelAnnotation: true, // Same label behavior as getColumns()
        },
      );

      if (entries) {
        for (const entry of entries) {
          // Create a deterministic key using canonical JSON serialization
          // This matches the approach used for linkedColumns
          const keyObj: { name: string; domain?: Record<string, string> } = {
            name: entry.spec.name,
          };
          if (entry.spec.domain && Object.keys(entry.spec.domain).length > 0) {
            // Filter domain to only include string values (matching linkedColumns approach)
            const domain: Record<string, string> = {};
            for (const [key, value] of Object.entries(entry.spec.domain)) {
              if (typeof value === 'string') {
                domain[key] = value;
              }
            }
            if (Object.keys(domain).length > 0) {
              keyObj.domain = domain;
            }
          }
          const key = canonicalizeJson(keyObj);

          // Use the label from spec annotations (set by overrideLabelAnnotation: true)
          const label = entry.spec.annotations?.[Annotation.Label] || '';
          if (label) {
            byClonotypeLabels[key] = label;
          }
        }
      }
    }

    return {
      byClonotypeLabels,
      linkedColumns: linkedColumns || {},
    };
  })

  .output('overlapColumns', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;
    const anchorCtx = ctx.resultPool.resolveAnchorCtx({ main: ctx.args.inputAnchor });
    const anchorSpec = ctx.resultPool.getPColumnSpecByRef(ctx.args.inputAnchor);
    if (anchorCtx == null || anchorSpec == null) return undefined;

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

    if (!entries) return undefined;

    return {
      pFrame: ctx.createPFrame(entries),
      columns: prepareToAdvancedFilters(entries, anchorSpec.axesSpec),
    };
  })

  .output('overlapTable', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;

    const anchorCtx = ctx.resultPool.resolveAnchorCtx({ main: ctx.args.inputAnchor });
    if (!anchorCtx) return undefined;

    const anchorSpec = ctx.resultPool.getPColumnSpecByRef(ctx.args.inputAnchor);
    if (!anchorSpec) return undefined;

    const collection = new PColumnCollection();

    const annotation = ctx.prerun?.resolve({ field: 'annotationsPf', assertFieldType: 'Input', allowPermanentAbsence: true })?.getPColumns();
    if (annotation) collection.addColumns(annotation);

    // result pool is added after the pre-run outputs so that pre-run results take precedence
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

    // Get linked columns through linkers (e.g., cluster columns)
    addLinkedColumnsToArray(ctx, ctx.args.inputAnchor, anchorSpec, columns);

    columns.forEach((column) => {
      if (column.spec.annotations?.['pl7.app/isAbundance'] === 'true' && column.spec.name !== 'pl7.app/vdj/sampleCount')
        column.spec.annotations['pl7.app/table/visibility'] = 'optional';
    });

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
    if (ctx.args.inputAnchor === undefined) return undefined;
    const tsvResource = ctx.prerun?.resolve({ field: 'tsvZip', assertFieldType: 'Input', allowPermanentAbsence: true });
    if (!tsvResource) return undefined;
    if (!tsvResource.getIsReadyOrError()) return undefined;
    if (tsvResource.resourceType.name === 'Null') return null;
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

  .title((ctx) => {
    return ctx.args.annotationSpec.steps.length > 0
      ? `Clonotype Annotation - ${ctx.args.annotationSpec.title}`
      : ctx.args.datasetTitle
        ? `Clonotype Browser - ${ctx.args.datasetTitle}`
        : 'Clonotype Browser';
  })

  .done(2);

export type Platforma = typeof platforma;

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export * from './types';
export type { BlockArgs };
