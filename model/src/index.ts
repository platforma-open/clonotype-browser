import type {
  AxesSpec,
  ColumnSnapshot,
  InferHrefType,
  InferOutputsType,
  PColumn,
  PColumnDataUniversal,
  PObjectId,
  PlRef,
  SUniversalPColumnId,
} from "@platforma-sdk/model";
import {
  BlockModelV3,
  canonicalizeJson,
  ColumnCollectionBuilder,
  collectCtxColumnSnapshotProviders,
  createPlDataTableSheet,
  createPlDataTableV2,
  createPlDataTableV3,
  expandByPartition,
  getUniquePartitionKeys,
  PColumnCollection,
  Services,
  type RenderCtxBase,
  type RequireServices,
} from "@platforma-sdk/model";
import type { AnnotationSpec, TableInputs } from "./types";
import { commonExcludes, getLinkedColumnsForArgs } from "./column_utils";
import {
  Annotation,
  getTrace,
  isAbundanceColumn,
  PColumnName,
  readAnnotation,
} from "./schema";
import { blockDataModel } from "./dataModel";

export type { LinkedColumnEntry } from "./column_utils";
export { blockDataModel } from "./dataModel";

type BlockArgs = {
  inputAnchor?: PlRef;
  datasetTitle?: string;
  annotationSpec: AnnotationSpec;
  runExportAll: boolean;
  tableInputs?: TableInputs;
};

function getLabelColumns(entries: PColumn<PColumnDataUniversal>[]) {
  const labelColumns: PColumn<PColumnDataUniversal>[] = [];

  for (const entry of entries) {
    if (entry.spec.name === PColumnName.Label) {
      labelColumns.push(entry);
    }
  }

  return labelColumns;
}

function prepareToAdvancedFilters(
  entries: PColumn<PColumnDataUniversal>[],
  anchorAxesSpec: AxesSpec,
) {
  const labelColumns = getLabelColumns(entries);
  const ret = entries.map((entry) => {
    const axesSpec = entry.spec.axesSpec;
    return {
      id: entry.id as SUniversalPColumnId,
      spec: entry.spec,
      label: readAnnotation(entry.spec, Annotation.Label) ?? "",
      axesToBeFixed:
        axesSpec.length > anchorAxesSpec.length
          ? axesSpec.slice(anchorAxesSpec.length).map((axis, i) => {
              const labelColumn = labelColumns.find((c) => {
                return c.spec.axesSpec[0].name === axis.name;
              });

              return {
                idx: anchorAxesSpec.length + i,
                label:
                  readAnnotation(labelColumn?.spec, Annotation.Label) ??
                  readAnnotation(axis, Annotation.Label) ??
                  axis.name,
              };
            })
          : undefined,
    };
  });

  ret.sort((a, b) => a.label.localeCompare(b.label));

  return ret;
}

/**
 * Split columns by partition axis and add split key to domain for unique nativeIds.
 * Returns undefined if any column's data is not ready.
 */
function splitByPartition<A, U, S extends RequireServices<typeof Services.PFrameSpec>>(
  ctx: RenderCtxBase<A, U, S>,
  snapshots: ColumnSnapshot<PObjectId>[],
  splitAxisIdx: number,
) {
  const { items, complete } = expandByPartition(snapshots, [{ idx: splitAxisIdx }], {
    axisLabels: (axisId) => ctx.resultPool.findLabels(axisId),
  });
  if (!complete || items.length === 0) return undefined;

  const splitAxisName = snapshots[0].spec.axesSpec[splitAxisIdx].name;
  return items.map((col) => {
    const splitValue = getTrace(col.spec)[0]?.label ?? "";
    return {
      ...col,
      id: `${col.id}#${splitValue}` as PObjectId,
      spec: { ...col.spec, domain: { ...col.spec.domain, [splitAxisName]: splitValue } },
    };
  });
}

/**
 * Find enrichment columns for the overlap view using ColumnCollectionBuilder.
 * Returns direct + linked non-abundance matches, or undefined if not ready.
 * Optionally accepts extra sources to add before ctx sources (e.g. prerun annotations).
 */
function findOverlapMatches<
  A,
  U,
  S extends RequireServices<typeof Services.PFrameSpec>,
