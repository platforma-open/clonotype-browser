import type {
  AxesSpec,
  ColumnSnapshot,
  ColumnVariant,
  DiscoveredPColumnId,
  InferOutputsType,
  PColumn,
  PColumnDataUniversal,
  PColumnSpec,
  PlRef,
  PObjectId,
  SUniversalPColumnId,
} from "@platforma-sdk/model";
import {
  BlockModelV3,
  collectCtxColumnSnapshotProviders,
  ColumnCollectionBuilder,
  convertFilterSpecsToExpressionSpecs,
  createDiscoveredPColumnId,
  createPlDataTableSheet,
  createPlDataTableV3,
  deriveDistinctLabels,
  expandByPartition,
  getUniquePartitionKeys,
  OutputColumnProvider,
  plRefsEqual,
  type RenderCtxBase,
} from "@platforma-sdk/model";
import {
  Annotation,
  getTrace,
  isAbundanceColumn,
  isSampleCountColumn,
  PAxisName,
  PColumnName,
  readAnnotation,
} from "./columns";
import { blockDataModel } from "./dataModel";
import type { BlockArgs, BlockData } from "./types";

export { blockDataModel } from "./dataModel";
export * from "./types";

const inputAnchorSpecs = [
  {
    axes: [{ name: PAxisName.SampleId }, { name: PAxisName.VDJ.ClonotypeKey }],
    annotations: { [Annotation.IsAnchor]: "true" },
  },
  {
    axes: [{ name: PAxisName.SampleId }, { name: PAxisName.VDJ.ScClonotypeKey }],
    annotations: { [Annotation.IsAnchor]: "true" },
  },
  {
    // @TODO: PAxisName.VariantKey is not yet exposed in the SDK — string literal until it lands.
    axes: [{ name: PAxisName.SampleId }, { name: "pl7.app/variantKey" }],
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
    };
  })

  .prerunArgs((data) => {
    if (data.inputAnchor === undefined) return undefined;
    const annotationSpec = compileAnnotationSpec(data.annotationSpecUi);
    if (annotationSpec.steps.length === 0) return undefined;
    return {
      inputAnchor: data.inputAnchor,
      annotationSpec,
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
    const variants = result.variants.filter(
      (m) => m.column.spec.name !== PColumnName.AnnotationResult,
    );

    const entries = variants.map((m) => ({
      id: m.column.id,
      spec: m.column.spec,
      data: m.column.data?.get(),
    })) as PColumn<PColumnDataUniversal>[];
    if (entries.length === 0) return undefined;

    return {
      pFrame: ctx.createPFrame(entries),
      columns: buildFilterUiColumns(variants, result.anchorSpec.axesSpec),
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

    const { variants } = result;

    // Direct multi-axis abundance columns split by sampleId (axis 0).
    const isAbundanceToSplit = (spec: PColumnSpec) =>
      isAbundanceColumn(spec) && spec.axesSpec.length > 1;

    // Variants from non-split direct paths and from linked paths.
    const nonSplitDirect: ReturnType<typeof toTableColumnVariant>[] = [];
    const linked: ReturnType<typeof toTableColumnVariant>[] = [];
    const splitInputs: ColumnSnapshot<PObjectId>[] = [];

    for (const v of variants) {
      if (v.path.length === 0 && isAbundanceToSplit(v.column.spec)) {
        splitInputs.push(v.column);
      } else if (v.path.length === 0) {
        nonSplitDirect.push(toTableColumnVariant(v, false));
      } else {
        linked.push(toTableColumnVariant(v, false));
      }
    }

    const splitColumns = splitByPartition(ctx, splitInputs, 0);
    if (!splitColumns) return undefined;

    const splitSnapshots = splitColumns.map((col) => ({
      column: {
        id: col.id as unknown as DiscoveredPColumnId,
        spec: col.spec,
        data: col.data,
        dataStatus: col.dataStatus,
      },
      path: [],
      qualifications: { forHit: [], forQueries: {} },
      originalId: col.id,
      isPrimary: true,
    }));

    return createPlDataTableV3(ctx, {
      columns: [...splitSnapshots, ...nonSplitDirect, ...linked],
      primaryJoinType: "full",
      tableState: ctx.data.overlapTableState,
      displayOptions: {
        visibility: [
          {
            match: (spec: PColumnSpec) =>
              isAbundanceColumn(spec) && !isSampleCountColumn(spec),
            visibility: "optional",
          },
        ],
      },
    });
  })

  .outputWithStatus("sampleTable", (ctx) => {
    if (ctx.data.inputAnchor === undefined) return undefined;
    return createPlDataTableV3(ctx, {
      columns: {
        anchors: { main: ctx.data.inputAnchor },
        selector: {
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
        column: {
          id: s.id as unknown as DiscoveredPColumnId,
          spec: s.spec,
          data: s.data,
          dataStatus: s.dataStatus,
        },
        path: [],
        qualifications: { forHit: [], forQueries: {} },
        originalId: s.id,
        isPrimary: true,
      })),
      tableState: ctx.data.statsTableState,
    });
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

  .output("modality", (ctx) => {
    const spec = ctx.data.inputAnchor
      ? ctx.resultPool.getPColumnSpecByRef(ctx.data.inputAnchor)
      : undefined;
    if (!spec) return undefined;
    for (const ax of spec.axesSpec) {
      if (ax.name === "pl7.app/variantKey") return "peptide";
      if (ax.name === "pl7.app/vdj/clonotypeKey" || ax.name === "pl7.app/vdj/scClonotypeKey") return "antibody_tcr";
      // clustered abundances
      for (const key of Object.keys(ax.domain ?? {})) {
        if (key.startsWith("pl7.app/peptide/")) return "peptide";
        if (key.startsWith("pl7.app/vdj/")) return "antibody_tcr";
      }
    }
    // Fallback when the input is resolved but unrecognized. The early
    // `if (!spec) return undefined` above lets the retentive flag preserve the
    // last-known modality during transient unavailability (re-runs, loading).
    return "antibody_tcr";
  }, { retentive: true })

  .title((ctx) => {
    try {
      if (hasCompiledSteps(ctx.data.annotationSpecUi)) {
        return `Sequence Annotation - ${ctx.data.annotationSpecUi.title}`;
      }
      const { inputAnchor } = ctx.data;
      if (inputAnchor) {
        const options = ctx.resultPool.getOptions(inputAnchorSpecs, {
          refsWithEnrichments: true,
        });
        const label = options.find((o) => plRefsEqual(o.ref, inputAnchor))?.label;
        if (label) return `Sequence Browser - ${label}`;
      }
    } catch {
      // render context may not be fully initialized yet
    }
    return "Sequence Browser";
  })

  .done();

export type Platforma = typeof platforma;
export type BlockOutputs = InferOutputsType<typeof platforma>;

function buildFilterUiColumns(
  variants: readonly ColumnVariant[],
  anchorAxesSpec: AxesSpec,
) {
  const distinctLabels = deriveDistinctLabels(
    variants.map((v) => ({
      spec: v.column.spec,
      linkersPath: v.path.map((step) => ({ spec: step.linker.spec })),
    })),
    { includeNativeLabel: true },
  );
  const labelSpecs = variants
    .map((v) => v.column.spec)
    .filter((s) => s.name === PColumnName.Label);
  const ret = variants.map((m, i) => {
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

function splitByPartition<A, U>(
  ctx: RenderCtxBase<A, U>,
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
function findOverlapMatches<A, U>(
  ctx: RenderCtxBase<A, U>,
  inputAnchor: PlRef,
  extraSources?: Parameters<ColumnCollectionBuilder["addSource"]>[0][],
) {
  const anchorSpec = ctx.resultPool.getPColumnSpecByRef(inputAnchor);
  if (!anchorSpec) return undefined;

  const builder = new ColumnCollectionBuilder(ctx.getService("pframeSpec"));
  if (extraSources) for (const src of extraSources) builder.addSource(src);
  builder.addSources(collectCtxColumnSnapshotProviders(ctx));

  const collection = builder.build({ anchors: { main: anchorSpec } });
  if (!collection) return undefined;

  const matches = collection.findColumnVariants({
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
  return { variants: filtered, anchorSpec };
}

function toTableColumnVariant(variant: ColumnVariant, isPrimary: boolean) {
  const id = createDiscoveredPColumnId({
    column: variant.column.id,
    path: variant.path.map((p) => ({
      type: "linker" as const,
      column: p.linker.id,
      qualifications: p.qualifications,
    })),
    columnQualifications: variant.qualifications.forHit,
    queriesQualifications: variant.qualifications.forQueries,
  });
  return {
    column: {
      id,
      spec: variant.column.spec,
      data: variant.column.data,
      dataStatus: variant.column.dataStatus,
    },
    path: variant.path,
    qualifications: variant.qualifications,
    originalId: variant.column.id,
    isPrimary,
  };
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
