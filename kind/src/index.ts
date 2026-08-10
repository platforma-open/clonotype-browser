import { defineBlockKind } from "@platforma-sdk/block-kind";
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

function parseTemplateParams(value: unknown): BlockParams {
  invariant(isPlainObject(value), "params must be an object");
  for (const key of Object.keys(value)) {
    invariant(key === "inputAnchor" || key === "annotationSpecUi", `unknown param "${key}"`);
  }

  if (value.inputAnchor !== undefined) {
    invariant(isColumnUniversalId(value.inputAnchor), "inputAnchor is not a column id");
  }
  if (value.annotationSpecUi !== undefined) checkAnnotationSpec(value.annotationSpecUi);

  return value as BlockParams;
}

function checkAnnotationSpec(spec: unknown): void {
  invariant(isPlainObject(spec), "annotationSpecUi must be an object");
  invariant(typeof spec.title === "string", "annotationSpecUi.title must be a string");
  invariant(Array.isArray(spec.steps), "annotationSpecUi.steps must be an array");

  spec.steps.forEach((step: unknown, i: number) => {
    invariant(isPlainObject(step), `annotationSpecUi step ${i} must be an object`);
    invariant(typeof step.label === "string", `annotationSpecUi step ${i} has no label`);
    invariant(isPlainObject(step.filter), `annotationSpecUi step ${i} has no filter`);
  });
}

export const kind = defineBlockKind<BlockParams>({ name, version, parseTemplateParams });
