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
 * A neighbor edge is a true arc of that same circle, so the eye reads
 * one ring, not n separate curves. Every path is sampled center to
 * center, then trimmed to the exact silhouette crossings — bisected
 * on the curve itself, shape-aware — with straight ≥10px terminal
 * segments outside mermaid's marker-meddling window, so each
 * arrowhead sits flush on the outline it points into, rotated along
 * the curve's own trajectory. Mermaid is told to skip its own
 * boundary trimming, which cuts toward interior samples and would
 * bury what the layout just seated.
 */

export interface LayoutNodeInput {
  id: string;
  width: number;
  height: number;
  /** Geometric family of the node's rendered silhouette. Spacing and
   *  border crossings measure the true outline: an ellipse claims
   *  less of the ring than its bounding box and a circle claims the
   *  same amount from every seat; a diamond is its rhombus, a stadium
   *  its capsule. Shapes without a closer family default to 'box',
   *  which over-reserves and never overlaps. */
  shape?: 'box' | 'ellipse' | 'diamond' | 'stadium';
  /** Subgraph membership. Members of one group are seated side by
   *  side on their ring, so a box drawn around them wraps one arc. */
  group?: string;
}

export interface LayoutEdgeInput {
  id: string;
  start: string;
  end: string;
  /** Measured width of the edge's label, when it has one. A labeled
   *  gap — on the rim or along a spur — widens so the label can live
   *  inside it. */
  labelWidth?: number;
  /** Measured height of the edge's label. A radial gap cares about
   *  the label's projection onto the spur direction, which needs
   *  both dimensions. */
  labelHeight?: number;
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
  /** Which way the walk travels from the top node. Default
   *  'clockwise'; 'counterclockwise' mirrors the whole layout across
   *  the vertical axis, so every guarantee carries over unchanged. */
  direction?: 'clockwise' | 'counterclockwise';
  /** Hub-and-spoke. 'auto' (the default) pulls a node into the center
   *  only when the shape is unmistakable — a star's center or a
   *  wheel's axle — and rings everything else around it. 'none' keeps
   *  every node on the ring; a node id names the hub explicitly. */
  hub?: 'auto' | 'none' | (string & {});
}

export interface SatelliteRing {
  /** The main-ring node the satellite hangs from or passes through. */
  anchor: string;
  /** The satellite's own rim, in walk order. */
  members: string[];
  /** Center of the satellite circle, in final coordinates. */
  center: Point;
  radius: number;
}

export interface CircularLayoutResult {
  nodes: PlacedNode[];
  edges: RoutedEdge[];
  order: string[];
  radius: number;
  /** The node placed at the center, when the layout found one. */
  hub?: string;
  /** Cycles hanging off the main ring, each drawn as its own circle. */
  satellites?: SatelliteRing[];
}

const TAU = 2 * Math.PI;

const defaults = {
  spacing: 40,
  startAngle: -Math.PI / 2,
  ordering: 'follow-edges' as const,
  bow: 0.35,
  swerve: 0.2,
  samples: 24,
  direction: 'clockwise' as const,
  hub: 'auto' as const,
};

/**
 * Counter-clockwise is clockwise seen in a mirror. The solver always
 * works clockwise — its sequential ring laying, mirror-pair
 * symmetrization and arc sweeps all assume it — and the finished
 * geometry is reflected across the vertical axis, which the ring is
 * already symmetric about. Reflection preserves every distance, so no
 * spacing or collision guarantee needs re-proving. `|| 0` keeps -0
 * from flipping atan2 to π on axis-bound points.
 */
const mirrored = (result: CircularLayoutResult): CircularLayoutResult => {
  for (const node of result.nodes) {
    node.x = -node.x || 0;
    node.angle = Math.atan2(node.y, node.x);
  }
  for (const edge of result.edges) {
    for (const point of edge.points) {
      point.x = -point.x || 0;
    }
  }
  for (const satellite of result.satellites ?? []) {
    satellite.center.x = -satellite.center.x || 0;
  }
  return result;
};

/**
 * Half-extent of a node's silhouette along a unit direction — the
 * support function of its shape, the one geometric fact every spacing
 * rule needs. A box resists |dx|·w/2 + |dy|·h/2; an ellipse
 * √((dx·w/2)² + (dy·h/2)²), which for a circle is w/2 whatever the
 * direction — a circle claims the same amount from every angle. A
 * diamond is the box's dual, max instead of sum; a stadium is a
 * segment thickened by a disc, so its supports add.
 */
const extent = (n: LayoutNodeInput, dir: Point): number => {
  switch (n.shape) {
    case 'ellipse':
      return Math.hypot(dir.x * n.width, dir.y * n.height) / 2;
    case 'diamond':
      return Math.max((Math.abs(dir.x) * n.width) / 2, (Math.abs(dir.y) * n.height) / 2);
    case 'stadium':
      return (Math.abs(dir.x) * Math.max(0, n.width - n.height)) / 2 + n.height / 2;
    default:
      return (Math.abs(dir.x) * n.width + Math.abs(dir.y) * n.height) / 2;
  }
};

/** The silhouette's largest half-extent over every direction: the
 *  safe radius of the node whatever its orientation. */
const footprint = (n: LayoutNodeInput) => {
  switch (n.shape) {
    case 'ellipse':
    case 'diamond':
      return Math.max(n.width, n.height) / 2;
    case 'stadium':
      return Math.max(n.width, n.height) / 2;
    default:
      return Math.hypot(n.width, n.height) / 2;
  }
};

/** Room a subgraph box's wall claims beyond its member's border. */
const GROUP_PAD = 16;

