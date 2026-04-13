/**
 * PColumn schema knowledge specific to this block — extends SDK constants with
 * names/annotations this block consumes or recognizes, and provides read helpers
 * typed against the extended schema.
 *
 * Consumers should import from here (not from `@platforma-sdk/model`) so SDK and
 * block-level constants live under the same namespace.
 */

import {
  Annotation as SdkAnnotation,
  PColumnName as SdkPColumnName,
  parseJson,
  readAnnotation as sdkReadAnnotation,
  type Annotation as SdkAnnotationType,
  type Metadata,
  type PColumnSpec,
  type Trace,
} from "@platforma-sdk/model";

// =============================================================================
// EXTENDED CONSTANTS
// =============================================================================

/** Well-known PColumn names — SDK's set plus names this block references. */
export const PColumnName = {
  ...SdkPColumnName,
  /** Per-sample clonotype count — produced by upstream VDJ blocks. */
  SampleCount: "pl7.app/vdj/sampleCount",
} as const;

const ANNOTATION_EXTENSIONS = {
  /** Marks a column as an abundance measurement (counts or fractions). */
  IsAbundance: "pl7.app/isAbundance",
} as const;

/** Annotation keys — SDK's set plus keys this block reads. */
export const Annotation = {
  ...SdkAnnotation,
  ...ANNOTATION_EXTENSIONS,
} as const;

/** Typed annotation-value map — SDK's typed shape plus the values for our extensions. */
export type Annotation = SdkAnnotationType &
  Partial<{
    [ANNOTATION_EXTENSIONS.IsAbundance]: string;
  }>;

// =============================================================================
// READ HELPERS — typed against the extended Annotation schema.
// =============================================================================

/** Plain annotation read; same signature as SDK's, but typed against extended Annotation. */
export function readAnnotation<T extends keyof Annotation>(
  spec: { annotations?: Metadata | undefined } | undefined,
  key: T,
): Annotation[T] | undefined {
  return sdkReadAnnotation(spec, key as never) as Annotation[T] | undefined;
}

// =============================================================================
// PREDICATES & DECODED ACCESSORS
// =============================================================================

/** True if the column carries an abundance measurement. */
export function isAbundanceColumn(spec: PColumnSpec): boolean {
  return readAnnotation(spec, Annotation.IsAbundance) === "true";
}

/** Parsed trace entries for a column (derivation lineage), or empty if absent. */
export function getTrace(spec: PColumnSpec): Trace {
  const raw = readAnnotation(spec, Annotation.Trace);
  return raw ? (parseJson(raw) ?? []) : [];
}
