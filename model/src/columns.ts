/**
 * Block-level PColumn vocabulary. Extends the SDK's `PColumnName` and
 * `Annotation` enums with names and keys this block consumes, and exposes
 * read helpers typed against the extension. Block code imports from here
 * rather than `@platforma-sdk/model` so SDK and block-level constants share
 * one namespace.
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

/** Well-known axis names — re-exported from the SDK for single-namespace imports. */
export { PAxisName } from "@platforma-sdk/model";

/** Well-known PColumn names — SDK's set plus names this block references. */
export const PColumnName = {
  ...SdkPColumnName,
  /** Per-sample clonotype count — produced by upstream VDJ blocks. */
  SampleCount: "pl7.app/vdj/sampleCount",
  /** Sequence-annotation marker column — internal, never exported. */
  SequenceAnnotation: "pl7.app/vdj/sequence/annotation",
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

/** Typed annotation-value map — SDK's shape plus block extensions. */
export type Annotation = SdkAnnotationType &
  Partial<{
    [ANNOTATION_EXTENSIONS.IsAbundance]: string;
  }>;

/** SDK's readAnnotation, typed against the extended Annotation schema. */
export function readAnnotation<T extends keyof Annotation>(
  spec: { annotations?: Metadata | undefined } | undefined,
  key: T,
): Annotation[T] | undefined {
  return sdkReadAnnotation(spec, key as never) as Annotation[T] | undefined;
}

/** True if the column carries an abundance measurement. */
export function isAbundanceColumn(spec: PColumnSpec): boolean {
  return readAnnotation(spec, Annotation.IsAbundance) === "true";
}

/** Parsed trace entries (derivation lineage), or empty if absent. */
export function getTrace(spec: PColumnSpec): Trace {
  const raw = readAnnotation(spec, Annotation.Trace);
  return raw ? (parseJson(raw) ?? []) : [];
}
