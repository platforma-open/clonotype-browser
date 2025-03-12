import type {
  InferHrefType } from '@platforma-sdk/model';
import {
  BlockModel,
  type InferOutputsType,
} from '@platforma-sdk/model';

type BlockArgs = {
  input?: string;
};

export const platforma = BlockModel.create('Heavy')

  .withArgs<BlockArgs>({})

  .sections((_ctx) => {
    return [{ type: 'link', href: '/', label: 'Main' }];
  })

  .argsValid((ctx) => true)

  .title((ctx) => 'Clonotype Tagger')

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export { BlockArgs };
