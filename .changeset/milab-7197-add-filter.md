---
"@platforma-open/milaboratories.clonotype-browser-3": minor
"@platforma-open/milaboratories.clonotype-browser-3.kind": minor
"@platforma-open/milaboratories.clonotype-browser-3.model": minor
"@platforma-open/milaboratories.clonotype-browser-3.ui": minor
"@platforma-open/milaboratories.clonotype-browser-3.workflow": minor
---

Accept a subset filter (e.g. a Repertoire Labeling label or Lead Selection picks) with the input dataset. The dataset list is built with buildDatasetOptions (requireEnrichments: false), with the same dataset labels as before.

Unlike the other blocks updated for subsets, the subset here only narrows what the block shows: the Overlap and By sample tables, the By sample export and the annotation stats cover the subset's clonotypes. The annotations and subset columns the block exports are still computed on the full dataset, carry no `pl7.app/inputSubset` stamp and no subset trace, and are unchanged by picking or changing a subset, so downstream blocks see exactly what they saw before. The main run does not take the subset at all; only the prerun stats do.
