/**
 * The placement math, pure and DOM-free.
 *
 * Nodes go on one circle; the radius is solved from what the nodes
 * demand, not guessed. Every adjacent pair (i, i+1) around the rim
 * needs a chord of at least d_i between their centers — half of each
 * footprint plus the configured spacing. On a circle of radius R that
 * chord subtends 2·asin(d_i / 2R), which shrinks as R grows, so the
 * smallest circle where everything fits is the R where the subtended
 * angles sum to exactly 2π. That equation has no closed form; bisection
 * finds it. A pleasant consequence: each node's angular slice is
 * proportional to what it needs, so one wide node widens its own gap
 * without inflating everyone else's.
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

/**
 * Solve for the radius where the required chords exactly close the
 * circle: Σ 2·asin(d_i / 2R) = 2π, monotone in R, by bisection.
 */
const solveRadius = (chords: number[]): number => {
  const angleSum = (r: number) =>
    chords.reduce((sum, d) => sum + 2 * Math.asin(Math.min(1, d / (2 * r))), 0);

  // Below lo an asin argument clips at 1 (nodes would collide);
  // hi starts at the perimeter-derived upper bound.
  let lo = Math.max(...chords) / 2;
  let hi = Math.max(lo * 2, chords.reduce((a, b) => a + b, 0) / TAU) * 2;
  while (angleSum(hi) > TAU) {
    hi *= 2;
  }
  if (angleSum(lo) <= TAU) {
    return lo;
  }
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (angleSum(mid) > TAU) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return hi;
};

const onCircle = (radius: number, angle: number): Point => ({
  x: radius * Math.cos(angle),
  y: radius * Math.sin(angle),
});

/**
 * Sample an arc on the rim from angle a to angle b, the short way.
 * A diameter has no short way; the tie always resolves clockwise,
 * which mirrors a two-node pair into a lens by itself — the two
 * directions start from opposite nodes, so one clockwise half is the
 * right rim and the other is the left.
 */
const rimArc = (radius: number, a: number, b: number, samples: number): Point[] => {
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
  const points: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    points.push(onCircle(radius, a + (delta * i) / samples));
  }
  return points;
};

interface BoxAt extends Point {
  width: number;
  height: number;
}

const insideBox = (p: Point, b: BoxAt) =>
  Math.abs(p.x - b.x) < b.width / 2 && Math.abs(p.y - b.y) < b.height / 2;

/**
 * Drop interior samples that fall inside either endpoint's box.
 * mermaid's insertEdge discards the first and last point (the node
 * centers) and asks each node shape to intersect the line toward the
 * next point — which only lands on the true boundary if that next
 * point is already outside the shape.
 */
const clipToBoxes = (points: Point[], start: BoxAt, end: BoxAt): Point[] => {
  const interior = points.slice(1, -1).filter((p) => !insideBox(p, start) && !insideBox(p, end));
  if (interior.length === 0) {
    const mid = points[Math.floor(points.length / 2)]!;
    interior.push(mid);
  }
  return [points[0]!, ...interior, points[points.length - 1]!];
};

/**
 * A chord bowed toward the center: a quadratic Bézier whose control
 * point is the chord midpoint pulled `bow` of the way to the origin.
 * At bow 0 the samples lie on the straight chord.
 *
 * Pulling toward the center cannot move a diameter — its midpoint is
 * the center — so every diameter of a wheel stabs through one point.
 * The swerve slides the control sideways (left of travel), scaled by
 * how close the chord passes to the center: diameters braid around
 * the hub, short chords stay put, and the two directions of an
 * opposite pair swerve to opposite sides on their own.
 */
const bowedChord = (
  a: Point,
  b: Point,
  bow: number,
  swerve: number,
  radius: number,
  samples: number
): Point[] => {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const chordLength = Math.hypot(b.x - a.x, b.y - a.y);
  const centrality = radius === 0 ? 0 : 1 - Math.min(1, Math.hypot(mid.x, mid.y) / radius);
  const left =
    chordLength === 0
      ? { x: 0, y: 0 }
      : { x: (b.y - a.y) / chordLength, y: -(b.x - a.x) / chordLength };
  const slide = swerve * radius * centrality;
  const control = {
    x: mid.x * (1 - bow) + left.x * slide,
    y: mid.y * (1 - bow) + left.y * slide,
  };
  const points: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    points.push({
      x: u * u * a.x + 2 * u * t * control.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * control.y + t * t * b.y,
    });
  }
  return points;
};

/**
 * A self-loop: a petal reaching outward from the node, drawn as a
 * cubic Bézier that leaves and returns to the node's center with its
 * controls flanking the node's angle beyond the rim.
 */
const petal = (radius: number, angle: number, reach: number, samples: number): Point[] => {
  const spread = 0.55;
  const anchor = onCircle(radius, angle);
  const c1 = onCircle(radius + reach, angle - spread);
  const c2 = onCircle(radius + reach, angle + spread);
  const points: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    points.push({
      x: u * u * u * anchor.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * anchor.x,
      y: u * u * u * anchor.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * anchor.y,
    });
  }
  return points;
};

