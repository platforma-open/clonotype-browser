import type {
  AxisId,
  InferHrefType,
  PColumnSpec,
  PlRef,
  RenderCtx } from '@platforma-sdk/model';
import {
  BlockModel,
  generateAnchoredColumnOptions,
  getAxisId,
  isPColumnSpec,
  matchAxisId,
  type InferOutputsType,
} from '@platforma-sdk/model';

type BlockArgs = {
  /** Anchor column from the clonotyping output (must have sampleId and clonotypeKey axes) */
  inputAnchor?: PlRef;
};

type AnchorInfo = {
  anchorSpec: PColumnSpec;
  blockId: string;
  sampleIdAxis: AxisId;
  clonotypeKeyAxis: AxisId;
};

function getAnchorAxes(ctx: RenderCtx<BlockArgs, unknown>): AnchorInfo | undefined {
  if (ctx.args.inputAnchor === undefined)
    return undefined;
  const anchorSpec = ctx.resultPool.getPColumnSpecByRef(ctx.args.inputAnchor);
  if (anchorSpec === undefined)
    return undefined;
  if (anchorSpec.axesSpec.length !== 2
    || anchorSpec.axesSpec[0].name !== 'pl7.app/sampleId'
    || anchorSpec.axesSpec[1].name !== 'pl7.app/vdj/clonotypeKey')
    throw new Error(`Unexpected anchor spec ${JSON.stringify(anchorSpec)}`);
  if (anchorSpec.domain?.['pl7.app/blockId'] !== ctx.args.inputAnchor.blockId)
    throw new Error(`Unexpected anchor spec domain ${JSON.stringify(anchorSpec.domain)}`);
  const sampleIdAxis = getAxisId(anchorSpec.axesSpec[0]);
  const clonotypeKeyAxis = getAxisId(anchorSpec.axesSpec[1]);
  return { anchorSpec, blockId: ctx.args.inputAnchor.blockId, sampleIdAxis, clonotypeKeyAxis };
}

export const platforma = BlockModel.create('Heavy')

  .withArgs<BlockArgs>({})

  .output('inputOptions', (ctx) =>
    ctx.resultPool.getOptions((spec) => isPColumnSpec(spec)
      && spec.axesSpec.length === 2
      && spec.axesSpec[0].name === 'pl7.app/sampleId'
      && spec.axesSpec[1].name === 'pl7.app/vdj/clonotypeKey'
      && spec.annotations?.['pl7.app/isAnchor'] === 'true',
    ),
  )

  .output('metaColumnsOptions', (ctx) => {
    const anchorAxes = getAnchorAxes(ctx);
    if (anchorAxes === undefined)
      return undefined;

    return generateAnchoredColumnOptions(ctx,
      { main: anchorAxes.anchorSpec },
      (spec) => isPColumnSpec(spec)
        && spec.axesSpec.length === 1
        && matchAxisId(anchorAxes.sampleIdAxis, spec.axesSpec[0])
        && (spec.valueType === 'String' || spec.valueType === 'Int' || spec.valueType === 'Long'),
    );
  })

  .output('abundanceColumnsOptions', (ctx) => {
    const anchorAxes = getAnchorAxes(ctx);
    if (anchorAxes === undefined)
      return undefined;
    return generateAnchoredColumnOptions(ctx,
      { main: anchorAxes.anchorSpec },
      (spec) => isPColumnSpec(spec)
        && spec.axesSpec.length === 2
        && matchAxisId(anchorAxes.sampleIdAxis, spec.axesSpec[0])
        && matchAxisId(anchorAxes.clonotypeKeyAxis, spec.axesSpec[1])
        && spec.domain?.['pl7.app/blockId'] === anchorAxes.blockId
        && spec.annotations?.['pl7.app/isAbundance'] === 'true',
    );
  })

  .sections((_ctx) => {
    return [{ type: 'link', href: '/', label: 'Main' }];
  })

  .argsValid((ctx) => false)

  .title((ctx) => 'Clonotype Tagger')

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export { BlockArgs };
