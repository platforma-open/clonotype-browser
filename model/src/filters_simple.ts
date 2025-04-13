import type { SUniversalPColumnId } from '@platforma-sdk/model';
import type { AnnotationFilter, AnnotationScript, AnnotationMode, PatternPredicate } from './filter';
import type { SimplifiedPColumnSpec } from './';

export function unreachable(x: never): never {
  // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
  throw new Error('Unexpected object: ' + x);
}

function isNumericValueType(spec: SimplifiedPColumnSpec): boolean {
  return spec.valueType === 'Int' || spec.valueType === 'Long' || spec.valueType === 'Float' || spec.valueType === 'Double';
}

function isStringValueType(spec: SimplifiedPColumnSpec): boolean {
  return spec.valueType === 'String';
}

const isUniversalPColumnId = (x: unknown): x is SUniversalPColumnId => typeof x === 'string';

// Define recursive type explicitly
export type FilterUi =
  | { type: 'or'; filters: FilterUi[] }
  | { type: 'and'; filters: FilterUi[] }
  | { type: 'not'; filter: FilterUi }
  | { type: 'isNA'; column: SUniversalPColumnId }
  | { type: 'patternEquals'; column: SUniversalPColumnId; value: string }
  | { type: 'patternContainSubsequence'; column: SUniversalPColumnId; value: string }
  | { type: 'lessThan'; column: SUniversalPColumnId; rhs: number; minDiff?: number }
  | { type: 'lessThanOrEqual'; column: SUniversalPColumnId; rhs: number; minDiff?: number }
  | { type: 'DoubleColumns'; column: SUniversalPColumnId; rhs: SUniversalPColumnId; minDiff?: number; allowEqual?: true };

export type FilterUiType = FilterUi['type'];

export type FilterUiOfType<T extends FilterUi['type']> = Extract<FilterUi, { type: T }>;

type TypeToLiteral<T> =
[T] extends [FilterUiType] ? 'FilterUiType' :
  [T] extends [SUniversalPColumnId] ? 'SUniversalPColumnId' :
    [T] extends [PatternPredicate] ? 'PatternPredicate' :
      [T] extends [AnnotationFilter[]] ? 'AnnotationFilter[]' :
        [T] extends [AnnotationFilter] ? 'AnnotationFilter' :
          [T] extends [number] ? 'number' :
            [T] extends [number | undefined] ? 'number?' :
              [T] extends [string] ? 'string' :
                [T] extends [string | undefined] ? 'string?' :
                  [T] extends [boolean] ? 'boolean' :
                    [T] extends [boolean | undefined] ? 'boolean?' :
                      [T] extends [unknown[]] ? 'unknown[]' :
                    // this is special
                        T extends number ? 'number' :
                          T extends string ? 'string' :
                            T extends boolean ? 'boolean' :
                              T extends Record<string, unknown> ? 'form' :
                                'unknown';
// @TODO: "parse" option
export type TypeField<V> = {
  fieldType: TypeToLiteral<V>;
  label?: string;
  defaultValue: () => V | undefined;
};

export type TypeForm<T> = {
  [P in keyof T]: T[P] extends Record<string, unknown> ? {
    fieldType: 'form';
    label?: string;
    form?: T[P] extends Record<string, unknown> ? TypeForm<T[P]> : undefined;
    defaultValue: () => T[P];
  } : TypeField<T[P]>;
};

export type FormField = {
  fieldType: 'form';
  form?: Record<string, FormField>;
  defaultValue: () => Record<string, unknown>;
}
| TypeField<FilterUiType>
| TypeField<string>
| TypeField<number>
| TypeField<number | undefined>
| TypeField<boolean>
| TypeField<boolean | undefined>
| TypeField<SUniversalPColumnId>;

export type AnyForm = Record<string, FormField>;

type CreateFilterUiMetadataMap<T extends FilterUiType> = {
  [P in T]: {
    label: string;
    form: TypeForm<FilterUiOfType<T>>;
    supportedFor: (spec1: SimplifiedPColumnSpec, spec2: SimplifiedPColumnSpec | undefined) => boolean;
  }
};

