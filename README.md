# mermaid-layout-circular

A circular layout engine for mermaid flowcharts: the nodes of a cycle
placed on a circle, edges drawn as arcs, using mermaid's pluggable
layout registry. Destined to be a dependency of andrewbroz.net, where
diagram fences in notes render at sync time (see that repo's
2026-08-08 mermaid design); dagre draws a cycle as a bent ladder, and
this package is the repair.

This file is the one door in, for every reader: person or model.
`CLAUDE.md` is a symlink to it. Decisions are logged in
`docs/DECISIONS.md` (append-only, dated).

## Usage

The layout registers under the name `circular`, selected per diagram
in frontmatter — the same contract as `@mermaid-js/layout-elk`:

```
---
config:
  layout: circular
---
flowchart LR
  A --> B --> C --> D --> A
```

```ts
import mermaid from 'mermaid';
import circularLayouts from 'mermaid-layout-circular';

mermaid.registerLayoutLoaders(circularLayouts);
```

The full flowchart language keeps working — node shapes, edge labels,
classes, `look: handDrawn` — only placement changes. Non-flowchart
diagrams are out of scope; they own their layouts.

## Shape of the code

- `src/layout.ts` — the placement math, pure and unit-tested: node
  ordering around the circle, radius from measured node sizes, arc
  and chord point generation. No DOM.
- `src/render.ts` — the mermaid seam: insert nodes to measure them,
  call the math, position nodes, route edges through mermaid's own
  edge renderer.
- `src/index.ts` — the `LayoutLoaderDefinition[]` mermaid consumes.
- `demo/` — a vite page rendering the trial diagrams; the visual
  record lives beside it.

## Conventions

Conventional Commits, standard types. Model commits end with the
trailer `(generated using <model_name>)`; never `Co-Authored-By`.
Ask before pushing to any remote, once one exists. Committing as work
completes is fine and wanted.

## Gates

`npm test` (vitest, the math), `npm run lint` (eslint), `npm run
build` (vite lib build + declarations). All three green before any
commit that touches `src/`.

## Of record

Mermaid ships `InternalHelpers` marked deprecated — "definitions will
change without notice." Every external layout engine (elk, tidy-tree)
rides the same seam; the peer range stays `^11.0.2` and a mermaid
upgrade in the consumer is the moment to re-run the demo.
