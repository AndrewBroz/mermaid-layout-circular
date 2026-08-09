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

  it('starts at the top and steps clockwise', () => {
    const { nodes } = circularLayout(
      ['A', 'B', 'C', 'D'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D')
    );
    const a = nodes.find((n) => n.id === 'A')!;
    const b = nodes.find((n) => n.id === 'B')!;
    // A sits at the top (negative y in SVG coordinates), centered.
    expect(a.x).toBeCloseTo(0, 6);
    expect(a.y).toBeLessThan(0);
    // Clockwise in SVG space: the next node moves to the right.
    expect(b.x).toBeGreaterThan(0);
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
    // Written scrambled: A,C,E,B,D — the cycle is still A→B→C→D→E→A.
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

  it('saves a chord for last — the walk prefers the neighbor with fewer edges', () => {
    // The chord A→C is written first. A greedy walk that takes it
    // puts C beside A and turns two real cycle edges into chords.
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
  it('routes neighbor edges along the circle', () => {
    const { edges, radius } = circularLayout(
      ['A', 'B', 'C', 'D'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D')
    );
    for (const e of edges) {
      expect(e.points.length).toBeGreaterThanOrEqual(3);
      for (const p of e.points) {
        expect(Math.hypot(p.x, p.y)).toBeCloseTo(radius, 4);
      }
    }
  });

  it('sends the arc the short way round, never through the far side', () => {
    const { edges, nodes, radius } = circularLayout(
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
      // A short-way arc between neighbors on a hexagon is barely longer than
      // its chord; the long way round would be five times that.
      expect(length).toBeLessThan(straight * 1.5);
      expect(length).toBeGreaterThanOrEqual(straight - 1e-6);
      // The arc stays on the circle: radius never exceeded.
      for (const p of e.points) {
        expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(radius + 1e-6);
      }
    }
  });

  it('bows a non-neighbor edge inward, off the rim', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const { edges, radius } = circularLayout(
      ids.map((id) => box(id)),
      [...cycle(...ids), edge('A', 'D')]
    );
    const chord = edges.find((e) => e.id === 'A-D')!;
    const mid = chord.points[Math.floor(chord.points.length / 2)]!;
    expect(Math.hypot(mid.x, mid.y)).toBeLessThan(radius * 0.9);
  });

  it('draws a self-loop as a petal outside the rim, anchored on its node', () => {
    const { edges, nodes, radius } = circularLayout(
      ['A', 'B', 'C'].map((id) => box(id)),
      [...cycle('A', 'B', 'C'), edge('A', 'A')]
    );
    const loop = edges.find((e) => e.id === 'A-A')!;
    const a = nodes.find((n) => n.id === 'A')!;
    expect(loop.points.length).toBeGreaterThanOrEqual(5);
    expect(dist(loop.points[0]!, a)).toBeCloseTo(0, 6);
    expect(dist(loop.points[loop.points.length - 1]!, a)).toBeCloseTo(0, 6);
    const apex = Math.max(...loop.points.map((p) => Math.hypot(p.x, p.y)));
    expect(apex).toBeGreaterThan(radius * 1.05);
  });

  it('fans out parallel and opposite edges so they never overlap', () => {
    const ids = ['A', 'B', 'C', 'D'];
    const { edges } = circularLayout(
      ids.map((id) => box(id)),
      [...cycle(...ids), { id: 'back', start: 'B', end: 'A' }]
    );
    const there = edges.find((e) => e.id === 'A-B')!;
    const back = edges.find((e) => e.id === 'back')!;
    const midThere = there.points[Math.floor(there.points.length / 2)]!;
    const midBack = back.points[Math.floor(back.points.length / 2)]!;
    expect(dist(midThere, midBack)).toBeGreaterThan(8);
  });

  it('keeps endpoints at the node centers so mermaid can trim at the boundary', () => {
    const { edges, nodes } = circularLayout(
      ['A', 'B', 'C'].map((id) => box(id)),
      cycle('A', 'B', 'C')
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const e of edges) {
      const first = e.points[0]!;
      const last = e.points[e.points.length - 1]!;
      expect(dist(first, byId.get(e.start)!)).toBeCloseTo(0, 6);
      expect(dist(last, byId.get(e.end)!)).toBeCloseTo(0, 6);
    }
  });

  it('keeps every interior point outside both endpoint boxes — mermaid intersects with the point beside the center', () => {
    const wide = [box('A', 220, 60), box('B', 220, 60), box('C', 220, 60)];
    const { edges, nodes } = circularLayout(wide, cycle('A', 'B', 'C'));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const inside = (p: { x: number; y: number }, id: string, w: number, h: number) => {
      const n = byId.get(id)!;
      return Math.abs(p.x - n.x) < w / 2 && Math.abs(p.y - n.y) < h / 2;
    };
    for (const e of edges) {
      const interior = e.points.slice(1, -1);
      expect(interior.length).toBeGreaterThan(0);
      for (const p of interior) {
        expect(inside(p, e.start, 220, 60)).toBe(false);
        expect(inside(p, e.end, 220, 60)).toBe(false);
      }
    }
  });

  it('swerves a diameter off the center, and mirrored directions swerve apart', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const { edges, radius } = circularLayout(
      ids.map((id) => box(id)),
      [...cycle(...ids), edge('A', 'D'), { id: 'D-A', start: 'D', end: 'A' }],
      { swerve: 0.25 }
    );
    const midOf = (e: (typeof edges)[number]) => {
      const m = e.points[Math.floor(e.points.length / 2)]!;
      return Math.hypot(m.x, m.y);
    };
    const there = edges.find((e) => e.id === 'A-D')!;
    const back = edges.find((e) => e.id === 'D-A')!;
    // Off the center: a straight diameter's midpoint would sit at 0.
    expect(midOf(there)).toBeGreaterThan(radius * 0.05);
    expect(midOf(back)).toBeGreaterThan(radius * 0.05);
    // Left-of-travel is opposite sides for opposite directions.
    const mThere = there.points[Math.floor(there.points.length / 2)]!;
    const mBack = back.points[Math.floor(back.points.length / 2)]!;
    expect(mThere.x * mBack.x + mThere.y * mBack.y).toBeLessThan(0);
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
