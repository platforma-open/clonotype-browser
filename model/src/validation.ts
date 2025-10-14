import type { AnnotationScript } from '@platforma-sdk/model';

export interface ClonotypeColumn {
  axes?: ClonotypeColumn[];
  source?: ClonotypeColumn;
  [key: string]: unknown;
}

export type ClonotypeFilter = {
  filters?: ClonotypeFilter[];
  [key: string]: unknown;
};

function isTwoAxes(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const o = obj as ClonotypeColumn;
  if (Array.isArray(o.axes) && o.axes.length === 2) {
    return true;
  }
  if (o.source) {
    return isTwoAxes(o.source);
  }
  return false;
}

function checkObjectForTwoAxes(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  for (const value of Object.values(obj)) {
    if (typeof value === 'string') {
      try {
        const parsed: unknown = JSON.parse(value);
        if (isTwoAxes(parsed) || checkObjectForTwoAxes(parsed)) {
          return true;
        }
      } catch (e) {
        // Not a json string
      }
    } else if (checkObjectForTwoAxes(value)) {
      return true;
    }
  }
  return false;
}

function checkFilterForTwoAxes(filter: ClonotypeFilter): boolean {
  if (Array.isArray(filter.filters)) {
    for (const subFilter of filter.filters) {
      if (checkFilterForTwoAxes(subFilter)) {
        return true;
      }
    }
  }
  return checkObjectForTwoAxes(filter);
}

export function isAnnotationScriptValid(annotationScript: AnnotationScript): boolean {
  if (annotationScript.mode !== 'bySampleAndClonotype') {
    return true;
  }
  if (!annotationScript.steps || annotationScript.steps.length === 0) {
    return true;
  }
  // While the filters are being created we don't want any warnings
  if ('filters' in annotationScript.steps[0].filter && annotationScript.steps[0].filter.filters.length === 0) {
    return true;
  }
  for (const step of annotationScript.steps) {
    if (step.filter && checkFilterForTwoAxes(step.filter as ClonotypeFilter)) {
      return true;
    }
  }
  return false;
}
