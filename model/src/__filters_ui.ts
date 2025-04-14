import type { PColumnSpec, SUniversalPColumnId } from '@platforma-sdk/model';
import type { AnnotationMode, AnnotationScript, IsNA, AndFilter, NumericalComparisonFilter } from './filter';
import type { GetLens, Lens } from './lens';

/**
 * This file create an abstraction level between generic {@link AnnotationFilter} and UI-specific {@link FilterUI}.
 * Each filter in {@link FilterUI} is a special case of {@link AnnotationFilter}.
 *
 * This file also provides helper functions to create and manipulate {@link FilterUI} objects.
 */

export type UIFilterHelperSingleColumn<T extends FilterUI = FilterUI> = {
  name: string;
  /**
   * Check if the filter is supported for the given column specification
   * @param spec - The column specification
   * @returns true if the filter is supported, false otherwise
   */
  supportedFor: (spec: PColumnSpec) => boolean;
  guard: (filter: unknown) => filter is T;
  create: (column: SUniversalPColumnId) => T;
  column: GetLens<T, SUniversalPColumnId>;
  /**
   * Convert the filter to a string representation
   * @param filter - The filter to convert
   * @param columnLabelDeriver - A function that derives the label for a column from its ID
   * @returns A string representation of the filter
   */
  asString(filter: T, columnLabelDeriver: (column: SUniversalPColumnId) => string): string;
};

export type UIFilterHelperDoubleColumn<T> = {
  name: string;
  /**
   * Check if the filter is supported for the given column specifications
   * @param spec1 - The first column specification
   * @param spec2 - The second column specification (can be undefined to check if the filter is supported for any second column)
   * @returns true if the filter is supported, false otherwise
   */
  supportedFor: (spec1: PColumnSpec, spec2: PColumnSpec | undefined) => boolean;
  guard: (filter: unknown) => filter is T;
  create: (column1: SUniversalPColumnId, column2: SUniversalPColumnId) => T;
  column1: GetLens<T, SUniversalPColumnId>;
  column2: GetLens<T, SUniversalPColumnId>;
  asString: (filter: T, columnLabelDeriver: (column: SUniversalPColumnId) => string) => string;
};

function isNumericValueType(spec: PColumnSpec): boolean {
  return spec.valueType === 'Int' || spec.valueType === 'Long' || spec.valueType === 'Float' || spec.valueType === 'Double';
}

/** Filters for records where a specific column is NA (Not Available) */
export type IsNAUI = IsNA;
export const IsNAUI = {
  name: 'Is NA',
  supportedFor: () => true,
  guard: (filter: unknown): filter is IsNAUI => typeof filter === 'object' && filter !== null && 'type' in filter && filter.type === 'isNA' && 'column' in filter,
  create: (column: SUniversalPColumnId): IsNAUI => ({ type: 'isNA', column }),
  column: {
    get: (filter: IsNAUI) => filter.column,
  },
  asString: (filter: IsNAUI, columnLabelDeriver: (column: SUniversalPColumnId) => string) => {
    return `${columnLabelDeriver(filter.column)} is NA`;
  },
};

/** Filters for records where a specific column is *not* NA */
export type IsNotNAUI = {
  type: 'not';
  /** The IsNA filter to negate */
  filter: IsNA;
};
export const IsNotNAUI = {
  name: 'Is Not NA',
  supportedFor: () => true,
  guard: (filter: unknown): filter is IsNotNAUI => typeof filter === 'object' && filter !== null && 'type' in filter && filter.type === 'not' && 'filter' in filter && IsNAUI.guard(filter.filter),
  create: (column: SUniversalPColumnId): IsNotNAUI => ({ type: 'not', filter: IsNAUI.create(column) }),
  column: {
    get: (filter: IsNotNAUI) => filter.filter.column,
  } as GetLens<IsNotNAUI, SUniversalPColumnId>,
  asString(filter: IsNotNAUI, columnLabelDeriver: (column: SUniversalPColumnId) => string): string {
    return `${columnLabelDeriver(IsNotNAUI.column.get(filter))} is not NA`;
  },
};

