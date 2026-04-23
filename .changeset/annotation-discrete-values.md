---
'@platforma-open/milaboratories.clonotype-browser-3.workflow': patch
'@platforma-open/milaboratories.clonotype-browser-3': patch
---

Mark the annotation column as a discrete filter and expose step labels via `pl7.app/discreteValues`. This lets downstream blocks (e.g. TCR/antibody lead selection) render the annotation column as a multi-select dropdown instead of a free-text string filter.
