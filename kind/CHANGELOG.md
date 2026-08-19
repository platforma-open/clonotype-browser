# @platforma-open/milaboratories.clonotype-browser-3.kind

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
