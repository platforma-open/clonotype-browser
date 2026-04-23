---
"@platforma-open/milaboratories.clonotype-browser-3.workflow": patch
---

Fix: `computeClonotypeAnnotations` crashed with "wrong number of arguments in call to builtin-function:append" whenever `linkerIds` was empty — the `append(arr, linkerIds...)` spread collapsed to a single-argument call. Replaced with array concatenation.
