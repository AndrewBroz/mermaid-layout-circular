/**
 * The placement math, pure and DOM-free.
 *
 * Nodes sit at equal angles on one circle — the regular polygon a
 * designer would draw — with the first node centered on top, so the
 * ring is mirror-symmetric about the vertical axis and side pairs
 * share their heights exactly. The radius is solved from what the
 * nodes demand: every pair of positions g steps apart spans a chord
 * of 2R·sin(gπ/n), which must cover the two footprints plus spacing,
 * so R is the maximum of that requirement over all pairs.
 *
 * A neighbor edge is a true arc of that same circle — from the exact
 * angle where the circle leaves the source box's border to the exact
 * angle where it enters the target's, so the eye reads one ring, not
 * n separate curves, and every arrowhead sits on the border rotated
 * along the rim's own tangent. Paths start and end exactly on
 * borders — mermaid is told to skip its own boundary trimming.
 */

export interface LayoutNodeInput {
  id: string;
  width: number;
  height: number;
}

export interface LayoutEdgeInput {
  id: string;
  start: string;
  end: string;
  /** Measured width of the edge's label, when it has one. A labeled
   *  gap on the rim widens so the label can live inside it. */
  labelWidth?: number;
  /** True when the edge draws a visible marker at its start; the
   *  path's start then curls clear of the box like the end does.
   *  Default false — a plain arrow has no start marker to protect,
   *  and curling for nothing would kink the exit. */
  startMarker?: boolean;
  /** True when the edge draws a visible marker at its end.
   *  Default true. */
  endMarker?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface PlacedNode extends Point {
  id: string;
  /** Angle of the node's center on the circle, radians. */
  angle: number;
}

export interface RoutedEdge {
  id: string;
  start: string;
  end: string;
  points: Point[];
  /** True when the edge rides the rim between circle neighbors. */
  onRim: boolean;
}

export interface CircularLayoutOptions {
  /** Minimum gap between adjacent footprints along the rim. */
  spacing?: number;
  /** Angle of the first node, radians. Default -π/2: the top. */
  startAngle?: number;
  /** 'follow-edges' walks the graph so cycle neighbors sit beside each
   *  other; 'input' keeps the author's order. */
  ordering?: 'follow-edges' | 'input';
  /** How far a non-neighbor chord bows toward the center, 0..1.
   *  0 is a straight line. */
  bow?: number;
  /** Sideways slide (fraction of the radius) for chords passing near
   *  the center, so diameters braid around the hub instead of
   *  stabbing through one point. 0 disables. */
  swerve?: number;
  /** Points sampled per edge path. */
  samples?: number;
}

export interface CircularLayoutResult {
  nodes: PlacedNode[];
  edges: RoutedEdge[];
  order: string[];
  radius: number;
}

const TAU = 2 * Math.PI;

const defaults = {
  spacing: 40,
  startAngle: -Math.PI / 2,
  ordering: 'follow-edges' as const,
  bow: 0.35,
  swerve: 0.2,
  samples: 24,
};

/** Half the diagonal: the safe radius of a box whatever its rotation. */
const footprint = (n: LayoutNodeInput) => Math.hypot(n.width, n.height) / 2;

/**
 * Order the rim by walking the graph with declaration continuity:
 * from each node, continue along the out-edge written soonest after
 * the edge just walked — an author writes a cycle as a run of
 * statements, and the run is the path. No single start is safe (a
 * chord written first derails one, a busy hub another), so every
 * start is tried and the walk that puts the most edges between rim
 * neighbors wins. Diagram-sized graphs make the n·e price nothing.
 */
const followEdges = (nodes: LayoutNodeInput[], edges: LayoutEdgeInput[]): string[] => {
  interface Arc {
    to: string;
    index: number;
  }
  const out = new Map<string, Arc[]>();
  const undirected = new Map<string, Arc[]>();
  for (const n of nodes) {
    out.set(n.id, []);
    undirected.set(n.id, []);
  }
  let arcCount = 0;
  for (const [index, e] of edges.entries()) {
    if (!out.has(e.start) || !out.has(e.end) || e.start === e.end) {
      continue;
    }
    out.get(e.start)!.push({ to: e.end, index });
    undirected.get(e.start)!.push({ to: e.end, index });
    undirected.get(e.end)!.push({ to: e.start, index });
    arcCount = Math.max(arcCount, index + 1);
  }

  const walkFrom = (start: string): string[] => {
    const order: string[] = [];
    const seen = new Set<string>();
    const visit = (id: string) => {
      order.push(id);
      seen.add(id);
    };
    // Roots rotate so `start` leads; later components keep input order.
    const startAt = nodes.findIndex((n) => n.id === start);
    const roots = [...nodes.slice(startAt), ...nodes.slice(0, startAt)];
    for (const root of roots) {
      if (seen.has(root.id)) {
        continue;
      }
      let here = root.id;
      let lastIndex = -1;
      visit(here);
      for (;;) {
        const soonestAfter = (arcs: Arc[]): Arc | undefined =>
          arcs
            .filter((arc) => !seen.has(arc.to))
            .sort(
              (p, q) =>
                ((p.index - lastIndex + arcCount) % (arcCount + 1)) -
                ((q.index - lastIndex + arcCount) % (arcCount + 1))
            )[0];
        const next = soonestAfter(out.get(here)!) ?? soonestAfter(undirected.get(here)!);
        if (next === undefined) {
          break;
        }
        visit(next.to);
        here = next.to;
        lastIndex = next.index;
      }
    }
    return order;
  };

  const rimScore = (order: string[]): number => {
    const pos = new Map(order.map((id, i) => [id, i]));
    let score = 0;
    for (const e of edges) {
      const p = pos.get(e.start);
      const q = pos.get(e.end);
      if (p === undefined || q === undefined || e.start === e.end) {
        continue;
      }
      const gap = Math.abs(p - q);
      if (Math.min(gap, order.length - gap) === 1) {
        score++;
      }
    }
    return score;
  };

  let best: string[] = nodes.map((n) => n.id);
  let bestScore = -1;
  for (const n of nodes) {
    const candidate = walkFrom(n.id);
    const score = rimScore(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
};

const onCircle = (radius: number, angle: number): Point => ({
  x: radius * Math.cos(angle),
  y: radius * Math.sin(angle),
});

/** The signed short way from angle a to angle b; a diameter's tie
 *  resolves clockwise, which mirrors a two-node pair into a lens. */
const shortWay = (a: number, b: number): number => {
  let delta = (b - a) % TAU;
  if (delta > Math.PI) {
    delta -= TAU;
  }
  if (delta < -Math.PI) {
    delta += TAU;
  }
  if (Math.abs(Math.abs(delta) - Math.PI) < 1e-9) {
    delta = Math.PI;
  }
  return delta;
};

interface BoxAt extends Point {
  width: number;
  height: number;
}

/**
 * The middle of the side facing the target — used for the petal's
 * outward side, where only the side matters.
 */
const sideAnchor = (b: BoxAt, target: Point): Point => {
  const dx = target.x - b.x;
  const dy = target.y - b.y;
  const exitsVertical = Math.abs(dx) * b.height >= Math.abs(dy) * b.width;
  return exitsVertical
    ? { x: b.x + Math.sign(dx || 1) * (b.width / 2), y: b.y }
    : { x: b.x, y: b.y + Math.sign(dy || 1) * (b.height / 2) };
};

/**
 * Where the ray from the box center toward the target crosses the
 * border — the spot a hand starts an arrow from. Rays toward a
 * lateral target cross mid-edge; only a genuinely diagonal target
 * approaches a corner, which is then honestly where the arrow goes.
 */
const rayAnchor = (b: BoxAt, target: Point): Point => {
  const dx = target.x - b.x;
  const dy = target.y - b.y;
  const t = Math.min(
    dx === 0 ? Infinity : b.width / 2 / Math.abs(dx),
    dy === 0 ? Infinity : b.height / 2 / Math.abs(dy)
  );
  if (!Number.isFinite(t)) {
    return { x: b.x, y: b.y + b.height / 2 };
  }
  return { x: b.x + dx * t, y: b.y + dy * t };
};

const insideBox = (p: Point, b: BoxAt): boolean =>
  Math.abs(p.x - b.x) < b.width / 2 && Math.abs(p.y - b.y) < b.height / 2;

/**
 * The angle at which the circle of `radius` crosses the border of a
 * box whose center sits on it — walking from the center's angle
 * toward `limit`. Circle and box are both convex, so the crossing is
 * unique; a coarse walk brackets it and bisection sharpens it. Falls
 * back to `limit` when the walk never leaves the box (a box so large
 * it swallows its whole gap — the radius solver prevents this, but a
 * fallback beats a lie).
 */
const rimCrossing = (radius: number, b: BoxAt, from: number, limit: number): number => {
  const steps = 32;
  let inside = from;
  let outside: number | undefined;
  for (let i = 1; i <= steps; i++) {
    const angle = from + ((limit - from) * i) / steps;
    if (insideBox(onCircle(radius, angle), b)) {
      inside = angle;
    } else {
      outside = angle;
      break;
    }
  }
  if (outside === undefined) {
    return limit;
  }
  let lo = inside;
  let hi: number = outside;
  for (let i = 0; i < 40; i++) {
    const probe = (lo + hi) / 2;
    if (insideBox(onCircle(radius, probe), b)) {
      lo = probe;
    } else {
      hi = probe;
    }
  }
  return hi;
};

const unit = (v: Point): Point => {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
};

/**
 * Straighten both ends of a sampled curve into explicit 10px tails
 * laid along the given end tangents. The arrowhead's line of symmetry
 * is the final path segment's direction, and mermaid displaces points
 * within ~5px of an end — a straight tail longer than that window
 * makes the marker's axis the curve's true trajectory by
 * construction.
 */
const withTails = (points: Point[], d0: Point, d1: Point, tail: number): Point[] => {
  const first = points[0]!;
  const second = points[1]!;
  const last = points[points.length - 1]!;
  const penult = points[points.length - 2]!;
  // A tail longer than the gap to its neighboring sample would
  // overshoot it and double the path back on itself. The control
  // polygon overestimates curve length, so clamp against the real
  // sampled spacing.
  const startTail = Math.min(tail, 0.9 * Math.hypot(second.x - first.x, second.y - first.y));
  const endTail = Math.min(tail, 0.9 * Math.hypot(last.x - penult.x, last.y - penult.y));
  return [
    first,
    { x: first.x + d0.x * startTail, y: first.y + d0.y * startTail },
    ...points.slice(1, -1),
    { x: last.x - d1.x * endTail, y: last.y - d1.y * endTail },
    last,
  ];
};

/** Samples for a curve of the given approximate length: ~13px
 *  segments, so no interior point falls in mermaid's end windows. */
const densityOf = (length: number, cap: number) =>
  Math.max(3, Math.min(cap, Math.round(length / 13)));

/** A quadratic Bézier, sparsely sampled, with straight tangent tails. */
const quadratic = (p0: Point, c: Point, p3: Point, cap: number): Point[] => {
  const approxLength = Math.hypot(c.x - p0.x, c.y - p0.y) + Math.hypot(p3.x - c.x, p3.y - c.y);
  const samples = densityOf(approxLength, cap);
  const points: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    points.push({
      x: u * u * p0.x + 2 * u * t * c.x + t * t * p3.x,
      y: u * u * p0.y + 2 * u * t * c.y + t * t * p3.y,
    });
  }
  const tail = Math.min(10, approxLength / 4);
  return withTails(
    points,
    unit({ x: c.x - p0.x, y: c.y - p0.y }),
    unit({ x: p3.x - c.x, y: p3.y - c.y }),
    tail
  );
};

/** A cubic Bézier, sparsely sampled, with straight tangent tails. */
const cubic = (p0: Point, c1: Point, c2: Point, p3: Point, cap: number): Point[] => {
  const approxLength =
    Math.hypot(c1.x - p0.x, c1.y - p0.y) +
    Math.hypot(c2.x - c1.x, c2.y - c1.y) +
    Math.hypot(p3.x - c2.x, p3.y - c2.y);
  const samples = densityOf(approxLength, cap);
  const points: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    points.push({
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
    });
  }
  const tail = Math.min(10, approxLength / 5);
  return withTails(
    points,
    unit({ x: c1.x - p0.x, y: c1.y - p0.y }),
    unit({ x: p3.x - c2.x, y: p3.y - c2.y }),
    tail
  );
};

/** Half-extent of a box along the rim's tangent at the given angle:
 *  what the box actually claims of the circle, which depends on its
 *  orientation — a wide box claims much at 12 o'clock and little at
 *  3 o'clock, because only the tangential dimension counts. */
const tangentialExtent = (node: LayoutNodeInput, angle: number): number =>
  (Math.abs(Math.sin(angle)) * node.width) / 2 + (Math.abs(Math.cos(angle)) * node.height) / 2;

/** Half-extent of a box along the radial direction at the given angle. */
const radialExtent = (node: LayoutNodeInput, angle: number): number =>
  (Math.abs(Math.cos(angle)) * node.width) / 2 + (Math.abs(Math.sin(angle)) * node.height) / 2;

/** Half-extent of a box along an arbitrary unit direction. */
const supportExtent = (node: LayoutNodeInput, dir: Point): number =>
  (Math.abs(dir.x) * node.width) / 2 + (Math.abs(dir.y) * node.height) / 2;

/**
 * Separate the ring from what hangs off it. Repeatedly removing
 * nodes with a single live neighbor peels away every tree, and what
 * remains is the 2-core: the cycle (with its chords). Each peeled
 * node remembers the neighbor it hung from, which builds the spur
 * forest bottom-up. Isolated nodes and the roots of cycle-free
 * components survive peeling and stay on the ring.
 */
const peel = (
  nodes: LayoutNodeInput[],
  edges: LayoutEdgeInput[]
): { rim: Set<string>; childrenOf: Map<string, string[]> } => {
  const neighborsOf = new Map<string, Set<string>>();
  for (const node of nodes) {
    neighborsOf.set(node.id, new Set());
  }
  for (const e of edges) {
    if (e.start !== e.end && neighborsOf.has(e.start) && neighborsOf.has(e.end)) {
      neighborsOf.get(e.start)!.add(e.end);
      neighborsOf.get(e.end)!.add(e.start);
    }
  }
  const rim = new Set(nodes.map((n) => n.id));
  const childrenOf = new Map<string, string[]>();
  let peeled = true;
  while (peeled) {
    peeled = false;
    for (const node of nodes) {
      if (!rim.has(node.id)) {
        continue;
      }
      const live = [...neighborsOf.get(node.id)!].filter((nb) => rim.has(nb));
      if (live.length === 1) {
        rim.delete(node.id);
        const parent = live[0]!;
        if (!childrenOf.has(parent)) {
          childrenOf.set(parent, []);
        }
        childrenOf.get(parent)!.push(node.id);
        peeled = true;
      }
    }
  }
  return { rim, childrenOf };
};

const MARKER_LENGTH = 11;
const MARKER_HALF = 5;

/**
 * The arrowhead is a triangle, not a point: ~11px long, ~5px to each
 * side of the path, with only its tip on the border. A shallow entry
 * near a box corner puts a flank inside the box. The repair is the
 * gesture a hand makes: keep the tip where it is and curl the final
 * approach toward the border's normal, just far enough that the
 * whole triangle clears — a perpendicular entry has its flanks
 * parallel to the edge and outside it by construction.
 */
const curlMarkerClear = (points: Point[], box: BoxAt): void => {
  if (points.length < 2) {
    return;
  }
  const tip = points[points.length - 1]!;
  const prev = points[points.length - 2]!;
  const incoming = unit({ x: tip.x - prev.x, y: tip.y - prev.y });
  // Outward normal of the border edge the tip sits on.
  const dx = (tip.x - box.x) / (box.width / 2 || 1);
  const dy = (tip.y - box.y) / (box.height / 2 || 1);
  const normalOut =
    Math.abs(dx) >= Math.abs(dy)
      ? { x: Math.sign(dx || 1), y: 0 }
      : { x: 0, y: Math.sign(dy || 1) };
  const clears = (d: Point): boolean => {
    const perp = { x: -d.y, y: d.x };
    return [-1, 1].every((sign) => {
      const corner = {
        x: tip.x - d.x * MARKER_LENGTH + perp.x * MARKER_HALF * sign,
        y: tip.y - d.y * MARKER_LENGTH + perp.y * MARKER_HALF * sign,
      };
      return !insideBox(corner, box);
    });
  };
  for (let t = 0; t <= 1.0001; t += 0.1) {
    const d = unit({
      x: (1 - t) * incoming.x - t * normalOut.x,
      y: (1 - t) * incoming.y - t * normalOut.y,
    });
    if (clears(d)) {
      if (t > 0) {
        points[points.length - 2] = { x: tip.x - d.x * 10, y: tip.y - d.y * 10 };
      }
      return;
    }
  }
};

/** Curl a path's marker-bearing ends clear of the boxes they meet. */
const curlEndsClear = (
  points: Point[],
  startBox: BoxAt,
  endBox: BoxAt,
  e: LayoutEdgeInput
): Point[] => {
  if (e.endMarker !== false) {
    curlMarkerClear(points, endBox);
  }
  if (e.startMarker === true) {
    points.reverse();
    curlMarkerClear(points, startBox);
    points.reverse();
  }
  return points;
};

export const circularLayout = (
  nodes: LayoutNodeInput[],
  edges: LayoutEdgeInput[],
  options: CircularLayoutOptions = {}
): CircularLayoutResult => {
  // An option that is present but undefined must not clobber its
  // default — mermaid's config often supplies exactly that shape.
  const given = Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined)
  ) as CircularLayoutOptions;
  const { spacing, startAngle, ordering, bow, swerve, samples } = { ...defaults, ...given };

  if (nodes.length === 0) {
    return { nodes: [], edges: [], order: [], radius: 0 };
  }
  if (nodes.length === 1) {
    const only = nodes[0]!;
    const reach = footprint(only) + spacing;
    return {
      nodes: [{ id: only.id, x: 0, y: 0, angle: 0 }],
      edges: edges.map((e) => {
        if (e.start !== only.id || e.end !== only.id) {
          return { ...e, points: [], onRim: false };
        }
        // A self-loop on a lone node: a petal reaching upward from
        // the top edge, the same gesture as on a ring.
        const t1 = { x: -reach * Math.sin(0.45), y: -reach * Math.cos(0.45) };
        const t2 = { x: reach * Math.sin(0.45), y: -reach * Math.cos(0.45) };
        const p0 = { x: -only.width / 4, y: -only.height / 2 };
        const p3 = { x: only.width / 4, y: -only.height / 2 };
        const homeBox: BoxAt = { x: 0, y: 0, width: only.width, height: only.height };
        return {
          ...e,
          points: curlEndsClear(cubic(p0, t1, t2, p3, samples), homeBox, homeBox, e),
          onRim: false,
        };
      }),
      order: [only.id],
      radius: 0,
    };
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));

  // The ring is the graph's 2-core; trees hang off it as spurs. A
  // ring thinner than three nodes means the graph is mostly trees,
  // and everything stays on the ring as before.
  let { rim, childrenOf } = peel(nodes, edges);
  if (rim.size < 3) {
    rim = new Set(nodes.map((n) => n.id));
    childrenOf = new Map();
  }
  const rimNodes = nodes.filter((n) => rim.has(n.id));
  const rimEdges = edges.filter((e) => rim.has(e.start) && rim.has(e.end));

  const order =
    ordering === 'input' ? rimNodes.map((n) => n.id) : followEdges(rimNodes, rimEdges);
  const nRim = order.length;

  // What a rim node claims of the circle: its own tangential extent,
  // or half the width of the spur forest hanging off it, whichever
  // is wider. Tree widths stack children side by side.
  const treeWidth = (id: string, angle: number): number => {
    const kids = childrenOf.get(id) ?? [];
    const own = tangentialExtent(byId.get(id)!, angle) * 2;
    if (kids.length === 0) {
      return own;
    }
    const kidsWidth =
      kids.reduce((sum, kid) => sum + treeWidth(kid, angle), 0) + (kids.length - 1) * spacing;
    return Math.max(own, kidsWidth);
  };
  // A labeled edge between rim neighbors needs its gap to hold the
  // label; the widest such label sets the uniform gap for the whole
  // ring, so the arrows stay equal AND inhabited.
  const rimIndex = new Map(order.map((id, i) => [id, i]));
  let labeledGapNeed = 0;
  for (const e of edges) {
    const pi = rimIndex.get(e.start);
    const pj = rimIndex.get(e.end);
    if (pi === undefined || pj === undefined || !e.labelWidth) {
      continue;
    }
    const stepGap = Math.abs(pi - pj);
    if (Math.min(stepGap, nRim - stepGap) === 1 || nRim === 2) {
      // The renderer demands 32px of breathing room around a label,
      // and the gap is arc length while the collision check measures
      // straight-line distance, so the widening carries extra slack
      // for the curvature. Without it the label misses inline
      // placement by a hair and slides outside anyway.
      labeledGapNeed = Math.max(labeledGapNeed, e.labelWidth + 48);
    }
  }
  const targetGap = Math.max(spacing, labeledGapNeed);

  // Solve angles so the free arc between neighboring borders is the
  // same everywhere — the eye judges the arrows, not the angles.
  // Each box's claim on the circle is measured exactly, as the arc
  // between the true rim crossings of its border (an estimate from
  // the tangent line ran 10–25% off for oblique boxes, and the
  // errors showed as visibly unequal arrows). Claims depend on the
  // angles and the angles on the claims, so iterate; then mirror the
  // side pairs so the ring stays symmetric, with the first node
  // pinned to the top. The radius follows from the same equation
  // (2πR = n·gap + Σclaims) and rises if any two boxes anywhere on
  // the ring would come too close. Small rings keep a floor of 1.6
  // footprints so the crossings exist at all.
  let radius = 1.6 * Math.max(...rimNodes.map(footprint));
  const angles: number[] = order.map((_, i) => startAngle + (i * TAU) / nRim);
  // A box's claim is its silhouette: the angular extent its corners
  // subtend from the center of the ring. Rim crossings understate it
  // — an arc can exit through a bottom edge and then travel hidden
  // beneath the box on its way to the corner, and that hidden stretch
  // is invisible to the eye. What the eye reads as "the arrow" is the
  // open air between silhouettes, so that is what gets equalized.
  const claimOf = (id: string, angle: number, r: number): { back: number; fwd: number } => {
    const node = byId.get(id)!;
    const center = onCircle(r, angle);
    let lo = 0;
    let hi = 0;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const corner = {
          x: center.x + (sx * node.width) / 2,
          y: center.y + (sy * node.height) / 2,
        };
        let offset = Math.atan2(corner.y, corner.x) - angle;
        offset = ((((offset + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
        lo = Math.min(lo, offset);
        hi = Math.max(hi, offset);
      }
    }
    const fwd = hi * r;
    const back = -lo * r;
    const kids = childrenOf.get(id) ?? [];
    if (kids.length === 0) {
      return { back, fwd };
    }
    const kidsWidth =
      kids.reduce((sum, kid) => sum + treeWidth(kid, angle), 0) + (kids.length - 1) * spacing;
    return { back: Math.max(back, kidsWidth / 2), fwd: Math.max(fwd, kidsWidth / 2) };
  };
  for (let round = 0; round < 300; round++) {
    const claims = order.map((id, i) => claimOf(id, angles[i]!, radius));
    const claimSum = claims.reduce((sum, c) => sum + c.back + c.fwd, 0);
    const nextRadius = Math.max((nRim * targetGap + claimSum) / TAU, radius);
    const gap = (TAU * nextRadius - claimSum) / nRim;
    // Lay the ring sequentially, then symmetrize mirror pairs
    // (i and n−i reflect across the vertical axis: θ ↦ π − θ).
    const next: number[] = [startAngle];
    for (let i = 1; i < nRim; i++) {
      next.push(next[i - 1]! + (claims[i - 1]!.fwd + gap + claims[i]!.back) / nextRadius);
    }
    for (let i = 1; i * 2 < nRim; i++) {
      const mirrored = (next[i]! + (Math.PI - next[nRim - i]!)) / 2;
      next[i] = mirrored;
      next[nRim - i] = Math.PI - mirrored;
    }
    if (nRim % 2 === 0) {
      next[nRim / 2] = Math.PI / 2;
    }
    // Damped update: a claim jumps steeply where the rim crossing
    // moves from a box's side to its top or bottom edge, and an
    // undamped relaxation bounces across that cliff instead of
    // settling.
    let maxDelta = 0;
    for (let i = 0; i < nRim; i++) {
      const blended = (angles[i]! + next[i]!) / 2;
      maxDelta = Math.max(maxDelta, Math.abs(blended - angles[i]!));
      angles[i] = blended;
    }
    radius = nextRadius;

    // No two rim boxes may come closer than their supports allow —
    // this is what the radius floor is for. Scale up and re-solve.
    let scale = 1;
    for (let i = 0; i < nRim; i++) {
      for (let j = i + 1; j < nRim; j++) {
        const pi = onCircle(radius, angles[i]!);
        const pj = onCircle(radius, angles[j]!);
        const between = Math.hypot(pj.x - pi.x, pj.y - pi.y);
        const dir = unit({ x: pj.x - pi.x, y: pj.y - pi.y });
        const stepGap = Math.min(j - i, nRim - (j - i));
        const margin = stepGap === 1 ? 2 : spacing / 2;
        const need =
          supportExtent(byId.get(order[i]!)!, dir) +
          supportExtent(byId.get(order[j]!)!, dir) +
          margin;
        if (between < need) {
          scale = Math.max(scale, need / Math.max(between, 1));
        }
      }
    }
    if (scale > 1.001) {
      radius *= scale;
      continue;
    }
    // Converged only when the angles have actually stopped moving —
    // breaking as soon as collisions settle left the fixed point
    // half-reached and the gaps visibly unequal.
    if (round > 4 && maxDelta < 1e-4) {
      break;
    }
  }

  const angleOf = new Map(order.map((id, i) => [id, angles[i]!]));
  const posOf = new Map<string, Point>();
  for (const id of order) {
    posOf.set(id, onCircle(radius, angleOf.get(id)!));
  }

  // Hang each spur tree radially outward from its attachment,
  // children fanned side by side across the parent's angle.
  const placeChildren = (parentId: string, parentAngle: number, parentOuterRadius: number) => {
    const kids = childrenOf.get(parentId) ?? [];
    if (kids.length === 0) {
      return;
    }
    const widths = kids.map((kid) => treeWidth(kid, parentAngle));
    const total = widths.reduce((a, b) => a + b, 0) + (kids.length - 1) * spacing;
    let cursor = -total / 2;
    for (const [i, kid] of kids.entries()) {
      const node = byId.get(kid)!;
      const centerOffset = cursor + widths[i]! / 2;
      cursor += widths[i]! + spacing;
      const kidRadius =
        parentOuterRadius + spacing * 0.8 + radialExtent(node, parentAngle);
      const kidAngle = parentAngle + centerOffset / kidRadius;
      posOf.set(kid, onCircle(kidRadius, kidAngle));
      placeChildren(kid, kidAngle, kidRadius + radialExtent(node, kidAngle));
    }
  };
  for (const id of order) {
    const angle = angleOf.get(id)!;
    placeChildren(id, angle, radius + radialExtent(byId.get(id)!, angle));
  }

  const placed: PlacedNode[] = nodes.map((node) => {
    const pos = posOf.get(node.id) ?? { x: 0, y: 0 };
    return { id: node.id, ...pos, angle: Math.atan2(pos.y, pos.x) };
  });

  const boxAt = (id: string): BoxAt => {
    const node = byId.get(id)!;
    const pos = posOf.get(id)!;
    return { ...pos, width: node.width, height: node.height };
  };

  const position = new Map(order.map((id, i) => [id, i]));

  // Edges sharing a pair of ends must separate, or two arrows draw
  // as one line. Rim pairs split radially; chord pairs split by bow
  // depth; spur pairs bow apart sideways. At two rim nodes the key is
  // the directed pair, because the diameter tie already mirrors
  // opposite directions onto opposite sides.
  const pairIndex = new Map<string, number>();
  const pairCount = new Map<string, number>();
  const pairKeyOf = (e: LayoutEdgeInput) =>
    nRim === 2 ? `${e.start}>${e.end}` : [e.start, e.end].sort().join(' ');
  for (const e of edges) {
    pairCount.set(pairKeyOf(e), (pairCount.get(pairKeyOf(e)) ?? 0) + 1);
  }

  const routed: RoutedEdge[] = edges.map((e) => {
    const pStart = posOf.get(e.start);
    const pEnd = posOf.get(e.end);
    if (!pStart || !pEnd) {
      return { ...e, points: [], onRim: false };
    }

    if (e.start === e.end) {
      // A petal reaching outward from wherever the node sits — its
      // own radius and angle, whether on the rim or up a spur.
      const home = boxAt(e.start);
      const homeRadius = Math.hypot(pStart.x, pStart.y);
      const homeAngle = Math.atan2(pStart.y, pStart.x);
      const reach = footprint(byId.get(e.start)!) + spacing;
      const t1 = onCircle(homeRadius + reach, homeAngle - 0.45);
      const t2 = onCircle(homeRadius + reach, homeAngle + 0.45);
      const outwardSide = sideAnchor(home, {
        x: pStart.x * 2 || Math.cos(homeAngle),
        y: pStart.y * 2 || Math.sin(homeAngle),
      });
      const alongX = outwardSide.y === home.y ? 0 : 1;
      const flank = (sign: number): Point =>
        alongX === 0
          ? { x: outwardSide.x, y: home.y + (sign * home.height) / 4 }
          : { x: home.x + (sign * home.width) / 4, y: outwardSide.y };
      return {
        ...e,
        points: curlEndsClear(cubic(flank(-1), t1, t2, flank(1), samples), home, home, e),
        onRim: false,
      };
    }

    const key = pairKeyOf(e);
    const siblings = pairCount.get(key)!;
    const index = pairIndex.get(key) ?? 0;
    pairIndex.set(key, index + 1);
    const spread = siblings === 1 ? 0 : index - (siblings - 1) / 2;

    const bothOnRim = position.has(e.start) && position.has(e.end);

    if (!bothOnRim) {
      // A spur edge: essentially radial, drawn straight from border
      // to border. Siblings bow apart sideways.
      const from = rayAnchor(boxAt(e.start), pEnd);
      const to = rayAnchor(boxAt(e.end), pStart);
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      const across = unit({ x: to.y - from.y, y: -(to.x - from.x) });
      const control = { x: mid.x + across.x * spread * 18, y: mid.y + across.y * spread * 18 };
      return {
        ...e,
        points: curlEndsClear(quadratic(from, control, to, samples), boxAt(e.start), boxAt(e.end), e),
        onRim: false,
      };
    }

    const a = angleOf.get(e.start)!;
    const b = angleOf.get(e.end)!;
    const gap = Math.abs(position.get(e.start)! - position.get(e.end)!);
    const neighbors = Math.min(gap, nRim - gap) === 1 || nRim === 2;

    if (neighbors) {
      // One circle, drawn honestly: the edge is a true arc of the
      // rim, from the exact angle where the circle leaves the source
      // box's border to the exact angle where it enters the target's.
      // A sibling pair (opposite or parallel arrows) rides concentric
      // arcs — the offset clamped so the offset circle still passes
      // through both boxes.
      const boxA = boxAt(e.start);
      const boxB = boxAt(e.end);
      const maxOffset =
        0.6 * Math.min(boxA.width / 2, boxA.height / 2, boxB.width / 2, boxB.height / 2);
      // Scale the whole fan uniformly rather than clamping each
      // offset: clamping saturates, and saturated siblings coincide.
      const widestSpread = ((siblings - 1) / 2) * 24;
      const fanScale = widestSpread > maxOffset ? maxOffset / widestSpread : 1;
      const offset = spread * 24 * fanScale;
      const arcRadius = radius + offset;
      const delta = shortWay(a, b);
      const midAngle = a + delta / 2;
      // The target's angle expressed continuously from `a` — walking
      // back from its stored angle can sit across the ±π wrap and
      // send the arc the long way round the circle.
      const bUnwrapped = a + delta;
      const exit = rimCrossing(arcRadius, boxA, a, midAngle);
      const entry = rimCrossing(arcRadius, boxB, bUnwrapped, midAngle);

      // The marker's line of symmetry is the direction of the path's
      // final segment, and mermaid displaces any point within ~5px of
      // an end. Both ends therefore get a straight 10px tail laid
      // exactly along the rim's tangent at the crossing — the
      // arrowhead's axis IS the trajectory, by construction — and the
      // interior is sampled sparsely (~13px segments; the sagitta of
      // a 13px chord on these radii is a fraction of a pixel).
      const sweep = entry - exit;
      const arcLength = Math.abs(sweep) * arcRadius;
      const tail = Math.min(10, arcLength / 3);
      const tangentAt = (angle: number, sign: number): Point => ({
        x: -Math.sin(angle) * sign,
        y: Math.cos(angle) * sign,
      });
      const sign = Math.sign(sweep) || 1;
      const startPt = onCircle(arcRadius, exit);
      const endPt = onCircle(arcRadius, entry);
      const startTangent = tangentAt(exit, sign);
      const endTangent = tangentAt(entry, sign);
      const tailAngle = tail / arcRadius;
      const innerFrom = exit + sign * tailAngle;
      const innerTo = entry - sign * tailAngle;
      const innerSamples = Math.max(2, Math.min(samples, Math.round(arcLength / 13)));
      const points: Point[] = [
        startPt,
        { x: startPt.x + startTangent.x * tail, y: startPt.y + startTangent.y * tail },
      ];
      if ((innerTo - innerFrom) * sign > 0) {
        for (let i = 0; i <= innerSamples; i++) {
          points.push(onCircle(arcRadius, innerFrom + ((innerTo - innerFrom) * i) / innerSamples));
        }
      }
      points.push(
        { x: endPt.x - endTangent.x * tail, y: endPt.y - endTangent.y * tail },
        endPt
      );
      return { ...e, points: curlEndsClear(points, boxA, boxB, e), onRim: true };
    }

    // A chord: bowed toward the center, swerved left of travel by how
    // near it passes the center, so diameters braid around the hub
    // and opposite directions separate on their own.
    const pa = onCircle(radius, a);
    const pb = onCircle(radius, b);
    const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
    const chordLength = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    const centrality = 1 - Math.min(1, Math.hypot(mid.x, mid.y) / radius);
    const left =
      chordLength === 0
        ? { x: 0, y: 0 }
        : { x: (pb.y - pa.y) / chordLength, y: -(pb.x - pa.x) / chordLength };
    const slide = swerve * radius * centrality;
    const control = {
      x: mid.x * (1 - (bow + spread * 0.15)) + left.x * slide,
      y: mid.y * (1 - (bow + spread * 0.15)) + left.y * slide,
    };
    const from = rayAnchor(boxAt(e.start), control);
    const to = rayAnchor(boxAt(e.end), control);
    return {
      ...e,
      points: curlEndsClear(quadratic(from, control, to, samples), boxAt(e.start), boxAt(e.end), e),
      onRim: false,
    };
  });

  return { nodes: placed, edges: routed, order, radius };
};
