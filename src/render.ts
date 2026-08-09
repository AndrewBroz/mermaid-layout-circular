import type { InternalHelpers, LayoutData, RenderOptions, SVG } from 'mermaid';
import { circularLayout } from './layout.js';
import type { CircularLayoutOptions, Point } from './layout.js';

/**
 * The mermaid seam. The pattern every layout engine follows:
 * insert nodes into the DOM to learn their true rendered size, hand
 * the sizes to the placement math, translate each node to its place,
 * then feed the computed path points through mermaid's own edge
 * renderer so arrowheads, labels, classes and the hand-drawn look all
 * keep working.
 *
 * insertNode attaches each node's boundary-intersection function to
 * the node object it is given, and insertEdge trims the path at that
 * boundary — so the node objects handed to insertEdge must be the
 * same objects insertNode saw, not copies.
 */

type LayoutNode = LayoutData['nodes'][number];

export const render = async (
  data4Layout: LayoutData,
  svg: SVG,
  { insertEdge, insertEdgeLabel, insertMarkers, insertNode, log, positionEdgeLabel }: InternalHelpers,
  _options?: RenderOptions
) => {
  const element = svg.select('g');
  insertMarkers(element, data4Layout.markers, data4Layout.type, data4Layout.diagramId);

  const edgePaths = element.insert('g').attr('class', 'edgePaths');
  const edgeLabels = element.insert('g').attr('class', 'edgeLabels');
  const nodesEl = element.insert('g').attr('class', 'nodes');

  const nodeDb = new Map<string, LayoutNode>();
  const domOf = new Map<string, { attr: (name: string, value: string) => unknown }>();

  await Promise.all(
    data4Layout.nodes.map(async (node) => {
      if (node.isGroup) {
        // Subgraphs have no circular story yet; a cycle drawn in a
        // note is a flat graph. Loud, not silent.
        log.warn(`circular layout: subgraph ${node.id} ignored — clusters are not supported`);
        return;
      }
      nodeDb.set(node.id, node);
      const nodeEl = await insertNode(nodesEl, node, {
        config: data4Layout.config,
        dir: data4Layout.direction ?? 'TB',
      });
      const box = (nodeEl.node() as SVGGraphicsElement).getBBox();
      node.width = box.width;
      node.height = box.height;
      domOf.set(node.id, nodeEl as unknown as { attr: (name: string, value: string) => unknown });
    })
  );

  const measured = [...nodeDb.values()].map((node) => ({
    id: node.id,
    width: node.width ?? 100,
    height: node.height ?? 50,
  }));
  const layoutEdges = data4Layout.edges.map((edge) => ({
    id: edge.id,
    start: edge.start ?? '',
    end: edge.end ?? '',
  }));

  const layoutOptions: CircularLayoutOptions = {
    spacing: data4Layout.config.flowchart?.nodeSpacing,
  };
  const result = circularLayout(measured, layoutEdges, layoutOptions);

  for (const placed of result.nodes) {
    const node = nodeDb.get(placed.id);
    const dom = domOf.get(placed.id);
    if (!node || !dom) {
      continue;
    }
    node.x = placed.x;
    node.y = placed.y;
    dom.attr('transform', `translate(${placed.x}, ${placed.y})`);
  }

  const routedById = new Map(result.edges.map((e) => [e.id, e]));

  await Promise.all(
    data4Layout.edges.map(async (edge) => {
      await insertEdgeLabel(edgeLabels, edge);

      const startNode = nodeDb.get(edge.start ?? '');
      const endNode = nodeDb.get(edge.end ?? '');
      const routed = routedById.get(edge.id);
      if (!startNode || !endNode) {
        log.warn(`circular layout: edge ${edge.id} dropped — an endpoint is missing`);
        return;
      }

      const points: Point[] =
        routed && routed.points.length > 0
          ? routed.points
          : [
              { x: startNode.x ?? 0, y: startNode.y ?? 0 },
              { x: endNode.x ?? 0, y: endNode.y ?? 0 },
            ];

      const edgeWithPath = { ...edge, points };
      // positionEdgeLabel falls back to edge.x/y when the path is not
      // trimmed; give it the path's midpoint so a label never lands at
      // the origin.
      const mid = points[Math.floor(points.length / 2)]!;
      (edgeWithPath as { x?: number; y?: number }).x = mid.x;
      (edgeWithPath as { x?: number; y?: number }).y = mid.y;

      const paths = insertEdge(
        edgePaths,
        edgeWithPath,
        {},
        data4Layout.type,
        startNode,
        endNode,
        data4Layout.diagramId
      );
      positionEdgeLabel(edgeWithPath, paths);
    })
  );
};
