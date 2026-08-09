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

const TAU = 2 * Math.PI;

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

  it('spaces nodes at equal angles — the regular polygon a designer would draw', () => {
    const { nodes, order } = circularLayout(
      [box('A', 200, 60), box('B', 40, 40), box('C', 120, 50), box('D', 40, 40), box('E', 90, 45)],
      cycle('A', 'B', 'C', 'D', 'E')
    );
    const angleOf = new Map(nodes.map((n) => [n.id, n.angle]));
    const step = TAU / order.length;
    for (let i = 0; i < order.length; i++) {
      const here = angleOf.get(order[i]!)!;
      const next = angleOf.get(order[(i + 1) % order.length]!)!;
      const gap = (((next - here) % TAU) + TAU) % TAU;
      expect(gap).toBeCloseTo(step, 6);
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

  it('keeps adjacent nodes at least their footprint plus spacing apart', () => {
    const spacing = 30;
    const nodes = [box('A', 200, 60), box('B', 40, 40), box('C', 120, 50), box('D', 40, 40)];
    const { nodes: placed, order } = circularLayout(nodes, cycle('A', 'B', 'C', 'D'), {
      spacing,
    });
    const byId = new Map(placed.map((n) => [n.id, n]));
    const sizes = new Map(nodes.map((n) => [n.id, Math.hypot(n.width, n.height) / 2]));
    for (let i = 0; i < order.length; i++) {
      const here = order[i]!;
      const next = order[(i + 1) % order.length]!;
      const need = sizes.get(here)! + sizes.get(next)! + spacing;
      expect(dist(byId.get(here)!, byId.get(next)!)).toBeGreaterThanOrEqual(need - 1e-6);
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

  it('sends a neighbor edge through the middle of the gap, hugging the ring', () => {
    const { edges, nodes, radius } = circularLayout(
      ['A', 'B', 'C', 'D', 'E'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D', 'E')
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const e of edges) {
      expect(e.onRim).toBe(true);
      const mid = e.points[Math.floor(e.points.length / 2)]!;
      // The curve's waist stays in the ring's band — near the rim,
      // never sagging far inside nor ballooning outside…
      const r = Math.hypot(mid.x, mid.y);
      expect(r).toBeGreaterThan(radius * 0.8);
      expect(r).toBeLessThan(radius * 1.02);
      // …and sits at the half-angle between the two nodes.
      const a = byId.get(e.start)!;
      const b = byId.get(e.end)!;
      const midAngle = Math.atan2(mid.y, mid.x);
      const expected = Math.atan2((a.y + b.y) / 2, (a.x + b.x) / 2);
      expect(Math.abs(midAngle - expected)).toBeLessThan(0.02);
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

  it('mirrors the two-node pair into a lens, one arc each side', () => {
    const { edges } = circularLayout(
      [box('Ping'), box('Pong')],
      [edge('Ping', 'Pong'), edge('Pong', 'Ping')]
    );
    const midOf = (e: (typeof edges)[number]) => e.points[Math.floor(e.points.length / 2)]!;
    const [a, b] = edges.map(midOf);
    expect(Math.sign(a!.x)).not.toBe(Math.sign(b!.x));
  });
});
