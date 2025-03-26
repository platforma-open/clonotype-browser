import type {
  InferHrefType,
  PlRef } from '@platforma-sdk/model';
import {
  BlockModel,
  type InferOutputsType,
} from '@platforma-sdk/model';
import type { ExtraColumnSpec } from './extra_column';

// type Annotaiton = {
//   filter: {
//     // equals, less, rank, count
//     // sequence match, fuzzyMatch
//     // vgene, ...
//   },
//   label: string;
// }

// // cloneKey -> Label
// // // OnlyLabel=12 = > cloneKey
// // Sample, Label -> abundance..., numberOfCLones

type BlockArgs = {
  /** Anchor column from the clonotyping output (must have sampleId and clonotypeKey axes) */
  inputAnchor?: PlRef;
  /** Extra columns to aggregate */
  extraColumns: ExtraColumnSpec[];
  // annotations: Annotaiton[];
};

export const platforma = BlockModel.create('Heavy')

  .withArgs<BlockArgs>({
    extraColumns: [],
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

  .output('metaColumnsOptions', (ctx) => {
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

  .output('abundanceColumnsOptions', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;

    return ctx.resultPool.getCanonicalOptions(
      { main: ctx.args.inputAnchor },
      {
        annotations: { 'pl7.app/isAbundance': 'true' },
        domainAnchor: 'main',
        axes: [
          { anchor: 'main', name: 'pl7.app/sampleId' },
          { anchor: 'main', name: 'pl7.app/vdj/clonotypeKey' },
        ],
      },
    );
  })

  .output('extraColumns', (ctx) => {
    const extraColumns = ctx.prerun?.resolve('extraColumns');
    if (extraColumns === undefined)
      return undefined;

    return extraColumns.mapFields((name, val) => {
      return {
        name,
        data: val?.getFileContentAsString(),
      };
    });
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
