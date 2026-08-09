import type { LayoutLoaderDefinition } from 'mermaid';

const circularLayouts: LayoutLoaderDefinition[] = [
  {
    name: 'circular',
    loader: async () => await import('./render.js'),
    algorithm: 'circular',
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