/** Filters for values less than a constant */
export type LessThenUI = {
  type: 'numericalComparison';
  /** The column to compare */
  lhs: SUniversalPColumnId;
  /** The constant value to compare against */
  rhs: number;
};
export const LessThenUI = {
  name: 'Less Than',
  supportedFor: isNumericValueType,
  guard: (filter: unknown): filter is LessThenUI => typeof filter === 'object' && filter !== null && 'type' in filter && filter.type === 'numericalComparison' && 'lhs' in filter && typeof filter.lhs === 'string' && 'rhs' in filter && typeof filter.rhs === 'number' && !('allowEqual' in filter),
  create: (column: SUniversalPColumnId, threshold: number = 0): LessThenUI => ({
    type: 'numericalComparison',
    lhs: column,
    rhs: threshold,
  }),
  column: {
    get: (filter: LessThenUI) => filter.lhs,
  } as GetLens<LessThenUI, SUniversalPColumnId>,
  threshold: {
    get: (filter: LessThenUI) => filter.rhs,
    set: (filter: LessThenUI, threshold: number): LessThenUI => ({ ...filter, rhs: threshold }),
  } as Lens<LessThenUI, number>,
  asString(filter: LessThenUI, columnLabelDeriver: (column: SUniversalPColumnId) => string): string {
    const threshold = LessThenUI.threshold.get(filter);
    const columnLabel = columnLabelDeriver(LessThenUI.column.get(filter));
    return `${threshold} > ${columnLabel}`;
  },
};

/** Filters for values less than or equal to a constant */
export type LessThenOrEqualUI = {
  type: 'numericalComparison';
  /** The column to compare */
  lhs: SUniversalPColumnId;
  /** The constant value to compare against */
  rhs: number;
  allowEqual: true;
};
export const LessThenOrEqualUI = {
  name: 'Less Than or Equal',
  supportedFor: isNumericValueType,
  guard: (filter: unknown): filter is LessThenOrEqualUI => typeof filter === 'object' && filter !== null && 'type' in filter && filter.type === 'numericalComparison' && 'lhs' in filter && typeof filter.lhs === 'string' && 'rhs' in filter && typeof filter.rhs === 'number' && 'allowEqual' in filter && filter.allowEqual === true,
  create: (column: SUniversalPColumnId, threshold: number = 0): LessThenOrEqualUI => ({
    type: 'numericalComparison',
    lhs: column,
    rhs: threshold,
    allowEqual: true,
  }),
  column: {
    get: (filter: LessThenOrEqualUI) => filter.lhs,
  } as GetLens<LessThenOrEqualUI, SUniversalPColumnId>,
  threshold: {
    get: (filter: LessThenOrEqualUI) => filter.rhs,
    set: (filter: LessThenOrEqualUI, threshold: number): LessThenOrEqualUI => ({ ...filter, rhs: threshold }),
  } as Lens<LessThenOrEqualUI, number>,
  asString(filter: LessThenOrEqualUI, columnLabelDeriver: (column: SUniversalPColumnId) => string): string {
    const threshold = LessThenOrEqualUI.threshold.get(filter);
    const columnLabel = columnLabelDeriver(LessThenOrEqualUI.column.get(filter));
    return `${threshold} >= ${columnLabel}`;
  },
};

/** Filters for values greater than a constant */
export type GreaterThenUI = {
  type: 'numericalComparison';
  /** The constant value to compare against */
  lhs: number;
  /** The column to compare */
  rhs: SUniversalPColumnId;
};
export const GreaterThenUI = {
  name: 'Greater Than',
  supportedFor: isNumericValueType,
  guard: (filter: unknown): filter is GreaterThenUI => typeof filter === 'object' && filter !== null && 'type' in filter && filter.type === 'numericalComparison' && 'lhs' in filter && typeof filter.lhs === 'number' && 'rhs' in filter && typeof filter.rhs === 'string' && !('allowEqual' in filter),
  create: (column: SUniversalPColumnId, threshold: number = 0): GreaterThenUI => ({
    type: 'numericalComparison',
    lhs: threshold,
    rhs: column,
  }),
  column: {
    get: (filter: GreaterThenUI) => filter.rhs,
  } as GetLens<GreaterThenUI, SUniversalPColumnId>,
  threshold: {
    get: (filter: GreaterThenUI) => filter.lhs,
    set: (filter: GreaterThenUI, threshold: number): GreaterThenUI => ({ ...filter, lhs: threshold }),
  } as Lens<GreaterThenUI, number>,
  asString(filter: GreaterThenUI, columnLabelDeriver: (column: SUniversalPColumnId) => string): string {
    const threshold = GreaterThenUI.threshold.get(filter);
    const columnLabel = columnLabelDeriver(GreaterThenUI.column.get(filter));
    return `${threshold} < ${columnLabel}`;
  },
};

