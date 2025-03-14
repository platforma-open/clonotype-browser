import type {
  BlockArgs,
  BlockOutputs as MiXCRClonotypingBlockOutputs,
  platforma as mixcrPlatforma } from '@platforma-open/milaboratories.mixcr-clonotyping-2.model';
import {
  AlignReport,
  AssembleReport,
  Qc,
  SupportedPresetList,
  uniquePlId,
} from '@platforma-open/milaboratories.mixcr-clonotyping-2.model';
import { awaitStableState, blockTest } from '@platforma-sdk/test';
import { blockSpec as samplesAndDataBlockSpec } from '@platforma-open/milaboratories.samples-and-data';
import type { BlockArgs as SamplesAndDataBlockArgs } from '@platforma-open/milaboratories.samples-and-data.model';
import { blockSpec as clonotypingBlockSpec } from '@platforma-open/milaboratories.mixcr-clonotyping-2';
import { blockSpec as annotationBlockSpec } from 'this-block';
import type { platforma } from '@platforma-open/milaboratories.clonotype-tagger.model';
import type { InferBlockState } from '@platforma-sdk/model';
import { fromPlRef, wrapOutputs } from '@platforma-sdk/model';

blockTest(
  'simple project',
  { timeout: 55000 },
  async ({ rawPrj: project, ml, helpers, expect }) => {
    const sndBlockId = await project.addBlock('Samples & Data', samplesAndDataBlockSpec);
    const clonotypingBlockId = await project.addBlock('MiXCR Clonotyping', clonotypingBlockSpec);
    const annotationBlockId = await project.addBlock('Clonotype Annotation', annotationBlockSpec);

    const sample1Id = uniquePlId();
    const metaColumn1Id = uniquePlId();
    const dataset1Id = uniquePlId();

    const r1Handle = await helpers.getLocalFileHandle('./assets/small_data_R1.fastq.gz');
    const r2Handle = await helpers.getLocalFileHandle('./assets/small_data_R2.fastq.gz');

    await project.setBlockArgs(sndBlockId, {
      metadata: [
        {
          id: metaColumn1Id,
          label: 'MetaColumn1',
          global: false,
          valueType: 'Long',
          data: {
            [sample1Id]: 2345,
          },
        },
      ],
      sampleIds: [sample1Id],
      sampleLabelColumnLabel: 'Sample Name',
      sampleLabels: { [sample1Id]: 'Sample 1' },
      datasets: [
        {
          id: dataset1Id,
          label: 'Dataset 1',
          content: {
            type: 'Fastq',
            readIndices: ['R1', 'R2'],
            gzipped: true,
            data: {
              [sample1Id]: {
                R1: r1Handle,
                R2: r2Handle,
              },
            },
          },
        },
      ],
    } satisfies SamplesAndDataBlockArgs);
    await project.runBlock(sndBlockId);
    await helpers.awaitBlockDone(sndBlockId, 8000);
    const sndBlockState = project.getBlockState(sndBlockId);
    const clonotypingBlockState = project.getBlockState(clonotypingBlockId);

    const sdnStableState1 = await helpers.awaitBlockDoneAndGetStableBlockState(sndBlockId, 8000);
    expect(sdnStableState1.outputs).toMatchObject({
      fileImports: { ok: true, value: { [r1Handle]: { done: true }, [r2Handle]: { done: true } } },
    });

    const clonotypingStableState1 = (await awaitStableState(
      clonotypingBlockState,
      25000,
    )) as InferBlockState<typeof mixcrPlatforma>;

    expect(clonotypingStableState1.outputs).toMatchObject({
      inputOptions: {
        ok: true,
        value: [
          {
            label: 'Dataset 1',
          },
        ],
      },
    });

    const presets = SupportedPresetList.parse(
      JSON.parse(
        Buffer.from(
          await ml.driverKit.blobDriver.getContent(wrapOutputs(clonotypingStableState1.outputs).presets!.handle),
        ).toString(),
      ),
    );
    expect(presets).length.gt(10);

    const clonotypingStableState1Outputs = wrapOutputs(clonotypingStableState1.outputs);

    await project.setBlockArgs(clonotypingBlockId, {
      input: clonotypingStableState1Outputs.inputOptions[0].ref,
      preset: { type: 'name', name: 'milab-human-dna-xcr-7genes-multiplex' },
      chains: ['IGHeavy', 'TRB'],
    } satisfies BlockArgs);

    const clonotypingStableState2 = (await awaitStableState(
      project.getBlockState(clonotypingBlockId),
      25000,
    )) as InferBlockState<typeof mixcrPlatforma>;

    const outputs2 = wrapOutputs<MiXCRClonotypingBlockOutputs>(clonotypingStableState2.outputs);
    expect(outputs2.sampleLabels![sample1Id]).toBeDefined();

    await project.runBlock(clonotypingBlockId);
    const clonotypingStableState3 = (await helpers.awaitBlockDoneAndGetStableBlockState<typeof mixcrPlatforma>(
      clonotypingBlockId,
      35000,
    ));
    const outputs3 = wrapOutputs<MiXCRClonotypingBlockOutputs>(clonotypingStableState3.outputs);
    expect(outputs3.reports.isComplete).toEqual(true);

    const annotationStableState1 = (await awaitStableState(
      project.getBlockState(annotationBlockId),
      25000,
    )) as InferBlockState<typeof platforma>;
    console.dir(annotationStableState1, { depth: 8 });
  },
);
