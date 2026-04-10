import type {
  AxesSpec,
  ColumnData,
  ColumnDataStatus,
  InferHrefType,
  InferOutputsType,
  PColumn,
  PColumnDataUniversal,
  PColumnSpec,
  PObjectId,
  PlRef,
  SUniversalPColumnId,
} from "@platforma-sdk/model";
import {
  Annotation,
  BlockModelV3,
  canonicalizeJson,
  collectCtxColumnSnapshotProviders,
  ColumnCollectionBuilder,
  createPlDataTableSheet,
  createPlDataTableV2,
  createPlDataTableV3,
  expandByPartition,
  getUniquePartitionKeys,
  PColumnCollection,
  PColumnName,
} from "@platforma-sdk/model";
import type { AnnotationSpec, TableInputs } from "./types";
import { commonExcludes, getLinkedColumnsForArgs } from "./column_utils";
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
      label: entry.spec.annotations?.[Annotation.Label] ?? "",
      axesToBeFixed:
        axesSpec.length > anchorAxesSpec.length
          ? axesSpec.slice(anchorAxesSpec.length).map((axis, i) => {
              const labelColumn = labelColumns.find((c) => {
                return c.spec.axesSpec[0].name === axis.name;
              });

              return {
                idx: anchorAxesSpec.length + i,
                label:
                  labelColumn?.spec.annotations?.[Annotation.Label] ??
                  axis.annotations?.[Annotation.Label] ??
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
function splitByPartition(
  snapshots: {
    id: PObjectId;
    spec: PColumnSpec;
    dataStatus: ColumnDataStatus;
    data: ColumnData | undefined;
  }[],
  splitAxisIdx: number,
) {
  const { items, complete } = expandByPartition(snapshots, [{ idx: splitAxisIdx }]);
  if (!complete || items.length === 0) return undefined;

  const splitAxisName = snapshots[0].spec.axesSpec[splitAxisIdx].name;
  return items.map((col) => {
    const trace = JSON.parse(col.spec.annotations?.["pl7.app/trace"] ?? "[]");
    const splitValue = trace[0]?.label ?? "";
    return {
      ...col,
      id: `${col.id}#${splitValue}` as PObjectId,
      spec: { ...col.spec, domain: { ...col.spec.domain, [splitAxisName]: splitValue } },
    };
  });
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

          const label = entry.spec.annotations?.[Annotation.Label] || "";
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
    const anchorCtx = ctx.resultPool.resolveAnchorCtx({ main: ctx.data.inputAnchor });
    const anchorSpec = ctx.resultPool.getPColumnSpecByRef(ctx.data.inputAnchor);
    if (anchorCtx == null || anchorSpec == null) return undefined;

    const entries = new PColumnCollection()
      .addColumnProvider(ctx.resultPool)
      .addAxisLabelProvider(ctx.resultPool)
      .getColumns(
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
        { anchorCtx, dontWaitAllData: true },
      );

    if (!entries) return undefined;

    return {
      pFrame: ctx.createPFrame(entries),
      columns: prepareToAdvancedFilters(entries, anchorSpec.axesSpec),
    };
  })

  .outputWithStatus("overlapTable", (ctx) => {
    if (ctx.data.inputAnchor === undefined) return undefined;

    const anchorSpec = ctx.resultPool.getPColumnSpecByRef(ctx.data.inputAnchor);
    if (!anchorSpec) return undefined;

    // Build anchored collection: prerun first (priority), then ctx sources
    const builder = new ColumnCollectionBuilder(ctx.services.pframeSpec!);
    const annotation = ctx.prerun?.resolve({
      field: "annotationsPf",
      assertFieldType: "Input",
      allowPermanentAbsence: true,
    });
    if (annotation) builder.addSource(annotation);
    builder.addSources(collectCtxColumnSnapshotProviders(ctx));

    const collection = builder.build({ anchors: { main: anchorSpec } });
    if (!collection) return undefined;

    const matches = collection.findColumns({
      mode: "enrichment",
      maxHops: 0,
      exclude: [
        { name: "pl7.app/vdj/sequence/annotation" },
        { annotations: { "pl7.app/isSubset": "true" } },
        { axes: [{ name: anchorSpec.axesSpec[0].name }], partialAxesMatch: false },
      ],
    });
    collection.dispose();

    // Split multi-axis abundance by sampleId (idx 0)
    const isAbundanceToSplit = (m: (typeof matches)[number]) =>
      m.column.spec.annotations?.["pl7.app/isAbundance"] === "true" &&
      m.column.spec.axesSpec.length > 1;

    const splitColumns = splitByPartition(
      matches.filter(isAbundanceToSplit).map((m) => ({ ...m.column, id: m.originalId })),
      0,
    );
    if (!splitColumns) return undefined;

    // Merge: split abundance (primary) + enrichment columns (secondary)
    return createPlDataTableV3(ctx, {
      columns: [
        ...splitColumns.map((col) => ({
          ...col,
          id: col.id as SUniversalPColumnId,
          isPrimary: true as const,
        })),
        ...matches
          .filter((m) => !isAbundanceToSplit(m))
          .map((m) => ({
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
              spec.annotations?.["pl7.app/isAbundance"] === "true" &&
              spec.name !== "pl7.app/vdj/sampleCount",
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
    return [
      { type: "link", href: "/", label: "Overlap" } as const,
      { type: "link", href: "/sample", label: "By Sample" } as const,
      ...(ctx.data.annotationSpec.steps.length > 0
        ? [{ type: "link", href: "/stats", label: "Stats" } as const]
        : []),
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
