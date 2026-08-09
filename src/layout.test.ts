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

describe('uniform gaps', () => {
  it('equalizes the open air between silhouettes — the daylight the eye reads as the arrow', () => {
    // The water-cycle shape that showed a stubby bottom arrow. Arc
    // length between border crossings lied: an arc can travel hidden
    // beneath a box on its way past a corner. What must come out
    // equal is the angular gap between the boxes' corner silhouettes.
    for (const ids of [
      ['A', 'B', 'C', 'D', 'E'],
      ['A', 'B', 'C'],
    ]) {
      const { nodes, order, radius } = circularLayout(
        ids.map((id) => box(id, 150, 50)),
        cycle(...ids)
      );
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const extentOf = (id: string): { lo: number; hi: number } => {
        const n = byId.get(id)!;
        let lo = 0;
        let hi = 0;
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            const corner = { x: n.x + (sx * 150) / 2, y: n.y + (sy * 50) / 2 };
            let offset = Math.atan2(corner.y, corner.x) - n.angle;
            offset = ((((offset + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
            lo = Math.min(lo, offset);
            hi = Math.max(hi, offset);
          }
        }
        return { lo: n.angle + lo, hi: n.angle + hi };
      };
      const gaps: number[] = [];
      for (let i = 0; i < order.length; i++) {
        const here = extentOf(order[i]!);
        const next = extentOf(order[(i + 1) % order.length]!);
        let daylight = next.lo - here.hi;
        while (daylight <= -Math.PI) {
          daylight += 2 * Math.PI;
        }
        gaps.push(daylight * radius);
      }
      const widest = Math.max(...gaps);
      const slimmest = Math.min(...gaps);
      expect(slimmest, `gaps ${gaps.map((g) => g.toFixed(0)).join(', ')}`).toBeGreaterThan(0);
      expect(widest / slimmest, `gaps ${gaps.map((g) => g.toFixed(0)).join(', ')}`).toBeLessThan(1.15);
    }
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

  it('keeps the whole arrowhead triangle outside the target box, not just its tip', () => {
    // The marker is ~11px long and ~5px to each side of the path;
    // a shallow entry near a box corner can put a flank inside the
    // box while the tip sits exactly on the border.
    const cases = [
      ['A', 'B', 'C', 'D', 'E'].map((id) => box(id, 150, 50)),
      ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => box(id, 120, 40)),
    ];
    for (const nodes of cases) {
      const ids = nodes.map((n) => n.id);
      const { edges, nodes: placed } = circularLayout(nodes, cycle(...ids));
      const byId = new Map(placed.map((n) => [n.id, n]));
      const sizeOf = new Map(nodes.map((n) => [n.id, n]));
      for (const e of edges) {
        const tip = e.points[e.points.length - 1]!;
        const prev = e.points[e.points.length - 2]!;
        const len = Math.hypot(tip.x - prev.x, tip.y - prev.y) || 1;
        const dir = { x: (tip.x - prev.x) / len, y: (tip.y - prev.y) / len };
        const perp = { x: -dir.y, y: dir.x };
        const target = byId.get(e.end)!;
        const size = sizeOf.get(e.end)!;
        for (const sign of [-1, 1]) {
          const corner = {
            x: tip.x - dir.x * 11 + perp.x * 5 * sign,
            y: tip.y - dir.y * 11 + perp.y * 5 * sign,
          };
          const inside =
            Math.abs(corner.x - target.x) < size.width / 2 - 0.25 &&
            Math.abs(corner.y - target.y) < size.height / 2 - 0.25;
          expect(inside, `${e.id} marker flank inside ${e.end}`).toBe(false);
        }
      }
    }
  });

  it("aligns the arrowhead's axis with the trajectory, curled no further than the border's normal", () => {
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
      // On the tangent when the marker clears; bent toward the
      // border's normal (at most a quarter turn) when it must curl
      // to keep its flanks out of the box.
      expect(diff, `${e.id} marker angle off tangent by ${(diff * 180) / Math.PI}°`).toBeLessThan(
        Math.PI / 2 + 0.04
      );
      expect(Math.hypot(last.x, last.y)).toBeCloseTo(radius, 4);
    }
  });
});
