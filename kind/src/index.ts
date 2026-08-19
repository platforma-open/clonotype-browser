import { assertParamsObject, defineBlockKind } from "@platforma-sdk/block-kind";
import { invariant, isPlainObject } from "es-toolkit";
import {
  isColumnUniversalId,
  type AnnotationSpecUi as SdkAnnotationSpecUi,
  type ColumnUniversalId,
  type FilterSpec as SdkFilterSpec,
  type FilterSpecLeaf,
  type FilterSpecUi as SdkFilterSpecUi,
} from "@platforma-sdk/model";
import { name, version } from "../package.json" with { type: "json" };

export type FilterSpec = SdkFilterSpec<
  FilterSpecLeaf,
  { id: number; name?: string; isExpanded?: boolean }
>;

export type FilterSpecUI = SdkFilterSpecUi<Extract<FilterSpec, { type: "and" | "or" }>> & {
  id: number;
};

export type AnnotationSpecUi = SdkAnnotationSpecUi<FilterSpecUI> & { defaultValue?: string };

export type BlockParams = {
  inputAnchor?: ColumnUniversalId;
  annotationSpecUi?: AnnotationSpecUi;
};

/**
 * Both fields are optional, so a params object that sets neither is valid — a block
 * seeded with nothing to browse and nothing annotated is a state the UI reaches too.
 * Only the two declared fields are read; anything else in the object is dropped here
 * rather than refused, so the returned value is the whole of what the block receives.
 */
function parseInitializationParams(value: unknown): BlockParams {
  assertParamsObject(value);

  const { inputAnchor, annotationSpecUi } = value;

  if (inputAnchor !== undefined && !isColumnUniversalId(inputAnchor)) {
    throw new Error("'inputAnchor' must be a column id.");
  }
  if (annotationSpecUi !== undefined) assertAnnotationSpec(annotationSpecUi);

  return { inputAnchor, annotationSpecUi };
}

/**
 * The shape of an annotation script, checked only as far as the editor's own states go:
 * a step carries a label and a filter from the moment it is added, both still empty
 * until the user fills them in. Rejecting an empty label here would refuse a script
 * the block itself can produce and export.
 */
function assertAnnotationSpec(spec: unknown): asserts spec is AnnotationSpecUi {
  invariant(isPlainObject(spec), "'annotationSpecUi' must be an object.");
  invariant(typeof spec.title === "string", "'annotationSpecUi.title' must be a string.");
  invariant(
    spec.defaultValue === undefined || typeof spec.defaultValue === "string",
    "'annotationSpecUi.defaultValue' must be a string.",
  );
  invariant(Array.isArray(spec.steps), "'annotationSpecUi.steps' must be an array.");

  spec.steps.forEach((step: unknown, i: number) => {
    invariant(isPlainObject(step), `Annotation step ${i} must be an object.`);
    invariant(typeof step.label === "string", `Annotation step ${i} must have a string label.`);
    invariant(isPlainObject(step.filter), `Annotation step ${i} must have a filter object.`);
  });
}

export const kind = defineBlockKind<BlockParams>({ name, version, parseInitializationParams });