/** Filters for values greater than or equal to a constant */
export type GreaterThenOrEqualUI = {
  type: 'numericalComparison';
  /** The constant value to compare against */
  lhs: number;
  /** The column to compare */
  rhs: SUniversalPColumnId;
  allowEqual: true;
};
export const GreaterThenOrEqualUI = {
  name: 'Greater Than or Equal',
  supportedFor: isNumericValueType,
  guard: (filter: unknown): filter is GreaterThenOrEqualUI => typeof filter === 'object' && filter !== null && 'type' in filter && filter.type === 'numericalComparison' && 'lhs' in filter && typeof filter.lhs === 'number' && 'rhs' in filter && typeof filter.rhs === 'string' && 'allowEqual' in filter && filter.allowEqual === true,
  create: (column: SUniversalPColumnId, threshold: number = 0): GreaterThenOrEqualUI => ({
    type: 'numericalComparison',
    lhs: threshold,
    rhs: column,
    allowEqual: true,
  }),
  column: {
    get: (filter: GreaterThenOrEqualUI) => filter.rhs,
  } as GetLens<GreaterThenOrEqualUI, SUniversalPColumnId>,
  threshold: {
    get: (filter: GreaterThenOrEqualUI) => filter.lhs,
    set: (filter: GreaterThenOrEqualUI, threshold: number): GreaterThenOrEqualUI => ({ ...filter, lhs: threshold }),
  } as Lens<GreaterThenOrEqualUI, number>,
  asString(filter: GreaterThenOrEqualUI, columnLabelDeriver: (column: SUniversalPColumnId) => string): string {
    const threshold = GreaterThenOrEqualUI.threshold.get(filter);
    const columnLabel = columnLabelDeriver(GreaterThenOrEqualUI.column.get(filter));
    return `${threshold} <= ${columnLabel}`;
  },
};

/** Filters for the top N values in a column */
export type TopNUI = {
  type: 'numericalComparison';
  /** The rank-transformed column configuration */
  lhs: {
    transformer: 'rank';
    /** The column to apply ranking to */
    column: SUniversalPColumnId;
    descending: true;
  };
  /** The rank threshold (N) */
  rhs: number;
  allowEqual: true;
};
export const TopNUI = {
  name: 'Top N',
  supportedFor: isNumericValueType,
  guard: (filter: unknown): filter is TopNUI => typeof filter === 'object' && filter !== null && 'type' in filter && filter.type === 'numericalComparison' && 'lhs' in filter && typeof filter.lhs === 'object' && filter.lhs !== null && 'transformer' in filter.lhs && filter.lhs.transformer === 'rank' && 'column' in filter.lhs && 'descending' in filter.lhs && filter.lhs.descending === true && 'rhs' in filter && typeof filter.rhs === 'number' && 'allowEqual' in filter && filter.allowEqual === true,
  create: (column: SUniversalPColumnId, n: number = 0): TopNUI => ({
    type: 'numericalComparison',
    lhs: {
      transformer: 'rank',
      column,
      descending: true,
    },
    rhs: n,
    allowEqual: true,
  }),
  column: {
    get: (filter: TopNUI) => filter.lhs.column,
  } as GetLens<TopNUI, SUniversalPColumnId>,
  n: {
    get: (filter: TopNUI) => filter.rhs,
    set: (filter: TopNUI, n: number): TopNUI => ({ ...filter, rhs: n }),
  } as Lens<TopNUI, number>,
  asString(filter: TopNUI, columnLabelDeriver: (column: SUniversalPColumnId) => string): string {
    const n = TopNUI.n.get(filter);
    const columnLabel = columnLabelDeriver(TopNUI.column.get(filter));
    return `Top ${n} by ${columnLabel}`;
  },
};

