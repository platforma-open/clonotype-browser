# @platforma-open/milaboratories.clonotype-browser-3.workflow

## 1.0.7

### Patch Changes

- ba419d2: Mark the annotation column as a discrete filter and expose step labels via `pl7.app/discreteValues`. This lets downstream blocks (e.g. TCR/antibody lead selection) render the annotation column as a multi-select dropdown instead of a free-text string filter.

## 1.0.6

### Patch Changes

- f13bde7: Fix: main workflow now discovers linker columns and passes their IDs to `computeClonotypeAnnotations`. Without this, annotation expressions that reference columns on a different axis (e.g. `clusterId`-keyed enrichment columns bridged from a `clonotypeKey` input) caused the ptabler join to fail with "some of axes sets are disjoint". Prerun already did this; main now mirrors it.

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
