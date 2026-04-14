import type {
  AxesSpec,
  ColumnMatch,
  ColumnSnapshot,
  InferOutputsType,
  PColumn,
  PColumnDataUniversal,
  PObjectId,
  PlRef,
  SUniversalPColumnId,
} from "@platforma-sdk/model";
import {
  BlockModelV3,
  ColumnCollectionBuilder,
  collectCtxColumnSnapshotProviders,
  convertFilterSpecsToExpressionSpecs,
  createPlDataTableSheet,
  createPlDataTableV3,
  deriveDistinctLabels,
  expandByPartition,
  getUniquePartitionKeys,
  OutputColumnProvider,
  plRefsEqual,
  Services,
  type RenderCtxBase,
  type RequireServices,
} from "@platforma-sdk/model";
import {
  Annotation,
  getTrace,
  isAbundanceColumn,
  PAxisName,
  PColumnName,
  readAnnotation,
} from "./columns";
import { blockDataModel } from "./dataModel";
import type { BlockArgs, BlockData } from "./types";

export { blockDataModel } from "./dataModel";
export * from "./types";

function buildFilterUiColumns(
  matches: readonly ColumnMatch[],
  anchorAxesSpec: AxesSpec,
) {
  const distinctLabels = deriveDistinctLabels(
    matches.map((m) => ({
      spec: m.column.spec,
      linkersPath: m.path.map((step) => ({ spec: step.linker.spec })),
    })),
    { includeNativeLabel: true },
  );
  const labelSpecs = matches
    .map((m) => m.column.spec)
    .filter((s) => s.name === PColumnName.Label);
  const ret = matches.map((m, i) => {
    const spec = m.column.spec;
    const axesSpec = spec.axesSpec;
    return {
      id: m.column.id as SUniversalPColumnId,
      spec,
      label: distinctLabels[i] ?? readAnnotation(spec, Annotation.Label) ?? "",
      axesToBeFixed:
        axesSpec.length > anchorAxesSpec.length
          ? axesSpec.slice(anchorAxesSpec.length).map((axis, j) => {
              const labelSpec = labelSpecs.find(
                (s) => s.axesSpec[0].name === axis.name,
              );
              return {
                idx: anchorAxesSpec.length + j,
                label:
                  readAnnotation(labelSpec, Annotation.Label) ??
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

// Extra sources are added before ctx sources so prerun annotations participate.
function findOverlapMatches<A, U, S extends RequireServices<typeof Services.PFrameSpec>>(
  ctx: RenderCtxBase<A, U, S>,
  inputAnchor: PlRef,
  extraSources?: Parameters<ColumnCollectionBuilder["addSource"]>[0][],
) {
  const anchorSpec = ctx.resultPool.getPColumnSpecByRef(inputAnchor);
  if (!anchorSpec) return undefined;

  const builder = new ColumnCollectionBuilder(ctx.services.pframeSpec);
  if (extraSources) for (const src of extraSources) builder.addSource(src);
  builder.addSources(collectCtxColumnSnapshotProviders(ctx));

  const collection = builder.build({ anchors: { main: anchorSpec } });
  if (!collection) return undefined;

  const matches = collection.findColumns({
    mode: "enrichment",
    exclude: [
      { name: PColumnName.SequenceAnnotation },
      { annotations: { [Annotation.IsSubset]: "true" } },
      { axes: [{ name: anchorSpec.axesSpec[0].name }], partialAxesMatch: false },
    ],
  });
  collection.dispose();

  // Linked multi-axis columns (e.g. per-sample abundance on clusterId) bring
  // extra dimensions into the join and belong in the sample table instead.
  const filtered = matches.filter(
    (m) => m.path.length === 0 || m.column.spec.axesSpec.length === 1,
  );
  return { matches: filtered, anchorSpec };
}

function compileAnnotationSpec(ui: BlockData["annotationSpecUi"]): BlockArgs["annotationSpec"] {
  return {
    title: ui.title,
    steps: convertFilterSpecsToExpressionSpecs(ui.steps),
    defaultValue: ui.defaultValue,
  };
}

function hasCompiledSteps(ui: BlockData["annotationSpecUi"]): boolean {
  try {
    return compileAnnotationSpec(ui).steps.length > 0;
  } catch {
    return false;
  }
}

const inputAnchorSpecs = [
  {
    axes: [{ name: PAxisName.SampleId }, { name: PAxisName.VDJ.ClonotypeKey }],
    annotations: { [Annotation.IsAnchor]: "true" },
  },
  {
    axes: [{ name: PAxisName.SampleId }, { name: PAxisName.VDJ.ScClonotypeKey }],
    annotations: { [Annotation.IsAnchor]: "true" },
  },
];

export const platforma = BlockModelV3.create(blockDataModel)

  .args<BlockArgs>((data) => {
    if (data.inputAnchor === undefined) throw new Error("No input anchor");
    const annotationSpec = compileAnnotationSpec(data.annotationSpecUi);
    if (annotationSpec.steps.length === 0) throw new Error("No annotation steps");
    return {
      inputAnchor: data.inputAnchor,
      annotationSpec,
      runExportAll: data.runExportAll,
    };
  })

  .prerunArgs((data) => {
    if (data.inputAnchor === undefined) return undefined;
    const annotationSpec = compileAnnotationSpec(data.annotationSpecUi);
    const wantAnnotations = annotationSpec.steps.length > 0;
    const wantExport = data.runExportAll;
    if (!wantAnnotations && !wantExport) return undefined;
    return {
      inputAnchor: data.inputAnchor,
      annotationSpec: wantAnnotations ? annotationSpec : { title: "", steps: [] },
      runExportAll: wantExport,
    };
  })

  .output("inputOptions", (ctx) =>
    ctx.resultPool.getOptions(inputAnchorSpecs, { refsWithEnrichments: true }),
  )

  .output("annotationsIsComputing", (ctx) => {
    if (ctx.data.inputAnchor === undefined) return false;
    if (!hasCompiledSteps(ctx.data.annotationSpecUi)) return false;
    return ctx.prerun?.resolve({
      field: "annotationsPf",
      assertFieldType: "Input",
      allowPermanentAbsence: true,
    }) === undefined;
  })

  .output("overlapColumns", (ctx) => {
    if (ctx.data.inputAnchor === undefined) return undefined;
    const result = findOverlapMatches(ctx, ctx.data.inputAnchor);
    if (!result) return undefined;

    // Annotation results must not appear as filter inputs for their own definition.
    const matches = result.matches.filter(
      (m) => m.column.spec.name !== PColumnName.AnnotationResult,
    );

    const entries = matches.map((m) => ({
      id: m.column.id,
      spec: m.column.spec,
      data: m.column.data?.get(),
    })) as PColumn<PColumnDataUniversal>[];
    if (entries.length === 0) return undefined;

    return {
      pFrame: ctx.createPFrame(entries),
      columns: buildFilterUiColumns(matches, result.anchorSpec.axesSpec),
    };
  })

  .outputWithStatus("overlapTable", (ctx) => {
    if (ctx.data.inputAnchor === undefined) return undefined;

    // Include prerun annotations once ready — addSource silently drops unresolved
    // accessors, so passing them earlier only churns the table descriptor.
    const annotation = ctx.prerun?.resolve({
      field: "annotationsPf",
      assertFieldType: "Input",
      allowPermanentAbsence: true,
    });
    const extraSources = annotation?.getIsReadyOrError() ? [annotation] : [];
    const result = findOverlapMatches(ctx, ctx.data.inputAnchor, extraSources);
    if (!result) return undefined;

    const { matches } = result;
    const directMatches = matches.filter((m) => m.path.length === 0);
    const linkedMatches = matches.filter((m) => m.path.length > 0);

    // Direct multi-axis abundance columns split by sampleId (axis 0).
    const isAbundanceToSplit = (m: (typeof directMatches)[number]) =>
      isAbundanceColumn(m.column.spec) && m.column.spec.axesSpec.length > 1;

    const splitColumns = splitByPartition(
      ctx,
      directMatches.filter(isAbundanceToSplit).map((m) => ({ ...m.column, id: m.originalId })),
      0,
    );
    if (!splitColumns) return undefined;

    return createPlDataTableV3(ctx, {
      columns: [
        ...splitColumns.map((col) => ({
          ...col,
          id: col.id as SUniversalPColumnId,
          isPrimary: true,
        })),
        ...directMatches
          .filter((m) => !isAbundanceToSplit(m))
          .map((m) => ({
            ...m.column,
            originalId: m.originalId,
            linkerPath: m.path,
            isPrimary: false,
          })),
        ...linkedMatches.map((m) => ({
          ...m.column,
          originalId: m.originalId,
          linkerPath: m.path,
          isPrimary: false,
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
            // Drop sampleId-only columns (Sample label, metadata) via
            // partialAxesMatch: false — all column axes must match.
            {
              axes: [{ name: [{ type: "exact", value: PAxisName.SampleId }] }],
              partialAxesMatch: false,
            },
            { name: [{ type: "exact", value: PColumnName.SequenceAnnotation }] },
            { annotations: { [Annotation.IsSubset]: [{ type: "exact", value: "true" }] } },
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
    // Both prerun stats PFrames must be ready — the table is a full join of both.
    const annotationStatsPf = ctx.prerun?.resolve({
      field: "annotationStatsPf",
      assertFieldType: "Input",
      allowPermanentAbsence: true,
    });
    const sampleStatsPf = ctx.prerun?.resolve({
      field: "sampleStatsPf",
      assertFieldType: "Input",
      allowPermanentAbsence: true,
    });
    if (!annotationStatsPf?.getIsReadyOrError() || !sampleStatsPf?.getIsReadyOrError()) {
      return undefined;
    }

    // sampleStats is keyed on [sampleId, annotationKey] — split by sampleId
    // so each sample becomes its own annotation-keyed column set that joins
    // with annotationStats on annotationKey.
    const annotationSnapshots = new OutputColumnProvider(annotationStatsPf).getAllColumns();
    const splitSampleSnapshots = splitByPartition(
      ctx,
      new OutputColumnProvider(sampleStatsPf).getAllColumns(),
      0,
    );
    if (splitSampleSnapshots === undefined) return undefined;

    return createPlDataTableV3(ctx, {
      columns: [...annotationSnapshots, ...splitSampleSnapshots].map((s) => ({
        ...s,
        id: s.id as SUniversalPColumnId,
        isPrimary: true,
      })),
      tableState: ctx.data.statsTableState,
    });
  })

  .output("exportedTsvZip", (ctx) => {
    if (ctx.data.inputAnchor === undefined) return null;
    const tsvResource = ctx.prerun?.resolve({
      field: "tsvZip",
      assertFieldType: "Input",
      allowPermanentAbsence: true,
    });
    if (!tsvResource || !tsvResource.getIsReadyOrError()) return undefined;
    if (tsvResource.resourceType.name === "Null") return null;
    return tsvResource.getRemoteFileHandle();
  })

  .sections((ctx) => {
    const showStats =
      ctx.data.inputAnchor !== undefined && hasCompiledSteps(ctx.data.annotationSpecUi);
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
    try {
      if (hasCompiledSteps(ctx.data.annotationSpecUi)) {
        return `Clonotype Annotation - ${ctx.data.annotationSpecUi.title}`;
      }
      const { inputAnchor } = ctx.data;
      if (inputAnchor) {
        const options = ctx.resultPool.getOptions(inputAnchorSpecs, {
          refsWithEnrichments: true,
        });
        const label = options.find((o) => plRefsEqual(o.ref, inputAnchor))?.label;
        if (label) return `Clonotype Browser - ${label}`;
      }
    } catch {
      // render context may not be fully initialized yet
    }
    return "Clonotype Browser";
  })

  .done();

export type Platforma = typeof platforma;
export type BlockOutputs = InferOutputsType<typeof platforma>;
