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

// Define recursive type explicitly
export type FilterUi =
  | { type: 'or'; filters: FilterUi[] }
  | { type: 'and'; filters: FilterUi[] }
  | { type: 'not'; filter: FilterUi }
  | { type: 'isNA'; column: SUniversalPColumnId }
  | { type: 'patternEquals'; column: SUniversalPColumnId; value: string }
  | { type: 'patternContainSubsequence'; column: SUniversalPColumnId; value: string }
  | { type: 'lessThan'; column: SUniversalPColumnId; rhs: number; minDiff?: number; allowEqual?: true }
  | { type: 'DoubleColumns'; lhs: SUniversalPColumnId; rhs: SUniversalPColumnId; minDiff?: number; allowEqual?: true };

export type FilterUiType = FilterUi['type'];

export type FilterUiOfType<T extends FilterUi['type']> = Extract<FilterUi, { type: T }>;

type TypeToLiteral<T> =
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

export type TypeForm<T> = {
  [P in keyof T]: T[P] extends Record<string, unknown> ? {
    fieldType: 'form';
    form?: T[P] extends Record<string, unknown> ? TypeForm<T[P]> : undefined;
    defaultValue: () => T[P];
  } : {
    fieldType: TypeToLiteral<T[P]>;
    defaultValue: () => T[P];
  }
};

export type FormField = {
  fieldType: 'form';
  form?: Record<string, FormField>;
  defaultValue: () => Record<string, unknown>;
} | {
  fieldType: 'string';
  defaultValue: () => string;
} | {
  fieldType: 'number';
  defaultValue: () => number;
} | {
  fieldType: 'boolean';
  defaultValue: () => boolean;
} | {
  fieldType: 'SUniversalPColumnId';
  defaultValue: () => SUniversalPColumnId;
};

export const filterUiMetadata = {
  or: {
    label: 'Or',
    description: 'Or',
    icon: 'or',
    color: 'blue',
    form: {
      type: {
        fieldType: 'string',
        defaultValue: () => 'or',
      },
      filters: {
        fieldType: 'unknown[]',
        defaultValue: () => [],
      },
    },
    supportedFor: () => true,
  },
  and: {
    label: 'And',
    description: 'And',
    icon: 'and',
    color: 'green',
    form: {
      type: {
        fieldType: 'string',
        defaultValue: () => 'and',
      },
      filters: {
        fieldType: 'unknown[]',
        defaultValue: () => [],
      },
    },
    supportedFor: () => true,
  },
  not: {
    label: 'Not',
    description: 'Not',
    icon: 'not',
    color: 'red',
    form: {
      type: {
        fieldType: 'string',
        defaultValue: () => 'not',
      },
      filter: {
        fieldType: 'form',
        defaultValue: () => undefined as unknown as FilterUi, // TODO:
      },
    },
    supportedFor: () => true,
  },
  isNA: {
    label: 'Is NA',
    description: 'Is NA',
    icon: 'isNA',
    color: 'yellow',
    form: {
      type: {
        fieldType: 'string',
        defaultValue: () => 'isNA',
      },
      column: {
        fieldType: 'SUniversalPColumnId',
        defaultValue: () => '' as unknown as SUniversalPColumnId,
      },
    },
    supportedFor: () => true,
  },
  patternEquals: {
    label: 'Pattern Equals',
    description: 'Pattern Equals',
    icon: 'patternEquals',
    color: 'purple',
    form: {
      type: {
        fieldType: 'string',
        defaultValue: () => 'patternEquals',
      },
      column: {
        fieldType: 'SUniversalPColumnId',
        defaultValue: () => '' as unknown as SUniversalPColumnId,
      },
      value: {
        fieldType: 'string',
        defaultValue: () => '',
      },
    },
    supportedFor: isStringValueType,
  },
  patternContainSubsequence: {
    label: 'Pattern Contains Subsequence',
    description: 'Pattern Contains Subsequence',
    icon: 'patternContainsSubsequence',
    color: 'purple',
    form: {
      type: {
        fieldType: 'string',
        defaultValue: () => 'patternContainSubsequence',
      },
      column: {
        fieldType: 'SUniversalPColumnId',
        defaultValue: () => '' as unknown as SUniversalPColumnId,
      },
      value: {
        fieldType: 'string',
        defaultValue: () => '',
      },
    },
    supportedFor: isStringValueType,
  },
  lessThan: {
    label: 'Less Than',
    description: 'Less Than',
    icon: 'lessThan',
    color: 'orange',
    form: {
      type: {
        fieldType: 'string',
        defaultValue: () => 'lessThan',
      },
      column: {
        fieldType: 'SUniversalPColumnId',
        defaultValue: () => '' as unknown as SUniversalPColumnId,
      },
      rhs: {
        fieldType: 'number',
        defaultValue: () => 0,
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
    supportedFor: isNumericValueType,
  },
  DoubleColumns: {
    label: 'Double Columns',
    description: 'Double Columns',
    icon: 'DoubleColumns',
    color: 'cyan',
    form: {
      type: {
        fieldType: 'string',
        defaultValue: () => 'DoubleColumns',
      },
      lhs: {
        fieldType: 'SUniversalPColumnId',
        defaultValue: () => '' as unknown as SUniversalPColumnId,
      },
      rhs: {
        fieldType: 'SUniversalPColumnId',
        defaultValue: () => '' as unknown as SUniversalPColumnId,
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
    supportedFor: isNumericValueType,
  },
} satisfies Record<FilterUiType, {
  label: string;
  description: string;
  icon: string;
  color: string;
  form: TypeForm<FilterUiOfType<FilterUiType>>;
  supportedFor: (spec1: SimplifiedPColumnSpec, spec2: SimplifiedPColumnSpec | undefined) => boolean;
}>;

export function getFilterUiMetadata(type: FilterUiType) {
  return filterUiMetadata[type];
}

const isUniversalPColumnId = (x: unknown): x is SUniversalPColumnId => typeof x === 'string';

export function parseAnnotationFilter(f: AnnotationFilter): FilterUi {
  console.log('parseAnnotationFilter', f);

  if (f.type === 'or') {
    return {
      ...f,
      type: 'or' as const,
      filters: f.filters.map(parseAnnotationFilter), // Recursive call correctly typed
    };
  }

  if (f.type === 'and') {
    return {
      ...f,
      type: 'and' as const,
      filters: f.filters.map(parseAnnotationFilter), // Recursive call correctly typed
    };
  }

  if (f.type === 'not') {
    return {
      ...f,
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
        ...f,
        type: 'DoubleColumns' as const,
        lhs: f.lhs,
        rhs: f.rhs,
        minDiff: f.minDiff,
        allowEqual: f.allowEqual,
      };
    }

    if (isUniversalPColumnId(f.lhs) && typeof f.rhs === 'number') {
      return {
        type: 'lessThan' as const,
        column: f.lhs,
        rhs: f.rhs,
        minDiff: f.minDiff,
        allowEqual: f.allowEqual,
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
      allowEqual: ui.allowEqual,
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
      lhs: ui.lhs,
      rhs: ui.rhs,
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
