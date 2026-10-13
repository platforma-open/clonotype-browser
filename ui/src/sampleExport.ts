import type {
  FileFilter,
  PlDataTableColumnsMeta,
  PlDataTableModel,
  PTableColumnSpec,
  UiServices,
} from "@platforma-sdk/model";
import {
  Annotation,
  canonicalizeAxisId,
  getAxisId,
  isColumnHidden,
  isLabelColumn,
  isLinkerColumn,
  matchAxisId,
  readAnnotation,
  readAnnotationJson,
  XLSX_MAX_ROWS_PER_SHEET,
} from "@platforma-sdk/model";

/**
 * Writes the table to a file the user picks, in the format of the file's
 * extension, with the columns and headers the By sample table shows. Writes
 * nothing when the user cancels the save dialog.
 */
export async function exportSampleTable(
  services: Pick<UiServices, "dialog" | "pframe">,
  table: PlDataTableModel,
): Promise<void> {
  const handle = table.visibleTableHandle;
  if (handle === undefined) throw new Error("The export table has no data handle");

  const [specs, { rows }] = await Promise.all([
    services.pframe.getSpec(handle),
    services.pframe.getShape(handle),
  ]);
  const filters =
    rows > XLSX_MAX_ROWS_PER_SHEET
      ? EXPORT_FILTERS.filter(({ name }) => name !== "Excel")
      : EXPORT_FILTERS;

  const { canceled, path } = await services.dialog.showSaveDialog({
    defaultFileName: `samples_${formatTimestamp(new Date())}.csv`,
    filters,
  });
  if (canceled || path === undefined || !hasFilterExtension(path, filters)) return;

  const columns = displayedColumns(specs, table.columnsMeta);
  await services.pframe.exportPTable(handle, {
    path,
    columnIndices: columns.map((c) => c.index),
    headerNames: columns.map((c) => c.header),
  });
}

// Internals

const EXPORT_FILTERS: FileFilter[] = [
  { name: "CSV", extensions: ["csv"] },
  { name: "TSV", extensions: ["tsv"] },
  { name: "Parquet", extensions: ["parquet"] },
  { name: "Excel", extensions: ["xlsx"] },
];

/** Ranks axes and their label columns ahead of every data column. */
const LEADING_ORDER = Number.MAX_SAFE_INTEGER;

type ExportColumn = { index: number; header: string; order: number };

/**
 * The columns the table shows, in its order: axes and label columns first, then
 * data columns by order priority. A label column stands in for the axis it
 * labels; linker columns and hidden columns stay out.
 */
function displayedColumns(
  specs: PTableColumnSpec[],
  meta: PlDataTableColumnsMeta | undefined,
): ExportColumn[] {
  const labeledAxes = specs.flatMap((s) =>
    s.type === "column" && isLabelColumn(s.spec) && s.spec.axesSpec.length === 1
      ? [getAxisId(s.spec.axesSpec[0])]
      : [],
  );

  const isShown = (spec: PTableColumnSpec): boolean => {
    if (spec.type === "axis") {
      return (
        !labeledAxes.some((axis) => matchAxisId(axis, spec.id)) &&
        meta?.axes[canonicalizeAxisId(spec.id)]?.hidden !== true &&
        !isColumnHidden(spec.spec)
      );
    }
    if (isLinkerColumn(spec.spec)) return false;
    const visibility =
      meta?.columns[spec.id]?.visibility ?? (isColumnHidden(spec.spec) ? "hidden" : "default");
    return visibility !== "hidden";
  };

  const header = (spec: PTableColumnSpec): string => {
    const override = spec.type === "column" ? meta?.columns[spec.id]?.label : undefined;
    return (override ?? readAnnotation(spec.spec, Annotation.Label))?.trim() || spec.spec.name;
  };

  const order = (spec: PTableColumnSpec): number => {
    if (spec.type === "axis" || isLabelColumn(spec.spec)) return LEADING_ORDER;
    const priority = Number(
      meta?.columns[spec.id]?.order ??
        readAnnotationJson(spec.spec, Annotation.Table.OrderPriority),
    );
    return isNaN(priority) ? 0 : priority;
  };

  return specs
    .flatMap((spec, index) =>
      isShown(spec) ? [{ index, header: header(spec), order: order(spec) }] : [],
    )
    .sort((a, b) => b.order - a.order);
}

function hasFilterExtension(path: string, filters: FileFilter[]): boolean {
  return filters.some(({ extensions }) => extensions.some((ext) => path.endsWith("." + ext)));
}

function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  );
}
