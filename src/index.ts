import type { LayoutLoaderDefinition } from 'mermaid';

const circularLayouts: LayoutLoaderDefinition[] = [
  {
    name: 'circular',
    loader: async () => await import('./render.js'),
    algorithm: 'circular',
  },
  {
    // Same engine seen in a mirror: mermaid hands the algorithm name
    // to render, which maps it onto the direction option.
    name: 'circular-ccw',
    loader: async () => await import('./render.js'),
    algorithm: 'circular-ccw',
  },
];

export default circularLayouts;
export { circularLayout } from './layout.js';
export { setCircularLayoutOptions } from './options.js';
export type {
  CircularLayoutOptions,
  CircularLayoutResult,
  LayoutEdgeInput,
  LayoutNodeInput,
  PlacedNode,
  Point,
  RoutedEdge,
} from './layout.js';
