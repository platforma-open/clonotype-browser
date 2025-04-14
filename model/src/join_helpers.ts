import type {
  DataInfo,
  PColumn,
  RenderCtx,
  PObjectId,
  PTableColumnSpec,
  PlDataTableState,
  PTableHandle,
  PTableRecordSingleValueFilterV2 } from '@platforma-sdk/model';
import {
  TreeNodeAccessor,
} from '@platforma-sdk/model';
import {
  selectorsToPredicate,
  getAxisId,
  isPColumn,
  matchAxisId,
} from '@platforma-sdk/model';

function getMainColumn(
  columns: PColumn<TreeNodeAccessor | DataInfo<TreeNodeAccessor>>[],
): PColumn<TreeNodeAccessor | DataInfo<TreeNodeAccessor>> | undefined {
  const mainColumnPredicate = selectorsToPredicate({
    name: 'pl7.app/vdj/sequence',
    domain: {
      'pl7.app/vdj/feature': 'CDR3',
      'pl7.app/alphabet': 'nucleotide',
    },
  });
  return columns.find((c) => mainColumnPredicate(c.spec));
}

function getLabelColumns<BlockArgs, UiState>(
  ctx: RenderCtx<BlockArgs, UiState>,
  columns: PColumn<TreeNodeAccessor | DataInfo<TreeNodeAccessor>>[],
): PColumn<TreeNodeAccessor | DataInfo<TreeNodeAccessor>>[] {
  const allLabelCols = ctx.resultPool
    .getData()
    .entries.map((d) => d.obj)
    .filter(isPColumn)
    .filter((p) => p.spec.name === 'pl7.app/label' && p.spec.axesSpec.length === 1);

  const colId = (id: PObjectId, domain?: Record<string, string>) => {
    let wid = id.toString();
    if (domain) {
      for (const k in domain) {
        wid += k;
        wid += domain[k];
      }
    }
    return wid;
  };

  const labelColumns = new Map<string, PColumn<TreeNodeAccessor>>();
  for (const col of columns) {
    for (const axis of col.spec.axesSpec) {
      const axisId = getAxisId(axis);
      for (const labelColumn of allLabelCols) {
        const labelAxis = labelColumn.spec.axesSpec[0];
        const labelAxisId = getAxisId(labelColumn.spec.axesSpec[0]);
        if (matchAxisId(axisId, labelAxisId)) {
          const dataDomainLen = Object.keys(axisId.domain ?? {}).length;
          const labelDomainLen = Object.keys(labelAxisId.domain ?? {}).length;
          if (dataDomainLen > labelDomainLen) {
            const id = colId(labelColumn.id, axisId.domain);

            labelColumns.set(id, {
              id: id as PObjectId,
              spec: {
                ...labelColumn.spec,
                axesSpec: [{ ...axisId, annotations: labelAxis.annotations }],
              },
              data: labelColumn.data,
            });
          } else {
            labelColumns.set(colId(labelColumn.id), labelColumn);
          }
        }
      }
    }
  }

  return [...labelColumns.values()];
}

export function createPlDataTableSpec<BlockArgs, UiState>(
  ctx: RenderCtx<BlockArgs, UiState>,
  columns: PColumn<TreeNodeAccessor | DataInfo<TreeNodeAccessor>>[],
): undefined | PTableColumnSpec[] {
  const mainColumn = getMainColumn(columns);
  if (!mainColumn) return undefined;

  const labelColumns = getLabelColumns(ctx, columns);

  const tableSpecs = [
    ...mainColumn.spec.axesSpec.map((axis) => ({
      type: 'axis',
      id: getAxisId(axis),
      spec: axis,
    } satisfies PTableColumnSpec)),
    ...[...columns, ...labelColumns].map((c) => ({
      type: 'column',
      id: c.id,
      spec: c.spec,
    } satisfies PTableColumnSpec)),
  ];
  return tableSpecs;
}

export function createPlDataTableData<BlockArgs, UiState>(
  ctx: RenderCtx<BlockArgs, UiState>,
  columns: PColumn<TreeNodeAccessor | DataInfo<TreeNodeAccessor>>[],
  tableState: PlDataTableState | undefined,
  filters: PTableRecordSingleValueFilterV2[] | undefined,
): PTableHandle | undefined {
  const mainColumn = getMainColumn(columns);
  if (!mainColumn) return undefined;

  const labelColumns = getLabelColumns(ctx, columns);
  const allColumns = [...columns, ...labelColumns];
  if (allColumns.some((a) => {
    return (a.data instanceof TreeNodeAccessor && !a.data.getIsReadyOrError())
      || ('type' in a.data
        && ((a.data.type === 'JsonPartitioned'
          && Object.values(a.data.parts).some((p) => !p.getIsReadyOrError()))
        || (a.data.type === 'BinaryPartitioned'
          && Object.values(a.data.parts)
            .some((p) => !p.index.getIsReadyOrError() || !p.values.getIsReadyOrError()))));
  })) return undefined;

  const hiddenColumns = new Set(
    tableState?.gridState.columnVisibility?.hiddenColIds
      ?.map((c) => JSON.parse(c) as PTableColumnSpec)
      .filter((c) => c.type === 'column')
      .map((c) => c.id)
      ?? allColumns
        .filter((c) => c.spec.annotations?.['pl7.app/table/visibility'] === 'optional')
        .map((c) => c.id));
  hiddenColumns.delete(mainColumn.id);

  const allFilters = [...(filters ?? []), ...(tableState?.pTableParams?.filters ?? [])];
  for (const filter of allFilters) {
    if (filter.column.type === 'column') {
      hiddenColumns.delete(filter.column.id);
    }
  }
  const sorting = tableState?.pTableParams?.sorting ?? [];
  for (const sort of sorting) {
    if (sort.column.type === 'column') {
      hiddenColumns.delete(sort.column.id);
    }
  }
  const visibleColumns = allColumns.filter((c) => !hiddenColumns.has(c.id));

  return ctx.createPTable({
    src: {
      type: 'outer',
      primary: {
        type: 'full',
        entries: visibleColumns.map((c) => ({ type: 'column', column: c })),
      },
      secondary: labelColumns.map((c) => ({ type: 'column', column: c })),
    },
    filters: allFilters,
    sorting,
  });
}