/**
 * Ring order with subgraphs seated together. Each group collapses to
 * one super-node, the walk runs on that quotient — authors write
 * groups as blocks the way they write cycles as runs — and each
 * group then expands in place, ordered by its own internal walk. The
 * expansion enters through the member that touches what came before,
 * reversing the internal run when that member sits at its far end,
 * so the written path keeps reading forward across the boundary.
 */
const orderRim = (rimNodes: LayoutNodeInput[], rimEdges: LayoutEdgeInput[]): string[] => {
  const groupOf = new Map(
    rimNodes.filter((n) => n.group !== undefined).map((n) => [n.id, n.group!])
  );
  if (groupOf.size === 0) {
    return followEdges(rimNodes, rimEdges);
  }
  const superOf = (id: string) => groupOf.get(id) ?? id;
  const superIds = [...new Set(rimNodes.map((n) => superOf(n.id)))];
  const superNodes = superIds.map((id) => ({ id, width: 0, height: 0 }));
  const superEdges: LayoutEdgeInput[] = [];
  for (const e of rimEdges) {
    if (superOf(e.start) !== superOf(e.end)) {
      superEdges.push({ id: e.id, start: superOf(e.start), end: superOf(e.end) });
    }
  }
  const coarse = followEdges(superNodes, superEdges);

  const membersOf = new Map<string, string[]>();
  for (const n of rimNodes) {
    const key = superOf(n.id);
    if (!membersOf.has(key)) {
      membersOf.set(key, []);
    }
    membersOf.get(key)!.push(n.id);
  }

  const out: string[] = [];
  for (const superId of coarse) {
    const members = membersOf.get(superId)!;
    if (members.length === 1) {
      out.push(members[0]!);
      continue;
    }
    const memberSet = new Set(members);
    const inner = followEdges(
      rimNodes.filter((n) => memberSet.has(n.id)),
      rimEdges.filter((e) => memberSet.has(e.start) && memberSet.has(e.end))
    );
    const prev = out[out.length - 1];
    let run = inner;
    if (prev !== undefined) {
      const touchesPrev = new Set<string>();
      for (const e of rimEdges) {
        if (e.start === prev) {
          touchesPrev.add(e.end);
        }
        if (e.end === prev) {
          touchesPrev.add(e.start);
        }
      }
      const forward = inner.findIndex((id) => touchesPrev.has(id));
      const reversed = [...inner].reverse();
      const backward = reversed.findIndex((id) => touchesPrev.has(id));
      if (forward !== 0 && backward === 0) {
        run = reversed;
      } else if (forward > 0 && (backward < 0 || forward <= backward)) {
        run = [...inner.slice(forward), ...inner.slice(0, forward)];
      } else if (backward > 0 && backward < forward) {
        run = [...reversed.slice(backward), ...reversed.slice(0, backward)];
      }
    }
    out.push(...run);
  }
  return out;
};

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
  shape?: LayoutNodeInput['shape'];
}

/** Whether a point lies strictly inside the node's silhouette,
 *  inflated by `pad` pixels of margin on every side. */
const insideNode = (p: Point, b: BoxAt, pad = 0): boolean => {
  const dx = Math.abs(p.x - b.x);
  const dy = Math.abs(p.y - b.y);
  const hw = b.width / 2 + pad;
  const hh = b.height / 2 + pad;
  switch (b.shape) {
    case 'ellipse':
      return (dx * dx) / (hw * hw) + (dy * dy) / (hh * hh) < 1;
    case 'diamond':
      return dx / hw + dy / hh < 1;
    case 'stadium': {
      // A capsule: a core segment thickened by half-height discs.
      const core = Math.max(0, b.width / 2 - b.height / 2);
      const r = b.height / 2 + pad;
      const reach = Math.max(0, dx - core);
      return reach * reach + dy * dy < r * r;
    }
    default:
      return dx < hw && dy < hh;
  }
};

/** The exact silhouette crossing on the segment from an inside point
 *  to an outside point, by bisection — one routine for every convex
 *  shape the silhouette test knows. */
const borderCrossing = (insidePt: Point, outsidePt: Point, b: BoxAt): Point => {
  let lo = insidePt;
  let hi = outsidePt;
  for (let i = 0; i < 24; i++) {
    const mid = { x: (lo.x + hi.x) / 2, y: (lo.y + hi.y) / 2 };
    if (insideNode(mid, b)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return hi;
};

/** How far a path end must stay clean: mermaid's marker machinery
 *  displaces points within ~5px of an end, so the terminal segment
 *  must outreach that window or the arrowhead rotates along a kink. */
const TAIL = 10;

/**
 * Trim a sampled curve to the true silhouettes: the path begins and
 * ends exactly on the rendered outline — the crossing bisected on the
 * curve itself, shape-aware — and the samples adjacent to each end
 * keep a straight ≥10px terminal segment laid along the curve, out of
 * reach of mermaid's end-of-path marker meddling. The curve is
 * sampled from center to center, so the crossing always exists and
 * the arrowhead's axis is the curve's own trajectory at the border.
 */
const throughBorders = (points: Point[], from: BoxAt, to: BoxAt): Point[] => {
  const interior = points.filter((p) => !insideNode(p, from, TAIL) && !insideNode(p, to, TAIL));
  if (interior.length === 0) {
    // Silhouettes so close the whole curve is swallowed: fall back to
    // the middle sample so the path still has a direction.
    interior.push(points[Math.floor(points.length / 2)]!);
  }
  // The crossings are bisected between consecutive samples — a few
  // pixels of bracket on the true curve — so the endpoint sits where
  // the curve itself pierces the silhouette.
  let start = points[0]!;
  if (insideNode(start, from)) {
    let k = 1;
    while (k < points.length && insideNode(points[k]!, from)) {
      k++;
    }
    start = k < points.length ? borderCrossing(points[k - 1]!, points[k]!, from) : interior[0]!;
  }
  let end = points[points.length - 1]!;
  if (insideNode(end, to)) {
    let k = points.length - 2;
    while (k >= 0 && insideNode(points[k]!, to)) {
      k--;
    }
    end = k >= 0 ? borderCrossing(points[k + 1]!, points[k]!, to) : interior[interior.length - 1]!;
  }
  return [start, ...interior, end];
};

const unit = (v: Point): Point => {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
};

/** Samples for a curve of the given approximate length: ~10px
 *  segments, dense enough that the basis spline the renderer fits
 *  reads as the curve itself, floored so short paths keep shape. */
const densityOf = (length: number, cap: number) =>
  Math.max(8, Math.min(cap, Math.round(length / 10)));

/** A quadratic Bézier, sampled evenly. */
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
  return points;
};

/** A cubic Bézier, sampled evenly. */
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
  return points;
};

