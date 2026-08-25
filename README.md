# Sequence Browser

Explore and annotate your sequences interactively. This Platforma block puts clonotypes or peptides in front of you across samples — frequencies, overlap, distributions — and lets you write rule-based annotations that tag sequences by any criteria you choose, turning a judgment you made while looking at the data into a column every downstream block can use.

Open-source analysis block for Platforma, the biologics discovery platform by MiLaboratories. For the full no-code workflow, see [platforma.bio](https://platforma.bio/).

> **Naming:** this block appears as **Sequence Browser** in the Platforma app. Older documentation and this repository name call it **Clonotype Browser**. They are the same block.

## What it does

Most analysis blocks compute something. This one is where you look, decide, and record the decision.

**Browsing** works across samples. The overlap view shows which sequences are shared and which are sample-specific; the per-sample view shows each sample's sequences with their frequencies and characteristics. Anything upstream blocks have added — enrichment scores, cluster IDs, liabilities, humanness, assay data — is available as columns alongside the sequences, so you are looking at the full picture rather than sequences in isolation.

**Annotation** is the block's real purpose. Instead of maintaining a side spreadsheet of "the ones we like," you define annotation rules: an ordered list of steps, each combining filter conditions over any column with AND/OR logic, and each assigning a label when it matches. Steps are evaluated in order, so the first matching rule wins, and sequences matching nothing take a default label. That makes categories like *high-frequency binder*, *sample-specific*, *liability-flagged*, or your own campaign-specific classes explicit and reproducible — the rules travel with the project rather than living in someone's head.

Annotations become columns in the project, so they filter and rank downstream like any computed score. A **Stats** view appears once you have rules defined, summarizing how many sequences and what fraction of abundance each annotation captured — the fast way to see whether a rule set is doing what you intended before acting on it.

## Inputs & outputs

* **Input:** a clonotype dataset from any Platforma clonotyping or import block, or a peptide dataset from [Peptide Profiling](https://github.com/platforma-open/peptide-extraction) — together with whatever score and annotation columns upstream blocks have contributed.
* **Output:** annotation labels per sequence, exposed as columns for downstream filtering and ranking, plus per-annotation counts and abundance fractions.

## Specifications

| | |
|---|---|
| Block title in app | Sequence Browser |
| Modalities | Clonotypes (T-cell and B-cell receptors) and peptides |
| Views | Overlap across samples, per-sample sequences, annotation statistics |
| Annotation rules | Ordered steps; each combines filter conditions over any column with AND/OR logic and assigns a label |
| Rule evaluation | First matching step wins; unmatched sequences take a default label |
| Statistics | Per-annotation sequence counts and abundance fractions |
| Outputs | Annotation columns consumable by any downstream block |

## Use cases

* **Record a manual call reproducibly:** encode "the candidates we are taking forward" as rules rather than a spreadsheet nobody can audit later.
* **Frequency-based tagging:** label sequences above an abundance or frequency threshold, then use that label to filter downstream.
* **Sample-specific vs shared:** use the overlap view to find sequences unique to one condition and annotate them as such.
* **Multi-criteria classes:** combine enrichment, liability, and cluster columns into one rule — for example, enriched *and* liability-free *and* from a distinct family.
* **Cross-sample tracking:** follow a set of annotated sequences across timepoints or selection rounds.
* **Cohort triage:** check the Stats view to see what share of your library each annotation captures before committing to it.
* **Functional annotation review:** browse candidates by assay data imported with [Import Assay Data](https://github.com/platforma-open/immune-assay-data).

## FAQ

### What is this block for, if it does not compute anything?

Exploration and record-keeping. It is where you inspect what upstream analysis produced and where you write down the classifications you make as a result — so those classifications become part of the project rather than a side note.

### How do annotation rules work?

Each rule is a set of filter conditions over any columns in the project, combined with AND/OR logic, plus a label to assign when they match. Rules run in order and the first match wins, so put the most specific rules first. Sequences matching no rule take the default label.

### Why use rules rather than selecting sequences by hand?

Because rules are reproducible and re-runnable. When upstream data changes — a re-run with different parameters, another selection round added — the annotations recompute from the same criteria instead of needing to be reapplied by hand. They also document *why* a sequence was classified as it was.

### Where do annotations show up?

As columns on your sequences, available to every downstream block for filtering and ranking, and summarized in the Stats view by sequence count and abundance fraction.

### What does the overlap view show?

Which sequences appear in which samples — the fast way to separate sequences shared across conditions from those specific to one. Useful both for tracking sequences through a campaign and for spotting sample-specific artifacts.

### Does it work with peptides?

Yes. Peptide datasets from display-selection campaigns are supported alongside receptor clonotypes, with the same browsing and annotation behavior.

### When does the Stats view appear?

Once you have annotation rules defined. Without rules there is nothing to summarize, so the section stays hidden.

## Part of the Platforma ecosystem

This block is part of [Platforma](https://platforma.bio/) by [MiLaboratories](https://github.com/milaboratory). Explore the other open-source blocks at [github.com/platforma-open](https://github.com/platforma-open) and the docs for antibody discovery at [docs.platforma.bio/biology-guides/antibody-discovery](https://docs.platforma.bio/biology-guides/antibody-discovery/).