>(
  ctx: RenderCtxBase<A, U, S>,
  inputAnchor: PlRef,
  extraSources?: Parameters<ColumnCollectionBuilder["addSource"]>[0][],
) {
  const anchorSpec = ctx.resultPool.getPColumnSpecByRef(inputAnchor);
  if (!anchorSpec) return undefined;

  const builder = new ColumnCollectionBuilder(ctx.services.pframeSpec);
  if (extraSources) {
    for (const src of extraSources) builder.addSource(src);
  }
  builder.addSources(collectCtxColumnSnapshotProviders(ctx));

  const collection = builder.build({ anchors: { main: anchorSpec } });
  if (!collection) return undefined;

  const matches = collection.findColumns({
    mode: "enrichment",
    exclude: [
      { name: "pl7.app/vdj/sequence/annotation" },
      { annotations: { "pl7.app/isSubset": "true" } },
      { axes: [{ name: anchorSpec.axesSpec[0].name }], partialAxesMatch: false },
    ],
  });
  collection.dispose();

  // Direct columns: all included.
  // Linked columns: only per-clonotype (single-axis) columns are included.
  // Multi-axis linked columns (e.g. per-sample abundance on clusterId) bring
  // extra dimensions into the join and belong in the sample table instead.
  const filtered = matches.filter(
    (m) => m.path.length === 0 || m.column.spec.axesSpec.length === 1,
  );

  return { matches: filtered, anchorSpec };
}

