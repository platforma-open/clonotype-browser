import type {
  InferHrefType,
  PlRef } from '@platforma-sdk/model';
import {
  BlockModel,
  type InferOutputsType,
} from '@platforma-sdk/model';
import type { AnnotationScript } from './filter';

type BlockArgs = {
  /** Anchor column from the clonotyping output (must have sampleId and clonotypeKey axes) */
  inputAnchor?: PlRef;
  /** Annotation script to apply to the input anchor */
  annotationScript: AnnotationScript;
};

export const platforma = BlockModel.create('Heavy')

  .withArgs<BlockArgs>({
    annotationScript: {
      steps: [],
    },
  })

  .output('inputOptions', (ctx) =>
    ctx.resultPool.getOptions({
      axes: [
        { name: 'pl7.app/sampleId' },
        { name: 'pl7.app/vdj/clonotypeKey' },
      ],
      annotations: { 'pl7.app/isAnchor': 'true' },
    }),
  )

  .output('metaColumnOptions', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;

    return ctx.resultPool.getCanonicalOptions(
      { main: ctx.args.inputAnchor },
      {
        type: ['String', 'Int', 'Long'],
        axes: [{ anchor: 'main', name: 'pl7.app/sampleId' }],
      },
    );
  })

  .output('abundanceColumnOptions', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;

    return ctx.resultPool.getCanonicalOptions(
      { main: ctx.args.inputAnchor },
      {
        annotations: { 'pl7.app/isAbundance': 'true' },
        domainAnchor: 'main',
        axes: [
          { split: true },
          { anchor: 'main', name: 'pl7.app/vdj/clonotypeKey' },
        ],
      },
    );
  })

  .output('clonotypeColumnOptions', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;

    return ctx.resultPool.getCanonicalOptions(
      { main: ctx.args.inputAnchor },
      {
        domainAnchor: 'main',
        axes: [
          { anchor: 'main', name: 'pl7.app/vdj/clonotypeKey' },
        ],
        annotations: {
          'pl7.app/table/visibility': 'default',
        },
      },
    );
  })

  .output('filterColumn', (ctx) =>
    ctx.prerun?.resolve('filterColumn')?.getFileContentAsString())

  .output('fullScript', (ctx) =>
    ctx.prerun?.resolve('fullScript')?.getDataAsJson())

  .sections((_ctx) => {
    return [{ type: 'link', href: '/', label: 'Main' }];
  })

  .argsValid((ctx) => false)

  .title((ctx) => 'Clonotype Tagger')

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export { BlockArgs };

export * from './filter';
