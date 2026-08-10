import { describe, expect, it } from 'vitest';
import { circularLayout } from './layout.js';
import type { LayoutEdgeInput, LayoutNodeInput } from './layout.js';

const box = (id: string, width = 80, height = 40): LayoutNodeInput => ({ id, width, height });

const edge = (start: string, end: string): LayoutEdgeInput => ({
  id: `${start}-${end}`,
  start,
  end,
});

const cycle = (...ids: string[]): LayoutEdgeInput[] =>
  ids.map((id, i) => edge(id, ids[(i + 1) % ids.length]!));

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('placement', () => {
  it('puts every node at the same distance from the origin', () => {
    const { nodes, radius } = circularLayout(
      ['A', 'B', 'C', 'D', 'E'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D', 'E')
    );
    expect(nodes).toHaveLength(5);
    for (const n of nodes) {
      expect(Math.hypot(n.x, n.y)).toBeCloseTo(radius, 6);
    }
  });

  it('never lets two boxes touch, whatever their sizes', () => {
    const sized = [
      box('A', 200, 60),
      box('B', 40, 40),
      box('C', 120, 50),
      box('D', 40, 40),
      box('E', 90, 45),
    ];
    const { nodes } = circularLayout(sized, cycle('A', 'B', 'C', 'D', 'E'));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const sizeOf = new Map(sized.map((n) => [n.id, n]));
    for (let i = 0; i < sized.length; i++) {
      for (let j = i + 1; j < sized.length; j++) {
        const p = byId.get(sized[i]!.id)!;
        const q = byId.get(sized[j]!.id)!;
        const overlapX =
          Math.abs(p.x - q.x) < (sizeOf.get(sized[i]!.id)!.width + sizeOf.get(sized[j]!.id)!.width) / 2;
        const overlapY =
          Math.abs(p.y - q.y) <
          (sizeOf.get(sized[i]!.id)!.height + sizeOf.get(sized[j]!.id)!.height) / 2;
        expect(overlapX && overlapY, `${sized[i]!.id} overlaps ${sized[j]!.id}`).toBe(false);
      }
    }
  });

  it('mirrors side pairs at identical heights, first node centered on top', () => {
    const { nodes, order } = circularLayout(
      ['A', 'B', 'C', 'D', 'E'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D', 'E')
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const top = byId.get(order[0]!)!;
    expect(top.x).toBeCloseTo(0, 6);
    expect(top.y).toBeLessThan(0);
    // order[1]/order[4] and order[2]/order[3] are mirror pairs.
    expect(byId.get(order[1]!)!.y).toBeCloseTo(byId.get(order[4]!)!.y, 6);
    expect(byId.get(order[1]!)!.x).toBeCloseTo(-byId.get(order[4]!)!.x, 6);
    expect(byId.get(order[2]!)!.y).toBeCloseTo(byId.get(order[3]!)!.y, 6);
    expect(byId.get(order[2]!)!.x).toBeCloseTo(-byId.get(order[3]!)!.x, 6);
  });

  it('separates adjacent boxes along the line between them, plus real daylight on the rim', () => {
    const spacing = 30;
    const sized = [box('A', 200, 60), box('B', 40, 40), box('C', 120, 50), box('D', 40, 40)];
    const { nodes: placed, order } = circularLayout(sized, cycle('A', 'B', 'C', 'D'), {
      spacing,
    });
    const byId = new Map(placed.map((n) => [n.id, n]));
    const sizeOf = new Map(sized.map((n) => [n.id, n]));
    for (let i = 0; i < order.length; i++) {
      const here = byId.get(order[i]!)!;
      const next = byId.get(order[(i + 1) % order.length]!)!;
      const a = sizeOf.get(order[i]!)!;
      const b = sizeOf.get(order[(i + 1) % order.length]!)!;
      const d = dist(here, next);
      const dir = { x: (next.x - here.x) / d, y: (next.y - here.y) / d };
      const support =
        (Math.abs(dir.x) * a.width + Math.abs(dir.y) * a.height) / 2 +
        (Math.abs(dir.x) * b.width + Math.abs(dir.y) * b.height) / 2;
      expect(d, `${order[i]} to ${order[(i + 1) % order.length]}`).toBeGreaterThan(support);
    }
  });

  it('gives one node the center and two nodes an opposed pair', () => {
    const one = circularLayout([box('A')], []);
    expect(one.nodes[0]!.x).toBeCloseTo(0, 6);
    expect(one.nodes[0]!.y).toBeCloseTo(0, 6);

    const two = circularLayout([box('A'), box('B')], [edge('A', 'B')]);
    const [a, b] = two.nodes;
    expect(a!.x).toBeCloseTo(-b!.x, 6);
    expect(a!.y).toBeCloseTo(-b!.y, 6);
  });

  it('places every node even when the graph is not a cycle', () => {
    const { nodes } = circularLayout(
      ['A', 'B', 'C', 'lone'].map((id) => box(id)),
      [edge('A', 'B')]
    );
    expect(new Set(nodes.map((n) => n.id))).toEqual(new Set(['A', 'B', 'C', 'lone']));
  });
});

const tangentialExtent = (w: number, h: number, angle: number) =>
  (Math.abs(Math.sin(angle)) * w) / 2 + (Math.abs(Math.cos(angle)) * h) / 2;

describe('uniform gaps', () => {
  it('equalizes the visible arrows: free arcs between wide boxes stay within a fifth of each other', () => {
    // The water-cycle shape that showed a stubby bottom arrow: five
    // wide boxes whose tangential claims differ by position.
    const ids = ['A', 'B', 'C', 'D', 'E'];
    const { nodes, order, radius } = circularLayout(
      ids.map((id) => box(id, 150, 50)),
      cycle(...ids)
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const gaps: number[] = [];
    for (let i = 0; i < order.length; i++) {
      const here = byId.get(order[i]!)!;
      const next = byId.get(order[(i + 1) % order.length]!)!;
      let delta = next.angle - here.angle;
      while (delta <= 0) {
        delta += 2 * Math.PI;
      }
      gaps.push(
        radius * delta -
          tangentialExtent(150, 50, here.angle) -
          tangentialExtent(150, 50, next.angle)
      );
    }
    const widest = Math.max(...gaps);
    const slimmest = Math.min(...gaps);
    expect(slimmest).toBeGreaterThan(0);
    expect(widest / slimmest).toBeLessThan(1.2);
  });

  it('still mirrors side pairs after equalization', () => {
    const { nodes, order } = circularLayout(
      ['A', 'B', 'C', 'D', 'E'].map((id) => box(id, 150, 50)),
      cycle('A', 'B', 'C', 'D', 'E')
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const top = byId.get(order[0]!)!;
    expect(top.x).toBeCloseTo(0, 4);
    expect(byId.get(order[1]!)!.y).toBeCloseTo(byId.get(order[4]!)!.y, 4);
    expect(byId.get(order[1]!)!.x).toBeCloseTo(-byId.get(order[4]!)!.x, 4);
    expect(byId.get(order[2]!)!.y).toBeCloseTo(byId.get(order[3]!)!.y, 4);
    expect(byId.get(order[2]!)!.x).toBeCloseTo(-byId.get(order[3]!)!.x, 4);
  });
});

describe('spurs', () => {
  const ring = cycle('A', 'B', 'C', 'D');
  const spurEdges = [
    ...ring,
    edge('Sun', 'A'), // an input spur
    edge('C', 'Flood'), // an output spur
    edge('Flood', 'Damage'), // depth two
  ];
  const spurNodes = ['A', 'B', 'C', 'D', 'Sun', 'Flood', 'Damage'].map((id) => box(id));

  it('keeps only the cycle on the rim', () => {
    const { order } = circularLayout(spurNodes, spurEdges);
    expect(new Set(order)).toEqual(new Set(['A', 'B', 'C', 'D']));
  });

  it('hangs each spur outside the ring, near its attachment', () => {
    const { nodes, radius } = circularLayout(spurNodes, spurEdges);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const a = byId.get('A')!;
    const sun = byId.get('Sun')!;
    const flood = byId.get('Flood')!;
    const damage = byId.get('Damage')!;
    expect(Math.hypot(sun.x, sun.y)).toBeGreaterThan(radius);
    expect(Math.hypot(flood.x, flood.y)).toBeGreaterThan(radius);
    // Depth two reaches further out than depth one.
    expect(Math.hypot(damage.x, damage.y)).toBeGreaterThan(Math.hypot(flood.x, flood.y));
    // The spur stays in its parent's neighborhood.
    const angleGap = Math.abs(Math.atan2(sun.y, sun.x) - Math.atan2(a.y, a.x));
    expect(Math.min(angleGap, 2 * Math.PI - angleGap)).toBeLessThan(Math.PI / 3);
  });

  it('routes spur edges border to border with straight tangent tails', () => {
    const { edges, nodes } = circularLayout(spurNodes, spurEdges);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const spurEdge = edges.find((e) => e.id === 'Sun-A')!;
    expect(spurEdge.points.length).toBeGreaterThanOrEqual(4);
    const first = spurEdge.points[0]!;
    const last = spurEdge.points[spurEdge.points.length - 1]!;
    expect(dist(first, byId.get('Sun')!)).toBeLessThanOrEqual(Math.hypot(40, 20) + 1e-6);
    expect(dist(last, byId.get('A')!)).toBeLessThanOrEqual(Math.hypot(40, 20) + 1e-6);
    const tail = dist(last, spurEdge.points[spurEdge.points.length - 2]!);
    expect(tail).toBeGreaterThan(6);
  });

  it('keeps everything on the ring when the graph has no cycle', () => {
    const { order } = circularLayout(
      ['A', 'B', 'C', 'D'].map((id) => box(id)),
      [edge('A', 'B'), edge('B', 'C'), edge('C', 'D')]
    );
    expect(order).toHaveLength(4);
  });
});

describe('option hygiene', () => {
  it('ignores an explicitly undefined option instead of clobbering the default', () => {
    const { radius, nodes } = circularLayout(
      ['A', 'B', 'C'].map((id) => box(id)),
      cycle('A', 'B', 'C'),
      { spacing: undefined }
    );
    expect(Number.isFinite(radius)).toBe(true);
    for (const n of nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });
});

describe('hub and spoke', () => {
  const spokes = ['A', 'B', 'C', 'D', 'E', 'F'];
  const starEdges = spokes.map((id) => edge('Hub', id));
  const wheelEdges = [...cycle(...spokes), ...spokes.map((id) => edge(id, 'Hub'))];
  const starNodes = ['Hub', ...spokes].map((id) => box(id));

  it('pulls the center of a star into the middle and rings the spokes', () => {
    const { nodes, radius, hub, order } = circularLayout(starNodes, starEdges);
    expect(hub).toBe('Hub');
    expect(order).not.toContain('Hub');
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(byId.get('Hub')!.x).toBeCloseTo(0, 6);
    expect(byId.get('Hub')!.y).toBeCloseTo(0, 6);
    for (const id of spokes) {
      expect(Math.hypot(byId.get(id)!.x, byId.get(id)!.y), id).toBeCloseTo(radius, 6);
    }
  });

  it('centers the axle of a wheel and keeps the ring a ring', () => {
    const { nodes, radius, hub, order } = circularLayout(
      ['Hub', ...spokes].map((id) => box(id)),
      wheelEdges
    );
    expect(hub).toBe('Hub');
    expect(new Set(order)).toEqual(new Set(spokes));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(Math.hypot(byId.get('Hub')!.x, byId.get('Hub')!.y)).toBeCloseTo(0, 6);
    for (const id of spokes) {
      expect(Math.hypot(byId.get(id)!.x, byId.get(id)!.y), id).toBeCloseTo(radius, 6);
    }
  });

  it('routes every spoke straight, border to border, well clear of both boxes', () => {
    const { edges: routed, radius } = circularLayout(starNodes, starEdges);
    for (const e of routed) {
      expect(e.points.length).toBeGreaterThanOrEqual(2);
      const first = e.points[0]!;
      const last = e.points[e.points.length - 1]!;
      // Leaves the hub's border, not its center; arrives at the ring, not beyond.
      expect(Math.hypot(first.x, first.y)).toBeGreaterThan(10);
      expect(Math.hypot(last.x, last.y)).toBeLessThan(radius);
      // Straight: every point sits on the segment from first to last.
      const len = Math.hypot(last.x - first.x, last.y - first.y);
      for (const p of e.points) {
        const cross =
          ((last.x - first.x) * (p.y - first.y) - (last.y - first.y) * (p.x - first.x)) / len;
        expect(Math.abs(cross)).toBeLessThan(0.5);
      }
    }
  });

  it('grows the radius until the spokes have daylight past a huge hub', () => {
    const bigHub = [box('Hub', 400, 120), ...spokes.map((id) => box(id))];
    const { nodes, radius } = circularLayout(bigHub, starEdges, { spacing: 30 });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const id of spokes) {
      const p = byId.get(id)!;
      const dir = { x: p.x / radius, y: p.y / radius };
      const need =
        (Math.abs(dir.x) * (400 + 80)) / 2 + (Math.abs(dir.y) * (120 + 40)) / 2 + 30;
      expect(Math.hypot(p.x, p.y), id).toBeGreaterThanOrEqual(need - 1e-6);
    }
  });

  it('never mistakes a path, a plain ring, or a ring with a few chords for a hub', () => {
    const path = circularLayout(
      ['A', 'B', 'C'].map((id) => box(id)),
      [edge('A', 'B'), edge('B', 'C')]
    );
    expect(path.hub).toBeUndefined();

    const ring = circularLayout(spokes.map((id) => box(id)), cycle(...spokes));
    expect(ring.hub).toBeUndefined();

    // A busy ring member with two shortcuts is still a ring member —
    // it does not reach everyone.
    const chorded = circularLayout(
      spokes.map((id) => box(id)),
      [...cycle(...spokes), edge('A', 'C'), edge('A', 'E')]
    );
    expect(chorded.hub).toBeUndefined();
  });

  describe('the dominant fan — spokes have special status', () => {
    const elements = ['Earth', 'Fire', 'Wind', 'Water', 'Heart'];
    const planetNodes = ['P', ...elements].map((id) => box(id));
    const planetSpokes = elements.map((id) => edge(id, 'P'));
    const planetRing = [
      edge('Heart', 'Wind'),
      edge('Heart', 'Earth'),
      edge('Earth', 'Fire'),
      edge('Fire', 'Water'),
      edge('Water', 'Wind'),
    ];

    it('centers the full wheel', () => {
      const { hub } = circularLayout(planetNodes, [...planetSpokes, ...planetRing]);
      expect(hub).toBe('P');
    });

    it('keeps the axle when a rim arc goes missing', () => {
      const { hub, nodes, order } = circularLayout(planetNodes, [
        ...planetSpokes,
        ...planetRing.slice(0, 4),
      ]);
      expect(hub).toBe('P');
      expect(new Set(order)).toEqual(new Set(elements));
      const p = nodes.find((n) => n.id === 'P')!;
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(0, 6);
    });

    it('keeps the axle when two rim arcs go missing', () => {
      const { hub } = circularLayout(planetNodes, [
        ...planetSpokes,
        ...planetRing.slice(0, 3),
      ]);
      expect(hub).toBe('P');
    });

    it('keeps the axle when one spoke goes missing but the rim is whole', () => {
      const { hub } = circularLayout(planetNodes, [
        ...planetSpokes.slice(0, 4),
        ...planetRing,
      ]);
      expect(hub).toBe('P');
    });

    it('keeps the axle when a gear meshes off a rim member', () => {
      const { hub, satellites, nodes, order, radius } = circularLayout(
        [...planetNodes, box('Vapor'), box('Ice')],
        [
          ...planetSpokes,
          ...planetRing,
          edge('Water', 'Vapor'),
          edge('Vapor', 'Ice'),
          edge('Ice', 'Water'),
        ]
      );
      expect(hub).toBe('P');
      expect(new Set(order)).toEqual(new Set(elements));
      expect(satellites).toHaveLength(1);
      expect(satellites![0]!.anchor).toBe('Water');
      const byId = new Map(nodes.map((n) => [n.id, n]));
      expect(Math.hypot(byId.get('P')!.x, byId.get('P')!.y)).toBeCloseTo(0, 6);
      for (const id of ['Vapor', 'Ice']) {
        expect(Math.hypot(byId.get(id)!.x, byId.get(id)!.y), id).toBeGreaterThan(radius);
      }
    });

    it('declines the truly ambiguous case: a spoke and a rim arc both gone', () => {
      const { hub } = circularLayout(planetNodes, [
        ...planetSpokes.slice(0, 4),
        ...planetRing.slice(0, 4),
      ]);
      expect(hub).toBeUndefined();
    });
  });

  it('leaves the Krebs shape alone: ring plus spurs is not a wheel', () => {
    const { hub, order } = circularLayout(
      [...spokes, 'In', 'Out'].map((id) => box(id)),
      [...cycle(...spokes), edge('In', 'A'), edge('C', 'Out')]
    );
    expect(hub).toBeUndefined();
    expect(new Set(order)).toEqual(new Set(spokes));
  });

  it("honors hub: 'none' and an explicit hub id", () => {
    const off = circularLayout(starNodes, starEdges, { hub: 'none' });
    expect(off.hub).toBeUndefined();

    const forced = circularLayout(
      ['A', 'B', 'C'].map((id) => box(id)),
      [edge('A', 'B'), edge('B', 'C')],
      { hub: 'B' }
    );
    expect(forced.hub).toBe('B');
    const b = forced.nodes.find((n) => n.id === 'B')!;
    expect(Math.hypot(b.x, b.y)).toBeCloseTo(0, 6);
  });

  it('hangs deeper branches of a star outward, beyond the ring', () => {
    const { nodes, radius, hub } = circularLayout(
      ['Hub', ...spokes, 'Leaf'].map((id) => box(id)),
      [...starEdges, edge('B', 'Leaf')]
    );
    expect(hub).toBe('Hub');
    const leaf = nodes.find((n) => n.id === 'Leaf')!;
    expect(Math.hypot(leaf.x, leaf.y)).toBeGreaterThan(radius);
  });

  it('keeps the hub pinned at the origin through the ccw mirror', () => {
    const { nodes, hub } = circularLayout(starNodes, starEdges, {
      direction: 'counterclockwise',
    });
    expect(hub).toBe('Hub');
    const center = nodes.find((n) => n.id === 'Hub')!;
    expect(center.x).toBeCloseTo(0, 6);
    expect(center.y).toBeCloseTo(0, 6);
  });
});

describe('subgraph contiguity', () => {
  const ids = ['A', 'B', 'C', 'D', 'E'];
  const grouped = (id: string, group?: string): LayoutNodeInput => ({ ...box(id), group });

  const adjacentInOrder = (order: string[], a: string, b: string) => {
    const i = order.indexOf(a);
    const j = order.indexOf(b);
    const gap = Math.abs(i - j);
    return Math.min(gap, order.length - gap) === 1;
  };

  it('seats a subgraph side by side even when the cycle scatters its members', () => {
    const { order } = circularLayout(
      ids.map((id) => grouped(id, id === 'B' || id === 'D' ? 'g' : undefined)),
      cycle(...ids)
    );
    expect(adjacentInOrder(order, 'B', 'D'), order.join(',')).toBe(true);
  });

  it('costs nothing when the members already sit together', () => {
    const plain = circularLayout(ids.map((id) => box(id)), cycle(...ids));
    const boxed = circularLayout(
      ids.map((id) => grouped(id, id === 'B' || id === 'C' ? 'g' : undefined)),
      cycle(...ids)
    );
    expect(adjacentInOrder(boxed.order, 'B', 'C')).toBe(true);
    // Every cycle edge still joins rim neighbors, exactly as ungrouped.
    for (const e of cycle(...ids)) {
      expect(adjacentInOrder(boxed.order, e.start, e.end), e.id).toBe(true);
    }
    expect(new Set(boxed.order)).toEqual(new Set(plain.order));
  });

  it('keeps the run reading forward through the group', () => {
    // Group C,D in a five-cycle: entry from B must land on C, so the
    // written run B → C → D → E survives as rim neighbors.
    const { order } = circularLayout(
      ids.map((id) => grouped(id, id === 'C' || id === 'D' ? 'g' : undefined)),
      cycle(...ids)
    );
    for (const e of cycle(...ids)) {
      expect(adjacentInOrder(order, e.start, e.end), e.id).toBe(true);
    }
  });

  it('widens the ring to make room for the box walls', () => {
    const plain = circularLayout(ids.map((id) => box(id)), cycle(...ids));
    const boxed = circularLayout(
      ids.map((id) => grouped(id, id === 'B' || id === 'C' ? 'g' : undefined)),
      cycle(...ids)
    );
    expect(boxed.radius).toBeGreaterThan(plain.radius);
  });

  it('groups ride into satellites untouched', () => {
    const { satellites, order } = circularLayout(
      [...ids, 'X', 'Y', 'Z'].map((id) =>
        grouped(id, ['X', 'Y', 'Z'].includes(id) ? 'sat' : undefined)
      ),
      [...cycle(...ids), edge('C', 'X'), ...cycle('X', 'Y', 'Z')]
    );
    expect(new Set(order)).toEqual(new Set(ids));
    expect(satellites).toHaveLength(1);
    expect(new Set(satellites![0]!.members)).toEqual(new Set(['X', 'Y', 'Z']));
  });
});

describe('satellite rings', () => {
  const ring = ['A', 'B', 'C', 'D', 'E'];
  const bridge = {
    nodes: [...ring, 'X', 'Y', 'Z'].map((id) => box(id)),
    edges: [...cycle(...ring), edge('C', 'X'), ...cycle('X', 'Y', 'Z')],
  };
  const eight = {
    nodes: [...ring, 'X', 'Y'].map((id) => box(id)),
    edges: [...cycle(...ring), edge('C', 'X'), edge('X', 'Y'), edge('Y', 'C')],
  };

  it('keeps the main cycle a true ring when a pendant cycle hangs off a bridge', () => {
    const { nodes, radius, order, satellites } = circularLayout(bridge.nodes, bridge.edges);
    expect(new Set(order)).toEqual(new Set(ring));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const id of ring) {
      expect(Math.hypot(byId.get(id)!.x, byId.get(id)!.y), id).toBeCloseTo(radius, 6);
    }
    expect(satellites).toHaveLength(1);
    expect(satellites![0]!.anchor).toBe('C');
    expect(new Set(satellites![0]!.members)).toEqual(new Set(['X', 'Y', 'Z']));
  });

  it('draws the pendant as its own circle, wholly outside the main ring', () => {
    const { nodes, radius, satellites } = circularLayout(bridge.nodes, bridge.edges);
    const sat = satellites![0]!;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const id of ['X', 'Y', 'Z']) {
      const n = byId.get(id)!;
      expect(dist(n, sat.center), `${id} on satellite circle`).toBeCloseTo(sat.radius, 4);
      expect(Math.hypot(n.x, n.y), `${id} outside main ring`).toBeGreaterThan(radius);
    }
  });

  it('meets the figure-eight at the shared node: both circles pass exactly through C', () => {
    const { nodes, radius, satellites } = circularLayout(eight.nodes, eight.edges);
    expect(satellites).toHaveLength(1);
    const sat = satellites![0]!;
    expect(sat.anchor).toBe('C');
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const c = byId.get('C')!;
    expect(Math.hypot(c.x, c.y)).toBeCloseTo(radius, 6);
    expect(dist(c, sat.center)).toBeCloseTo(sat.radius, 4);
    for (const id of ['X', 'Y']) {
      const n = byId.get(id)!;
      expect(dist(n, sat.center), id).toBeCloseTo(sat.radius, 4);
      expect(Math.hypot(n.x, n.y), id).toBeGreaterThan(radius);
    }
    // Tangency: the satellite's center lies on the ray from the origin
    // through C, one satellite-radius beyond the rim.
    const cross = c.x * sat.center.y - c.y * sat.center.x;
    expect(Math.abs(cross) / (radius * Math.hypot(sat.center.x, sat.center.y))).toBeLessThan(1e-4);
    expect(Math.hypot(sat.center.x, sat.center.y)).toBeCloseTo(radius + sat.radius, 4);
  });

  it('gives the middle to the bigger cycle, whatever the writing order', () => {
    const { order, satellites } = circularLayout(
      bridge.nodes,
      [...cycle('X', 'Y', 'Z'), edge('C', 'X'), ...cycle(...ring)]
    );
    expect(new Set(order)).toEqual(new Set(ring));
    expect(satellites![0]!.anchor).toBe('C');
  });

  it('reaches a circle off a circle off a circle', () => {
    const ids = [...ring, 'X', 'Y', 'Z', 'U', 'V', 'W'];
    const { nodes, satellites } = circularLayout(
      ids.map((id) => box(id)),
      [
        ...cycle(...ring),
        edge('C', 'X'),
        ...cycle('X', 'Y', 'Z'),
        edge('Z', 'U'),
        ...cycle('U', 'V', 'W'),
      ]
    );
    expect(satellites).toHaveLength(2);
    const byAnchor = new Map(satellites!.map((s) => [s.anchor, s]));
    expect(new Set(byAnchor.get('C')!.members)).toEqual(new Set(['X', 'Y', 'Z']));
    expect(new Set(byAnchor.get('Z')!.members)).toEqual(new Set(['U', 'V', 'W']));
    const inner = byAnchor.get('C')!.center;
    const outer = byAnchor.get('Z')!.center;
    expect(Math.hypot(outer.x, outer.y)).toBeGreaterThan(Math.hypot(inner.x, inner.y));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const id of ['U', 'V', 'W']) {
      const n = byId.get(id)!;
      expect(dist(n, outer), id).toBeCloseTo(byAnchor.get('Z')!.radius, 4);
    }
  });

  it('never lets any two boxes collide, ring and satellites together', () => {
    for (const graph of [bridge, eight]) {
      const { nodes } = circularLayout(graph.nodes, graph.edges);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const p = nodes[i]!;
          const q = nodes[j]!;
          const overlap = Math.abs(p.x - q.x) < 80 && Math.abs(p.y - q.y) < 40;
          expect(overlap, `${p.id} overlaps ${q.id}`).toBe(false);
        }
      }
    }
  });

  it('mirrors satellites along with everything else under ccw', () => {
    const cw = circularLayout(eight.nodes, eight.edges);
    const ccw = circularLayout(eight.nodes, eight.edges, { direction: 'counterclockwise' });
    const sat = ccw.satellites![0]!;
    expect(sat.center.x).toBeCloseTo(-cw.satellites![0]!.center.x, 4);
    expect(sat.center.y).toBeCloseTo(cw.satellites![0]!.center.y, 4);
    const byId = new Map(ccw.nodes.map((n) => [n.id, n]));
    for (const id of ['X', 'Y']) {
      expect(dist(byId.get(id)!, sat.center), id).toBeCloseTo(sat.radius, 4);
    }
  });

  it('lands every arrow on a border, satellite arcs included', () => {
    const onBorder = (p: { x: number; y: number }, n: { x: number; y: number }) => {
      const dx = Math.abs(p.x - n.x);
      const dy = Math.abs(p.y - n.y);
      const eps = 1e-6;
      return (
        (Math.abs(dx - 40) < eps && dy <= 20 + eps) ||
        (Math.abs(dy - 20) < eps && dx <= 40 + eps)
      );
    };
    for (const graph of [bridge, eight]) {
      const { nodes, edges: routed } = circularLayout(graph.nodes, graph.edges);
      const byId = new Map(nodes.map((n) => [n.id, n]));
      for (const e of routed) {
        const first = e.points[0]!;
        const last = e.points[e.points.length - 1]!;
        expect(onBorder(first, byId.get(e.start)!), `${e.id} start`).toBe(true);
        expect(onBorder(last, byId.get(e.end)!), `${e.id} end`).toBe(true);
      }
    }
  });

  describe('gear flow', () => {
    // The signed short-way step of a directed edge about a center:
    // positive reads clockwise on screen, negative counter-clockwise.
    const stepSign = (
      center: { x: number; y: number },
      from: { x: number; y: number },
      to: { x: number; y: number }
    ) => {
      let delta =
        Math.atan2(to.y - center.y, to.x - center.x) -
        Math.atan2(from.y - center.y, from.x - center.x);
      while (delta > Math.PI) {
        delta -= 2 * Math.PI;
      }
      while (delta < -Math.PI) {
        delta += 2 * Math.PI;
      }
      return Math.sign(delta);
    };

    it('spins a figure-eight satellite against its main ring, like meshing gears', () => {
      const { nodes, satellites } = circularLayout(eight.nodes, eight.edges);
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const origin = { x: 0, y: 0 };
      const mainSpin = stepSign(origin, byId.get('A')!, byId.get('B')!);
      const satSpin = stepSign(satellites![0]!.center, byId.get('C')!, byId.get('X')!);
      expect(mainSpin).not.toBe(0);
      expect(satSpin).toBe(-mainSpin);
    });

    it('keeps the opposition through the ccw mirror', () => {
      const { nodes, satellites } = circularLayout(eight.nodes, eight.edges, {
        direction: 'counterclockwise',
      });
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const mainSpin = stepSign({ x: 0, y: 0 }, byId.get('A')!, byId.get('B')!);
      const satSpin = stepSign(satellites![0]!.center, byId.get('C')!, byId.get('X')!);
      expect(satSpin).toBe(-mainSpin);
    });

    it('alternates through a chain of three meshing loops', () => {
      const ids = ['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'C1', 'C2'];
      const { nodes, satellites } = circularLayout(
        ids.map((id) => box(id)),
        [
          ...cycle('A1', 'A2', 'A3', 'A4', 'A5'),
          edge('A2', 'B1'),
          edge('B1', 'B2'),
          edge('B2', 'A2'),
          edge('B1', 'C1'),
          edge('C1', 'C2'),
          edge('C2', 'B1'),
        ]
      );
      expect(satellites).toHaveLength(2);
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const first = satellites!.find((s) => s.anchor === 'A2')!;
      const second = satellites!.find((s) => s.anchor === 'B1')!;
      const mainSpin = stepSign({ x: 0, y: 0 }, byId.get('A1')!, byId.get('A2')!);
      const firstSpin = stepSign(first.center, byId.get('A2')!, byId.get('B1')!);
      const secondSpin = stepSign(second.center, byId.get('B1')!, byId.get('C1')!);
      expect(firstSpin).toBe(-mainSpin);
      expect(secondSpin).toBe(mainSpin);
    });

    it('leaves a bridge satellite spinning with its parent — a shaft, not a tooth', () => {
      const { nodes, satellites } = circularLayout(bridge.nodes, bridge.edges);
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const mainSpin = stepSign({ x: 0, y: 0 }, byId.get('A')!, byId.get('B')!);
      const satSpin = stepSign(satellites![0]!.center, byId.get('X')!, byId.get('Y')!);
      expect(satSpin).toBe(mainSpin);
    });
  });

  describe('satellite claims', () => {
    const gears = {
      nodes: ['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'C1', 'C2'].map((id) => box(id)),
      edges: [
        ...cycle('A1', 'A2', 'A3', 'A4', 'A5'),
        edge('A2', 'B1'),
        edge('B1', 'B2'),
        edge('B2', 'A2'),
        edge('B1', 'C1'),
        edge('C1', 'C2'),
        edge('C2', 'B1'),
      ],
    };

    it('a meshed gear train no longer starves the big ring of its evenness', () => {
      const { nodes, order } = circularLayout(gears.nodes, gears.edges);
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const angles = order.map((id) => {
        const n = byId.get(id)!;
        return Math.atan2(n.y, n.x);
      });
      const gaps = angles.map((a, i) => {
        let d = angles[(i + 1) % angles.length]! - a;
        while (d <= 0) {
          d += 2 * Math.PI;
        }
        while (d > 2 * Math.PI) {
          d -= 2 * Math.PI;
        }
        return d;
      });
      const ratio = Math.max(...gaps) / Math.min(...gaps);
      // A satellite touches the ring; it does not sit on it. Equal
      // boxes should keep near-equal gaps — the anchor's may breathe
      // a little, not swallow the circle.
      expect(ratio, gaps.map((g) => g.toFixed(2)).join(',')).toBeLessThan(1.25);
    });

    it('still keeps every box clear of every other, gears included', () => {
      const { nodes } = circularLayout(gears.nodes, gears.edges);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const p = nodes[i]!;
          const q = nodes[j]!;
          const overlap = Math.abs(p.x - q.x) < 80 && Math.abs(p.y - q.y) < 40;
          expect(overlap, `${p.id} overlaps ${q.id}`).toBe(false);
        }
      }
    });
  });

  it('leaves single-cycle graphs without satellites', () => {
    const plain = circularLayout(
      ring.map((id) => box(id)),
      cycle(...ring)
    );
    expect(plain.satellites ?? []).toHaveLength(0);
  });
});