export const platforma = BlockModelV3.create(blockDataModel)

  .args<BlockArgs>((data) => {
    if (data.inputAnchor === undefined) throw new Error("No input anchor");
    if (data.annotationSpec.steps.length === 0) throw new Error("No annotation steps");

    return {
      inputAnchor: data.inputAnchor,
      datasetTitle: data.datasetTitle,
      annotationSpec: data.annotationSpec,
      runExportAll: data.runExportAll,
      tableInputs: data.tableInputs,
    };
  })

  // Prerun runs in v3 only when .prerunArgs is defined; return undefined to skip it.
  // Each branch's inputs are gated independently so unrelated edits don't invalidate
  // the prerun cache.
  .prerunArgs((data) => {
    if (data.inputAnchor === undefined) return undefined;
    const wantAnnotations = data.annotationSpec.steps.length > 0;
    const wantExport = data.runExportAll;
    if (!wantAnnotations && !wantExport) return undefined;

    return {
      inputAnchor: data.inputAnchor,
      annotationSpec: wantAnnotations ? data.annotationSpec : { title: "", steps: [] },
      runExportAll: wantExport,
      tableInputs: wantExport ? data.tableInputs : undefined,
    };
  })

  .output("inputOptions", (ctx) =>
    ctx.resultPool.getOptions(
      [
        {
          axes: [{ name: "pl7.app/sampleId" }, { name: "pl7.app/vdj/clonotypeKey" }],
          annotations: { "pl7.app/isAnchor": "true" },
        },
        {
          axes: [{ name: "pl7.app/sampleId" }, { name: "pl7.app/vdj/scClonotypeKey" }],
          annotations: { "pl7.app/isAnchor": "true" },
        },
      ],
      {
        refsWithEnrichments: true,
      },
    ),
  )

  .output("annotationsIsComputing", (ctx) => {
    if (ctx.data.inputAnchor === undefined) return false;
    if (ctx.data.annotationSpec.steps.length === 0) return false;

    const annotationsPf = ctx.prerun?.resolve("annotationsPf");

    return annotationsPf === undefined;
  })

  .output("tableInputs", (ctx) => {
    if (ctx.data.inputAnchor === undefined) return undefined;

    const anchorSpec = ctx.resultPool.getPColumnSpecByRef(ctx.data.inputAnchor);
    if (!anchorSpec) return undefined;

    // Get linked columns
    const linkedColumns = getLinkedColumnsForArgs(ctx, ctx.data.inputAnchor, anchorSpec);

    // Build byClonotypeLabels map using getUniversalEntries with overrideLabelAnnotation
    const byClonotypeLabels: Record<string, string> = {};
    const anchorCtx = ctx.resultPool.resolveAnchorCtx({ main: ctx.data.inputAnchor });
    if (anchorCtx) {
      const collection = new PColumnCollection();
      collection.addColumnProvider(ctx.resultPool).addAxisLabelProvider(ctx.resultPool);

      const entries = collection.getUniversalEntries(
        [
          {
            domainAnchor: "main",
            axes: [{ anchor: "main", idx: 1 }],
          },
          {
            domainAnchor: "main",
            axes: [{ split: true }, { anchor: "main", idx: 1 }],
            annotations: {
              "pl7.app/isAbundance": "true",
            },
          },
        ],
        {
          anchorCtx,
          exclude: commonExcludes,
          overrideLabelAnnotation: true,
        },
      );

      if (entries) {
        for (const entry of entries) {
          const keyObj: { name: string; domain?: Record<string, string> } = {
            name: entry.spec.name,
          };
          if (entry.spec.domain && Object.keys(entry.spec.domain).length > 0) {
            const domain: Record<string, string> = {};
            for (const [key, value] of Object.entries(entry.spec.domain)) {
              if (typeof value === "string") {
                domain[key] = value;
              }
            }
            if (Object.keys(domain).length > 0) {
              keyObj.domain = domain;
            }
          }
          const key = canonicalizeJson(keyObj);

          const label = readAnnotation(entry.spec, Annotation.Label) || "";
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

  .output("overlapColumns", (ctx) => {
    if (ctx.data.inputAnchor === undefined) return undefined;
    const result = findOverlapMatches(ctx, ctx.data.inputAnchor);
    if (!result) return undefined;

    const entries = result.matches.map((m) => ({
      id: m.column.id,
      spec: m.column.spec,
      data: m.column.data?.get(),
    })) as PColumn<PColumnDataUniversal>[];

    if (entries.length === 0) return undefined;

    return {
      pFrame: ctx.createPFrame(entries),
      columns: prepareToAdvancedFilters(entries, result.anchorSpec.axesSpec),
    };
  })

  .outputWithStatus("overlapTable", (ctx) => {
    if (ctx.data.inputAnchor === undefined) return undefined;

    // Include prerun annotations once data is ready — addSource silently drops
    // unresolved accessors, so passing them earlier only churns the table descriptor.
    const annotation = ctx.prerun?.resolve({
      field: "annotationsPf",
      assertFieldType: "Input",
      allowPermanentAbsence: true,
    });
    const extraSources = annotation?.getIsReadyOrError() ? [annotation] : [];
    const result = findOverlapMatches(ctx, ctx.data.inputAnchor, extraSources);
    if (!result) return undefined;

    const { matches } = result;

    // Separate direct enrichments from linked (via linker) columns
    const directMatches = matches.filter((m) => m.path.length === 0);
    const linkedMatches = matches.filter((m) => m.path.length > 0);

    // Split only direct multi-axis abundance by sampleId (idx 0)
    const isAbundanceToSplit = (m: (typeof directMatches)[number]) =>
      isAbundanceColumn(m.column.spec) && m.column.spec.axesSpec.length > 1;

    const splitColumns = splitByPartition(
      ctx,
      directMatches
        .filter(isAbundanceToSplit)
        .map((m) => ({ ...m.column, id: m.originalId })),
      0,
    );
    if (!splitColumns) return undefined;

    // Merge: split abundance (primary) + direct enrichment (secondary)
    // + linked non-abundance (secondary with linkerPath).
    return createPlDataTableV3(ctx, {
      columns: [
        ...splitColumns.map((col) => ({
          ...col,
          id: col.id as SUniversalPColumnId,
          isPrimary: true as const,
        })),
        ...directMatches
          .filter((m) => !isAbundanceToSplit(m))
          .map((m) => ({
            ...m.column,
            originalId: m.originalId,
            linkerPath: m.path,
            isPrimary: false as const,
          })),
        ...linkedMatches.map((m) => ({
          ...m.column,
          originalId: m.originalId,
          linkerPath: m.path,
          isPrimary: false as const,
        })),
      ],
      primaryJoinType: "full",
      tableState: ctx.data.overlapTableState,
      columnsDisplayOptions: {
        visibility: [
          {
            match: (spec) =>
              isAbundanceColumn(spec) && spec.name !== PColumnName.SampleCount,
            visibility: "optional",
          },
        ],
      },
    });
  })

  .outputWithStatus("sampleTable", (ctx) => {
    if (ctx.data.inputAnchor === undefined) return undefined;

    return createPlDataTableV3(ctx, {
      discoverColumnOptions: {
        anchors: { main: ctx.data.inputAnchor },
        columnsSelector: {
          mode: "enrichment",
          exclude: [
            // Exclude sampleId-only columns (Sample label, metadata) — they have only
            // one axis matching sampleId. partialAxesMatch: false means ALL column axes
            // must be accounted for by the selector's axis patterns.
            {
              axes: [{ name: [{ type: "exact", value: "pl7.app/sampleId" }] }],
              partialAxesMatch: false,
            },
            // Exclude sequence annotations and subset columns
            { name: [{ type: "exact", value: "pl7.app/vdj/sequence/annotation" }] },
            {
              annotations: {
                "pl7.app/isSubset": [{ type: "exact", value: "true" }],
              },
            },
          ],
        },
      },
      tableState: ctx.data.sampleTableState,
    });
  })

  .output("sampleTableSheets", (ctx) => {
    if (ctx.data.inputAnchor === undefined) return undefined;

    const anchor = ctx.resultPool.getPColumnByRef(ctx.data.inputAnchor);
    if (!anchor) return undefined;

    const samples = getUniquePartitionKeys(anchor.data)?.[0];
    if (!samples) return undefined;

    return [createPlDataTableSheet(ctx, anchor.spec.axesSpec[0], samples)];
  })

  .outputWithStatus("statsTable", (ctx) => {
    const allColumns = [];
    const annotationStatsPf = ctx.prerun?.resolve({
      field: "annotationStatsPf",
      assertFieldType: "Input",
      allowPermanentAbsence: true,
    });
    if (annotationStatsPf && annotationStatsPf.getIsReadyOrError()) {
      const columns = annotationStatsPf.getPColumns();
      if (columns) {
        allColumns.push(columns);
      }
    }
    const sampleStatsPf = ctx.prerun?.resolve({
      field: "sampleStatsPf",
      assertFieldType: "Input",
      allowPermanentAbsence: true,
    });
    if (sampleStatsPf && sampleStatsPf.getIsReadyOrError()) {
      const columns = sampleStatsPf.getPColumns();
      if (columns) {
        allColumns.push(columns);
      }
    }

    if (allColumns.length !== 2) return undefined;

    const collection = new PColumnCollection().addAxisLabelProvider(ctx.resultPool);

    for (const cols of allColumns) {
      collection.addColumns(cols);
    }

    const columnsAfterSplitting = collection.getColumns([
      { axes: [{}] },
      { axes: [{ split: true }, {}] },
    ]);

    if (columnsAfterSplitting === undefined) return undefined;

    return createPlDataTableV2(ctx, columnsAfterSplitting, ctx.data.statsTableState);
  })

  .output("exportedTsvZip", (ctx) => {
    if (ctx.data.inputAnchor === undefined) return undefined;
    const tsvResource = ctx.prerun?.resolve({
      field: "tsvZip",
      assertFieldType: "Input",
      allowPermanentAbsence: true,
    });
    if (!tsvResource) return undefined;
    if (!tsvResource.getIsReadyOrError()) return undefined;
    if (tsvResource.resourceType.name === "Null") return null;
    return tsvResource.getRemoteFileHandle();
  })

  .sections((ctx) => {
    // Stats gate matches main's argsValid (inputAnchor + steps) since v3 has no
    // global argsValid; sections render independently of .args throwing.
    const showStats =
      ctx.data.inputAnchor !== undefined && ctx.data.annotationSpec.steps.length > 0;
    return [
      { type: "link", href: "/", label: "Overlap" } as const,
      { type: "link", href: "/sample", label: "By Sample" } as const,
      ...(showStats ? [{ type: "link", href: "/stats", label: "Stats" } as const] : []),
    ];
  })

  .enriches((args) =>
    args.inputAnchor !== undefined && args.annotationSpec.steps.length > 0
      ? [args.inputAnchor]
      : [],
  )

  .title((ctx) => {
    return ctx.data.annotationSpec.steps.length > 0
      ? `Clonotype Annotation - ${ctx.data.annotationSpec.title}`
      : ctx.data.datasetTitle
        ? `Clonotype Browser - ${ctx.data.datasetTitle}`
        : "Clonotype Browser";
  })

  .done();

export type Platforma = typeof platforma;

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export * from "./types";
export type { BlockArgs };