/** What the node claims of the circle at its seat: its extent along
 *  the rim's tangent there. A wide box claims much at 12 o'clock and
 *  little at 3 o'clock; a circle claims the same everywhere. */
const tangentialExtent = (node: LayoutNodeInput, angle: number): number =>
  extent(node, { x: -Math.sin(angle), y: Math.cos(angle) });

/** The node's extent along the radial direction at the given angle. */
const radialExtent = (node: LayoutNodeInput, angle: number): number =>
  extent(node, { x: Math.cos(angle), y: Math.sin(angle) });

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

/** Undirected adjacency, self-loops and dangling endpoints ignored. */
const neighborsOf = (
  nodes: LayoutNodeInput[],
  edges: LayoutEdgeInput[]
): Map<string, Set<string>> => {
  const nbrs = new Map<string, Set<string>>(nodes.map((n) => [n.id, new Set<string>()]));
  for (const e of edges) {
    if (e.start !== e.end && nbrs.has(e.start) && nbrs.has(e.end)) {
      nbrs.get(e.start)!.add(e.end);
      nbrs.get(e.end)!.add(e.start);
    }
  }
  return nbrs;
};

/** Connected components over an undirected adjacency, as id sets. */
const componentsOf = (ids: string[], nbrs: Map<string, Set<string>>): Set<string>[] => {
  const seen = new Set<string>();
  const out: Set<string>[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    const comp = new Set<string>();
    const queue = [id];
    seen.add(id);
    while (queue.length > 0) {
      const current = queue.pop()!;
      comp.add(current);
      for (const nb of nbrs.get(current) ?? []) {
        if (!seen.has(nb)) {
          seen.add(nb);
          queue.push(nb);
        }
      }
    }
    out.push(comp);
  }
  return out;
};

/**
 * Biconnected components — the blocks — of an undirected graph, via
 * Tarjan's lowpoint walk with an edge stack, iterative so deep chains
 * cannot overflow. Blocks of three or more nodes are the circles;
 * two-node blocks are bridges. Cut vertices belong to every block
 * they join, which is exactly what lets a figure-eight share its
 * waist node between two rings.
 */
const blocksOf = (ids: string[], nbrs: Map<string, Set<string>>): Set<string>[] => {
  const num = new Map<string, number>();
  const low = new Map<string, number>();
  const parent = new Map<string, string>();
  const edgeStack: [string, string][] = [];
  const blocks: Set<string>[] = [];
  let counter = 0;

  const popBlock = (u: string, v: string) => {
    const block = new Set<string>();
    let top: [string, string];
    do {
      top = edgeStack.pop()!;
      block.add(top[0]);
      block.add(top[1]);
    } while (top[0] !== u || top[1] !== v);
    blocks.push(block);
  };

  for (const root of ids) {
    if (num.has(root)) {
      continue;
    }
    num.set(root, counter);
    low.set(root, counter);
    counter++;
    const stack: [string, Iterator<string>][] = [[root, (nbrs.get(root) ?? new Set()).values()]];
    while (stack.length > 0) {
      const [u, iter] = stack[stack.length - 1]!;
      const step = iter.next();
      if (step.done) {
        stack.pop();
        const p = parent.get(u);
        if (p !== undefined) {
          low.set(p, Math.min(low.get(p)!, low.get(u)!));
          if (low.get(u)! >= num.get(p)!) {
            popBlock(p, u);
          }
        }
        continue;
      }
      const v = step.value;
      if (!num.has(v)) {
        parent.set(v, u);
        edgeStack.push([u, v]);
        num.set(v, counter);
        low.set(v, counter);
        counter++;
        stack.push([v, (nbrs.get(v) ?? new Set()).values()]);
      } else if (v !== parent.get(u) && num.get(v)! < num.get(u)!) {
        edgeStack.push([u, v]);
        low.set(u, Math.min(low.get(u)!, num.get(v)!));
      }
    }
  }
  return blocks;
};

/**
 * Find the hub, if the shape is unmistakable. Two shapes qualify.
 *
 * A wheel: the ring has an axle. The candidate is the rim node with
 * strictly the most rim neighbors — strictly, because in a wheel
 * removing even an ordinary ring member leaves a cycle (the ring
 * reroutes through the axle), so the removal test alone cannot tell
 * the axle from a busy ring member; uniqueness can. The candidate is
 * confirmed if it is adjacent to every other rim member — a dominant
 * fan holds the center even when the outer ring is missing arcs — or
 * if the ring survives whole without it.
 *
 * A star: no cycle anywhere (a cycle-free peel leaves a rim smaller
 * than three), and one node is strictly the busiest, with at least
 * three neighbors. Strictly, so a path (everyone ties at two) and a
 * balanced tree (internal nodes tie) stay on the ring; but a star
 * whose spokes grow branches keeps its center — the branches hang
 * outward as spurs, and demanding that every edge touch the hub
 * would let one annotation leaf collapse the whole shape.
 */