describe('direction', () => {
  const ids = ['A', 'B', 'C', 'D', 'E'];
  const sized = [box('A', 200, 60), box('B', 40, 40), box('C', 120, 50), box('D', 40, 40), box('E', 90, 45)];

  it('is the exact mirror of the clockwise layout across the vertical axis', () => {
    const cw = circularLayout(sized, cycle(...ids));
    const ccw = circularLayout(sized, cycle(...ids), { direction: 'counterclockwise' });
    const cwById = new Map(cw.nodes.map((n) => [n.id, n]));
    for (const n of ccw.nodes) {
      const twin = cwById.get(n.id)!;
      expect(n.x, `${n.id} x`).toBeCloseTo(-twin.x, 6);
      expect(n.y, `${n.id} y`).toBeCloseTo(twin.y, 6);
    }
    const cwEdges = new Map(cw.edges.map((e) => [e.id, e]));
    for (const e of ccw.edges) {
      const twin = cwEdges.get(e.id)!;
      expect(e.points.length).toBe(twin.points.length);
      for (const [i, p] of e.points.entries()) {
        expect(p.x, `${e.id} point ${i} x`).toBeCloseTo(-twin.points[i]!.x, 6);
        expect(p.y, `${e.id} point ${i} y`).toBeCloseTo(twin.points[i]!.y, 6);
      }
    }
  });

  it('sends the walk leftward from the top: the successor sits on the left', () => {
    const { nodes, order } = circularLayout(
      ids.map((id) => box(id)),
      cycle(...ids),
      { direction: 'counterclockwise' }
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const top = byId.get(order[0]!)!;
    expect(top.x).toBeCloseTo(0, 6);
    expect(top.y).toBeLessThan(0);
    expect(byId.get(order[1]!)!.x).toBeLessThan(0);
    expect(byId.get(order[order.length - 1]!)!.x).toBeGreaterThan(0);
  });

  it('keeps a lone node centered, its angle untouched by the mirror', () => {
    const { nodes } = circularLayout([box('A')], [], { direction: 'counterclockwise' });
    expect(nodes[0]!.x).toBeCloseTo(0, 6);
    expect(nodes[0]!.y).toBeCloseTo(0, 6);
    expect(nodes[0]!.angle).toBeCloseTo(0, 6);
  });
});

describe('degenerate graphs', () => {
  it('draws a self-loop on a lone node as a petal, not a point', () => {
    const { edges } = circularLayout([box('A')], [edge('A', 'A')]);
    const loop = edges[0]!;
    expect(loop.points.length).toBeGreaterThanOrEqual(5);
    const apex = Math.max(...loop.points.map((p) => Math.hypot(p.x, p.y)));
    expect(apex).toBeGreaterThan(Math.hypot(40, 20));
  });

  it('separates same-direction duplicate edges between two nodes', () => {
    const { edges } = circularLayout(
      [box('A'), box('B')],
      [edge('A', 'B'), { id: 'again', start: 'A', end: 'B' }]
    );
    const midOf = (e: (typeof edges)[number]) => e.points[Math.floor(e.points.length / 2)]!;
    const [a, b] = edges.map(midOf);
    expect(dist(a!, b!)).toBeGreaterThan(8);
  });

  it('never doubles back: every segment advances along the path', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const { edges } = circularLayout(
      ids.map((id) => box(id)),
      [...cycle(...ids), edge('A', 'C'), edge('B', 'D'), edge('A', 'E')],
      { bow: 0.8 }
    );
    for (const e of edges) {
      for (let i = 2; i < e.points.length; i++) {
        const prev = {
          x: e.points[i - 1]!.x - e.points[i - 2]!.x,
          y: e.points[i - 1]!.y - e.points[i - 2]!.y,
        };
        const here = {
          x: e.points[i]!.x - e.points[i - 1]!.x,
          y: e.points[i]!.y - e.points[i - 1]!.y,
        };
        const dot = prev.x * here.x + prev.y * here.y;
        // A real double-back is strongly negative (segments are ~10px,
        // so reversal reads in the hundreds); -1 tolerates the
        // sub-pixel sagitta where a straight tail rejoins its arc.
        expect(dot, `${e.id} reverses at point ${i}`).toBeGreaterThan(-1);
      }
    }
  });
});

