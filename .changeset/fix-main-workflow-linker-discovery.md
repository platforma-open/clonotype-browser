---
"@platforma-open/milaboratories.clonotype-browser-3.workflow": patch
---

Fix: main workflow now discovers linker columns and passes their IDs to `computeClonotypeAnnotations`. Without this, annotation expressions that reference columns on a different axis (e.g. `clusterId`-keyed enrichment columns bridged from a `clonotypeKey` input) caused the ptabler join to fail with "some of axes sets are disjoint". Prerun already did this; main now mirrors it.
