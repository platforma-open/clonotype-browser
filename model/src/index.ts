import type {
  InferHrefType,
  PlRef } from '@platforma-sdk/model';
import {
  BlockModel,
  isPColumnSpec,
  type InferOutputsType,
} from '@platforma-sdk/model';

type BlockArgs = {
  /** Anchor column from the clonotyping output (must have sampleId and clonotypeKey axes) */
  inputAnchor?: PlRef;
};

export const platforma = BlockModel.create('Heavy')

  .withArgs<BlockArgs>({})

  .output('inputOptions', (ctx) =>
    ctx.resultPool.getOptions((spec) => isPColumnSpec(spec)
      && spec.axesSpec.length === 1
      && spec.axesSpec[0].name === 'pl7.app/vdj/clonotypeKey'
      && spec.annotations?.['pl7.app/isAnchor'] === 'true',
    { includeNativeLabel: true },
    ),
    // ctx.resultPool.getSpecs().entries.filter(({ obj: spec }) => isPColumnSpec(spec)
    //   && spec.axesSpec.length === 1
    //   && spec.axesSpec[0].name === 'pl7.app/vdj/clonotypeKey'
    //   && spec.annotations?.['pl7.app/isAnchor'] === 'true',
    // ),
  )

  .sections((_ctx) => {
    return [{ type: 'link', href: '/', label: 'Main' }];
  })

  .argsValid((ctx) => false)

  .title((ctx) => 'Clonotype Tagger')

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export { BlockArgs };
