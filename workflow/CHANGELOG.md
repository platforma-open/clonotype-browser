# @platforma-open/milaboratories.clonotype-browser-3.workflow

## 2.0.5

### Patch Changes

- f54d8fe: SDK Upgrade, fix page title

## 2.0.4

### Patch Changes

- ebda7f8: Migrate the block onto the structurer (block-tools 2.11.1) with a full SDK
  upgrade: model/ui-vue 1.79.15, workflow-tengo 6.6.3, tengo-builder 4.0.9,
  test 1.79.15. Canonical tool-managed layout (tsconfig, oxlint/oxfmt, turbo,
  block index, test-scope lint/fmt). No behavior change.

## 2.0.3

### Patch Changes

- 8618c84: SDK update

## 2.0.2

### Patch Changes

- b8ba916: Update SDK
- 1603c3a: update dependencies

## 2.0.1

### Patch Changes

- d298e28: dont show column header linker postfix

## 2.0.0

### Major Changes

- 6523b2c: Support peptides
- a2ec81f: Support peptides

## 1.2.0

### Minor Changes

- 6a42056: update sdk and replace workflow export to pframedriver export

## 1.1.0

### Minor Changes

- 3753a29: export only visible columns

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