export const filterUiMetadata = {
  or: {
    label: 'Or',
    form: {
      type: {
        fieldType: 'FilterUiType',
        defaultValue: () => 'or',
      },
      filters: {
        fieldType: 'unknown[]',
        defaultValue: () => [],
      },
    },
    supportedFor: () => false,
  },
  and: {
    label: 'And',
    form: {
      type: {
        fieldType: 'FilterUiType',
        defaultValue: () => 'and',
      },
      filters: {
        fieldType: 'unknown[]',
        defaultValue: () => [],
      },
    },
    supportedFor: () => false,
  },
  not: {
    label: 'Not',
    form: {
      type: {
        fieldType: 'FilterUiType',
        defaultValue: () => 'not',
      },
      filter: {
        fieldType: 'form',
        defaultValue: () => undefined as unknown as FilterUi, // TODO:
      },
    },
    supportedFor: () => false,
  },
  isNA: {
    label: 'Is NA',
    form: {
      column: {
        label: 'Column',
        fieldType: 'SUniversalPColumnId',
        defaultValue: () => undefined,
      },
      type: {
        label: 'Predicate',
        fieldType: 'FilterUiType',
        defaultValue: () => 'isNA',
      },
    },
    supportedFor: () => true,
  },
  patternEquals: {
    label: 'Pattern Equals',
    form: {
      column: {
        fieldType: 'SUniversalPColumnId',
        defaultValue: () => undefined,
      },
      type: {
        label: 'Predicate',
        fieldType: 'FilterUiType',
        defaultValue: () => 'patternEquals',
      },
      value: {
        label: 'Equals To',
        fieldType: 'string',
        defaultValue: () => '',
      },
    },
    supportedFor: isStringValueType,
  },
  patternContainSubsequence: {
    label: 'Pattern Contains Subsequence',
    form: {
      column: {
        fieldType: 'SUniversalPColumnId',
        defaultValue: () => undefined,
      },
      type: {
        label: 'Predicate',
        fieldType: 'FilterUiType',
        defaultValue: () => 'patternContainSubsequence',
      },
      value: {
        fieldType: 'string',
        defaultValue: () => '',
      },
    },
    supportedFor: isStringValueType,
  },
  lessThan: {
    label: 'Less Than Number',
    form: {
      column: {
        fieldType: 'SUniversalPColumnId',
        defaultValue: () => undefined,
      },
      type: {
        fieldType: 'FilterUiType',
        defaultValue: () => 'lessThan',
      },
      rhs: {
        fieldType: 'number',
        defaultValue: () => 0,
      },
      minDiff: {
        fieldType: 'number?',
        defaultValue: () => undefined,
      },
    },
    supportedFor: isNumericValueType,
  },
  lessThanOrEqual: {
    label: 'Less Than or Equal to Number',
    form: {
      column: {
        fieldType: 'SUniversalPColumnId',
        defaultValue: () => undefined,
      },
      type: {
        fieldType: 'FilterUiType',
        defaultValue: () => 'lessThanOrEqual',
      },
      rhs: {
        fieldType: 'number',
        defaultValue: () => 0,
      },
      minDiff: {
        fieldType: 'number?',
        defaultValue: () => undefined,
      },
    },
    supportedFor: isNumericValueType,
  },
  DoubleColumns: {
    label: 'Less than Column',
    form: {
      column: {
        fieldType: 'SUniversalPColumnId',
        defaultValue: () => undefined,
      },
      type: {
        fieldType: 'FilterUiType',
        defaultValue: () => 'DoubleColumns',
      },
      rhs: {
        fieldType: 'SUniversalPColumnId',
        defaultValue: () => undefined,
      },
      minDiff: {
        fieldType: 'number?',
        defaultValue: () => undefined,
      },
      allowEqual: {
        fieldType: 'boolean?',
        defaultValue: () => undefined,
      },
    },
    supportedFor: (spec1: SimplifiedPColumnSpec, spec2?: SimplifiedPColumnSpec): boolean => {
      return isNumericValueType(spec1) && (spec2 === undefined || isNumericValueType(spec2));
    },
  },
} satisfies CreateFilterUiMetadataMap<FilterUiType>;

export function getFilterUiTypeOptions(columnSpec?: SimplifiedPColumnSpec) {
  if (!columnSpec) {
    return [];
  }

  return Object.entries(filterUiMetadata).filter(([_, metadata]) => metadata.supportedFor(columnSpec)).map(([type, metadata]) => ({
    label: metadata.label,
    value: type,
  }));
}

export function getFilterUiMetadata(type: FilterUiType) {
  return filterUiMetadata[type];
}

