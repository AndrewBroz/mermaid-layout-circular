import { afterEach, describe, expect, it } from 'vitest';
import { setCircularLayoutOptions } from './options.js';
import { bandPath, boxTitleAt, layoutGroupsFor, layoutOptionsFor } from './render.js';

// The placement math and its tests live in layout-circular. What is
// tested here is the mermaid seam: which options reach the math.

describe('layoutOptionsFor', () => {
  afterEach(() => setCircularLayoutOptions({}));

  it('asks for a 10px tail, past the reach of mermaid marker handling', () => {
    expect(layoutOptionsFor({})).toEqual({ tail: 10 });
  });

  it('seeds spacing from flowchart.nodeSpacing', () => {
    expect(layoutOptionsFor({ flowchart: { nodeSpacing: 70 } })).toEqual({
      tail: 10,
      spacing: 70,
    });
  });

  it('lets options set in code override what the seam derives', () => {
    setCircularLayoutOptions({ spacing: 40, tail: 12, parallelGap: 14 });
    expect(layoutOptionsFor({ flowchart: { nodeSpacing: 70 } })).toEqual({
      tail: 12,
      spacing: 40,
      parallelGap: 14,
    });
  });

  it('lets layout: circular-ccw outrank a direction set in code', () => {
    setCircularLayoutOptions({ direction: 'clockwise' });
    expect(layoutOptionsFor({}, 'circular-ccw').direction).toBe('counterclockwise');
    expect(layoutOptionsFor({}, 'circular').direction).toBe('clockwise');
  });

  it('maps flowchart.curve: linear to straight edges', () => {
    expect(layoutOptionsFor({ flowchart: { curve: 'linear' } })).toEqual({
      tail: 10,
      edges: 'straight',
    });
  });

  it('keeps the arcs for every other curve', () => {
    for (const curve of ['basis', 'cardinal', 'step', 'natural'] as const) {
      expect(layoutOptionsFor({ flowchart: { curve } }), curve).toEqual({ tail: 10 });
    }
  });

  it('lets curve: linear outrank edges set in code, and combine with ccw', () => {
    setCircularLayoutOptions({ edges: 'arc' });
    const options = layoutOptionsFor({ flowchart: { curve: 'linear' } }, 'circular-ccw');
    expect(options.edges).toBe('straight');
    expect(options.direction).toBe('counterclockwise');
  });
});

describe('layoutGroupsFor', () => {
  it("pads every subgraph as mermaid draws it: 12px a side, the title's 26px above", () => {
    const padding = { top: 38, right: 12, bottom: 12, left: 12 };
    expect(layoutGroupsFor([{ id: 'Atmosphere' }, { id: 'Land' }])).toEqual([
      { id: 'Atmosphere', padding },
      { id: 'Land', padding },
    ]);
  });

  it('passes a subgraph nested in another as its child', () => {
    const groups = layoutGroupsFor([
      { id: 'outer' },
      { id: 'inner', parentId: 'outer' },
      { id: 'stray', parentId: 'not-a-subgraph' },
    ]);
    expect(groups.map((g) => g.parent)).toEqual([undefined, 'outer', undefined]);
  });

  it("passes each subgraph's measured title, for a band's caption", () => {
    const groups = layoutGroupsFor(
      [{ id: 'Atmosphere' }, { id: 'Land' }],
      new Map([['Atmosphere', { width: 84.5, height: 24 }]])
    );
    expect(groups[0]!.title).toEqual({ width: 84.5, height: 24 });
    expect(groups[1]!.title).toBeUndefined();
  });
});

describe('bandPath', () => {
  it('outlines a band: the outer arc clockwise, the inner arc back', () => {
    const d = bandPath({
      kind: 'band',
      id: 'g',
      center: { x: 0, y: 0 },
      innerRadius: 50,
      outerRadius: 100,
      startAngle: 0,
      endAngle: Math.PI / 2,
      title: { x: 0, y: 0 },
    });
    expect(d).toBe('M100,0A100,100 0 0 1 0,100L0,50A50,50 0 0 0 50,0Z');
  });

  it('takes the large arc past half a turn', () => {
    const d = bandPath({
      kind: 'band',
      id: 'g',
      center: { x: 10, y: 20 },
      innerRadius: 50,
      outerRadius: 100,
      startAngle: -Math.PI / 2,
      endAngle: Math.PI,
      title: { x: 0, y: 0 },
    });
    expect(d).toBe('M10,-80A100,100 0 1 1 -90,20L-40,20A50,50 0 1 0 10,-30Z');
  });
});

describe('boxTitleAt', () => {
  const box = { kind: 'box' as const, id: 'g', x: 100, y: 50, width: 200, height: 100 };
  const label = { width: 60, height: 24 };

  it("leaves a centered title on top where mermaid puts it", () => {
    expect(boxTitleAt({ ...box, titleSide: 'top', title: { x: 100, y: 19 } }, label)).toBeUndefined();
  });

  it('moves a title the core put at the bottom: its top-left corner, centered on the point', () => {
    expect(boxTitleAt({ ...box, titleSide: 'bottom', title: { x: 100, y: 81 } }, label)).toEqual({ x: 70, y: 69 });
  });

  it('slides a top title to the spot the core found clear, at mermaid\'s height', () => {
    expect(boxTitleAt({ ...box, titleSide: 'top', title: { x: 140, y: 19 } }, label)).toEqual({ x: 110 });
  });
});
