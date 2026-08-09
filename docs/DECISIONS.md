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
- **2026-08-08 — Trial verdicts** (the visual record is `trials/`,
  screenshots against `demo/trials.html`):
  - *Chord bow:* inward 0.35 default. Outward bow rejected — it
    collides with rim nodes between the endpoints.
  - *Swerve:* 0.2 default. Bow-toward-center cannot move a diameter
    (its midpoint is the center), so a wheel's diameters stabbed one
    point; the left-of-travel swerve braids them and separates
    opposite directions for free. 0.35 read as mannered.
  - *Ordering:* follow-edges default, walked with declaration
    continuity from every start, best rim-adjacency score wins.
    Insertion order broke on a chord declared first; lowest-degree
    preference broke on a chord-heavy wheel; the exhaustive-start
    walk survived both. Diagram-sized n makes n·e nothing.
  - *Spacing:* 40 default; the knob reads monotonically 16→90.
  - *Sample count:* 24 default; 6 was already indistinguishable at
    demo scale, so density is not a cost worth tuning down.
- **2026-08-08 — The helpers seam is accepted risk.** mermaid marks
  `InternalHelpers` deprecated for external use. elk and tidy-tree
  ship on it anyway; so does this. The demo is the canary on
  upgrades.