/** Filters for values contributing to the top cumulative share of a column */
export type TopCumulativeShareUI = {
  type: 'numericalComparison';
  /** The sorted cumulative sum transformed column configuration */
  lhs: {
    transformer: 'sortedCumulativeSum';
    /** The column to apply the cumulative sum to */
    column: SUniversalPColumnId;
    descending: true;
  };
  /** The cumulative share threshold */
  rhs: number;
  allowEqual: true;
};
export const TopCumulativeShareUI = {
  name: 'Top Cumulative Share',
  supportedFor: isNumericValueType,
  guard: (filter: unknown): filter is TopCumulativeShareUI => typeof filter === 'object' && filter !== null && 'type' in filter && filter.type === 'numericalComparison' && 'lhs' in filter && typeof filter.lhs === 'object' && filter.lhs !== null && 'transformer' in filter.lhs && filter.lhs.transformer === 'sortedCumulativeSum' && 'column' in filter.lhs && 'descending' in filter.lhs && filter.lhs.descending === true && 'rhs' in filter && typeof filter.rhs === 'number' && 'allowEqual' in filter && filter.allowEqual === true,
  create: (column: SUniversalPColumnId, share: number = 0): TopCumulativeShareUI => ({
    type: 'numericalComparison',
    lhs: {
      transformer: 'sortedCumulativeSum',
      column,
      descending: true,
    },
    rhs: share,
    allowEqual: true,
  }),
  column: {
    get: (filter: TopCumulativeShareUI) => filter.lhs.column,
  } as GetLens<TopCumulativeShareUI, SUniversalPColumnId>,
  share: {
    get: (filter: TopCumulativeShareUI) => filter.rhs,
    set: (filter: TopCumulativeShareUI, share: number): TopCumulativeShareUI => ({ ...filter, rhs: share }),
  } as Lens<TopCumulativeShareUI, number>,
  asString(filter: TopCumulativeShareUI, columnLabelDeriver: (column: SUniversalPColumnId) => string): string {
    const share = TopCumulativeShareUI.share.get(filter);
    const columnLabel = columnLabelDeriver(TopCumulativeShareUI.column.get(filter));
    return `Top ${share * 100}% cumulative share by ${columnLabel}`;
  },
};

