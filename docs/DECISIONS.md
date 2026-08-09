# Decisions

Append-only, dated. When a decision changes the shape of the code,
update the README beside it.

- **2026-08-08 — Founded.** Path 2 of the mermaid cycle-diagram
  assessment: a layout engine, not a new diagram type. The flowchart
  language stays; only placement changes. Modeled on
  `@mermaid-js/layout-tidy-tree` (registry shape, render seam) with
  zero runtime dependencies — the math needs no d3.
- **2026-08-08 — Against mermaid 11.x as published.** Developed
  against 11.16.1 from npm, peer range `^11.0.2` (andrewbroz.net's
  sync pins mermaid-cli 11.12.0). The master branch's helper surface
  differs; published is what consumers get.
- **2026-08-08 — The helpers seam is accepted risk.** mermaid marks
  `InternalHelpers` deprecated for external use. elk and tidy-tree
  ship on it anyway; so does this. The demo is the canary on
  upgrades.
