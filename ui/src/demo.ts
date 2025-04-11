import type { AnnotationScript, SimplifiedUniversalPColumnEntry, AnnotationFilter, AnnotationStep } from '@platforma-open/milaboratories.clonotype-browser-2.model';
import type { SUniversalPColumnId } from '@platforma-sdk/model';
import { randomInt } from '@platforma-sdk/ui-vue';

export function generateAnnotationScript(
  byClonotypeColumns: SimplifiedUniversalPColumnEntry[],
  bySampleColumns: SimplifiedUniversalPColumnEntry[]): AnnotationScript {
  const t = randomInt(0, 1);

  switch (t) {
    case 0:
      return generateDemo1(byClonotypeColumns, bySampleColumns);
  }
  throw new Error('Unknown demo type');
}

function findColumnByLabelAndType(columns: SimplifiedUniversalPColumnEntry[], labelSubstring: string, valueType: 'String' | 'Int' | 'Long' | 'Double'): SUniversalPColumnId | undefined {
  return columns.find((col) => col.label.includes(labelSubstring) && col.obj.valueType === valueType)?.id;
}

function generateDemo1(
  byClonotypeColumns: SimplifiedUniversalPColumnEntry[],
  _bySampleColumns: SimplifiedUniversalPColumnEntry[],
): AnnotationScript {
  const steps: AnnotationStep[] = [];

  // --- Find relevant columns (adapt substrings as needed based on actual data) ---

  // Example: Find a V gene column (string type)
  const vGeneColumn = findColumnByLabelAndType(byClonotypeColumns, 'Best V gene', 'String');

  // Example: Find abundance columns for two different samples (e.g., UMI counts, long type)
  // These labels often include sample IDs or names. Adjust "SRR1" and "SRR2" if needed.
  const umiCountSample1 = findColumnByLabelAndType(byClonotypeColumns, 'Number of UMIs / SRR1', 'Long');
  const umiCountSample2 = findColumnByLabelAndType(byClonotypeColumns, 'Number of UMIs / SRR2', 'Long');
  const umiFractionSample1 = findColumnByLabelAndType(byClonotypeColumns, 'Fraction of UMIs / SRR1', 'Double');

  // Example: Find a mutation count column (int type)
  const aaMutCountV = findColumnByLabelAndType(byClonotypeColumns, 'AA mutations count in V gene', 'Int');

  // --- Define Annotation Steps ---

  // 1. Filter by V gene family (Pattern Filter)
  if (vGeneColumn) {
    steps.push({
      label: 'IGHV3 Family',
      filter: {
        type: 'pattern',
        column: vGeneColumn,
        predicate: {
          type: 'containSubsequence',
          value: 'IGHV3', // Example family
        },
      },
    });
  }

  // 2. Filter for Top 10 most abundant clonotypes in Sample 1 (Rank Transform + Numerical Comparison)
  if (umiCountSample1) {
    steps.push({
      label: 'Top 10 Abundant (Sample 1)',
      filter: {
        type: 'numericalComparison',
        lhs: { transformer: 'rank', column: umiCountSample1, descending: true },
        rhs: 10,
        allowEqual: true, // Rank is <= 10
      },
    });
  }

  // 3. Filter for clonotypes making up top 50% cumulative abundance in Sample 1 (Cumulative Sum Transform)
  if (umiFractionSample1) {
    steps.push({
      label: 'Top 50% Cumulative Abundance (Sample 1)',
      filter: {
        type: 'numericalComparison',
        lhs: { transformer: 'sortedCumulativeSum', column: umiFractionSample1, descending: true },
        rhs: 0.5,
        allowEqual: true, // Cumulative sum <= 0.5
      },
    });
  }

  // 4. Filter for clonotypes significantly more abundant in Sample 1 than Sample 2 (Numerical Comparison between columns)
  if (umiCountSample1 && umiCountSample2) {
    steps.push({
      label: 'More Abundant in Sample 1 vs Sample 2',
      filter: {
        type: 'numericalComparison',
        lhs: umiCountSample2, // RHS is Sample 1
        rhs: umiCountSample1,
        minDiff: 10, // Sample 1 count must be at least 10 greater than Sample 2
        // lhs + minDiff < rhs => umiCountSample2 + 10 < umiCountSample1
      },
    });
  }

  // 5. Filter for High V Gene AA Mutations (Numerical Comparison)
  if (aaMutCountV) {
    steps.push({
      label: 'High V Gene AA Mutations',
      filter: {
        type: 'numericalComparison',
        lhs: 5, // Constant value
        rhs: aaMutCountV, // Column value
        allowEqual: true, // Mutations >= 5
        // lhs <= rhs => 5 <= aaMutCountV
      },
    });
  }

  // 6. Combine Filters (AND/OR/NOT) - Example: IGHV3 family AND High Mutations
  if (vGeneColumn && aaMutCountV) {
    const vGeneFilter: AnnotationFilter = {
      type: 'pattern',
      column: vGeneColumn,
      predicate: { type: 'containSubsequence', value: 'IGHV3' },
    };
    const highMutationFilter: AnnotationFilter = {
      type: 'numericalComparison',
      lhs: 5,
      rhs: aaMutCountV,
      allowEqual: true,
    };
    steps.push({
      label: 'IGHV3 Family with High Mutations',
      filter: {
        type: 'and',
        filters: [vGeneFilter, highMutationFilter],
      },
    });
  }

  // --- Construct the final AnnotationScript ---
  return {
    mode: 'byClonotype',
    steps: steps,
  };
}

export function generateDemo2Aging(
  mainAbundanceId: SUniversalPColumnId,
): AnnotationScript {
  return {
    mode: 'bySampleAndClonotype',
    steps: [
      {
        label: 'Hyperexpanded',
        filter: {
          type: 'numericalComparison',
          lhs: mainAbundanceId,
          rhs: 1.0, // Equivalent to just true
        },
      },
      {
        label: 'Large',
        filter: {
          type: 'numericalComparison',
          lhs: mainAbundanceId,
          rhs: 0.01,
        },
      },
      {
        label: 'Medium',
        filter: {
          type: 'numericalComparison',
          lhs: mainAbundanceId,
          rhs: 0.001,
        },
      },
      {
        label: 'Small',
        filter: {
          type: 'numericalComparison',
          lhs: mainAbundanceId,
          rhs: 0.0001,
        },
      },
      {
        label: 'Rare',
        filter: {
          type: 'numericalComparison',
          lhs: mainAbundanceId, // TODO change to counts
          rhs: 0.00001,
        },
      },
    ],
  };
}

export function generateDemo3Aging(
  mainAbundanceId: SUniversalPColumnId,
): AnnotationScript {
  return {
    mode: 'bySampleAndClonotype',
    steps: [
      {
        label: 'Aging',
        filter: {
          type: 'and',
          filters: [
            {
              type: 'isNA',
              column: mainAbundanceId,
            },
            {
              type: 'pattern',
              column: mainAbundanceId,
              predicate: {
                type: 'containSubsequence',
                value: 'IGHV3',
              },
            },
          ],
        },
      },
    ],
  };
}
