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
- **2026-08-08 — The author's third review: the arrowhead's axis is
  the trajectory.** Upheld, and the mechanism found in mermaid's
  line-offset pass: any point within ~5px of a path end is displaced
  along the whole path's global left/right direction, so with dense
  samples the tail always kinks and `orient="auto"` rotates the
  marker along the kink. Every path now ends (and begins) with an
  explicit straight 10px tail laid exactly on the curve's terminal
  tangent — outreaching the displacement window, making the marker's
  line of symmetry the trajectory by construction — and interiors
  sample sparsely (~13px segments; sub-pixel sagitta). Also upheld:
  the two-node lens was lopsided because sibling spread applied to a
  pair the diameter tie already mirrors; at n = 2 the sibling key is
  the directed pair.
- **2026-08-08 — The review's harvest.** A ten-finding code review
  (high effort), nine fixed the same day: an undefined `spacing`
  from mermaid's config could ride over the default and turn the
  whole layout NaN; the peer floor rose to `^11.12.0`, the earliest
  release verified to carry `skipIntersect` and the label `data-id`
  (11.0.2 has neither — on it, the arrowhead and label machinery
  silently degrades); a self-loop on a lone node now draws its
  petal; a dropped edge no longer leaves its label at the origin;
  the two-node sibling key mismatch meant duplicate same-direction
  edges overlapped; the parallel-edge fan now scales instead of
  saturating at the clamp; the label push cap scales with label
  size; node and edge insertion went sequential (Promise.all made
  z-order nondeterministic for zero speedup); Bézier tails clamp to
  their sampled neighbor so a deep bow cannot double back. Not
  fixed, documented: mermaid measures HTML labels in screen pixels,
  so a CSS-transformed container skews collision checks.
- **2026-08-09 — The author's fourth review: the eye judges arrows,
  not angles.** Equal center angles gave unequal visible arrows,
  because a box's claim on the circle depends on its orientation (a
  wide box eats much arc at twelve o'clock, little at three).
  Superseded by gap equalization: each box claims its tangential
  extent, free arcs are set equal, mirror pairs are averaged to keep
  the bilateral symmetry, labeled gaps widen to hold their labels
  (the renderer then prefers a snug inline label over an airy exiled
  one, two-tier), and the radius rises when any pair of boxes would
  come too close — with a 1.6-footprint floor, because the extent
  linearization lies when the radius stops dwarfing the boxes (the
  two-node lens collapsed to prove it).
- **2026-08-09 — The fifth review: claims are measured, not
  estimated.** Gap equalization on linearized tangential extents
  still left the bottom arrow visibly stubby — the estimate runs
  10–25% off for boxes oblique to the rim, always in the same
  directions. Each box's claim is now the exact arc between the true
  rim crossings of its border (the same bisection the router uses),
  the relaxation is damped (a claim jumps steeply where the crossing
  moves between a box's side and its top edge, and undamped rounds
  bounce across the cliff), and convergence means the angles stopped
  moving — not merely that collisions settled, which had been
  breaking the loop half-way to the fixed point and was the actual
  bug. The pin is what the eye measures: all five water-cycle arrows
  now draw at the same length to the tenth of a pixel.
- **2026-08-09 — Reverted: measured claims and the marker curl.**
  The author judged both attempts against his eye and both failed —
  the arrows still read unequal and the arrowhead overlap survived —
  at a cost of two commits of added machinery. The source returns to
  the linearized gap equalization exactly as it stood before the
  measured-claims commit; the two superseded entries below stay, as
  the record of what was tried and why it was not enough. The open
  problems stand: the eye's metric for arrow equality is still not
  captured, and arrowheads near corners still need an answer that
  survives a human look.
- **2026-08-09 — The sixth review, twice over: silhouettes and
  flanks.** (Superseded by the reversion above, same day.) Two corrections from the author's eye against the
  measured-claims version. First, arc length between border
  crossings also lied: an arc can exit through a box's bottom edge
  and travel hidden beneath the box past its corner, so equal arc
  lengths still showed a short bottom arrow. The claim is now the
  box's silhouette — the angular extent its corners subtend —
  and what gets equalized is the open daylight between silhouettes,
  which is the thing the eye actually reads. Second, the arrowhead
  is a triangle, not a point: ~11px long, ~5px each side, and a
  shallow entry near a corner put a flank inside the box while the
  tip sat exactly on the border. Marker-bearing path ends now curl
  toward the border's normal just far enough for the whole triangle
  to clear — the tip stays put, and only ends that actually carry a
  visible marker curl, because curling a bare exit kinked it.
