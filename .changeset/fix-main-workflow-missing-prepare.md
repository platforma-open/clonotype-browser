---
"@platforma-open/milaboratories.clonotype-browser-3.workflow": patch
---

Fix: main workflow now emits annotation exports. Added the missing `wf.prepare` step so `args.columnBundle` is populated; without it `getAnnotationAxesSpec` returned `undefined` and the export guard silently skipped writing `annotationsPf` and `filtersPf` to the result pool.
