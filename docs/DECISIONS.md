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
- **2026-11-22 — Mermaid 12 joins the peer range.** The range widened
  from `^11.12.0` to `>=11.12.0 <13`, and development moved to 12.3.0.
  The `InternalHelpers` surface in 12.x differs from 11.16 only by two
  new optional parameters (`insertEdge`'s `layoutAlgorithm`,
  `labelHelper`'s `ignoreMinWidth`) that `src/render.ts` does not use,
  and the `registerLayoutLoaders` dispatch is unchanged. Verified by
  the three gates and by rendering the gallery and the bow and samples
  trials against 12.3.0: every case drew, no NaN, no console errors.
  The 11.12.0 floor stays.
- **2026-11-25 — A spur and a satellite on one node split its fan.**
  `effectiveExtent` already reserved ring room for a node's spur
  forest and its satellites side by side, but placement put both on
  the node's own ray. A bridge satellite's landing node then drew
  exactly on top of the spur leaf (`trials/spur-satellite-before.png`:
  Build log hides Debug). Now the spur forest takes one side of the
  ray and the satellites the other, a spacing apart
  (`trials/spur-satellite-after.png`). Nodes carrying only one of the
  two place exactly as before; the gallery's other cases render
  unchanged. Same pass: counter-clockwise now honors a custom
  `startAngle`. The solve runs at π − startAngle and the vertical
  mirror brings the first node back, because a mirror across any
  other axis would turn axis-aligned boxes. Known corners left open: a
  self-loop on a figure-eight waist points into the main ring, an
  explicit `hub` naming an off-ring node is ignored silently once the
  graph has a cycle, and a colliding label on a satellite's rim
  slides outward from the main center, not the satellite's.
- **2026-11-25 — The math comes from layout-circular.** The placement
  math moved to its own package, `layout-circular`, shared with the
  Pele layout. `src/layout.ts` and `src/layout.test.ts` are gone. The
  math and its tests live there now, with their history. This package
  lists it as a devDependency. Vite compiles it into the bundle, and
  dts-bundle-generator inlines its types into `dist/index.d.ts`. The
  published package has no runtime dependency on it. The reason is
  the upstreams: mermaid and Pele both take in layout code as source,
  not as a dependency, so the core is built to be copied, and this
  package copies it at build time. What only mermaid needs stays in
  `src/render.ts`. It passes `tail: 10`, because mermaid's marker
  handling moves points within about 5px of a path's end. Label
  placement moved into the core unchanged, so `render.ts` now draws
  each label at the point the core returns. Its own tests cover which
  options reach the math. The gallery and the five trial suites render
  identically before and after. Open: CI runs `npm ci`, which cannot
  resolve `file:../layout-circular` on GitHub. That waits on
  `layout-circular` getting a remote or an npm release.
- **2026-11-25 — The core installs from GitHub.** `layout-circular` now
  has a remote, so the devDependency is
  `github:AndrewBroz/layout-circular` instead of a local path. npm
  fetches it over HTTPS and runs its `prepare` script, which builds
  it, so CI can install it and nothing needs building by hand. The
  lockfile pins the commit.
- **2026-11-25 — `curve: linear` draws straight edges.** A diagram
  whose config sets `flowchart.curve: linear` gets layout-circular's
  `edges: 'straight'`. The ring becomes a polygon, and a three-cycle a
  triangle. The owner chose mermaid's existing knob over a new layout
  name, for the reasons recorded in layout-circular's DECISIONS. The
  seam reads it from `data4Layout.config.flowchart.curve`: mermaid's
  flowchart `getData` hands the merged config there, frontmatter
  included, and the default is `basis`. Only `linear` maps; every
  other curve keeps the arcs. Like `circular-ccw`, the diagram's own
  config outranks options set in code. Mermaid then draws the points
  with its linear curve, so the segments stay straight. A per-edge
  curve and `linkStyle default interpolate linear` are not read. The
  demo gallery has a case. This needs a release of layout-circular
  with the `edges` option.
- **2026-11-25 — Chords are straight; bow and swerve are gone.** The
  owner decided that a chord is always a straight line, whatever
  `flowchart.curve` says, and that `bow` and `swerve` are removed
  rather than kept as opt-in. The decision and its reasons are
  recorded in layout-circular's DECISIONS. It supersedes this file's
  trial verdicts on chord bow (inward 0.35) and swerve (0.2).
  `curve: linear` now changes only the edges between ring neighbors.
  The demo's `bow` and `swerve` trial suites are removed, and the
  trials page opens on `ordering`. The screenshots in `trials/` stay
  as history. Of the README images, only `labels-and-chord.png` shows
  a chord, so only it was re-rendered. It was rendered with mermaid
  11.12, like its neighbors, since 12.3 draws nodes with a different
  look. This needs layout-circular 0.2.0 or the commit that removes
  the options.
- **2026-11-25 — Subgraph shapes come from the core.** `render.ts`
  drew each cluster as the padded union of where its members landed,
  and nothing kept that box off other nodes or boxes. `layout-circular`
  now places group shapes, strategy D2 from the owner's prototype
  gallery (its DECISIONS entry "Group shapes are placed here, the book
  designer's way"). The seam passes each subgraph's parent, mermaid's
  own padding, `CLUSTER_PAD` (12px a side) with `CLUSTER_TITLE` (26px)
  added on top, and the title's measured size, through
  `layoutGroupsFor`. The title is measured by drawing each cluster
  once, hidden, with `insertCluster`, because a band seats its caption
  outside itself before anything is placed. A box is drawn by
  `insertCluster` at the core's rect, as before. A band is drawn by
  `insertCluster` at its bounds, then its rect is replaced with a path,
  the band's outline. Mermaid colors cluster rects through
  `.cluster rect`, which a path doesn't match, so the path carries the
  colors the rect computed to, then the rect's own style. Under
  `look: handDrawn` the wall is rough.js paths, so a band takes the
  theme's cluster colors and is drawn plain. The cluster's title moves
  to the band's caption point. A box's title follows the core too:
  where spokes or chords cross the top, the core moves the title room
  to the bottom, and the seam moves mermaid's cluster label there. On
  top, the label keeps mermaid's height and slides to the spot the
  core found clear of edges. The subgraph pictures in `docs/media`
  were redrawn with mermaid 11.12, as the others were. Known limit:
  under `look: handDrawn` a band is drawn plain. When the core reports `groupsClear`
  false, the seam logs a warning. The union code is gone. The demo
  gains a band case and a nested-band case. Diagrams without
  subgraphs take the same path as before. This needs a release of
  layout-circular with group shapes; the lockfile moves to that commit
  once it merges.
- **2026-11-25 — The README leads with the picture, and the pictures
  come from this repo.** The README now opens with what the layout
  does and one picture, then the family table, install and setup.
  The showcase follows setup, and every picture's source moves to
  `docs/GALLERY.md`. README pictures are rendered by
  `npm run docs:images` (`scripts/render-docs.mjs`, which screenshots
  `demo/docs.html` in the installed Chrome through `playwright-core`)
  with the repo's mermaid 12.3, at 2x, on a white card with a thin
  gray border, rendered on macOS so every picture uses the same fonts.
  They replace the 11.12 renders borrowed from andrewbroz.net: the repo
  can now reproduce them on its own, and 12.x is what new users
  install. Each picture is a demo case with a `doc` name, so a picture
  and its case can't drift apart. mermaid 12.3 gives every node a
  minimum width of 120px (`flowchart.minNodeWidth`), so its pictures
  are wide. A first try showed the showcase at half its natural width,
  and its node text came out about 8px, too small to read. Instead,
  every README picture is shown at 0.65 of its natural width, one
  scale for the whole page. The showcase and the group pair use
  compact diagrams, with fewer nodes, so two fit side by side at that
  scale. The satellite and figure-eight texts start at the shared
  node, so their circles stack and stay narrow. The larger versions
  stay in the demo. `CLAUDE.md` is no longer a symlink to the README;
  it holds the agent's own rules.
- **2026-11-26 — The core installs from npm, at 0.3.0.** The
  devDependency is `layout-circular@^0.3.0` from npm, in place of
  `github:AndrewBroz/layout-circular`. The GitHub entry was a stopgap
  until an npm release. Its lockfile still pinned the 0.1.1 commit, so
  the bundle carried 0.1.1. With 0.3.0 the bundle gains every core
  change since then: a box holds the arcs between its members, the
  `title-bottom` hub is compact, and groups take their shape by fit.
- **2026-11-26 — Groups by fit.** A group is a box when one clears,
  however much of the ring it covers. A box may put its title below at
  a turn that can't clear with titles on top. A group is a band only
  when no box fits. The owner picked this from renders; it is
  provisional and may change. This package draws bands as before. The
  docs show a band with `hub-band` and a nested band with
  `hub-nested-band`. `lifecycle-band.png` and `nested-band.png` stay
  until the next release, because the npm README loads its pictures
  from `main`.
- **2026-11-26 — A playground.** The demo site's front page is a
  playground. A visitor picks an example from a drop-down, edits its
  text, and sees it drawn. The owner asked for the drop-down, a quick
  editor for the frontmatter settings, and a Circular toggle in place
  of a side-by-side comparison. The controls are Circular, its
  direction, Straight edges and Hand-drawn. They write into the text,
  so what is drawn is always what a visitor can copy. Each control's
  label shows the line it writes. The edits go through the `yaml`
  library, which keeps a visitor's comments and key order and reads
  any YAML form they type. It is a dev dependency, used by the demo
  only; the package still has no runtime dependencies. The examples
  are the water cycle and every heading in `docs/GALLERY.md`, and a
  test keeps the two lists matched. The link holds the example's
  name, or the visitor's own text once they edit it. The grid of
  every case moves to `gallery.html`. pele-layout-circular has the
  same page. The design is in
  `docs/superpowers/specs/2026-11-26-playground-design.md`.