/** Filters for values between a minimum and maximum constant */
export type BetweenUI = AndFilter & { __brand: 'BetweenUI' }; // Use branding to distinguish in guards, actual type is AndFilter
export const BetweenUI = {
  name: 'Between',
  supportedFor: isNumericValueType,
  guard: (filter: unknown): filter is BetweenUI => {
    if (typeof filter !== 'object' || filter === null || !('type' in filter) || filter.type !== 'and' || !('filters' in filter) || !Array.isArray(filter.filters) || filter.filters.length !== 2) {
      return false;
    }
    // Check if the two filters are numerical comparisons involving the same column
    const filter1: unknown = filter.filters[0];
    const filter2: unknown = filter.filters[1];

    if (!GreaterThenOrEqualUI.guard(filter1) && !GreaterThenUI.guard(filter1)) return false;
    if (!LessThenOrEqualUI.guard(filter2) && !LessThenUI.guard(filter2)) return false;

    // Ensure both filters operate on the same column
    const column1 = filter1.rhs;
    const column2 = filter2.lhs;

    return typeof column1 === 'string' && typeof column2 === 'string' && column1 === column2;
  },
  create: (column: SUniversalPColumnId, min: number = 0, max: number = 1, minInclusive: boolean = true, maxInclusive: boolean = true): BetweenUI => {
    const minFilter = minInclusive ? GreaterThenOrEqualUI.create(column, min) : GreaterThenUI.create(column, min);
    const maxFilter = maxInclusive ? LessThenOrEqualUI.create(column, max) : LessThenUI.create(column, max);
    return {
      type: 'and',
      filters: [minFilter, maxFilter],
    } as BetweenUI; // Cast to branded type
  },
  column: {
    get: (filter: BetweenUI): SUniversalPColumnId => {
      // Both filters guaranteed to have the same column by the guard
      const f1 = filter.filters[0] as GreaterThenOrEqualUI | GreaterThenUI;
      return f1.rhs;
    },
  } as GetLens<BetweenUI, SUniversalPColumnId>,
  min: {
    get: (filter: BetweenUI): number => {
      const f1 = filter.filters[0] as GreaterThenOrEqualUI | GreaterThenUI;
      return f1.lhs;
    },
    set: (filter: BetweenUI, value: number): BetweenUI => {
      const f1 = filter.filters[0] as GreaterThenOrEqualUI | GreaterThenUI;
      const f2 = filter.filters[1] as LessThenOrEqualUI | LessThenUI; // Corrected index from 2 to 1
      const newF1 = { ...f1, lhs: value };
      return { ...filter, filters: [newF1, f2] } as BetweenUI;
    },
  } as Lens<BetweenUI, number>,
  max: {
    get: (filter: BetweenUI): number => {
      const f2 = filter.filters[1] as LessThenOrEqualUI | LessThenUI; // Corrected index from 2 to 1
      return f2.rhs;
    },
    set: (filter: BetweenUI, value: number): BetweenUI => {
      const f1 = filter.filters[0] as GreaterThenOrEqualUI | GreaterThenUI;
      const f2 = filter.filters[1] as LessThenOrEqualUI | LessThenUI; // Corrected index from 2 to 1
      const newF2 = { ...f2, rhs: value };
      return { ...filter, filters: [f1, newF2] } as BetweenUI;
    },
  } as Lens<BetweenUI, number>,
  minInclusive: {
    get: (filter: BetweenUI): boolean => {
      const f1 = filter.filters[0];
      return GreaterThenOrEqualUI.guard(f1);
    },
    set: (filter: BetweenUI, inclusive: boolean): BetweenUI => {
      const column = BetweenUI.column.get(filter);
      const min = BetweenUI.min.get(filter);
      const max = BetweenUI.max.get(filter);
      const maxInclusive = BetweenUI.maxInclusive.get(filter);
      return BetweenUI.create(column, min, max, inclusive, maxInclusive);
    },
  } as Lens<BetweenUI, boolean>,
  maxInclusive: {
    get: (filter: BetweenUI): boolean => {
      const f2 = filter.filters[1];
      return LessThenOrEqualUI.guard(f2);
    },
    set: (filter: BetweenUI, inclusive: boolean): BetweenUI => {
      const column = BetweenUI.column.get(filter);
      const min = BetweenUI.min.get(filter);
      const max = BetweenUI.max.get(filter);
      const minInclusive = BetweenUI.minInclusive.get(filter);
      return BetweenUI.create(column, min, max, minInclusive, inclusive);
    },
  } as Lens<BetweenUI, boolean>,
  asString(filter: BetweenUI, columnLabelDeriver: (column: SUniversalPColumnId) => string): string {
    const column = columnLabelDeriver(BetweenUI.column.get(filter));
    const min = BetweenUI.min.get(filter);
    const max = BetweenUI.max.get(filter);
    const minOp = BetweenUI.minInclusive.get(filter) ? '>=' : '>';
    const maxOp = BetweenUI.maxInclusive.get(filter) ? '<=' : '<';
    return `${min} ${minOp} ${column} ${maxOp} ${max}`;
  },
};

