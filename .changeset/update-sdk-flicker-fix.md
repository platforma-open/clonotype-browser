---
'@platforma-open/milaboratories.clonotype-browser-3.model': patch
'@platforma-open/milaboratories.clonotype-browser-3.ui': patch
---

Update the Platforma UI SDK to pick up the `PlAgDataTableV2` fix: `@platforma-sdk/ui-vue` and `@platforma-sdk/test` 1.79.15 → 1.79.34, `@platforma-sdk/model` 1.79.15 → 1.79.27, `@milaboratories/pl-model-common` 1.45.0 → 1.46.4, `@milaboratories/helpers` 1.14.2 → 1.14.3.

Resolves the infinite grid-remount loop in the data table that made column headers strobe (rapid flickering of the type icons) and flooded the console with AG Grid "grid has been destroyed" errors. Dependency bump only — no block behavior change.
