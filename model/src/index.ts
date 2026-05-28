import type {
  AxesSpec, ColumnRecipe,
  ColumnUniversalId,
  InferOutputsType,
  PColumnSpec,
  PlRef,
  PObjectId,
  RelaxedColumnSelector
} from "@platforma-sdk/model";
import {
  BlockModelV3,
  Column,
  ColumnsCollection,
  convertFilterSpecsToExpressionSpecs,
  createPlDataTableSheet,
  createPlDataTableV3,
  deriveAxisValuesLabels,
  deriveDistinctLabels,
  expandByPartition,
  deriveColumnOptions,
  getLeafColumnData,
  getUniquePartitionKeys, isLeafColumn, isPlRef, TreeNodeAccessor
} from "@platforma-sdk/model";
import {
  Annotation,
  isAbundanceColumn, PAxisName,
  PColumnName,
  readAnnotation
} from "./columns";
import { blockDataModel } from "./dataModel";
import type { BlockArgs, BlockData } from "./types";

export { blockDataModel } from "./dataModel";
export * from "./types";

const inputAnchorSelectors: RelaxedColumnSelector[] = [
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

  .output("inputOptions", () =>
    deriveColumnOptions(
      ColumnsCollection(["result_pool"]).filter({ include: inputAnchorSelectors }),
    ),
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
    const result = findOverlapMatches(ctx.data.inputAnchor);
    if (!result) return undefined;

    // Annotation results must not appear as filter inputs for their own definition.
    const variants = result.collection
      .filter({ exclude: { name: { type: "exact", value: PColumnName.AnnotationResult } } })
      .getColumns();
    if (variants.length === 0) return undefined;

    return {
      pFrame: ctx.createPFrame(variants.map((c) => c.id)),
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
    const extraSources = annotation?.getIsReadyOrError() ? [annotation] : undefined;
    const result = findOverlapMatches(ctx.data.inputAnchor, extraSources);
    if (!result) return undefined;

    const columns = result.collection.getColumns();

    // Direct multi-axis abundance columns split by sampleId (axis 0).
    const isAbundanceToSplit = (spec: PColumnSpec) =>
      isAbundanceColumn(spec) && spec.axesSpec.length > 1;

    // Leaves go to primary; wrapped (linker-reachable) recipes become secondary.
    const splitInputs: ColumnRecipe[] = [];
    const directLeaves: ColumnRecipe[] = [];
    const wrappedRecipes: ColumnRecipe[] = [];

    for (const c of columns) {
      if (isLeafColumn(c)) {
        if (isAbundanceToSplit(c.getSpec())) {
          splitInputs.push(c);
        } else {
          directLeaves.push(c);
        }
      } else {
        wrappedRecipes.push(c);
      }
    }

    const splitRecipes = expandByPartition(splitInputs, [{ idx: 0 }], {
      axisValuesLabels: deriveAxisValuesLabels(),
    });
    if (!splitRecipes) return undefined;

    return createPlDataTableV3(ctx, {
      primaryColumns: [...splitRecipes, ...directLeaves],
      columns: wrappedRecipes,
      primaryJoinType: "full",
      tableState: ctx.data.overlapTableState,
      displayOptions: {
        visibility: [
          // Sample-count columns stay default — explicit match first wins.
          {
            match: { name: "^(pl7\\.app/vdj/sampleCount|pl7\\.app/sampleCount)$" },
            visibility: "default",
          },
          // Other abundance columns drop to optional.
          {
            match: { annotations: { [Annotation.IsAbundance]: "true" } },
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
        anchors: { main: ctx.data.inputAnchor as unknown as PObjectId },
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
    const anchor = Column(ctx.data.inputAnchor);
    if (!anchor) return undefined;
    const data = getLeafColumnData(anchor);
    if (!(data instanceof TreeNodeAccessor)) return undefined;
    const samples = getUniquePartitionKeys(data)?.[0];
    if (!samples) return undefined;
    return [createPlDataTableSheet(ctx, anchor.getSpec().axesSpec[0], samples)];
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

    const annotationRecipes = ColumnsCollection([annotationStatsPf]).getColumns();
    const sampleRecipes = ColumnsCollection([sampleStatsPf]).getColumns();

    // sampleStats is keyed on [sampleId, annotationKey] — split by sampleId so
    // each sample becomes its own annotation-keyed column set that joins with
    // annotationStats on annotationKey.
    const sampleInputs = sampleRecipes.filter(isLeafColumn);
    if (sampleInputs.length !== sampleRecipes.length) return undefined;

    const splitSampleRecipes = expandByPartition(sampleInputs, [{ idx: 0 }], {
      axisValuesLabels: deriveAxisValuesLabels(),
    });
    if (splitSampleRecipes === undefined) return undefined;

    return createPlDataTableV3(ctx, {
      primaryColumns: [...annotationRecipes, ...splitSampleRecipes],
      columns: [],
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

  .enriches((args) => {
    if (args.inputAnchor === undefined || args.annotationSpec.steps.length === 0) return [];
    const ref = universalIdToPlRef(args.inputAnchor);
    return ref ? [ref] : [];
  })

  .output("modality", (ctx) => {
    const spec = ctx.data.inputAnchor
      ? Column(ctx.data.inputAnchor)?.getSpec()
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
    if (hasCompiledSteps(ctx.data.annotationSpecUi)) {
      return `Sequence Annotation - ${ctx.data.annotationSpecUi.title}`;
    }
    
    const { inputAnchor } = ctx.data;
    
    if (inputAnchor) {
      const columns = ColumnsCollection(["result_pool"]).filter({ include: inputAnchorSelectors }).getColumns();
      const labels = deriveDistinctLabels(columns.map(v => v.getSpec()),{ includeNativeLabel: true })
      const label = labels[columns.findIndex(c => c.id === inputAnchor)];
      if (label) return `Sequence Browser - ${label}`;
    }
    
    return "Sequence Browser";
  })

  .done();

export type Platforma = typeof platforma;
export type BlockOutputs = InferOutputsType<typeof platforma>;

function buildFilterUiColumns(
  variants: readonly ColumnRecipe[],
  anchorAxesSpec: AxesSpec,
) {
  // Each variant pays one host round-trip; cache locally to keep the rest of
  // this function spec-access free.
  const specs = variants.map((c) => c.getSpec());

  const distinctLabels = deriveDistinctLabels(specs, { includeNativeLabel: true });
  const labelSpecs = specs.filter((s) => s.name === PColumnName.Label);

  const ret = variants.map((v, i) => {
    const spec = specs[i];
    const axesSpec = spec.axesSpec;
    return {
      id: v.id,
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

/**
 * Build the overlap discovery collection and resolve the anchor spec.
 * Returns `{ collection, anchorSpec }` — the collection holds discovery
 * survivors (still as host-side state, no specs fetched); per-output filters
 * (e.g. dropping `AnnotationResult` for `overlapColumns`) refine it further.
 */
function findOverlapMatches(
  inputAnchor: ColumnUniversalId,
  extraSources?: TreeNodeAccessor[],
) {
  const anchorSpec = Column(inputAnchor)?.getSpec();
  if (!anchorSpec) return undefined;

  // Default ctx triplet (outputs + prerun + result pool) plus any caller-
  // supplied subtree (e.g. the prerun annotation accessor).
  const sources: (TreeNodeAccessor | "current_block" | "result_pool")[] = [
    "current_block",
    "result_pool",
  ];
  if (extraSources) sources.unshift(...extraSources);

  let collection = ColumnsCollection(sources)
    .discover({
      anchors: { main: anchorSpec },
      mode: "enrichment",
      exclude: [
        { name: [{ type: "exact", value: PColumnName.SequenceAnnotation }] },
        { annotations: { [Annotation.IsSubset]: [{ type: "exact", value: "true" }] } },
        {
          axes: [{ name: [{ type: "exact", value: anchorSpec.axesSpec[0].name }] }],
          partialAxesMatch: false,
        },
      ],
    });

  // Linked multi-axis columns (e.g. per-sample abundance on clusterId) bring
  // extra dimensions into the join and belong in the sample table instead.
  const survivors = collection.getColumns().filter((c) => {
    return isLeafColumn(c) || c.getSpec().axesSpec.length === 1;
  });
  collection = ColumnsCollection([{ columns: survivors, isFinal: collection.isFinal() }]);

  return { collection, anchorSpec };
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

/**
 * `enriches` expects `PlRef[]`. Our `inputAnchor` is now a `ColumnUniversalId`
 * — for result-pool leaves that is `createGlobalPObjectId(blockId, name)`,
 * which is exactly the canonical JSON of `{ __isRef, blockId, name }`. Parse
 * it back to recover the original `PlRef`.
 */
function universalIdToPlRef(id: ColumnUniversalId): PlRef | undefined {
  try {
    const parsed = JSON.parse(id);
    if (isPlRef(parsed)) {
      return parsed;
    }
  } catch {
    // wrapped (filtered/discovered/overrided) ids — no underlying single ref.
  }
  return undefined;
}