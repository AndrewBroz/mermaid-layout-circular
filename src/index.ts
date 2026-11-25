import type { LayoutLoaderDefinition } from 'mermaid';

// Both names load the same engine. Mermaid hands the algorithm name
// to render, which maps 'circular-ccw' onto the direction option.
const circularLayouts: LayoutLoaderDefinition[] = ['circular', 'circular-ccw'].map((name) => ({
  name,
  loader: async () => await import('./render.js'),
  algorithm: name,
}));

export default circularLayouts;
export { circularLayout } from 'layout-circular';
export { setCircularLayoutOptions } from './options.js';
export type {
  CircularLayoutOptions,
  CircularLayoutResult,
  LayoutEdgeInput,
  LayoutNodeInput,
  PlacedNode,
  Point,
  RoutedEdge,
} from 'layout-circular';
