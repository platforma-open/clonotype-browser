import type {
  AnchoredPColumnSelector,
  BlockRenderCtx,
  CanonicalizedJson,
  PColumn,
  PColumnDataUniversal,
  PColumnSpec,
  PlRef,
} from "@platforma-sdk/model";
import {
  canonicalizeJson,
  deriveDistinctLabels,
  isLabelColumn,
  PColumnCollection,
} from "@platforma-sdk/model";
import { Annotation, PColumnName, readAnnotation } from "./columns";
import type { TableInputs } from "./types";

// Selectors this block universally treats as internal and hides from tables/exports.
const commonExcludes: AnchoredPColumnSelector[] = [
  { name: PColumnName.SequenceAnnotation },
  { annotations: { [Annotation.IsSubset]: "true" } },
];

/** One linker's entry in `TableInputs.linkedColumns`: the linker's ref, a
 * single-match column query identifying it, and every column reachable through it. */
export interface LinkedColumnEntry {
  anchorRef: PlRef;
  /** Single-match column query for the linker, fed to `bundle.addById` in the
   * workflow. Cluster blocks share linker name; uniqueness comes from axes. */
  anchorId: CanonicalizedJson<AnchoredPColumnSelector>;
  columns: LinkedColumn[];
}

export interface LinkedColumn {
  query: AnchoredPColumnSelector;
  header: string;
}

/** Builds the workflow's `TableInputs`. Returns undefined if the input
 * anchor's spec is unresolved. */
export function buildTableInputs<TArgs, TUiState>(
  ctx: BlockRenderCtx<TArgs, TUiState>,
  inputAnchor: PlRef,
): TableInputs | undefined {
  const anchorSpec = ctx.resultPool.getPColumnSpecByRef(inputAnchor);
  if (!anchorSpec) return undefined;
  return {
    byClonotypeLabels: buildByClonotypeLabels(ctx, inputAnchor),
    linkedColumns: buildLinkedColumns(ctx, anchorSpec),
  };
}

interface LinkerMatch {
  anchorName: string;
  anchorRef: PlRef;
  anchorId: CanonicalizedJson<AnchoredPColumnSelector>;
  /** Position of the OTHER axis in the linker — the side it bridges to. */
  axisIdx: 0 | 1;
}

// `findColumns` discovers linkers too but returns snapshots keyed by the
// internal universal id — the workflow bundle contract wants PlRefs, so we
// stay on `getOptions` and derive the axis position from each linker's spec.
function findLinkers<TArgs, TUiState>(
  ctx: BlockRenderCtx<TArgs, TUiState>,
  anchorSpec: PColumnSpec,
): LinkerMatch[] {
  const clonotypeAxisName = anchorSpec.axesSpec[1].name;
  const isLinker = { [Annotation.IsLinkerColumn]: "true" };
  const options = ctx.resultPool.getOptions([
    { axes: [{}, { name: clonotypeAxisName }], annotations: isLinker },
    { axes: [{ name: clonotypeAxisName }, {}], annotations: isLinker },
  ]);

  const matches: LinkerMatch[] = [];
  for (const [i, opt] of options.entries()) {
    const spec = ctx.resultPool.getPColumnSpecByRef(opt.ref);
    if (!spec) continue;
    const axisIdx: 0 | 1 = spec.axesSpec[0].name === clonotypeAxisName ? 1 : 0;
    matches.push({
      anchorName: `linker-${i}`,
      anchorRef: opt.ref,
      anchorId: canonicalizeJson(linkerSingleMatchQuery(spec)),
      axisIdx,
    });
  }
  return matches;
}

// Single-match pool query for a linker column. Each axis carries name + type
// + string-valued domain (the cluster axis's blockId disambiguates linkers
// from different cluster blocks). Both name and type per axis are required by
// query-anchored.tpl.tengo's direct-axis-reference branch.
function linkerSingleMatchQuery(spec: PColumnSpec): AnchoredPColumnSelector {
  const query: AnchoredPColumnSelector = {
    name: spec.name,
    axes: spec.axesSpec.map((axis) => {
      const domain = pickStringDomain(axis.domain);
      return domain
        ? { name: axis.name, type: axis.type, domain }
        : { name: axis.name, type: axis.type };
    }),
  };
  const colDomain = pickStringDomain(spec.domain);
  if (colDomain) query.domain = colDomain;
  return query;
}

