import { afterEach, describe, expect, it } from 'vitest';
import { setCircularLayoutOptions } from './options.js';
import { layoutOptionsFor } from './render.js';

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
