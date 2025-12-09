import type {
  AnchoredPColumnSelector,
  AnnotationScript,
  AnnotationScriptUi,
  InferHrefType,
  InferOutputsType,
  PColumn,
  PColumnDataUniversal,
  PColumnEntryUniversal,
  PColumnSpec,
  PlDataTableStateV2,
  PlRef,
  PObjectId,
  RenderCtx,
  SUniversalPColumnId,
} from '@platforma-sdk/model';
import {
  BlockModel,
  createPlDataTableSheet,
  createPlDataTableStateV2,
  createPlDataTableV2,
  deriveLabels,
  getUniquePartitionKeys,
  isLabelColumn,
  PColumnCollection,
} from '@platforma-sdk/model';
import omit from 'lodash.omit';
import { isAnnotationScriptValid } from './validation';

export type LinkedColumnEntry = {
  anchorName: string;
  anchorRef: PlRef;
  columns: string[]; // Array of JSON-serialized AnchoredPColumnSelector queries
};

type BlockArgs = {
  /** Anchor column from the clonotyping output (must have sampleId and clonotypeKey axes) */
  inputAnchor?: PlRef;
  /** Annotation script to apply to the input anchor */
  annotationScript: AnnotationScript;
  datasetTitle?: string;
  /** Enables export all */
  runExportAll: boolean;
  /** Linked columns through linker columns (e.g., cluster-related columns) */
  linkedColumns?: Record<string, LinkedColumnEntry>;
};

export type UiState = {
  settingsOpen: boolean;
  perSampleTable: {
    tableState: PlDataTableStateV2;
  };
  overlapTable: {
    tableState: PlDataTableStateV2;
  };
  statsTable: {
    tableState: PlDataTableStateV2;
  };
  annotationScript: AnnotationScriptUi;
};

export type SimplifiedUniversalPColumnEntry = {
  id: SUniversalPColumnId;
  label: string;
  spec: PColumnSpec;
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
      spec: {
        ...entry.spec,
        annotations: filteredAnnotations,
      },
    };
  });

  ret.sort((a, b) => a.label.localeCompare(b.label));

  return ret;
};

const copmmonExcludes: AnchoredPColumnSelector[] = [
  { name: 'pl7.app/vdj/sequence/annotation' },
  { annotations: { 'pl7.app/isSubset': 'true' } },
];

/**
 * Updates linked column labels to use labels derived from trace information.
 * This ensures that columns from linkers show distinguishing labels when multiple
 * linkers are present (e.g., "Cluster Size / Clustering (sim:..., ident:..., cov:...)").
 */
function updateLinkedColumnLabels(columns: PColumn<PColumnDataUniversal>[]): PColumn<PColumnDataUniversal>[] {
  if (columns.length === 0) {
    return columns;
  }

  // Derive labels using trace information
  const derivedLabels = deriveLabels(
    columns,
    (col) => col.spec,
    { includeNativeLabel: true },
  );

  // Create a map of column id to derived label
  const labelMap = new Map<string, string>();
  for (const { value, label } of derivedLabels) {
    labelMap.set(value.id, label);
  }

  // Update columns with derived labels
  return columns.map((col) => {
    const derivedLabel = labelMap.get(col.id);
    if (derivedLabel !== undefined) {
      // Create a deep copy of annotations to avoid mutating shared objects
      const newAnnotations = col.spec.annotations
        ? { ...col.spec.annotations, 'pl7.app/label': derivedLabel }
        : { 'pl7.app/label': derivedLabel };
      return {
        ...col,
        spec: {
          ...col.spec,
          annotations: newAnnotations,
        },
      };
    }
    return col;
  });
}

/**
 * Helper function to find linker options for both axis positions.
 * Returns an array of objects containing linker information for processing.
 */
