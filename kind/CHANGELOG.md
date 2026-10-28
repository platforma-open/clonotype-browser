# @platforma-open/milaboratories.clonotype-browser-3.kind

## 1.2.0

### Minor Changes

- 32a9333: Accept a subset filter (e.g. a Repertoire Labeling label or Lead Selection picks) with the input dataset. The dataset list is built with buildDatasetOptions (requireEnrichments: false), with the same dataset labels as before.

  On a subset run everything covers only the subset's clonotypes: the Overlap and By sample tables, the By sample export, the annotation stats, and the annotations and per-label subset columns the block computes and exports. Exported columns of a subset run carry `pl7.app/inputSubset` in their domain and a trace rooted in the subset. Unfiltered runs are unchanged.

  How this differs from the other blocks updated for subsets: the annotation rules run on the full dataset and the result is then cut to the subset, rather than the input being restricted before the computation. Each clonotype's label depends only on its own values, so the result is the same. The tables keep reading the full dataset and hide the rows outside the subset with a filter the user cannot remove, so the dataset's own columns and links stay available in the views.

## 1.1.0

### Minor Changes

- 6150866: Add the mandatory block kind and its init-params contract

  The block declares a kind carrying its identity and an init-params contract of
  `inputAnchor` plus `annotationSpecUi` — the two fields a project template
  supplies to seed a new instance. The data model consumes them in `init` and the
  block model projects the same pair back through `templateParams`, so export and
  apply are inverses.

  Also tracks the current column API: `expandByPartition` is now `splitByAxes`
  with a defaulted label resolver, and `getLeafColumnData` is replaced by a
  `hasReachableData` guard followed by `getData()`.