describe('ordering', () => {
  it('follows edges so cycle neighbors sit beside each other, whatever the input order', () => {
    const { order } = circularLayout(
      ['A', 'C', 'E', 'B', 'D'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D', 'E')
    );
    const pos = new Map(order.map((id, i) => [id, i]));
    const n = order.length;
    for (const e of cycle('A', 'B', 'C', 'D', 'E')) {
      const gap = Math.abs(pos.get(e.start)! - pos.get(e.end)!);
      expect(Math.min(gap, n - gap)).toBe(1);
    }
  });

  it('saves a chord for last — declaration continuity from the best start', () => {
    const { order } = circularLayout(
      ['A', 'C', 'B', 'D', 'E'].map((id) => box(id)),
      [edge('A', 'C'), ...cycle('A', 'B', 'C', 'D', 'E')]
    );
    const pos = new Map(order.map((id, i) => [id, i]));
    const n = order.length;
    for (const e of cycle('A', 'B', 'C', 'D', 'E')) {
      const gap = Math.abs(pos.get(e.start)! - pos.get(e.end)!);
      expect(Math.min(gap, n - gap)).toBe(1);
    }
  });

  it('honors input order when asked', () => {
    const { order } = circularLayout(
      ['A', 'C', 'E', 'B', 'D'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D', 'E'),
      { ordering: 'input' }
    );
    expect(order).toEqual(['A', 'C', 'E', 'B', 'D']);
  });
});

describe('edge routing', () => {
  const onBorder = (p: { x: number; y: number }, n: { x: number; y: number }, w: number, h: number) => {
    const dx = Math.abs(p.x - n.x);
    const dy = Math.abs(p.y - n.y);
    const eps = 1e-6;
    const onVertical = Math.abs(dx - w / 2) < eps && dy <= h / 2 + eps;
    const onHorizontal = Math.abs(dy - h / 2) < eps && dx <= w / 2 + eps;
    return onVertical || onHorizontal;
  };

  it('starts and ends every path on the node border, never at the center', () => {
    const { edges, nodes } = circularLayout(
      ['A', 'B', 'C', 'D', 'E'].map((id) => box(id)),
      [...cycle('A', 'B', 'C', 'D', 'E'), edge('A', 'C'), edge('A', 'A')]
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const e of edges) {
      const first = e.points[0]!;
      const last = e.points[e.points.length - 1]!;
      expect(onBorder(first, byId.get(e.start)!, 80, 40)).toBe(true);
      expect(onBorder(last, byId.get(e.end)!, 80, 40)).toBe(true);
    }
  });

  it('draws every neighbor edge as a true arc of the one circle', () => {
    const { edges, radius } = circularLayout(
      ['A', 'B', 'C', 'D', 'E'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D', 'E')
    );
    for (const e of edges) {
      expect(e.onRim).toBe(true);
      // Every point of the path — endpoints included — lies on the
      // rim (the straight 10px marker tails may sit tail²/2R off it,
      // under a pixel at any plausible radius): the eye reads one
      // circle.
      for (const p of e.points) {
        expect(Math.abs(Math.hypot(p.x, p.y) - radius)).toBeLessThan(0.8);
      }
    }
  });

  it('starts an arc exactly where the circle leaves the source box', () => {
    const { edges, nodes, radius } = circularLayout(
      ['A', 'B', 'C', 'D', 'E'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D', 'E')
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const onBorderOf = (p: { x: number; y: number }, id: string) => {
      const n = byId.get(id)!;
      const dx = Math.abs(p.x - n.x);
      const dy = Math.abs(p.y - n.y);
      const eps = 0.01;
      return (
        (Math.abs(dx - 40) < eps && dy <= 20 + eps) ||
        (Math.abs(dy - 20) < eps && dx <= 40 + eps)
      );
    };
    for (const e of edges) {
      const first = e.points[0]!;
      const last = e.points[e.points.length - 1]!;
      expect(onBorderOf(first, e.start), `${e.id} start`).toBe(true);
      expect(onBorderOf(last, e.end), `${e.id} end`).toBe(true);
      expect(Math.hypot(first.x, first.y)).toBeCloseTo(radius, 4);
      expect(Math.hypot(last.x, last.y)).toBeCloseTo(radius, 4);
    }
  });

  it('never wanders inside a node box on its way', () => {
    const wide = ['A', 'B', 'C', 'D', 'E'].map((id) => box(id, 180, 60));
    const { edges, nodes } = circularLayout(wide, [
      ...cycle('A', 'B', 'C', 'D', 'E'),
      edge('B', 'E'),
    ]);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const e of edges) {
      for (const p of e.points.slice(1, -1)) {
        for (const n of nodes) {
          const owner = byId.get(n.id)!;
          const inside =
            Math.abs(p.x - owner.x) < 180 / 2 - 0.5 && Math.abs(p.y - owner.y) < 60 / 2 - 0.5;
          expect(inside, `edge ${e.id} point inside ${n.id}`).toBe(false);
        }
      }
    }
  });

  it('takes the short way: a neighbor path is barely longer than its chord', () => {
    const { edges, nodes } = circularLayout(
      ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D', 'E', 'F')
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const e of edges) {
      const a = byId.get(e.start)!;
      const b = byId.get(e.end)!;
      const straight = dist(a, b);
      let length = 0;
      for (let i = 1; i < e.points.length; i++) {
        length += dist(e.points[i - 1]!, e.points[i]!);
      }
      expect(length).toBeLessThan(straight * 1.5);
    }
  });

  it('lands the arrow flush: the final segment points into the border it meets', () => {
    const { edges, nodes } = circularLayout(
      ['A', 'B', 'C', 'D', 'E'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D', 'E')
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const e of edges) {
      const last = e.points[e.points.length - 1]!;
      const prev = e.points[e.points.length - 2]!;
      const target = byId.get(e.end)!;
      // Walking the final segment direction from the endpoint must
      // enter the box, not skim along its border.
      const dir = { x: last.x - prev.x, y: last.y - prev.y };
      const len = Math.hypot(dir.x, dir.y);
      const probe = { x: last.x + (dir.x / len) * 3, y: last.y + (dir.y / len) * 3 };
      const inside =
        Math.abs(probe.x - target.x) < 80 / 2 && Math.abs(probe.y - target.y) < 40 / 2;
      expect(inside, `edge ${e.id} arrow does not enter its target`).toBe(true);
    }
  });

  it('bows a non-neighbor chord toward the middle, off the rim', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const { edges, radius } = circularLayout(
      ids.map((id) => box(id)),
      [...cycle(...ids), edge('A', 'C')]
    );
    const chord = edges.find((e) => e.id === 'A-C')!;
    const mid = chord.points[Math.floor(chord.points.length / 2)]!;
    expect(Math.hypot(mid.x, mid.y)).toBeLessThan(radius * 0.9);
  });

  it('swerves a diameter off the center, and mirrored directions swerve apart', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const { edges, radius } = circularLayout(
      ids.map((id) => box(id)),
      [...cycle(...ids), edge('A', 'D'), { id: 'D-A', start: 'D', end: 'A' }],
      { swerve: 0.25 }
    );
    const midPoint = (e: (typeof edges)[number]) => e.points[Math.floor(e.points.length / 2)]!;
    const there = midPoint(edges.find((e) => e.id === 'A-D')!);
    const back = midPoint(edges.find((e) => e.id === 'D-A')!);
    expect(Math.hypot(there.x, there.y)).toBeGreaterThan(radius * 0.05);
    expect(Math.hypot(back.x, back.y)).toBeGreaterThan(radius * 0.05);
    expect(there.x * back.x + there.y * back.y).toBeLessThan(0);
  });

  it('draws a self-loop as a petal outside the rim, anchored on its node border', () => {
    const { edges, nodes, radius } = circularLayout(
      ['A', 'B', 'C'].map((id) => box(id)),
      [...cycle('A', 'B', 'C'), edge('A', 'A')]
    );
    const loop = edges.find((e) => e.id === 'A-A')!;
    const a = nodes.find((n) => n.id === 'A')!;
    expect(loop.points.length).toBeGreaterThanOrEqual(5);
    expect(dist(loop.points[0]!, a)).toBeLessThanOrEqual(Math.hypot(40, 20) + 1e-6);
    const apex = Math.max(...loop.points.map((p) => Math.hypot(p.x, p.y)));
    expect(apex).toBeGreaterThan(radius * 1.05);
  });

  it('fans out parallel and opposite edges so they never overlap', () => {
    const ids = ['A', 'B', 'C', 'D'];
    const { edges } = circularLayout(
      ids.map((id) => box(id)),
      [...cycle(...ids), { id: 'back', start: 'B', end: 'A' }]
    );
    const midOf = (e: (typeof edges)[number]) => e.points[Math.floor(e.points.length / 2)]!;
    const there = midOf(edges.find((e) => e.id === 'A-B')!);
    const back = midOf(edges.find((e) => e.id === 'back')!);
    expect(dist(there, back)).toBeGreaterThan(8);
  });

  it('mirrors the two-node pair into a lens, one arc each side, same size', () => {
    const { edges } = circularLayout(
      [box('Ping'), box('Pong')],
      [edge('Ping', 'Pong'), edge('Pong', 'Ping')]
    );
    const midOf = (e: (typeof edges)[number]) => e.points[Math.floor(e.points.length / 2)]!;
    const [a, b] = edges.map(midOf);
    expect(Math.sign(a!.x)).not.toBe(Math.sign(b!.x));
    // The lens is symmetric: both arcs the same distance out.
    expect(Math.hypot(a!.x, a!.y)).toBeCloseTo(Math.hypot(b!.x, b!.y), 4);
  });

  it('gives every path a straight terminal tail longer than mermaid marker meddling', () => {
    const ids = ['A', 'B', 'C', 'D', 'E'];
    const { edges } = circularLayout(
      ids.map((id) => box(id)),
      [...cycle(...ids), edge('A', 'C'), edge('A', 'A')]
    );
    for (const e of edges) {
      const last = e.points[e.points.length - 1]!;
      const prev = e.points[e.points.length - 2]!;
      const first = e.points[0]!;
      const second = e.points[1]!;
      // mermaid displaces points within ~5px of the ends; the
      // terminal segments must outreach that window or the marker
      // orients along a kink.
      expect(dist(last, prev), `${e.id} end tail`).toBeGreaterThan(6);
      expect(dist(first, second), `${e.id} start tail`).toBeGreaterThan(6);
    }
  });

  it("aligns the arrowhead's line of symmetry with the arc's true tangent", () => {
    const { edges, radius } = circularLayout(
      ['A', 'B', 'C', 'D', 'E'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D', 'E')
    );
    for (const e of edges) {
      const last = e.points[e.points.length - 1]!;
      const prev = e.points[e.points.length - 2]!;
      const segAngle = Math.atan2(last.y - prev.y, last.x - prev.x);
      // Rim tangent at the endpoint, clockwise travel.
      const tangent = Math.atan2(last.x, -last.y);
      let diff = Math.abs(segAngle - tangent) % (2 * Math.PI);
      diff = Math.min(diff, 2 * Math.PI - diff);
      expect(diff, `${e.id} marker angle off tangent by ${(diff * 180) / Math.PI}°`).toBeLessThan(
        (1.5 * Math.PI) / 180
      );
      expect(Math.hypot(last.x, last.y)).toBeCloseTo(radius, 4);
    }
  });
});