function findLinkerOptions(
  ctx: RenderCtx<BlockArgs, UiState>,
  anchor: PlRef,
  anchorSpec: PColumnSpec,
): Array<{
  idx: number;
  linkerOption: { ref: PlRef; label?: string };
  anchorName: string;
}> {
  const linkerInfos: Array<{
    idx: number;
    linkerOption: { ref: PlRef; label?: string };
    anchorName: string;
  }> = [];

  // Try both axis positions (clonotypeKey might be at idx 0 or idx 1 in the linker)
  let linkerIndex = 0;
  for (const idx of [0, 1]) {
    // Calculate axes to match based on which position the anchor axis is in
    const axesToMatch = idx === 0
      ? [{}, anchorSpec.axesSpec[1]] // clonotypeKey in second axis of the linker
      : [anchorSpec.axesSpec[1], {}]; // clonotypeKey in first axis of the linker

    // Get linker refs to use as anchors for finding linked columns
    const linkerOptions = ctx.resultPool.getOptions([{
      axes: axesToMatch,
      annotations: { 'pl7.app/isLinkerColumn': 'true' },
    }]);

    // For each linker, create an info object
    for (const linkerOption of linkerOptions) {
      linkerInfos.push({
        idx,
        linkerOption,
        anchorName: `linker-${linkerIndex}`,
      });
      linkerIndex++;
    }
  }

  return linkerInfos;
}

/**
 * Gets columns linked through linker columns.
 * Linker columns connect two different key axes (e.g., clonotypeKey to clusterKey).
 * This function finds linker columns and resolves the columns on the "other side" of the link.
 *
 * @param ctx - The render context
 * @param anchor - The anchor PlRef (e.g., input anchor with clonotypeKey axis)
 * @param anchorSpec - The specification of the anchor column
 * @returns Object containing linker columns and linked columns, or undefined if not available
 */
function getLinkedColumns(
  ctx: RenderCtx<BlockArgs, UiState>,
  anchor: PlRef,
  anchorSpec: PColumnSpec,
): { linkerColumns: PColumn<PColumnDataUniversal>[]; linkedColumns: PColumn<PColumnDataUniversal>[] } | undefined {
  const linkerColumns: PColumn<PColumnDataUniversal>[] = [];
  const linkedColumns: PColumn<PColumnDataUniversal>[] = [];

  // Get linker columns for both axis positions
  for (const idx of [0, 1]) {
    const axesToMatch = idx === 0
      ? [{}, anchorSpec.axesSpec[1]]
      : [anchorSpec.axesSpec[1], {}];

    // Get linker columns that connect to our anchor's clonotypeKey axis
    const linkers = ctx.resultPool.getAnchoredPColumns(
      { main: anchor },
      [{
        axes: axesToMatch,
        annotations: { 'pl7.app/isLinkerColumn': 'true' },
      }],
    );

    if (linkers) {
      linkerColumns.push(...linkers);
    }
  }

  // Process linker options to find linked columns
  const linkerInfos = findLinkerOptions(ctx, anchor, anchorSpec);
  for (const { idx, linkerOption, anchorName } of linkerInfos) {
    const linkerAnchorSpec: Record<string, PlRef> = {
      [anchorName]: linkerOption.ref,
    };

    // Get columns that have the linker's "other" axis (the one that's not clonotypeKey)
    const linkedProps = ctx.resultPool.getAnchoredPColumns(
      linkerAnchorSpec,
      [{
        axes: [{ anchor: anchorName, idx }],
      }],
    );

    if (linkedProps) {
      linkedColumns.push(
        ...linkedProps.filter((p) => !isLabelColumn(p.spec)),
      );
    }
  }

  // Deduplicate column names using trace-based labels only if there are two or more linker columns
  const deduplicatedLinkedColumns = linkerColumns.length >= 2
    ? updateLinkedColumnLabels(linkedColumns)
    : linkedColumns;

  return { linkerColumns, linkedColumns: deduplicatedLinkedColumns };
}

/**
 * Gets linked columns data structure for workflow arguments.
 * Similar to getLinkedColumns but returns the format needed for linkedColumns argument.
 *
 * @param ctx - The render context
 * @param anchor - The anchor PlRef (e.g., input anchor with clonotypeKey axis)
 * @param anchorSpec - The specification of the anchor column
 * @returns Record of linked column entries keyed by anchor name, or undefined if not available
 */
