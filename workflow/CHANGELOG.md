# @platforma-open/milaboratories.clonotype-browser-3.workflow

## 1.0.5

### Patch Changes

- 9c2a423: Fix: `computeClonotypeAnnotations` crashed with "wrong number of arguments in call to builtin-function:append" whenever `linkerIds` was empty — the `append(arr, linkerIds...)` spread collapsed to a single-argument call. Replaced with array concatenation.
- 8eea85f: Fix: main workflow now emits annotation exports. Added the missing `wf.prepare` step so `args.columnBundle` is populated; without it `getAnnotationAxesSpec` returned `undefined` and the export guard silently skipped writing `annotationsPf` and `filtersPf` to the result pool.

## 1.0.4

### Patch Changes

- 96c7232: Migration to createTable v3 API

## 1.0.3

### Patch Changes

- d25c939: Update sdk

## 1.0.2

### Patch Changes

- 7f7ae7a: Fix export error

## 1.0.1

### Patch Changes

- 950a4cd: migrate to new annotations schema and ui filters
- 8ba9261: release
- cfc1d27: Init commit
