import type { CanonicalPColumnId } from '@platforma-sdk/model';

//
// Sequence filter
//

/**
 * Represents an equals predicate for pattern filtering.
 * Checks if the pattern exactly matches the provided value.
 * Can handle both string literals and biological sequences with wildcards.
 */
export type PatternPredicateEquals = {
  type: 'equals';
  /** The exact pattern value to match */
  value: string;
};

/**
 * Represents a subsequence containment predicate for pattern filtering.
 * Checks if the pattern contains the provided subsequence.
 * Can handle both string literals and biological sequences with wildcards.
 */
export type PatternPredicateContainSubsequence = {
  type: 'containSubsequence';
  /** The subpattern to search for within the target pattern */
  value: string;
};

/**
 * Union type for pattern predicates that can be applied to both sequence and string data.
 */
export type PatternPredicate = PatternPredicateEquals | PatternPredicateContainSubsequence;

/**
 * Filter for pattern data, specifying the column to filter and the predicate to apply.
 * Works with both biological sequences (with wildcards) and regular strings.
 */
export type PatternFilter = {
  /** The column identifier to apply the filter to */
  column: CanonicalPColumnId;
  /** The predicate defining the filtering logic */
  predicate: PatternPredicate;
};

//
// Numerical filter
//

/**
 * Represents a unary numerical filter that applies range constraints to a single column.
 */
export type UnaryNumericalFilter = {
  /** The column identifier to apply the filter to */
  column: CanonicalPColumnId;
  /** The minimum value (inclusive) for the filter range */
  min?: number;
  /** The maximum value (inclusive) for the filter range */
  max?: number;
};

/**
 * Represents a binary numerical filter that compares values between two columns.
 * Used for "greater than" relationships between columns.
 */
export type GtNumericalFilter = {
  /** The first column to compare (left side of comparison) */
  column1: CanonicalPColumnId;
  /** The second column to compare (right side of comparison) */
  column2: CanonicalPColumnId;
  /** The minimum difference between column1 and column2 values */
  minDiff?: number;
  /** Whether equality is permitted in the comparison */
  allowEqual?: boolean;
};

//
// Logical filters
//

/**
 * Represents a logical OR operation between multiple filters.
 * A record matches if at least one of the contained filters matches.
 */
export interface OrFilter {
  type: 'or';
  /** Array of filters to combine with OR logic */
  filters: AnnotationFilter[];
}

/**
 * Represents a logical AND operation between multiple filters.
 * A record matches only if all of the contained filters match.
 */
export interface AndFilter {
  type: 'and';
  /** Array of filters to combine with AND logic */
  filters: AnnotationFilter[];
}

/**
 * Represents a logical NOT operation on a filter.
 * A record matches if it does not match the contained filter.
 */
export interface NotFilter {
  type: 'not';
  /** The filter to negate */
  filter: AnnotationFilter;
}

/**
 * Union type for all supported annotation filters.
 */
export type AnnotationFilter = PatternFilter | UnaryNumericalFilter | GtNumericalFilter | OrFilter | AndFilter | NotFilter;

//
// Annotation
//

/**
 * Represents a single step in the annotation process.
 * Each step consists of a filter to select records and a label to assign to those records.
 */
export type AnnotationStep = {
  /** The filter to apply for selecting records */
  filter: AnnotationFilter;
  /** The label to assign to records that match the filter */
  label: string;
};

/**
 * Represents a complete annotation configuration.
 * Contains a series of annotation steps that are applied in sequence.
 * Annotations are applied from bottom to top (later steps are processed first),
 * with lower indices taking precedence when multiple steps match the same record.
 */
export type AnnotationScript = {
  /** Ordered list of annotation steps to apply */
  steps: AnnotationStep[];
};