/** Compare two columns numerically */
export type CompareColumnsUI = NumericalComparisonFilter & {
  lhs: SUniversalPColumnId; // Override to ensure lhs is a column
  rhs: SUniversalPColumnId; // Override to ensure rhs is a column
  __brand: 'CompareColumnsUI';
};
export const CompareColumnsUI = {
  name: 'Compare Columns',
  supportedFor: (spec1: PColumnSpec, spec2: PColumnSpec | undefined): boolean => {
    return isNumericValueType(spec1) && (spec2 === undefined || isNumericValueType(spec2));
  },
  guard: (filter: unknown): filter is CompareColumnsUI => {
    return (
      typeof filter === 'object'
      && filter !== null
      && 'type' in filter
      && filter.type === 'numericalComparison'
      && 'lhs' in filter
      && typeof filter.lhs === 'string' // Ensure lhs is a column ID
      && 'rhs' in filter
      && typeof filter.rhs === 'string' // Ensure rhs is a column ID
      // Removed '!('transformer' in ...)' checks as typeof === 'string' is sufficient
      // We don't strictly need a brand check if the conditions above are sufficient,
      // but it can prevent accidental matches if NumericalComparisonFilter structure changes.
      // && '__brand' in filter && filter.__brand === 'CompareColumnsUI'
    );
  },
  create: (column1: SUniversalPColumnId, column2: SUniversalPColumnId, allowEqual: boolean = false, minDiff?: number): CompareColumnsUI => ({
    type: 'numericalComparison',
    lhs: column1,
    rhs: column2,
    ...(allowEqual && { allowEqual: true }),
    ...(minDiff !== undefined && { minDiff }),
    __brand: 'CompareColumnsUI', // Add brand for clarity
  }),
  column1: {
    get: (filter: CompareColumnsUI) => filter.lhs,
    // No setter provided as changing one column might invalidate the filter's context or require changing the other column too.
  } as GetLens<CompareColumnsUI, SUniversalPColumnId>,
  column2: {
    get: (filter: CompareColumnsUI) => filter.rhs,
    // No setter provided.
  } as GetLens<CompareColumnsUI, SUniversalPColumnId>,
  allowEqual: {
    get: (filter: CompareColumnsUI) => filter.allowEqual === true,
    set: (filter: CompareColumnsUI, allowEqual: boolean): CompareColumnsUI => {
      const newFilter = { ...filter };
      if (allowEqual) {
        newFilter.allowEqual = true;
      } else {
        delete newFilter.allowEqual;
      }
      return newFilter as CompareColumnsUI;
    },
  } as Lens<CompareColumnsUI, boolean>,
  minDiff: {
    get: (filter: CompareColumnsUI) => filter.minDiff,
    set: (filter: CompareColumnsUI, minDiff: number | undefined): CompareColumnsUI => {
      const newFilter = { ...filter };
      if (minDiff !== undefined) {
        newFilter.minDiff = minDiff;
      } else {
        delete newFilter.minDiff;
      }
      return newFilter as CompareColumnsUI;
    },
  } as Lens<CompareColumnsUI, number | undefined>,
  asString: (filter: CompareColumnsUI, columnLabelDeriver: (column: SUniversalPColumnId) => string): string => {
    const col1Label = columnLabelDeriver(filter.lhs);
    const col2Label = columnLabelDeriver(filter.rhs);
    const op = filter.allowEqual ? '<=' : '<';
    const diffStr = filter.minDiff !== undefined && filter.minDiff !== 0 ? ` + ${filter.minDiff}` : '';
    return `${col1Label}${diffStr} ${op} ${col2Label}`;
  },
};

/** Union type for all supported UI-level annotation filters */
export type FilterUI =
  | IsNAUI
  | IsNotNAUI
  | LessThenUI
  | LessThenOrEqualUI
  | GreaterThenUI
  | GreaterThenOrEqualUI
  | TopNUI
  | TopCumulativeShareUI
  | BetweenUI;

export const SingleColumnFilters: UIFilterHelperSingleColumn<FilterUI>[] = [
  IsNAUI,
  IsNotNAUI,
  LessThenUI,
  LessThenOrEqualUI,
  GreaterThenUI,
  GreaterThenOrEqualUI,
  TopNUI,
  TopCumulativeShareUI,
  BetweenUI,
];

export const DoubleColumnFilters: UIFilterHelperDoubleColumn<CompareColumnsUI>[] = [CompareColumnsUI];

/** Represents a list of UI filters combined using AND logic */
export interface AnnotationFilterList {
  type: 'and';
  /** Array of filters to combine with AND logic */
  filters: FilterUI[];
}

/** Represents a single step in the UI annotation process */
export type AnnotationStepUI = {
  /** The filter to apply for selecting records */
  filter: AnnotationFilterList;
  /** The label to assign to records that match the filter */
  label: string;
};

/** Represents a complete annotation configuration from the UI perspective */
type AnnotationScriptUI = {
  /** The mode of annotation to apply */
  mode: AnnotationMode;
  /** Ordered list of annotation steps to apply */
  steps: AnnotationStepUI[];
};

type CheckTrue<_T extends true> = true;

/** Important Check: confirm that AnnotationScriptUI is a subset of AnnotationScript, and thus FilterUI is a subset of Filter */
type _C = CheckTrue<AnnotationScriptUI extends AnnotationScript ? true : false>;
