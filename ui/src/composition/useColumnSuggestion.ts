import type { ListOptionBase, PObjectId } from "@milaboratories/pl-model-common";
import { getUniqueSourceValuesWithLabels } from "@platforma-sdk/model";
import type { PlAdvancedFilterColumnId } from "@platforma-sdk/ui-vue";

import { useApp } from "../app";

export function useColumnSuggestion() {
  const app = useApp();

  const suggest = async (params: {
    columnId: PlAdvancedFilterColumnId;
    axisIdx?: number;
    searchStr: string;
    searchType: "value" | "label";
  }): Promise<ListOptionBase<string | number>[]> => {
    const handle = app.model.outputs.overlapColumns?.pFrame;
    if (handle == null) return [];

    const response = await getUniqueSourceValuesWithLabels(handle, {
      // `getUniqueSourceValuesWithLabels` still types `columnId` as PObjectId,
      // but the host accepts any ColumnUniversalId (wrapped recipes included).
      columnId: params.columnId as PObjectId,
      axisIdx: params.axisIdx,
      limit: 300,
      searchQuery: params.searchType === "label" ? params.searchStr : undefined,
      searchQueryValue: params.searchType === "value" ? params.searchStr : undefined,
    }).catch((err) => {
      console.error("Error while fetching unique values for suggestion:", err);
      return { values: [] as ListOptionBase<string | number>[] };
    });

    return response.values;
  };

  return suggest;
}