export function parseAnnotationFilter(f: AnnotationFilter): FilterUi {
  if (f.type === 'or') {
    return {
      type: 'or' as const,
      filters: f.filters.map(parseAnnotationFilter), // Recursive call correctly typed
    };
  }

  if (f.type === 'and') {
    return {
      type: 'and' as const,
      filters: f.filters.map(parseAnnotationFilter), // Recursive call correctly typed
    };
  }

  if (f.type === 'not') {
    return {
      type: 'not' as const,
      filter: parseAnnotationFilter(f.filter),
    };
  }

  if (f.type === 'isNA') {
    return f;
  }

  if (f.type === 'pattern') {
    if (f.predicate.type === 'equals') {
      return {
        type: 'patternEquals' as const,
        column: f.column,
        value: f.predicate.value,
      };
    }

    if (f.predicate.type === 'containSubsequence') {
      return {
        type: 'patternContainSubsequence' as const,
        column: f.column,
        value: f.predicate.value,
      };
    }

    throw Error('unimplemented');
  }

  if (f.type === 'numericalComparison') {
    if (isUniversalPColumnId(f.lhs) && isUniversalPColumnId(f.rhs)) {
      return {
        column: f.lhs,
        type: 'DoubleColumns' as const,
        rhs: f.rhs,
        minDiff: f.minDiff,
        allowEqual: f.allowEqual || undefined,
      };
    }

    if (isUniversalPColumnId(f.lhs) && typeof f.rhs === 'number' && typeof f.allowEqual === 'undefined') {
      return {
        type: 'lessThan' as const,
        column: f.lhs,
        rhs: f.rhs,
        minDiff: f.minDiff,
      };
    }

    if (isUniversalPColumnId(f.lhs) && typeof f.rhs === 'number' && typeof f.allowEqual === 'boolean') {
      return {
        type: 'lessThanOrEqual' as const,
        column: f.lhs,
        rhs: f.rhs,
        minDiff: f.minDiff,
      };
    }

    throw Error('unimplemented');
  }

  unreachable(f);
}

export function compileFilter(ui: FilterUi): AnnotationFilter {
  if (ui.type === 'or') {
    return {
      type: 'or' as const,
      filters: compileFilters(ui.filters),
    };
  }

  if (ui.type === 'and') {
    return {
      type: 'and' as const,
      filters: compileFilters(ui.filters),
    };
  }

  if (ui.type === 'not') {
    return {
      type: 'not' as const,
      filter: compileFilter(ui.filter),
    };
  }

  if (ui.type === 'isNA') {
    return ui;
  }

  if (ui.type === 'lessThan') {
    return {
      type: 'numericalComparison' as const,
      lhs: ui.column,
      rhs: ui.rhs,
      minDiff: ui.minDiff,
    };
  }

  if (ui.type === 'lessThanOrEqual') {
    return {
      type: 'numericalComparison' as const,
      lhs: ui.column,
      rhs: ui.rhs,
      minDiff: ui.minDiff,
      allowEqual: true,
    };
  }

  if (ui.type === 'patternEquals') {
    return {
      type: 'pattern' as const,
      column: ui.column,
      predicate: {
        type: 'equals' as const,
        value: ui.value,
      },
    };
  }

  if (ui.type === 'patternContainSubsequence') {
    return {
      type: 'pattern' as const,
      column: ui.column,
      predicate: {
        type: 'containSubsequence' as const,
        value: ui.value,
      },
    };
  }

  if (ui.type === 'DoubleColumns') {
    return {
      type: 'numericalComparison' as const,
      lhs: ui.column,
      rhs: ui.rhs,
      minDiff: ui.minDiff,
      allowEqual: ui.allowEqual ? true : undefined,
    };
  }

  unreachable(ui);
}

export function compileFilters(uiFilters: FilterUi[]): AnnotationFilter[] {
  return uiFilters.map(compileFilter);
}

export type AnnotationStepUi = {
  label: string;
  filter: Extract<FilterUi, { type: 'and' | 'or' }>;
};

export type AnnotationScriptUi = {
  mode: AnnotationMode;
  steps: AnnotationStepUi[];
};

export function parseAnnotationScript(script: AnnotationScript): AnnotationScriptUi {
  const steps = script.steps.filter((step) => step.filter.type === 'and' || step.filter.type === 'or');

  return {
    mode: script.mode,
    steps: steps.map((step) => ({
      ...step,
      filter: parseAnnotationFilter(step.filter),
    })) as AnnotationStepUi[],
  };
}

export function compileAnnotationScript(uiScript: AnnotationScriptUi): AnnotationScript {
  return {
    mode: uiScript.mode,
    steps: uiScript.steps.map((step) => ({
      ...step,
      filter: compileFilter(step.filter),
    })),
  };
}