const findHub = (nodes: LayoutNodeInput[], edges: LayoutEdgeInput[]): string | undefined => {
  const nbrs = neighborsOf(nodes, edges);
  const { rim } = peel(nodes, edges);

  if (rim.size >= 3) {
    let best: string | undefined;
    let bestCount = 0;
    let tied = false;
    for (const id of rim) {
      const count = [...nbrs.get(id)!].filter((nb) => rim.has(nb)).length;
      if (count > bestCount) {
        best = id;
        bestCount = count;
        tied = false;
      } else if (count === bestCount) {
        tied = true;
      }
    }
    if (!best || tied || bestCount < 3) {
      return undefined;
    }
    // The dominant fan: a node adjacent to EVERY other rim member is
    // a hub whatever the leftovers look like — spokes have special
    // status, and a wheel missing rim arcs keeps its axle. This is
    // the same graph as a ring with a full fan of chords, and when
    // the two readings collide, the spokes win.
    if (bestCount === rim.size - 1) {
      return best;
    }
    const { rim: rest } = peel(
      nodes.filter((n) => n.id !== best),
      edges.filter((e) => e.start !== best && e.end !== best)
    );
    const wholeWithoutIt = [...rim].every((id) => id === best || rest.has(id));
    return wholeWithoutIt && rest.size >= 3 ? best : undefined;
  }

  let best: string | undefined;
  let most = 0;
  let tied = false;
  for (const [id, set] of nbrs) {
    if (set.size > most) {
      best = id;
      most = set.size;
      tied = false;
    } else if (set.size === most && set.size > 0) {
      tied = true;
    }
  }
  return best !== undefined && !tied && most >= 3 ? best : undefined;
};

/**
 * The ring around a chosen hub. A wheel keeps the ring the peel finds
 * once the axle is gone, spurs and all. A star has no such ring, so
 * the hub's direct neighbors become one, and anything deeper hangs
 * off its first-reached parent, outward — the same spur machinery the
 * ring case uses. Nodes the hub cannot reach still deserve a place,
 * so they join the ring.
 */
const ringAroundHub = (
  nodes: LayoutNodeInput[],
  edges: LayoutEdgeInput[],
  hubId: string
): { rim: Set<string>; childrenOf: Map<string, string[]> } => {
  const rest = nodes.filter((n) => n.id !== hubId);
  const restEdges = edges.filter((e) => e.start !== hubId && e.end !== hubId);
  const peeled = peel(rest, restEdges);
  // A rim-rim edge proves a genuine cycle: cycle-free roots survive
  // peeling too, but isolated. Trust the peel only past that proof —
  // peeling is direction-blind, and on a hubless tree it can hang a
  // spoke off its own leaf.
  const genuineRing = restEdges.some(
    (e) => e.start !== e.end && peeled.rim.has(e.start) && peeled.rim.has(e.end)
  );
  if (peeled.rim.size >= 3 && genuineRing) {
    return peeled;
  }

  const nbrs = neighborsOf(nodes, edges);
  const rim = new Set<string>();
  const childrenOf = new Map<string, string[]>();
  const seen = new Set([hubId]);
  const queue = [hubId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of nbrs.get(current)!) {
      if (seen.has(next)) {
        continue;
      }
      seen.add(next);
      if (current === hubId) {
        rim.add(next);
      } else {
        if (!childrenOf.has(current)) {
          childrenOf.set(current, []);
        }
        childrenOf.get(current)!.push(next);
      }
      queue.push(next);
    }
  }
  for (const n of rest) {
    if (!seen.has(n.id)) {
      rim.add(n.id);
    }
  }
  return { rim, childrenOf };
};

type RingOptions = Omit<Required<CircularLayoutOptions>, 'direction'>;

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
  const { direction, ...ringOptions } = { ...defaults, ...given };
  const result = layoutRing(nodes, edges, ringOptions, undefined);
  return direction === 'counterclockwise' ? mirrored(result) : result;
};

/**
 * One ring and everything hanging off it. Satellites recurse right
 * back into this function: a pendant cycle is just a smaller ring,
 * anchored so its own copy of the attachment node faces home. The
 * mirror for counter-clockwise is applied once, by the wrapper, on
 * the finished geometry.
 */
