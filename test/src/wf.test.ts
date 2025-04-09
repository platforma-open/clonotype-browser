import type {
  BlockArgs as MiXCRClonotypingBlockArgs,
  BlockOutputs as MiXCRClonotypingBlockOutputs,
  platforma as mixcrPlatforma } from '@platforma-open/milaboratories.mixcr-clonotyping-2.model';
import {
  SupportedPresetList,
  uniquePlId,
} from '@platforma-open/milaboratories.mixcr-clonotyping-2.model';
import { awaitStableState, blockTest } from '@platforma-sdk/test';
import { blockSpec as samplesAndDataBlockSpec } from '@platforma-open/milaboratories.samples-and-data';
import type { BlockArgs as SamplesAndDataBlockArgs } from '@platforma-open/milaboratories.samples-and-data.model';
import { blockSpec as clonotypingBlockSpec } from '@platforma-open/milaboratories.mixcr-clonotyping-2';
import { blockSpec as annotationBlockSpec } from 'this-block';
import type { BlockArgs, BlockOutputs, platforma } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import type { InferBlockState } from '@platforma-sdk/model';
import { wrapOutputs } from '@platforma-sdk/model';

blockTest(
  'simple project byClonotype mode',
  { timeout: 300000 },
  async ({ rawPrj: project, ml, helpers, expect }) => {
    const sndBlockId = await project.addBlock('Samples & Data', samplesAndDataBlockSpec);
    const clonotypingBlockId = await project.addBlock('MiXCR Clonotyping', clonotypingBlockSpec);
    const annotationBlockId = await project.addBlock('Clonotype Annotation', annotationBlockSpec);

    const metaColumnDonorId = uniquePlId();
    const metaColumnTissueId = uniquePlId();
    const metaColumnDayAfterVaccinationId = uniquePlId();
    const dataset1Id = uniquePlId();

    const s652_sampleId = uniquePlId();
    const s652_r1Handle = await helpers.getLocalFileHandle('./assets/SRR11233652_sampledBulk_R1.fastq.gz');
    const s652_r2Handle = await helpers.getLocalFileHandle('./assets/SRR11233652_sampledBulk_R2.fastq.gz');
    const s663_sampleId = uniquePlId();
    const s663_r1Handle = await helpers.getLocalFileHandle('./assets/SRR11233663_sampledBulk_R1.fastq.gz');
    const s663_r2Handle = await helpers.getLocalFileHandle('./assets/SRR11233663_sampledBulk_R2.fastq.gz');
    const s664_sampleId = uniquePlId();
    const s664_r1Handle = await helpers.getLocalFileHandle('./assets/SRR11233664_sampledBulk_R1.fastq.gz');
    const s664_r2Handle = await helpers.getLocalFileHandle('./assets/SRR11233664_sampledBulk_R2.fastq.gz');

    await project.setBlockArgs(sndBlockId, {
      metadata: [
        {
          id: metaColumnDonorId,
          label: 'Donor',
          global: false,
          valueType: 'String',
          data: {
            [s652_sampleId]: '321-05',
            [s663_sampleId]: '321-04',
            [s664_sampleId]: '321-04',
          },
        },
        {
          id: metaColumnTissueId,
          label: 'Tissue',
          global: true,
          valueType: 'String',
          data: {
            [s652_sampleId]: 'Plasmablasts',
            [s663_sampleId]: 'PBMC',
            [s664_sampleId]: 'Plasmablasts',
          },
        },
        {
          id: metaColumnDayAfterVaccinationId,
          label: 'Day after vaccination',
          global: false,
          valueType: 'Long',
          data: {
            [s652_sampleId]: 5,
            [s663_sampleId]: 0,
            [s664_sampleId]: 5,
          },
        },
      ],
      sampleIds: [s652_sampleId, s663_sampleId, s664_sampleId],
      sampleLabelColumnLabel: 'Sample Name',
      sampleLabels: { [s652_sampleId]: 'SRR11233652', [s663_sampleId]: 'SRR11233663', [s664_sampleId]: 'SRR11233664' },
      datasets: [{
        id: dataset1Id,
        label: 'Dataset 1',
        content: {
          type: 'Fastq',
          readIndices: ['R1', 'R2'],
          gzipped: true,
          data: {
            [s652_sampleId]: {
              R1: s652_r1Handle,
              R2: s652_r2Handle,
            },
            [s663_sampleId]: {
              R1: s663_r1Handle,
              R2: s663_r2Handle,
            },
            [s664_sampleId]: {
              R1: s664_r1Handle,
              R2: s664_r2Handle,
            },
          },
        },
      }],
    } satisfies SamplesAndDataBlockArgs);
    await project.runBlock(sndBlockId);
    await helpers.awaitBlockDone(sndBlockId, 100000);
    // const sndBlockState = project.getBlockState(sndBlockId);
    const clonotypingBlockState = project.getBlockState(clonotypingBlockId);

    const sdnStableState1 = await helpers.awaitBlockDoneAndGetStableBlockState(sndBlockId, 100000);
    expect(sdnStableState1.outputs).toMatchObject({
      fileImports: { ok: true, value: { [s652_r1Handle]: { done: true }, [s652_r2Handle]: { done: true }, [s663_r1Handle]: { done: true }, [s663_r2Handle]: { done: true }, [s664_r1Handle]: { done: true }, [s664_r2Handle]: { done: true } } },
    });

    const clonotypingStableState1 = (await awaitStableState(
      clonotypingBlockState,
      100000,
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
      preset: { type: 'name', name: 'neb-human-rna-xcr-umi-nebnext' },
      chains: ['IGHeavy'],
    } satisfies MiXCRClonotypingBlockArgs);

    const clonotypingStableState2 = (await awaitStableState(
      project.getBlockState(clonotypingBlockId),
      25000,
    )) as InferBlockState<typeof mixcrPlatforma>;

    const outputs2 = wrapOutputs<MiXCRClonotypingBlockOutputs>(clonotypingStableState2.outputs);
    expect(outputs2.sampleLabels![s652_sampleId]).toBeDefined();

    await project.runBlock(clonotypingBlockId);
    const clonotypingStableState3 = (await helpers.awaitBlockDoneAndGetStableBlockState<typeof mixcrPlatforma>(
      clonotypingBlockId,
      100000,
    ));
    const outputs3 = wrapOutputs<MiXCRClonotypingBlockOutputs>(clonotypingStableState3.outputs);
    expect(outputs3.reports.isComplete).toEqual(true);

    const annotationStableState1 = (await awaitStableState(
      project.getBlockState(annotationBlockId),
      200000,
    )) as InferBlockState<typeof platforma>;
    const outputs4 = wrapOutputs<BlockOutputs>(annotationStableState1.outputs);
    expect(outputs4.inputOptions).toBeDefined();
    expect(outputs4.inputOptions).toHaveLength(1);

    await project.setBlockArgs(annotationBlockId, {
      inputAnchor: outputs4.inputOptions[0].ref,
      annotationScript: {
        mode: 'byClonotype',
        steps: [],
      },
    } satisfies BlockArgs);

    const annotationStableState2 = (await awaitStableState(
      project.getBlockState(annotationBlockId),
      200000,
    )) as InferBlockState<typeof platforma>;

    const outputs5 = wrapOutputs<BlockOutputs>(annotationStableState2.outputs);
    console.dir(outputs5, { depth: 8 });

    // Sort column options for consistent behavior across test runs
    // const sortedAbundanceColumns = [...(outputs5.bySampleAndClonotypeColumns || [])].sort((a, b) => a.label.localeCompare(b.label));
    const sortedClonotypeColumns = [...(outputs5.byClonotypeColumns || [])].sort((a, b) => a.label.localeCompare(b.label));

    // Extract column values with appropriate casting based on outputs5 structure
    const readCount652Column = sortedClonotypeColumns.find((col) => col.label.includes('Number Of Reads / SRR11233652'))?.id;
    const readFraction652Column = sortedClonotypeColumns.find((col) => col.label.includes('Fraction of reads / SRR11233652'))?.id;
    const readFraction664Column = sortedClonotypeColumns.find((col) => col.label.includes('Fraction of reads / SRR11233664'))?.id;
    const vGeneColumn = sortedClonotypeColumns.find((col) => col.label === 'Best V gene')?.id;

    // Ensure all column references are defined before using them
    expect(readCount652Column).toBeDefined();
    expect(readFraction652Column).toBeDefined();
    expect(readFraction664Column).toBeDefined();
    expect(vGeneColumn).toBeDefined();

    // Type guard to ensure columns are strings
    if (!readCount652Column || !readFraction652Column || !readFraction664Column || !vGeneColumn) {
      throw new Error('Required column references are undefined');
    }

    await project.setBlockArgs(annotationBlockId, {
      inputAnchor: outputs5.inputOptions[0].ref,
      annotationScript: {
        mode: 'byClonotype',
        steps: [
          {
            filter: {
              type: 'and',
              filters: [
                {
                  type: 'numericalComparison',
                  lhs: 1,
                  rhs: readCount652Column,
                },
                {
                  type: 'numericalComparison',
                  lhs: readCount652Column,
                  rhs: 1000,
                },
              ],
            },
            label: 'Medium Read Count (Sample 652)',
          },
          {
            filter: {
              type: 'numericalComparison',
              lhs: readFraction664Column,
              rhs: readFraction652Column,
              minDiff: 0.01,
            },
            label: 'Significantly More Abundant in Sample 652',
          },
          {
            filter: {
              type: 'pattern',
              column: vGeneColumn,
              predicate: {
                type: 'containSubsequence',
                value: 'IGHV3',
              },
            },
            label: 'IGHV3 Family',
          },
          {
            filter: {
              type: 'numericalComparison',
              lhs: { transformer: 'rank', column: readCount652Column, descending: true },
              rhs: 2,
              allowEqual: true,
            },
            label: 'Top 2 by Read Count (Sample 652)',
          },
          {
            filter: {
              type: 'numericalComparison',
              lhs: { transformer: 'sortedCumulativeSum', column: readFraction664Column, descending: true },
              rhs: 0.5,
              allowEqual: true,
            },
            label: 'Top 50% by Read Fraction (Sample 664)',
          },
        ],
      },
    } satisfies BlockArgs);

    const annotationStableState3 = (await awaitStableState(
      project.getBlockState(annotationBlockId),
      200000,
    )) as InferBlockState<typeof platforma>;

    const outputs6 = wrapOutputs<BlockOutputs>(annotationStableState3.outputs);

    console.dir(outputs6, { depth: 8 });

    expect(outputs6.table).toBeDefined();
    expect(outputs6.statsTable).toBeDefined();

    const columnSpecs = await ml.driverKit.pFrameDriver.getSpec(outputs6.table!);
    console.dir(columnSpecs, { depth: 8 });
    const annotationIdx = columnSpecs.findIndex((col) => col.spec.name === 'pl7.app/vdj/annotation');
    expect(annotationIdx).toBeGreaterThanOrEqual(0);

    const annotationData = await ml.driverKit.pFrameDriver.getData(outputs6.table!, [annotationIdx]);
    expect(annotationData[0].data).toBeDefined();
    expect(annotationData[0].data.length).toBeGreaterThan(0);
    expect(annotationData[0].data.some((val) => Boolean(val?.toString()?.startsWith('Top 2')))).toBe(true);
    // console.dir(annotationData, { depth: 8 });

    const statsShape = await ml.driverKit.pFrameDriver.getShape(outputs6.statsTable!);
    const statsData = await ml.driverKit.pFrameDriver.getData(outputs6.statsTable!, [...Array(statsShape.columns).keys()]);
    // console.dir(statsData, { depth: 8 });

    expect(statsData[0].data).toBeDefined();
    expect(statsData[0].data.length).toBeGreaterThan(0);
  },
);
