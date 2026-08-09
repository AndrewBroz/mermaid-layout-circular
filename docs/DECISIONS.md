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
- **2026-08-08 — The author's review: measure, think design.** The
  first shipped look failed his eye on two counts, both upheld:
  arrowheads landed on box corners at wrong rotations, and the ring
  was lopsided. Superseded by this review:
  - *Equal angles supersede sized slices.* A designer draws the
    regular polygon: first node centered on top, mirror symmetry
    about the vertical axis, side pairs at identical heights. The
    radius takes the worst pair over every gap instead of bending
    the angles.
  - *Paths own their endpoints.* Anchors sit where the ray toward
    the gap crosses the border (mid-edge, as a hand draws), curves
    pass through the gap's midpoint pulled to the anchors' radius (a
    rim-height waypoint sagged below side-by-side boxes), and
    mermaid renders with skipIntersect — its own re-trimming toward
    interior samples is what buried and rotated the arrowheads.
  - *Labels are measured, not hoped.* After insertEdgeLabel the true
    label rectangle is checked against every node box; a colliding
    rim label slides radially outward until clear — outside the ring
    there is always room.
- **2026-08-08 — The author's second review: one circle.** The
  quadratic-per-edge routing fixed flush entries but broke the form —
  each edge was its own curve, and the ring read as a poorly drawn
  figure. Superseded: a neighbor edge is a true arc of the one rim
  circle, from the exact angle where the circle leaves the source
  border (rim∩border by bisection; both shapes convex, so the
  crossing is unique) to where it enters the target's. Arrowheads
  inherit the rim's tangent. Of record: the entry walk must unwrap
  the target's angle (`a + delta`) — the stored angle can sit across
  the ±π seam and send the arc the long way round, and did.
- **2026-08-08 — Labels are owned, measured, and given breath.**
  positionEdgeLabel re-estimates position whenever the basis spline
  misses the sampled midpoint (always, for a curve), so the seam sets
  the label transform itself after measuring. The collision padding
  is breathing room (32px), not mere non-overlap — a label clearing
  a box by five pixels still reads as jammed; a tight-gap label
  slides radially outside the ring, where there is always room.
- **2026-08-08 — The helpers seam is accepted risk.** mermaid marks
  `InternalHelpers` deprecated for external use. elk and tidy-tree
  ship on it anyway; so does this. The demo is the canary on
  upgrades.
