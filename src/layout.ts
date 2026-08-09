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
 * Edges are drawn the way a hand draws them: leave the border of the
 * source through the point facing the gap, arc through the middle of
 * the gap on the rim, land flush on the border of the target. Paths
 * start and end exactly on borders — mermaid is told to skip its own
 * boundary trimming — which is what keeps every arrowhead seated on
 * the box edge it points into.
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

/** A quadratic Bézier sampled evenly, endpoints included. */
const quadratic = (p0: Point, c: Point, p3: Point, samples: number): Point[] => {
  const points: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    points.push({
      x: u * u * p0.x + 2 * u * t * c.x + t * t * p3.x,
      y: u * u * p0.y + 2 * u * t * c.y + t * t * p3.y,
    });
  }
  return points;
};

/** A cubic Bézier sampled evenly, endpoints included. */
const cubic = (p0: Point, c1: Point, c2: Point, p3: Point, samples: number): Point[] => {
  const points: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    points.push({
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
    });
  }
  return points;
};

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
  const n = order.length;
  const step = TAU / n;

  // Equal angles; the radius covers the worst pair at every gap:
  // positions g steps apart span a chord of 2R·sin(gπ/n).
  let radius = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const gap = Math.min(j - i, n - (j - i));
      const need = footprint(byId.get(order[i]!)!) + footprint(byId.get(order[j]!)!) + spacing;
      radius = Math.max(radius, need / (2 * Math.sin((gap * Math.PI) / n)));
    }
  }

  const angleOf = new Map(order.map((id, i) => [id, startAngle + i * step]));
  const placed: PlacedNode[] = nodes.map((node) => {
    const a = angleOf.get(node.id)!;
    return { id: node.id, ...onCircle(radius, a), angle: a };
  });

  const boxOf = (id: string): BoxAt => {
    const node = byId.get(id)!;
    return { ...onCircle(radius, angleOf.get(id)!), width: node.width, height: node.height };
  };

  const position = new Map(order.map((id, i) => [id, i]));

  // Edges sharing an unordered pair of ends must separate, or two
  // opposite arrows draw as one line. Rim pairs split radially at the
  // gap's midpoint; chord pairs split by bow depth.
  const pairIndex = new Map<string, number>();
  const pairCount = new Map<string, number>();
  const pairKeyOf = (e: LayoutEdgeInput) => [e.start, e.end].sort().join(' ');
  for (const e of edges) {
    pairCount.set(pairKeyOf(e), (pairCount.get(pairKeyOf(e)) ?? 0) + 1);
  }

  const routed: RoutedEdge[] = edges.map((e) => {
    const a = angleOf.get(e.start);
    const b = angleOf.get(e.end);
    if (a === undefined || b === undefined) {
      return { ...e, points: [], onRim: false };
    }

    if (e.start === e.end) {
      // A petal reaching outward: it springs from the outward-facing
      // side, from two points either side of that side's middle.
      const home = boxOf(e.start);
      const reach = footprint(byId.get(e.start)!) + spacing;
      const t1 = onCircle(radius + reach, a - 0.45);
      const t2 = onCircle(radius + reach, a + 0.45);
      const outwardSide = sideAnchor(home, onCircle(radius * 2, a));
      const alongX = outwardSide.y === home.y ? 0 : 1;
      const flank = (sign: number): Point =>
        alongX === 0
          ? { x: outwardSide.x, y: home.y + (sign * home.height) / 4 }
          : { x: home.x + (sign * home.width) / 4, y: outwardSide.y };
      return { ...e, points: cubic(flank(-1), t1, t2, flank(1), samples), onRim: false };
    }

    const key = pairKeyOf(e);
    const siblings = pairCount.get(key)!;
    const index = pairIndex.get(key) ?? 0;
    pairIndex.set(key, index + 1);
    const spread = siblings === 1 ? 0 : index - (siblings - 1) / 2;

    const gap = Math.abs(position.get(e.start)! - position.get(e.end)!);
    const neighbors = Math.min(gap, n - gap) === 1 || n === 2;

    if (neighbors) {
      // Through the middle of the gap: leave the border where the ray
      // toward the gap crosses it, pass the gap's midpoint, land
      // flush on the neighbor's border. The midpoint's radius is
      // pulled to the anchors' own radius — a rim-height waypoint
      // between two low anchors would sag past the ring's band (two
      // boxes side by side at the bottom of the ring taught this).
      const midAngle = a + shortWay(a, b) / 2;
      const guide = onCircle(radius, midAngle);
      const from = rayAnchor(boxOf(e.start), guide);
      const to = rayAnchor(boxOf(e.end), guide);
      const band = (Math.hypot(from.x, from.y) + Math.hypot(to.x, to.y)) / 2;
      const mid = onCircle(band + spread * 24, midAngle);
      const control = { x: 2 * mid.x - (from.x + to.x) / 2, y: 2 * mid.y - (from.y + to.y) / 2 };
      return { ...e, points: quadratic(from, control, to, samples), onRim: true };
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
    const from = rayAnchor(boxOf(e.start), control);
    const to = rayAnchor(boxOf(e.end), control);
    return { ...e, points: quadratic(from, control, to, samples), onRim: false };
  });

  return { nodes: placed, edges: routed, order, radius };
};