const layoutRing = (
  nodes: LayoutNodeInput[],
  edges: LayoutEdgeInput[],
  opts: RingOptions,
  anchor: string | undefined,
  /** Seat the ring in reverse, flipping its direction of travel.
   *  Tangent satellites mesh like gears — each spins against its
   *  parent — so every tangent recursion toggles this; a bridge
   *  satellite turns with its parent, like a shaft, and passes it
   *  through unchanged. */
  reversed = false
): CircularLayoutResult => {
  const { spacing, startAngle, ordering, bow, swerve, samples, hub } = opts;

  if (nodes.length === 0) {
    return { nodes: [], edges: [], order: [], radius: 0 };
  }
  if (nodes.length === 1) {
    const only = nodes[0]!;
    const reach = footprint(only) + spacing;
    const home: BoxAt = { x: 0, y: 0, width: only.width, height: only.height, shape: only.shape };
    return {
      nodes: [{ id: only.id, x: 0, y: 0, angle: 0 }],
      edges: edges.map((e) => {
        if (e.start !== only.id || e.end !== only.id) {
          return { ...e, points: [], onRim: false };
        }
        // A self-loop on a lone node: a petal reaching upward, the
        // same gesture as on a ring, anchored by mermaid on the border.
        const t1 = { x: -reach * Math.sin(0.45), y: -reach * Math.cos(0.45) };
        const t2 = { x: reach * Math.sin(0.45), y: -reach * Math.cos(0.45) };
        const origin = { x: 0, y: 0 };
        return {
          ...e,
          points: throughBorders(cubic(origin, t1, t2, origin, samples), home, home),
          onRim: false,
        };
      }),
      order: [only.id],
      radius: 0,
    };
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const peeled = peel(nodes, edges);

  // A 2-core holding more than one circle is not one ring: it is a
  // main ring with pendant circles. The blocks tell them apart, the
  // largest block (or the one holding the recursion's anchor) keeps
  // the middle, and every other circle-bearing component becomes a
  // satellite, laid out by recursion and parked outside.
  interface SatellitePlan {
    anchor: string;
    /** True when the anchor itself rides the satellite circle — a
     *  figure-eight waist. False means a bridge edge reaches out. */
    tangent: boolean;
    subNodes: LayoutNodeInput[];
    subEdges: LayoutEdgeInput[];
    /** The satellite node that must face home: the anchor's own copy
     *  when tangent, the bridge's landing node otherwise. */
    subAnchor: string;
    /** Radius of the disc the whole satellite occupies, from a probe
     *  solve; the disc is orientation-proof, so the probe's answer
     *  holds for the real orientation too. */
    discR: number;
    /** What the satellite claims of the ring: its measured intrusion
     *  into the band the ring's boxes occupy, not its whole disc. */
    claimWidth: number;
  }
  const satellitePlans: SatellitePlan[] = [];
  let mainSet: Set<string> | undefined;
  if (peeled.rim.size >= 3) {
    const rimNodeList = nodes.filter((n) => peeled.rim.has(n.id));
    const rimEdgeList = edges.filter((e) => peeled.rim.has(e.start) && peeled.rim.has(e.end));
    const blocks = blocksOf(
      rimNodeList.map((n) => n.id),
      neighborsOf(rimNodeList, rimEdgeList)
    ).filter((b) => b.size >= 3);
    // One block is enough: even without a second circle in the
    // 2-core, a pendant pair joined by two or more edges is a cycle
    // the simple-graph peel cannot see, and the extraction below is
    // what finds it.
    if (blocks.length >= 1) {
      const inputIndex = new Map(nodes.map((n, i) => [n.id, i]));
      const earliest = (b: Set<string>) => Math.min(...[...b].map((id) => inputIndex.get(id)!));
      const candidates =
        anchor === undefined ? blocks : blocks.filter((b) => b.has(anchor));
      mainSet = (candidates.length > 0 ? candidates : blocks).reduce((best, b) =>
        b.size > best.size || (b.size === best.size && earliest(b) < earliest(best)) ? b : best
      );
    }
  }

  let rim: Set<string>;
  let childrenOf: Map<string, string[]>;
  let hubId: string | undefined;
  if (mainSet !== undefined) {
    // Components of the graph away from the main block. One that
    // touches the 2-core carries a circle and becomes a satellite;
    // pure trees stay with the spur machinery below.
    const main = mainSet;
    const restNodes = nodes.filter((n) => !main.has(n.id));
    const restNbrs = neighborsOf(
      restNodes,
      edges.filter((e) => !main.has(e.start) && !main.has(e.end))
    );
    const extracted = new Set<string>();
    for (const comp of componentsOf(restNodes.map((n) => n.id), restNbrs)) {
      const attach = edges.filter(
        (e) =>
          (main.has(e.start) && comp.has(e.end)) || (main.has(e.end) && comp.has(e.start))
      );
      if (attach.length === 0) {
        continue; // a free-floating cycle keeps its seat on the main ring
      }
      const anchorId = main.has(attach[0]!.start) ? attach[0]!.start : attach[0]!.end;
      const tangent =
        attach.filter((e) => e.start === anchorId || e.end === anchorId).length >= 2;
      // A satellite must carry a circle: either the component holds
      // 2-core members (a cycle of its own), or it hangs from one
      // anchor by two or more edges — a pendant lens, a cycle the
      // simple-graph peel cannot see. A tree on a single edge stays
      // with the spur machinery.
      const carriesCycle = [...comp].some((id) => peeled.rim.has(id));
      if (!carriesCycle && !tangent) {
        continue;
      }
      const subIds = new Set(comp);
      if (tangent) {
        subIds.add(anchorId);
      }
      const subNodes = nodes.filter((n) => subIds.has(n.id));
      const subEdges = edges.filter((e) => subIds.has(e.start) && subIds.has(e.end));
      const subAnchor = tangent
        ? anchorId
        : comp.has(attach[0]!.start)
          ? attach[0]!.start
          : attach[0]!.end;
      const probe = layoutRing(
        subNodes,
        subEdges,
        { ...opts, hub: 'none' },
        subAnchor,
        tangent ? !reversed : reversed
      );
      const discR = Math.max(
        ...probe.nodes.map((n) => Math.hypot(n.x, n.y) + footprint(byId.get(n.id)!))
      );
      // A satellite touches the ring; it does not sit on it. Its
      // claim on the rim is not the whole disc but the width of what
      // actually reaches down into the band the ring's boxes occupy:
      // each probe node is projected onto the home axis (the anchor's
      // direction from the sub-center — the probe pins the anchor, so
      // the final orientation only rotates this picture rigidly), and
      // only nodes within a rim-footprint-plus-gap of the rim
      // contribute their sideways reach. A small gear's far members
      // clear the band and cost nothing; a big gear's shoulders
      // genuinely crowd the anchor's neighbors and still pay.
      const anchorProbe = probe.nodes.find((n) => n.id === subAnchor)!;
      const aDist = Math.hypot(anchorProbe.x, anchorProbe.y);
      const home =
        aDist > 0 ? { x: anchorProbe.x / aDist, y: anchorProbe.y / aDist } : { x: 0, y: -1 };
      const rimAt = aDist + (tangent ? 0 : spacing * 0.8);
      // How deep the band reaches: as far out as a ring box can — its
      // footprint. Breathing room is not part of the band; the gap
      // equation and the claim's own spacing already pay for it, and
      // counting it here would drag a small gear's far members back
      // into the band and re-inflate the claim.
      const band = Math.max(...nodes.filter((n) => main.has(n.id)).map(footprint));
      let halfClaim = 0;
      for (const n of probe.nodes) {
        if (n.id === anchorId) {
          continue;
        }
        const fp = footprint(byId.get(n.id)!);
        const toward = n.x * home.x + n.y * home.y;
        if (toward + fp >= rimAt - band) {
          halfClaim = Math.max(halfClaim, Math.abs(n.x * home.y - n.y * home.x) + fp);
        }
      }
      satellitePlans.push({
        anchor: anchorId,
        tangent,
        subNodes,
        subEdges,
        subAnchor,
        discR,
        claimWidth: 2 * halfClaim + spacing,
      });
      for (const id of comp) {
        extracted.add(id);
      }
    }
    rim = new Set([...peeled.rim].filter((id) => !extracted.has(id)));
    // A satellite member the peel had hung as a spur child (a
    // pendant lens rides the peel as a leaf) must leave the spur
    // forest, or its parent reserves room for it twice and the spur
    // placement fights the satellite's.
    childrenOf = new Map(
      [...peeled.childrenOf]
        .map(([parent, kids]): [string, string[]] => [
          parent,
          kids.filter((kid) => !extracted.has(kid)),
        ])
        .filter(([, kids]) => kids.length > 0)
    );
    // A wheel can carry gears. With the satellites parked, the main
    // block may still have an axle of its own — detect it on the
    // block's subgraph, and step aside only if a satellite is
    // anchored to the very node that would take the center.
    const mainRimNodes = nodes.filter((n) => rim.has(n.id));
    const mainRimEdges = edges.filter((e) => rim.has(e.start) && rim.has(e.end));
    const axle =
      hub === 'none'
        ? undefined
        : hub === 'auto'
          ? findHub(mainRimNodes, mainRimEdges)
          : rim.has(hub)
            ? hub
            : undefined;
    if (axle !== undefined && !satellitePlans.some((plan) => plan.anchor === axle)) {
      hubId = axle;
      rim.delete(axle);
      // A spoke with no rim arcs peels onto the hub as if it were a
      // tree limb — but a spoke belongs on the ring. The axle's
      // direct children take rim seats; their own subtrees keep
      // hanging off them, outward.
      for (const kid of childrenOf.get(axle) ?? []) {
        rim.add(kid);
      }
      childrenOf.delete(axle);
    }
  } else {
    // The center is earned, never assumed. An unmistakable star or
    // wheel — or an explicitly named node — puts its hub at the
    // origin and rings everything else. Otherwise the ring is the
    // 2-core with trees hanging off as spurs, and a ring thinner
    // than three nodes keeps everything on the ring as before.
    hubId =
      hub === 'none'
        ? undefined
        : hub === 'auto'
          ? findHub(nodes, edges)
          : byId.has(hub)
            ? hub
            : undefined;
    if (hubId !== undefined) {
      ({ rim, childrenOf } = ringAroundHub(nodes, edges, hubId));
    } else {
      ({ rim, childrenOf } = peeled);
      if (rim.size < 3) {
        rim = new Set(nodes.map((n) => n.id));
        childrenOf = new Map();
      }
    }
  }
  const hubNode = hubId === undefined ? undefined : byId.get(hubId);

  // For spacing, a satellite is one more thing its anchor carries —
  // but only as wide as what it pushes into the ring's own band.
  const satWidthsOf = new Map<string, number[]>();
  for (const plan of satellitePlans) {
    if (!satWidthsOf.has(plan.anchor)) {
      satWidthsOf.set(plan.anchor, []);
    }
    satWidthsOf.get(plan.anchor)!.push(plan.claimWidth);
  }
  const rimNodes = nodes.filter((n) => rim.has(n.id));
  const rimEdges = edges.filter((e) => rim.has(e.start) && rim.has(e.end));

  let order =
    ordering === 'input' ? rimNodes.map((n) => n.id) : orderRim(rimNodes, rimEdges);
  // A satellite is solved facing home: its anchor (or, when the
  // anchor hangs off the ring, the ring node it hangs from) becomes
  // the first seat, which startAngle then pins. Rotating a cyclic
  // order changes no neighbor.
  if (anchor !== undefined) {
    const parentOf = new Map<string, string>();
    for (const [parent, kids] of childrenOf) {
      for (const kid of kids) {
        parentOf.set(kid, parent);
      }
    }
    const seats = new Set(order);
    let seat: string | undefined = anchor;
    const walked = new Set<string>();
    while (seat !== undefined && !seats.has(seat) && !walked.has(seat)) {
      walked.add(seat);
      seat = parentOf.get(seat);
    }
    if (seat !== undefined && seats.has(seat)) {
      const at = order.indexOf(seat);
      order = [...order.slice(at), ...order.slice(0, at)];
    }
  }
  if (reversed) {
    // Cyclic reversal about the first seat: the anchor stays pinned,
    // everyone else walks the other way around.
    order = [order[0]!, ...order.slice(1).reverse()];
  }
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
  const effectiveExtent = (id: string, angle: number): number => {
    const kids = childrenOf.get(id) ?? [];
    // A grouped node's box wall stands one pad beyond its border, and
    // the neighbors must clear the wall, not just the node.
    const self = byId.get(id)!;
    const own = tangentialExtent(self, angle) + (self.group !== undefined ? GROUP_PAD : 0);
    const carried = [
      ...kids.map((kid) => treeWidth(kid, angle)),
      ...(satWidthsOf.get(id) ?? []),
    ];
    if (carried.length === 0) {
      return own;
    }
    const width = carried.reduce((a, b) => a + b, 0) + (carried.length - 1) * spacing;
    return Math.max(own, width / 2);
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

  // A labeled spur needs radial room the same way a labeled rim gap
  // needs arc: the gap between the two borders must hold the label's
  // projection onto the spur direction, plus breathing room. The
  // widest label of the pair decides.
  const pairLabel = new Map<string, { w: number; h: number }>();
  for (const e of edges) {
    if (!e.labelWidth) {
      continue;
    }
    const key = [e.start, e.end].sort().join('|');
    const prev = pairLabel.get(key) ?? { w: 0, h: 0 };
    pairLabel.set(key, {
      w: Math.max(prev.w, e.labelWidth),
      h: Math.max(prev.h, e.labelHeight ?? 20),
    });
  }
  const radialLabelNeed = (a: string, b: string, angle: number): number => {
    const label = pairLabel.get([a, b].sort().join('|'));
    if (!label) {
      return 0;
    }
    return Math.abs(Math.cos(angle)) * label.w + Math.abs(Math.sin(angle)) * label.h + 24;
  };

  // Solve angles so the free arc between neighboring borders is the
  // same everywhere — the eye judges the arrows, not the angles. The
  // extents depend on the angles and the angles on the extents, so
  // iterate; then mirror the side pairs so the ring stays symmetric,
  // with the first node pinned to the top. The radius follows from
  // the same equation (2πR = n·gap + 2Σextent) and rises if any two
  // boxes anywhere on the ring would come too close. The extent
  // linearization needs the radius to dwarf the boxes, so small
  // rings keep a floor of 1.6 footprints.
  let radius = 1.6 * Math.max(...rimNodes.map(footprint));
  let angles: number[] = order.map((_, i) => startAngle + (i * TAU) / nRim);
  for (let round = 0; round < 60; round++) {
    const extents = order.map((id, i) => effectiveExtent(id, angles[i]!));
    const extentSum = 2 * extents.reduce((a, b) => a + b, 0);
    const nextRadius = Math.max((nRim * targetGap + extentSum) / TAU, radius);
    const gap = (TAU * nextRadius - extentSum) / nRim;
    // Lay the ring sequentially, then symmetrize mirror pairs: i and
    // n−i reflect across the axis through the first node, whatever
    // angle that node was pinned to — a satellite pins it to face
    // its anchor's home, the default pins it to the top.
    const next: number[] = [startAngle];
    for (let i = 1; i < nRim; i++) {
      next.push(next[i - 1]! + (extents[i - 1]! + extents[i]! + gap) / nextRadius);
    }
    for (let i = 1; i * 2 < nRim; i++) {
      const phiNear = next[i]! - startAngle;
      const phiFar = next[nRim - i]! - startAngle;
      const mirroredPhi = (phiNear + (TAU - phiFar)) / 2;
      next[i] = startAngle + mirroredPhi;
      next[nRim - i] = startAngle + TAU - mirroredPhi;
    }
    if (nRim % 2 === 0) {
      next[nRim / 2] = startAngle + Math.PI;
    }
    angles = next;
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
          extent(byId.get(order[i]!)!, dir) +
          extent(byId.get(order[j]!)!, dir) +
          margin;
        if (between < need) {
          scale = Math.max(scale, need / Math.max(between, 1));
        }
      }
    }
    // A hub in the middle is one more thing the ring must clear:
    // every spoke needs daylight between the hub's border and its
    // ring node's border — enough for the spoke's label, when it
    // carries one.
    if (hubNode) {
      for (let i = 0; i < nRim; i++) {
        const dir = unit(onCircle(radius, angles[i]!));
        const daylight = Math.max(
          spacing,
          radialLabelNeed(hubId!, order[i]!, angles[i]!)
        );
        const need =
          extent(byId.get(order[i]!)!, dir) + extent(hubNode, dir) + daylight;
        if (radius < need) {
          scale = Math.max(scale, need / Math.max(radius, 1));
        }
      }
    }
    if (scale > 1.001) {
      radius *= scale;
      continue;
    }
    if (round > 4 && scale <= 1.001) {
      break;
    }
  }

  const angleOf = new Map(order.map((id, i) => [id, angles[i]!]));
  const posOf = new Map<string, Point>();
  for (const id of order) {
    posOf.set(id, onCircle(radius, angleOf.get(id)!));
  }
  if (hubId !== undefined) {
    posOf.set(hubId, { x: 0, y: 0 });
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
        parentOuterRadius +
        Math.max(spacing * 0.8, radialLabelNeed(parentId, kid, parentAngle)) +
        radialExtent(node, parentAngle);
      const kidAngle = parentAngle + centerOffset / kidRadius;
      posOf.set(kid, onCircle(kidRadius, kidAngle));
      placeChildren(kid, kidAngle, kidRadius + radialExtent(node, kidAngle));
    }
  };
  for (const id of order) {
    const angle = angleOf.get(id)!;
    placeChildren(id, angle, radius + radialExtent(byId.get(id)!, angle));
  }

  // Park each satellite on its anchor's ray. The probe solve above
  // only sized the disc; the real solve happens HERE, with the
  // sub-ring's first seat pinned to face home — so every extent, gap
  // and border crossing is computed against boxes exactly where they
  // will render, and the move into place is a pure translation.
  // Boxes are axis-aligned and do not rotate with a layout; a
  // rotation would tear every arc endpoint off its border, so no
  // rotation may ever touch finished geometry. For a tangent
  // satellite the anchor's copy lands exactly on its main-ring seat,
  // and the two circles genuinely touch. Siblings sharing an anchor
  // take neighboring rays, which preserves that tangency.
  const satellites: SatelliteRing[] = [];
  const satRouted = new Map<string, RoutedEdge>();
  const plansByAnchor = new Map<string, SatellitePlan[]>();
  for (const plan of satellitePlans) {
    if (!plansByAnchor.has(plan.anchor)) {
      plansByAnchor.set(plan.anchor, []);
    }
    plansByAnchor.get(plan.anchor)!.push(plan);
  }
  for (const [anchorId, plans] of plansByAnchor) {
    const theta = angleOf.get(anchorId)!;
    const anchorPos = posOf.get(anchorId)!;
    const anchorNode = byId.get(anchorId)!;
    for (const [k, plan] of plans.entries()) {
      const swing =
        plans.length === 1
          ? 0
          : ((k - (plans.length - 1) / 2) * (2 * plan.discR + spacing)) / radius;
      const ray = theta + swing;
      const sub = layoutRing(
        plan.subNodes,
        plan.subEdges,
        { ...opts, hub: 'none', startAngle: ray + Math.PI },
        plan.subAnchor,
        plan.tangent ? !reversed : reversed
      );
      const subA = sub.nodes.find((n) => n.id === plan.subAnchor)!;
      const aDist = Math.hypot(subA.x, subA.y);
      const center = plan.tangent
        ? {
            x: anchorPos.x + aDist * Math.cos(ray),
            y: anchorPos.y + aDist * Math.sin(ray),
          }
        : onCircle(
            radius +
              radialExtent(anchorNode, theta) +
              Math.max(spacing * 0.8, radialLabelNeed(anchorId, plan.subAnchor, ray)) +
              radialExtent(byId.get(plan.subAnchor)!, ray) +
              aDist,
            ray
          );
      const place = (p: Point): Point => ({ x: p.x + center.x, y: p.y + center.y });
      for (const n of sub.nodes) {
        if (plan.tangent && n.id === anchorId) {
          continue; // the waist keeps its main-ring seat
        }
        posOf.set(n.id, place(n));
      }
      for (const e of sub.edges) {
        satRouted.set(e.id, { ...e, points: e.points.map(place) });
      }
      satellites.push({
        anchor: anchorId,
        members: sub.order,
        center: { ...center },
        radius: sub.radius,
      });
      for (const nested of sub.satellites ?? []) {
        satellites.push({ ...nested, center: place(nested.center) });
      }
    }
  }

  const placed: PlacedNode[] = nodes.map((node) => {
    const pos = posOf.get(node.id) ?? { x: 0, y: 0 };
    return { id: node.id, ...pos, angle: Math.atan2(pos.y, pos.x) };
  });

  const boxAt = (id: string): BoxAt => {
    const node = byId.get(id)!;
    const pos = posOf.get(id)!;
    return { ...pos, width: node.width, height: node.height, shape: node.shape };
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
    // A satellite's interior edges were routed by the recursion and
    // moved with it; the bridge edge is not among them, so it falls
    // through to the spur branch below and draws straight.
    const fromSatellite = satRouted.get(e.id);
    if (fromSatellite) {
      return fromSatellite;
    }
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
      return {
        ...e,
        points: throughBorders(cubic(pStart, t1, t2, pStart, samples), home, home),
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
      // A spur edge: essentially radial, drawn straight from center
      // to center. Siblings bow apart sideways — in the canonical
      // frame of the sorted pair, not the edge's own travel frame,
      // or an opposite pair's perpendiculars cancel and the two
      // curves collapse onto one line.
      const mid = { x: (pStart.x + pEnd.x) / 2, y: (pStart.y + pEnd.y) / 2 };
      const across = unit({ x: pEnd.y - pStart.y, y: -(pEnd.x - pStart.x) });
      const side = e.start < e.end ? 1 : -1;
      const control = {
        x: mid.x + across.x * spread * 18 * side,
        y: mid.y + across.y * spread * 18 * side,
      };
      return {
        ...e,
        points: throughBorders(
          quadratic(pStart, control, pEnd, samples),
          boxAt(e.start),
          boxAt(e.end)
        ),
        onRim: false,
      };
    }

    const a = angleOf.get(e.start)!;
    const b = angleOf.get(e.end)!;
    const gap = Math.abs(position.get(e.start)! - position.get(e.end)!);
    const neighbors = Math.min(gap, nRim - gap) === 1 || nRim === 2;

    if (neighbors) {
      // One circle, drawn honestly: the edge is a true arc of the
      // rim, sampled from seat angle to seat angle — both seats lie
      // on the rim, so the path runs center to center and the
      // renderer replaces each center with the exact border crossing.
      // A sibling pair (opposite or parallel arrows) rides concentric
      // arcs — the offset clamped so the offset circle still passes
      // through both silhouettes.
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
      // The target's angle expressed continuously from `a` — walking
      // back from its stored angle can sit across the ±π wrap and
      // send the arc the long way round the circle.
      const delta = shortWay(a, b);
      const arcLength = Math.abs(delta) * arcRadius;
      // Denser than the free-curve samplers: the arc's ends feed the
      // renderer its border directions, and a fine step keeps those
      // directions honest tangents.
      const count = Math.max(8, Math.min(4 * samples, Math.round(arcLength / 8)));
      const arc: Point[] = [];
      for (let i = 0; i <= count; i++) {
        arc.push(onCircle(arcRadius, a + (delta * i) / count));
      }
      return { ...e, points: throughBorders(arc, boxA, boxB), onRim: true };
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
    return {
      ...e,
      points: throughBorders(
        quadratic(pa, control, pb, samples),
        boxAt(e.start),
        boxAt(e.end)
      ),
      onRim: false,
    };
  });

  return {
    nodes: placed,
    edges: routed,
    order,
    radius,
    ...(hubId !== undefined && { hub: hubId }),
    ...(satellites.length > 0 && { satellites }),
  };
};
