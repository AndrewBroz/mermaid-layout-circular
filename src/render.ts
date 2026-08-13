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
  {
    insertCluster,
    insertEdge,
    insertEdgeLabel,
    insertMarkers,
    insertNode,
    log,
    positionEdgeLabel,
  }: InternalHelpers,
  options?: RenderOptions
) => {
  const element = svg.select('g');
  insertMarkers(element, data4Layout.markers, data4Layout.type, data4Layout.diagramId);

  // Clusters first in the DOM, so their boxes paint behind everything.
  const clustersEl = element.insert('g').attr('class', 'clusters');
  const edgePaths = element.insert('g').attr('class', 'edgePaths');
  const edgeLabels = element.insert('g').attr('class', 'edgeLabels');
  const nodesEl = element.insert('g').attr('class', 'nodes');

  const nodeDb = new Map<string, LayoutNode>();
  const domOf = new Map<string, { attr: (name: string, value: string) => unknown }>();
  const groupNodes: LayoutNode[] = [];

  // Sequential on purpose: the work is DOM insertion plus a forced
  // reflow per getBBox, so concurrency buys nothing, and interleaved
  // appends would make stacking order at overlaps vary run to run.
  for (const node of data4Layout.nodes) {
    if (node.isGroup) {
      // A subgraph is not placed; it is drawn around where its
      // members land, after the members know where that is.
      groupNodes.push(node);
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

  const groupIds = new Set(groupNodes.map((g) => g.id));
  // The silhouette family per mermaid shape name (aliases included):
  // the spacing math and border crossings measure the true outline
  // for these instead of the bounding box. Every unlisted shape stays
  // a box, which over-reserves and never overlaps.
  const families: Record<string, 'ellipse' | 'diamond' | 'stadium'> = {
    circle: 'ellipse',
    circ: 'ellipse',
    doublecircle: 'ellipse',
    'dbl-circ': 'ellipse',
    'double-circle': 'ellipse',
    question: 'diamond',
    diamond: 'diamond',
    diam: 'diamond',
    decision: 'diamond',
    stadium: 'stadium',
    pill: 'stadium',
    terminal: 'stadium',
  };
  const measured = [...nodeDb.values()].map((node) => ({
    id: node.id,
    width: node.width ?? 100,
    height: node.height ?? 50,
    shape: families[node.shape ?? ''] ?? ('box' as const),
    // Innermost membership only; outer boxes wrap inner ones later.
    ...(node.parentId !== undefined && groupIds.has(node.parentId) && { group: node.parentId }),
  }));

  // Labels are measured before layout so a labeled gap on the rim
  // can widen to hold its label. insertEdgeLabel stamps the measured
  // size onto the edge object itself.
  for (const edge of data4Layout.edges) {
    if (nodeDb.has(edge.start ?? '') && nodeDb.has(edge.end ?? '')) {
      await insertEdgeLabel(edgeLabels, edge);
    }
  }

  const layoutEdges = data4Layout.edges.map((edge) => ({
    id: edge.id,
    start: edge.start ?? '',
    end: edge.end ?? '',
    labelWidth: edge.label ? (edge as { width?: number }).width : undefined,
  }));

  const nodeSpacing = data4Layout.config.flowchart?.nodeSpacing;
  const layoutOptions: CircularLayoutOptions = {
    ...(nodeSpacing !== undefined && { spacing: nodeSpacing }),
    ...circularLayoutOptions(),
    // The diagram picked circular-ccw by name in its own frontmatter —
    // the most local signal there is, so it outranks options set in code.
    ...(options?.algorithm === 'circular-ccw' && { direction: 'counterclockwise' as const }),
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

  // Subgraph boxes wrap wherever their members landed: the padded
  // union of member boxes, deepest group first so an outer box can
  // wrap its inner boxes, drawn shallow-first so outer paints behind
  // inner. The extra top headroom holds the title mermaid paints
  // inside the box's upper edge.
  if (groupNodes.length > 0) {
    const PAD = 12;
    const TITLE = 26;
    const groupById = new Map(groupNodes.map((g) => [g.id, g]));
    const depthOf = (g: LayoutNode): number => {
      let depth = 0;
      let cur = g.parentId;
      const walked = new Set<string>();
      while (cur !== undefined && groupById.has(cur) && !walked.has(cur)) {
        walked.add(cur);
        depth++;
        cur = groupById.get(cur)!.parentId;
      }
      return depth;
    };
    interface Rect {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    }
    const rects = new Map<string, Rect>();
    const deepFirst = [...groupNodes].sort((a, b) => depthOf(b) - depthOf(a));
    for (const g of deepFirst) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const member of nodeDb.values()) {
        if (member.parentId !== g.id || member.x === undefined || member.y === undefined) {
          continue;
        }
        minX = Math.min(minX, member.x - (member.width ?? 0) / 2);
        maxX = Math.max(maxX, member.x + (member.width ?? 0) / 2);
        minY = Math.min(minY, member.y - (member.height ?? 0) / 2);
        maxY = Math.max(maxY, member.y + (member.height ?? 0) / 2);
      }
      for (const child of groupNodes) {
        const r = child.parentId === g.id ? rects.get(child.id) : undefined;
        if (!r) {
          continue;
        }
        minX = Math.min(minX, r.minX);
        maxX = Math.max(maxX, r.maxX);
        minY = Math.min(minY, r.minY);
        maxY = Math.max(maxY, r.maxY);
      }
      if (!Number.isFinite(minX)) {
        log.warn(`circular layout: subgraph ${g.id} has no placed members — box skipped`);
        continue;
      }
      rects.set(g.id, {
        minX: minX - PAD,
        minY: minY - PAD - TITLE,
        maxX: maxX + PAD,
        maxY: maxY + PAD,
      });
    }
    for (const g of [...deepFirst].reverse()) {
      const r = rects.get(g.id);
      if (!r) {
        continue;
      }
      g.x = (r.minX + r.maxX) / 2;
      g.y = (r.minY + r.maxY) / 2;
      g.width = r.maxX - r.minX;
      g.height = r.maxY - r.minY;
      await insertCluster(clustersEl, g as Parameters<typeof insertCluster>[1]);
    }
  }

  const routedById = new Map(result.edges.map((e) => [e.id, e]));

  for (const edge of data4Layout.edges) {
    {
      const startNode = nodeDb.get(edge.start ?? '');
      const endNode = nodeDb.get(edge.end ?? '');
      const routed = routedById.get(edge.id);
      if (!startNode || !endNode) {
        // The label pass above skipped this edge too, so nothing
        // sits unpositioned at the origin.
        log.warn(`circular layout: edge ${edge.id} dropped — an endpoint is missing`);
        continue;
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
          const collides = (at: Point, breath: number): boolean =>
            [...nodeDb.values()].some(
              (node) =>
                Math.abs(at.x - (node.x ?? 0)) < (labelW + breath + (node.width ?? 0)) / 2 &&
                Math.abs(at.y - (node.y ?? 0)) < (labelH + breath + (node.height ?? 0)) / 2
            );
          // Two tiers: a label that fits inline with modest breathing
          // room stays inline — a home inside the gap beats an airier
          // exile outside the ring. Only when even the modest fit
          // fails does the label slide outward, and then it clears
          // generously.
          if (collides(labelAt, 14)) {
            // The cap scales with the label: a wide label needs a
            // longer slide before it can possibly clear.
            const maxPush = 64 + labelW + labelH;
            for (let push = 8; collides(labelAt, 32) && push <= maxPush; push += 8) {
              labelAt = { x: (mid.x * (r + push)) / r, y: (mid.y * (r + push)) / r };
            }
          }
        }
      }
      (edgeWithPath as { x?: number; y?: number }).x = labelAt.x;
      (edgeWithPath as { x?: number; y?: number }).y = labelAt.y;

      // The layout anchored both endpoints exactly on the silhouette
      // borders (bisected on the curve, shape-aware) with straight
      // ≥10px terminal segments; skipIntersect stops insertEdge from
      // re-trimming toward interior samples, which would bury and
      // rotate the arrowheads it just seated flush.
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
