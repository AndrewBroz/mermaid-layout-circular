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
    setCircularLayoutOptions({ spacing: 40, tail: 12, bow: 0.4 });
    expect(layoutOptionsFor({ flowchart: { nodeSpacing: 70 } })).toEqual({
      tail: 12,
      spacing: 40,
      bow: 0.4,
    });
  });

  it('lets layout: circular-ccw outrank a direction set in code', () => {
    setCircularLayoutOptions({ direction: 'clockwise' });
    expect(layoutOptionsFor({}, 'circular-ccw').direction).toBe('counterclockwise');
    expect(layoutOptionsFor({}, 'circular').direction).toBe('clockwise');
  });
});