function getLinkedColumnsForArgs(
  ctx: RenderCtx<BlockArgs, UiState>,
  anchor: PlRef,
  anchorSpec: PColumnSpec,
): Record<string, LinkedColumnEntry> | undefined {
  const result: Record<string, LinkedColumnEntry> = {};

  // Process linker options to find linked columns
  const linkerInfos = findLinkerOptions(ctx, anchor, anchorSpec);
  for (const { idx, linkerOption, anchorName } of linkerInfos) {
    const linkerAnchorSpec: Record<string, PlRef> = {
      [anchorName]: linkerOption.ref,
    };

    // Get columns that have the linker's "other" axis (the one that's not clonotypeKey)
    const linkedProps = ctx.resultPool.getAnchoredPColumns(
      linkerAnchorSpec,
      [{
        axes: [{ anchor: anchorName, idx }],
      }],
    );

    if (linkedProps && linkedProps.length > 0) {
      // Filter out label columns and serialize queries
      const columns = linkedProps
        .filter((p) => !isLabelColumn(p.spec))
        .map((p) => {
          // Create AnchoredPColumnSelector query for this column
          // We need to match by the column's spec properties
          const query: AnchoredPColumnSelector = {
            axes: [{ anchor: anchorName, idx }],
          };

          // Add domain if present
          if (p.spec.domain && Object.keys(p.spec.domain).length > 0) {
            // Convert domain to string values only (no anchor refs) for serialization
            const domain: Record<string, string> = {};
            for (const [key, value] of Object.entries(p.spec.domain)) {
              if (typeof value === 'string') {
                domain[key] = value;
              }
            }
            if (Object.keys(domain).length > 0) {
              query.domain = domain;
            }
          }

          // Add name if it's not a generic column
          if (p.spec.name) {
            query.name = p.spec.name;
          }

          // Serialize to JSON string
          return JSON.stringify(query);
        });

      if (columns.length > 0) {
        result[anchorName] = {
          anchorName,
          anchorRef: linkerOption.ref,
          columns,
        };
      }
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export const platforma = BlockModel.create('Heavy')

  .withArgs<BlockArgs>({
    annotationScript: {
      title: 'My Annotation',
      mode: 'byClonotype',
      steps: [],
    },
    runExportAll: false,
    linkedColumns: {},
  })

  .withUiState<UiState>({
    settingsOpen: true,
    perSampleTable: {
      tableState: createPlDataTableStateV2(),
    },
    overlapTable: {
      tableState: createPlDataTableStateV2(),
    },
    statsTable: {
      tableState: createPlDataTableStateV2(),
    },
    annotationScript: {
      title: 'My Annotation',
      mode: 'byClonotype',
      steps: [],
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
    }], {
      refsWithEnrichments: true,
    }),
  )

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

  // .output('exportDebug', (ctx) => {
  //   return ctx.prerun?.resolve('exportDebug')?.getDataAsJson();
  // })

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

  .output('linkedColumns', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;

    const anchorSpec = ctx.resultPool.getPColumnSpecByRef(ctx.args.inputAnchor);
    if (!anchorSpec) return undefined;

    return getLinkedColumnsForArgs(ctx, ctx.args.inputAnchor, anchorSpec);
  })

  .output('overlapTable', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;

    const anchorCtx = ctx.resultPool.resolveAnchorCtx({ main: ctx.args.inputAnchor });
    if (!anchorCtx) return undefined;

    const anchorSpec = ctx.resultPool.getPColumnSpecByRef(ctx.args.inputAnchor);
    if (!anchorSpec) return undefined;

    const collection = new PColumnCollection();

    const aggregates = ctx.prerun?.resolve({ field: 'aggregatesPf', assertFieldType: 'Input', allowPermanentAbsence: true })?.getPColumns();
    if (aggregates) collection.addColumns(aggregates);

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
      { anchorCtx, exclude: copmmonExcludes },
    );

    if (!columns) return undefined;

    // Get linked columns through linkers (e.g., cluster columns)
    // Get them BEFORE we modify any columns to avoid affecting the collection
    const linked = getLinkedColumns(ctx, ctx.args.inputAnchor, anchorSpec);

    // Filter out linked columns that are already in the main columns array to avoid duplicates
    const existingColumnIds = new Set(columns.map((c) => c.id));
    const newLinkedColumns = linked?.linkedColumns.filter((c) => !existingColumnIds.has(c.id)) ?? [];
    const newLinkerColumns = linked?.linkerColumns.filter((c) => !existingColumnIds.has(c.id)) ?? [];

    // Add linker columns but mark them as hidden - they're needed for PFrame structure but shouldn't be shown in UI
    if (newLinkerColumns.length > 0) {
      const hiddenLinkerColumns = newLinkerColumns.map((linkerColumn) => ({
        ...linkerColumn,
        spec: {
          ...linkerColumn.spec,
          annotations: {
            ...linkerColumn.spec.annotations,
            'pl7.app/table/visibility': 'hidden',
          },
        },
      }));
      columns.push(...hiddenLinkerColumns);
    }

    if (newLinkedColumns.length > 0) {
      columns.push(...newLinkedColumns);
    }

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

  .output('perSampleTableSheets', (ctx) => {
    if (ctx.args.inputAnchor === undefined) return undefined;

    const anchor = ctx.resultPool.getPColumnByRef(ctx.args.inputAnchor);
    if (!anchor) return undefined;

    const samples = getUniquePartitionKeys(anchor.data)?.[0];
    if (!samples) return undefined;

    return [createPlDataTableSheet(ctx, anchor.spec.axesSpec[0], samples)];
  })

  .output('perSampleTable', (ctx) => {
    if (ctx.args.inputAnchor === undefined) return undefined;

    const anchor = ctx.resultPool.getPColumnByRef(ctx.args.inputAnchor);
    if (!anchor) return undefined;

    const anchorCtx = ctx.resultPool.resolveAnchorCtx({ main: ctx.args.inputAnchor });
    if (!anchorCtx) return undefined;

    const anchorSpec = ctx.resultPool.getPColumnSpecByRef(ctx.args.inputAnchor);
    if (!anchorSpec) return undefined;

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
          { anchor: 'main', idx: 0 },
          { anchor: 'main', idx: 1 },
        ],
      }, {
        domainAnchor: 'main',
        axes: [
          { anchor: 'main', idx: 1 },
        ],
      }],
      {
        anchorCtx,
        exclude: copmmonExcludes,
        overrideLabelAnnotation: false,
      },
    );

    if (!columns) return undefined;

    // Get linked columns through linkers (e.g., cluster columns)
    // Get them BEFORE we modify any columns to avoid affecting the collection
    const linked = getLinkedColumns(ctx, ctx.args.inputAnchor, anchorSpec);

    // Filter out linked columns that are already in the main columns array to avoid duplicates
    const existingColumnIds = new Set(columns.map((c) => c.id));
    const newLinkedColumns = linked?.linkedColumns.filter((c) => !existingColumnIds.has(c.id)) ?? [];
    const newLinkerColumns = linked?.linkerColumns.filter((c) => !existingColumnIds.has(c.id)) ?? [];

    // Add linker columns but mark them as hidden - they're needed for PFrame structure but shouldn't be shown in UI
    if (newLinkerColumns.length > 0) {
      const hiddenLinkerColumns = newLinkerColumns.map((linkerColumn) => ({
        ...linkerColumn,
        spec: {
          ...linkerColumn.spec,
          annotations: {
            ...linkerColumn.spec.annotations,
            'pl7.app/table/visibility': 'hidden',
          },
        },
      }));
      columns.push(...hiddenLinkerColumns);
    }

    if (newLinkedColumns.length > 0) {
      columns.push(...newLinkedColumns);
    }

    return createPlDataTableV2(
      ctx,
      columns,
      ctx.uiState.perSampleTable.tableState,
    );
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

      return createPlDataTableV2(
        ctx,
        columnsAfterSplitting,
        ctx.uiState.statsTable.tableState,
      );
    }
    return undefined;
  })

  .sections((ctx) => {
    return [
      { type: 'link', href: '/', label: 'Per Sample ' } as const,
      { type: 'link', href: '/overlap', label: 'Overlap' } as const,
      ...(ctx.args.annotationScript.steps.length > 0
        ? [{ type: 'link', href: '/stats', label: 'Annotation Stats' } as const]
        : []),
    ];
  })

  .argsValid((ctx) => {
    if (ctx.args.inputAnchor === undefined || ctx.args.annotationScript.steps.length === 0) {
      return false;
    }
    return isAnnotationScriptValid(ctx.args.annotationScript);
  })

  // We enrich the input, only if we produce annotations
  .enriches((args) => args.inputAnchor !== undefined && args.annotationScript.steps.length > 0 ? [args.inputAnchor] : [])

  .title((ctx) => ctx.args.annotationScript.steps.length > 0
    ? `Annotation - ${ctx.args.annotationScript.title}`
    : ctx.args.datasetTitle
      ? `Clonotype Browser - ${ctx.args.datasetTitle}`
      : 'Clonotype Browser')

  .done(2);

export { isAnnotationScriptValid } from './validation';
export type { BlockArgs };
export type Platforma = typeof platforma;

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