/**
 * Nudge a path sideways-of-radius so parallel and opposite edges of
 * the same pair separate. The nudge tapers with sin(πt): zero at both
 * endpoints (they must stay on the node centers for boundary
 * trimming), full at the middle.
 */
const fanOut = (points: Point[], offset: number): Point[] =>
  points.map((p, i) => {
    const t = i / (points.length - 1);
    const r = Math.hypot(p.x, p.y);
    if (r === 0 || offset === 0) {
      return p;
    }
    const scale = (r + offset * Math.sin(Math.PI * t)) / r;
    return { x: p.x * scale, y: p.y * scale };
  });

export const circularLayout = (
  nodes: LayoutNodeInput[],
  edges: LayoutEdgeInput[],
  options: CircularLayoutOptions = {}
): CircularLayoutResult => {
  const { spacing, startAngle, ordering, bow, swerve, samples } = { ...defaults, ...options };

  if (nodes.length === 0) {
    return { nodes: [], edges: [], order: [], radius: 0 };
  }
  if (nodes.length === 1) {
    const only = nodes[0]!;
    return {
      nodes: [{ id: only.id, x: 0, y: 0, angle: 0 }],
      edges: edges.map((e) => ({ ...e, points: [], onRim: false })),
      order: [only.id],
      radius: 0,
    };
  }

  const order = ordering === 'input' ? nodes.map((n) => n.id) : followEdges(nodes, edges);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Chord i is the demand between rim neighbors order[i] and order[i+1].
  const chords = order.map((id, i) => {
    const next = order[(i + 1) % order.length]!;
    return footprint(byId.get(id)!) + footprint(byId.get(next)!) + spacing;
  });
  const radius = solveRadius(chords);

  // Lay the demanded angles around the rim; distribute any slack (the
  // radius never dips below the largest single chord's need, which can
  // leave the sum short of 2π) evenly so the circle still closes.
  const angles = chords.map((d) => 2 * Math.asin(Math.min(1, d / (2 * radius))));
  const slack = (TAU - angles.reduce((a, b) => a + b, 0)) / order.length;

  const angleOf = new Map<string, number>();
  let angle = startAngle;
  for (const [i, id] of order.entries()) {
    angleOf.set(id, angle);
    angle += angles[i]! + slack;
  }

  const placed: PlacedNode[] = nodes.map((n) => {
    const a = angleOf.get(n.id)!;
    return { id: n.id, ...onCircle(radius, a), angle: a };
  });

  const position = new Map(order.map((id, i) => [id, i]));

  // Edges sharing an unordered pair of ends fan out with distinct
  // radial offsets, or two opposite arrows would draw as one line.
  const pairIndex = new Map<string, number>();
  const pairCount = new Map<string, number>();
  const pairKeyOf = (e: LayoutEdgeInput) => [e.start, e.end].sort().join(' ');
  for (const e of edges) {
    const key = pairKeyOf(e);
    pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
  }

  const boxOf = (id: string): BoxAt => {
    const n = byId.get(id)!;
    return { ...onCircle(radius, angleOf.get(id)!), width: n.width, height: n.height };
  };

  const routed: RoutedEdge[] = edges.map((e) => {
    const a = angleOf.get(e.start);
    const b = angleOf.get(e.end);
    if (a === undefined || b === undefined) {
      return { ...e, points: [], onRim: false };
    }
    if (e.start === e.end) {
      const reach = footprint(byId.get(e.start)!) * 2 + spacing;
      const looped = petal(radius, a, reach, samples);
      return { ...e, points: clipToBoxes(looped, boxOf(e.start), boxOf(e.end)), onRim: false };
    }
    const key = pairKeyOf(e);
    const siblings = pairCount.get(key)!;
    const index = pairIndex.get(key) ?? 0;
    pairIndex.set(key, index + 1);
    const spread = siblings === 1 ? 0 : index - (siblings - 1) / 2;

    const gap = Math.abs(position.get(e.start)! - position.get(e.end)!);
    const neighbors = Math.min(gap, order.length - gap) === 1 || order.length === 2;
    if (neighbors) {
      // Rim points all sit near radius R, where a radial nudge is
      // stable; chord points can pass the origin, where it is not.
      const points = fanOut(rimArc(radius, a, b, samples), spread * 24);
      return { ...e, points: clipToBoxes(points, boxOf(e.start), boxOf(e.end)), onRim: true };
    }
    // Chord siblings separate by bow depth; opposite directions
    // already separate by the swerve's left-of-travel.
    const points = bowedChord(
      onCircle(radius, a),
      onCircle(radius, b),
      bow + spread * 0.15,
      swerve,
      radius,
      samples
    );
    return { ...e, points: clipToBoxes(points, boxOf(e.start), boxOf(e.end)), onRim: false };
  });

  return { nodes: placed, edges: routed, order, radius };
};