- **2026-08-09 — Process, of record: no push without the author's
  visual pass.** Two pushes in a row satisfied the numbers and
  failed his eye. Visual work now stops at a local commit and opened
  renders; the push waits for him.
- **2026-08-09 — Spurs: the ring is the 2-core.** Peeling nodes with
  a single neighbor, repeatedly, leaves exactly the cycle; the
  peeled forest hangs radially off its attachment nodes, deeper
  branches further out, each tree's angular wedge widening its rim
  node's claim so neighbors make room. Cycle-free graphs and rims
  thinner than three fall back to everything-on-the-ring. This is
  the hand-drawn tradition (Krebs, water-with-side-effects): one
  ring, spurs radiating.
- **2026-08-08 — The helpers seam is accepted risk.** mermaid marks
  `InternalHelpers` deprecated for external use. elk and tidy-tree
  ship on it anyway; so does this. The demo is the canary on
  upgrades.
- **2026-08-13 — The node is not its box; the border is mermaid's.**
  Circle nodes exposed the root fault: every geometric predicate
  modeled the node as its bounding rectangle, and `skipIntersect`
  kept mermaid from correcting it. Arrows stopped on invisible box
  corners (measured: up to r·(√2−1), 21px on a 105px circle — the
  bound exactly saturated), small arcs were mostly tail-workaround
  (8-10 points, four of them endpoint/tail pairs, through a basis
  spline), and half-diagonal footprints inflated rings 41% and split
  a satellite anchor's gaps 324/77/332. Both fixes are deletions.
  Spacing: the four extent helpers collapse into one support
  function, `extent(node, dir)`, with families for ellipse, diamond
  and stadium — a circle claims the same amount from every seat, so
  equal circles seat at exactly equal angles. Routing: every path is
  sampled center to center, then trimmed by ONE generic mechanism —
  `insideNode` (the silhouette test, per family) finds the crossing
  by bisection between consecutive samples, and an inflated
  silhouette (border + 10px) filters the interior so both terminal
  segments outreach mermaid's marker-meddling window. skipIntersect
  stays ON. Of record, because it was tried within the hour: handing
  the cut to mermaid's own intersect (skipIntersect off,
  center-terminated paths, dagre's contract) reproduced the buried,
  rotated arrowheads on the author's first render — the renderer's
  cut lands within a sample step of its neighbor and the marker
  orients along the kink, exactly what the third review's tails were
  built against. The two guarantees that survive every rewrite:
  endpoints exactly on the silhouette, and ≥10px of straight path
  before every marker. What changed is that both are now computed
  against the true silhouette in one bisection routine, and
  rimCrossing, rayAnchor, sideAnchor, insideBox, withTails and both
  tail constructions are gone.
- **2026-08-13 — Labels claim radial room; a pendant pair is a
  circle.** Three faults found working the labeled-elements cases.
  First, spur gaps never asked about labels — the rim's
  labeledGapNeed lesson, never applied radially. A labeled spur (or
  hub spoke, or satellite bridge) now widens its gap to the label's
  projection onto the spur direction plus breathing room, which is
  why LayoutEdgeInput grew labelHeight. Second, opposite spur
  siblings drew as ONE line: the sideways spread lived in each
  edge's own travel frame, and an opposite pair's perpendiculars
  cancel exactly. The spread now lives in the canonical frame of
  the sorted pair, like the rim fan's radial offset always did.
  Third, a pendant two-cycle (Earth ⇄ Lava off a ring) flattened
  into that collapsed spur, because blocksOf sees the undirected
  simple graph and a double edge collapses to one adjacency. The
  satellite extraction now runs whenever the 2-core has any block
  and admits a component hanging from one anchor by two or more
  edges — a cycle the peel cannot see — so the pair renders as the
  same tangent lens it earns standalone, labels widening it as on
  any rim. Known corner left open: a pendant lens hanging off a
  spur node (not a ring member) still flattens, though its two
  curves now at least separate.