function buildLinkedColumns<TArgs, TUiState>(
  ctx: BlockRenderCtx<TArgs, TUiState>,
  anchorSpec: PColumnSpec,
): Record<string, LinkedColumnEntry> {
  const linkers = findLinkers(ctx, anchorSpec);

  // Collect per-linker first so deriveDistinctLabels runs once over the full
  // set — suffix assignment stays consistent across linkers.
  const perLinker = new Map<string, PColumn<PColumnDataUniversal>[]>();
  for (const { anchorName, anchorRef, axisIdx } of linkers) {
    const linked =
      ctx.resultPool.getAnchoredPColumns({ [anchorName]: anchorRef }, [
        { axes: [{ anchor: anchorName, idx: axisIdx }] },
      ]) ?? [];
    perLinker.set(
      anchorName,
      linked.filter((p) => !isLabelColumn(p.spec)),
    );
  }
  const labelMap = deriveLabelsFromTrace([...perLinker.values()].flat());

  const result: Record<string, LinkedColumnEntry> = {};
  for (const { anchorName, anchorRef, anchorId, axisIdx } of linkers) {
    const linkedCols = perLinker.get(anchorName) ?? [];
    if (linkedCols.length === 0) continue;
    const columns: LinkedColumn[] = linkedCols.map((p) => ({
      query: linkedColumnQuery(p.spec, anchorName, axisIdx),
      header: labelMap.get(p.id) ?? readAnnotation(p.spec, Annotation.Label) ?? "",
    }));
    result[anchorName] = { anchorRef, anchorId, columns };
  }
  return result;
}

function deriveLabelsFromTrace(
  columns: PColumn<PColumnDataUniversal>[],
): Map<string, string> {
  if (columns.length === 0) return new Map();
  const labels = deriveDistinctLabels(
    columns.map((c) => c.spec),
    { includeNativeLabel: true },
  );
  return new Map(columns.map((c, i) => [c.id, labels[i]]));
}

function linkedColumnQuery(
  spec: PColumnSpec,
  anchorName: string,
  axisIdx: number,
): AnchoredPColumnSelector {
  const query: AnchoredPColumnSelector = { axes: [{ anchor: anchorName, idx: axisIdx }] };
  const domain = pickStringDomain(spec.domain);
  if (domain) query.domain = domain;
  if (spec.name) query.name = spec.name;
  return query;
}

// Per-clonotype label override key — mirrors the workflow's `makeColumnKey`
// (export-plan.lib.tengo), which Tengo can't share with TS. Keep the two
// canonicalisations identical: `{name, domain}` only.
function clonotypeLabelKey(spec: PColumnSpec): string {
  const key: { name: string; domain?: Record<string, string> } = { name: spec.name };
  const domain = pickStringDomain(spec.domain);
  if (domain) key.domain = domain;
  return canonicalizeJson(key);
}

// Canonical spec-JSON → user-visible label. The workflow looks columns up by
// the same canonical key; canonicalizeJson must stay identical on both sides.
function buildByClonotypeLabels<TArgs, TUiState>(
  ctx: BlockRenderCtx<TArgs, TUiState>,
  inputAnchor: PlRef,
): Record<string, string> {
  const anchorCtx = ctx.resultPool.resolveAnchorCtx({ main: inputAnchor });
  if (!anchorCtx) return {};

  const collection = new PColumnCollection()
    .addColumnProvider(ctx.resultPool)
    .addAxisLabelProvider(ctx.resultPool);

  const entries = collection.getUniversalEntries(
    [
      { domainAnchor: "main", axes: [{ anchor: "main", idx: 1 }] },
      {
        domainAnchor: "main",
        axes: [{ split: true }, { anchor: "main", idx: 1 }],
        annotations: { [Annotation.IsAbundance]: "true" },
      },
    ],
    { anchorCtx, exclude: commonExcludes, overrideLabelAnnotation: true },
  );
  if (!entries) return {};

  const result: Record<string, string> = {};
  for (const entry of entries) {
    const label = readAnnotation(entry.spec, Annotation.Label) || "";
    if (!label) continue;
    result[clonotypeLabelKey(entry.spec)] = label;
  }
  return result;
}

// Sorted keys are required: the returned object ends up inside block args,
// and JSON.stringify emits properties in insertion order — backend caching
// needs stable serialization.
function pickStringDomain(
  domain: PColumnSpec["domain"] | undefined,
): Record<string, string> | undefined {
  if (!domain || Object.keys(domain).length === 0) return undefined;
  const out: Record<string, string> = {};
  for (const k of Object.keys(domain).sort()) {
    const v = domain[k];
    if (typeof v === "string") out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
