import type { InternalHelpers, LayoutData, RenderOptions, SVG } from 'mermaid';
import { circularLayout } from './layout.js';
import type { CircularLayoutOptions, Point } from './layout.js';
import { circularLayoutOptions } from './options.js';

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

  // Sequential on purpose: the work is DOM insertion plus a forced
  // reflow per getBBox, so concurrency buys nothing, and interleaved
  // appends would make stacking order at overlaps vary run to run.
  for (const node of data4Layout.nodes) {
    if (node.isGroup) {
      // Subgraphs have no circular story yet; a cycle drawn in a
      // note is a flat graph. Loud, not silent.
      log.warn(`circular layout: subgraph ${node.id} ignored — clusters are not supported`);
      continue;
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
  }

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

  const nodeSpacing = data4Layout.config.flowchart?.nodeSpacing;
  const layoutOptions: CircularLayoutOptions = {
    ...(nodeSpacing !== undefined && { spacing: nodeSpacing }),
    ...circularLayoutOptions(),
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

  for (const edge of data4Layout.edges) {
    {
      const startNode = nodeDb.get(edge.start ?? '');
      const endNode = nodeDb.get(edge.end ?? '');
      const routed = routedById.get(edge.id);
      if (!startNode || !endNode) {
        // Checked before inserting the label: a dropped edge's label
        // would otherwise sit unpositioned at the origin.
        log.warn(`circular layout: edge ${edge.id} dropped — an endpoint is missing`);
        continue;
      }
      await insertEdgeLabel(edgeLabels, edge);

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
      let labelAt = mid;
      // A label wider than its gap would sit on the neighboring
      // boxes. The label's true size is known here — measure its
      // rectangle against every node box, and while it collides,
      // slide it radially outward: outside the ring there is always
      // room. Rim edges only; a chord's label lives in the middle,
      // which the swerve already keeps clear.
      if (edge.label && routed?.onRim) {
        // insertEdgeLabel measures the rendered label and records its
        // size on the edge itself — the wrapper's own getBBox reads
        // zero for foreignObject labels.
        const { width: labelW = 0, height: labelH = 0 } = edge as {
          width?: number;
          height?: number;
        };
        const r = Math.hypot(mid.x, mid.y);
        if (labelW > 0 && r > 0) {
          // The padding is breathing room, not mere non-overlap — a
          // label that clears a box by five pixels still reads as
          // jammed against it.
          const breath = 32;
          const collides = (at: Point): boolean =>
            [...nodeDb.values()].some(
              (node) =>
                Math.abs(at.x - (node.x ?? 0)) < (labelW + breath + (node.width ?? 0)) / 2 &&
                Math.abs(at.y - (node.y ?? 0)) < (labelH + breath + (node.height ?? 0)) / 2
            );
          // The cap scales with the label: a wide label needs a
          // longer slide before it can possibly clear.
          const maxPush = 64 + labelW + labelH;
          for (let push = 8; collides(labelAt) && push <= maxPush; push += 8) {
            labelAt = { x: (mid.x * (r + push)) / r, y: (mid.y * (r + push)) / r };
          }
        }
      }
      (edgeWithPath as { x?: number; y?: number }).x = labelAt.x;
      (edgeWithPath as { x?: number; y?: number }).y = labelAt.y;

      // The layout already anchored both endpoints on the node
      // borders; skipIntersect stops insertEdge from re-trimming
      // toward interior samples, which is what seats the arrowhead
      // flush on the border it points into.
      const paths = insertEdge(
        edgePaths,
        edgeWithPath,
        {},
        data4Layout.type,
        startNode,
        endNode,
        data4Layout.diagramId,
        true
      );
      positionEdgeLabel(edgeWithPath, paths);
      // positionEdgeLabel estimates its own position whenever the
      // basis spline doesn't pass exactly through the sampled
      // midpoint — which is always, for a curve. The measured,
      // collision-pushed point is the designed one; place the label
      // there directly. Terminal labels keep positionEdgeLabel's
      // placement.
      if (edge.label) {
        const wrapper = (edgeLabels.node() as SVGGElement | null)?.querySelector(
          `.label[data-id="${CSS.escape(edge.id)}"]`
        )?.parentNode as SVGGElement | null;
        wrapper?.setAttribute('transform', `translate(${labelAt.x}, ${labelAt.y})`);
      }
    }
  }
};
