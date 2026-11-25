import type { CircularLayoutOptions } from 'layout-circular';

/**
 * The consumer's tuning knobs. Mermaid's config schema has no slot
 * for layout-engine options, so they are set programmatically before
 * rendering — the same moment registerLayoutLoaders runs. Options set
 * here merge over what the seam sets for mermaid (tail) and what it
 * derives from mermaid's own config (flowchart.nodeSpacing → spacing).
 */
let configured: CircularLayoutOptions = {};

export const setCircularLayoutOptions = (options: CircularLayoutOptions): void => {
  configured = { ...options };
};

export const circularLayoutOptions = (): CircularLayoutOptions => configured;
