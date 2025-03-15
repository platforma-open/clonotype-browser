import type { LabelDerivationOps, RenderCtx } from '@platforma-sdk/model';
import { deriveLabels, getAxisId, isPColumnSpec, type AxisId, type PColumnSpec } from '@platforma-sdk/model';
import { pick, pipe } from 'remeda';
import canonicalize from 'canonicalize';

/** [anchorId, axisIndex] */
export type AnchorAxisRef = [string, number];

export type GenDomain = string | { anc: string };
export type GenAxisId = AxisId | AnchorAxisRef;

export type GenPColumnId = {
  name: string;
  domain: Record<string, GenDomain>;
  axes: GenAxisId[];
};

function axisKey(axis: AxisId): string {
  return canonicalize(getAxisId(axis))!;
}

function domainKey(key: string, value: string): string {
  return JSON.stringify([key, value]);
}

export class GenIdContext {
  private readonly domains = new Map<string, string>();
  private readonly axes = new Map<string, AnchorAxisRef>();

  constructor(anchors: Record<string, PColumnSpec>) {
    for (const [anchorId, spec] of Object.entries(anchors)) {
      for (let axisIdx = 0; axisIdx < spec.axesSpec.length; axisIdx++) {
        const axis = spec.axesSpec[axisIdx];
        const key = axisKey(axis);
        this.axes.set(key, [anchorId, axisIdx]);
      }
      for (const [dKey, dValue] of Object.entries(spec.domain ?? {})) {
        const key = domainKey(dKey, dValue);
        this.domains.set(key, anchorId);
      }
    }
  }

  deriveGeneralizedId(spec: PColumnSpec): GenPColumnId {
    const domain: Record<string, GenDomain> = {};
    for (const [dKey, dValue] of Object.entries(spec.domain ?? {})) {
      const key = domainKey(dKey, dValue);
      const anchorId = this.domains.get(key);
      domain[dKey] = anchorId ? { anc: anchorId } : dValue;
    }

    const axes: GenAxisId[] = spec.axesSpec.map((axis) => {
      const key = axisKey(axis);
      const anchorAxisRef = this.axes.get(key);
      return anchorAxisRef || axis;
    });

    return {
      name: spec.name,
      domain,
      axes,
    };
  }
}

export function getGeneralizedIdOptions(
  ctx: RenderCtx<unknown, unknown>,
  anchorsOrCtx: GenIdContext | Record<string, PColumnSpec>,
  predicate: (spec: PColumnSpec) => boolean,
  labelOps?: LabelDerivationOps,
): { label: string; value: string }[] {
  const filtered = ctx.resultPool.getSpecs().entries.filter(({ obj: spec }) => isPColumnSpec(spec) && predicate(spec));
  const genIdCtx = anchorsOrCtx instanceof GenIdContext ? anchorsOrCtx : new GenIdContext(anchorsOrCtx);
  return deriveLabels(filtered, (o) => o.obj, labelOps ?? {}).map(({ value: { obj: spec }, label }) => ({
    value: canonicalize(genIdCtx.deriveGeneralizedId(spec as PColumnSpec))!,
    label,
  }));
}
