import type { InternalHelpers, LayoutData, RenderOptions, SVG } from 'mermaid';
import { circularLayout, groupBounds, outlinePath } from 'layout-circular';
import type {
  CircularLayoutOptions,
  GroupBox,
  GroupPadding,
  LayoutGroupInput,
  LayoutNodeInput,
  Point,
} from 'layout-circular';
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
type LayoutEdge = LayoutData['edges'][number];

/**
 * The silhouette family per mermaid shape name (aliases included):
 * the spacing math and border crossings measure the true outline
 * for these instead of the bounding box. Every unlisted shape stays
 * a box, which over-reserves and never overlaps.
 */
const SHAPE_FAMILIES: Record<string, NonNullable<LayoutNodeInput['shape']>> = {
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

/** Room between a subgraph box's wall and its members. */
const CLUSTER_PAD = 12;
/** Extra top headroom for the title mermaid paints inside the box's
 *  upper edge: one line of the default 16px label plus its margin. */
const CLUSTER_TITLE = 26;
const CLUSTER_PADDING: GroupPadding = {
  top: CLUSTER_PAD + CLUSTER_TITLE,
  right: CLUSTER_PAD,
  bottom: CLUSTER_PAD,
  left: CLUSTER_PAD,
};

/**
 * The subgraphs handed to the placement math: mermaid's cluster
 * padding, each one's parent when that parent is a subgraph too, and
 * its title's measured size, which a band needs to seat its caption.
 * The math returns each shape clear of everything outside it.
 */
export const layoutGroupsFor = (
  groupNodes: { id: string; parentId?: string }[],
  titles: Map<string, { width: number; height: number }> = new Map()
): LayoutGroupInput[] => {
  const ids = new Set(groupNodes.map((g) => g.id));
  return groupNodes.map((g) => {
    const title = titles.get(g.id);
    return {
      id: g.id,
      ...(g.parentId !== undefined && ids.has(g.parentId) && { parent: g.parentId }),
      padding: CLUSTER_PADDING,
      ...(title && { title }),
    };
  });
};

/**
 * Where a box's cluster label goes when the core moved its title, as
 * the label's top-left corner: undefined for a title centered on top,
 * which mermaid already places. A title on top keeps mermaid's height
 * and slides to the core's clear spot; a title at the bottom centers
 * on the core's point.
 */
export const boxTitleAt = (
  box: GroupBox,
  label: { width: number; height: number }
): { x: number; y?: number } | undefined => {
  const x = box.title.x - label.width / 2;
  if (box.titleSide === 'bottom') {
    return { x, y: box.title.y - label.height / 2 };
  }
  // Half a pixel: closer than that is the middle mermaid uses anyway.
  return Math.abs(box.title.x - box.x) > 0.5 ? { x } : undefined;
};

/** insertEdgeLabel measures the rendered label and records its size
 *  on the edge itself; the wrapper's own getBBox reads zero for
 *  foreignObject labels. */
const labelSize = (edge: LayoutEdge) => edge as { width?: number; height?: number };

/**
 * The options handed to the placement math, lowest precedence first:
 * what mermaid itself needs, then what mermaid's config says, then
 * what the consumer set in code, then the diagram's own layout name
 * and curve.
 */
export const layoutOptionsFor = (
  config: LayoutData['config'],
  algorithm?: string
): CircularLayoutOptions => {
  const nodeSpacing = config.flowchart?.nodeSpacing;
  return {
    // Mermaid's marker handling moves points within about 5px of a
    // path's end. A 10px straight tail outreaches it, so arrowheads
    // keep the curve's own direction.
    tail: 10,
    ...(nodeSpacing !== undefined && { spacing: nodeSpacing }),
    ...circularLayoutOptions(),
    // The diagram picked circular-ccw by name in its own frontmatter —
    // the most local signal there is, so it outranks options set in code.
    ...(algorithm === 'circular-ccw' && { direction: 'counterclockwise' as const }),
    // `curve` already means edge shape, so a linear curve draws
    // straight edges. Every other curve keeps the arcs.
    ...(config.flowchart?.curve === 'linear' && { edges: 'straight' as const }),
  };
};

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

  // A subgraph is not placed; it is drawn around where its members
  // land, after the members know where that is.
  const groupNodes = data4Layout.nodes.filter((node) => node.isGroup);
  const groupIds = new Set(groupNodes.map((g) => g.id));

  const nodeDb = new Map<string, LayoutNode>();
  const domOf = new Map<string, Awaited<ReturnType<InternalHelpers['insertNode']>>>();
  const measured: LayoutNodeInput[] = [];

  // Sequential on purpose: the work is DOM insertion plus a forced
  // reflow per getBBox, so concurrency buys nothing, and interleaved
  // appends would make stacking order at overlaps vary run to run.
  for (const node of data4Layout.nodes) {
    if (node.isGroup) {
      continue;
    }
    const nodeEl = await insertNode(nodesEl, node, {
      config: data4Layout.config,
      dir: data4Layout.direction ?? 'TB',
    });
    const { width, height } = (nodeEl.node() as SVGGraphicsElement).getBBox();
    node.width = width;
    node.height = height;
    nodeDb.set(node.id, node);
    domOf.set(node.id, nodeEl);
    measured.push({
      id: node.id,
      width,
      height,
      shape: SHAPE_FAMILIES[node.shape ?? ''] ?? 'box',
      // Innermost membership only; the groups say who nests in whom.
      ...(node.parentId !== undefined && groupIds.has(node.parentId) && { group: node.parentId }),
    });
  }

  // Labels are measured before layout so a labeled gap on the rim
  // can widen to hold its label.
  for (const edge of data4Layout.edges) {
    if (nodeDb.has(edge.start ?? '') && nodeDb.has(edge.end ?? '')) {
      await insertEdgeLabel(edgeLabels, edge);
    }
  }

  const layoutEdges = data4Layout.edges.map((edge) => ({
    id: edge.id,
    start: edge.start ?? '',
    end: edge.end ?? '',
    ...(edge.label && {
      labelWidth: labelSize(edge).width,
      labelHeight: labelSize(edge).height,
    }),
  }));

  // Each subgraph's title, measured by drawing the cluster once off to
  // the side: a band seats its caption outside itself, so the math
  // needs the caption's size before it places anything.
  const titles = new Map<string, { width: number; height: number }>();
  if (groupNodes.length > 0) {
    const scratch = element.insert('g').attr('class', 'clusters').attr('visibility', 'hidden');
    for (const g of groupNodes) {
      const probe = { ...g, x: 0, y: 0, width: 0, height: 0 };
      const { labelBBox } = await insertCluster(scratch, probe as Parameters<typeof insertCluster>[1]);
      if (labelBBox.width > 0 || labelBBox.height > 0) {
        titles.set(g.id, { width: labelBBox.width, height: labelBBox.height });
      }
    }
    scratch.remove();
  }

  const result = circularLayout(
    measured,
    layoutEdges,
    layoutOptionsFor(data4Layout.config, options?.algorithm),
    layoutGroupsFor(groupNodes, titles)
  );
  if (result.groupsClear === false) {
    log.warn('circular layout: a subgraph could not be kept clear of every node outside it');
  }

  for (const placed of result.nodes) {
    const node = nodeDb.get(placed.id);
    if (!node) {
      continue;
    }
    node.x = placed.x;
    node.y = placed.y;
    domOf.get(placed.id)?.attr('transform', `translate(${placed.x}, ${placed.y})`);
  }

  // Subgraph shapes stand where the math put them, each clear of
  // everything outside it. Outer shapes go first, so they paint behind
  // the shapes they wrap. A box is mermaid's own cluster. A band is
  // mermaid's cluster drawn at the band's bounds, its rect then traded
  // for the band's outline, with the colors the rect had, and its title
  // moved to the band's caption point.
  if (groupNodes.length > 0) {
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
    const shapeOf = new Map((result.groups ?? []).map((b) => [b.id, b]));
    for (const g of [...groupNodes].sort((a, b) => depthOf(a) - depthOf(b))) {
      const shape = shapeOf.get(g.id);
      if (!shape) {
        log.warn(`circular layout: subgraph ${g.id} has no placed members — box skipped`);
        continue;
      }
      if (shape.kind === 'box') {
        g.x = shape.x;
        g.y = shape.y;
        g.width = shape.width;
        g.height = shape.height;
        const { cluster, labelBBox } = await insertCluster(
          clustersEl,
          g as Parameters<typeof insertCluster>[1]
        );
        // The core moves a title to the bottom where spokes or chords
        // cross the top, or along the top to a spot they leave clear.
        const moved = boxTitleAt(shape, labelBBox);
        const label = (cluster.node() as SVGGElement | null)?.querySelector(':scope > .cluster-label');
        if (moved && label) {
          const now = /translate\(\s*([-\d.e]+)[,\s]+([-\d.e]+)/.exec(label.getAttribute('transform') ?? '');
          label.setAttribute('transform', `translate(${moved.x}, ${moved.y ?? Number(now?.[2] ?? 0)})`);
        }
        continue;
      }
      const bounds = groupBounds(shape);
      g.x = (bounds.minX + bounds.maxX) / 2;
      g.y = (bounds.minY + bounds.maxY) / 2;
      g.width = bounds.maxX - bounds.minX;
      g.height = bounds.maxY - bounds.minY;
      const { cluster, labelBBox } = await insertCluster(
        clustersEl,
        g as Parameters<typeof insertCluster>[1]
      );
      const el = cluster.node() as SVGGElement | null;
      const wall = el?.firstElementChild as SVGGraphicsElement | null | undefined;
      if (!el || !wall) {
        continue;
      }
      // Mermaid colors a cluster's rect through `.cluster rect`, which a
      // path doesn't match, so the path carries the colors the wall
      // computed to, then the wall's own style, as the rect had it.
      // The hand-drawn look draws its wall with rough.js, in the theme's
      // cluster colors; the band takes those colors, drawn plain.
      const theme = data4Layout.config.themeVariables as Record<string, string> | undefined;
      const look = getComputedStyle(wall);
      const colors =
        wall.tagName === 'rect'
          ? `fill:${look.fill};stroke:${look.stroke};stroke-width:${look.strokeWidth};${wall.getAttribute('style') ?? ''}`
          : `fill:${theme?.clusterBkg ?? 'none'};stroke:${theme?.clusterBorder ?? 'currentColor'};stroke-width:1px;`;
      const band = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      band.setAttribute('d', outlinePath(shape.outline));
      band.setAttribute('style', colors);
      el.replaceChild(band, wall);
      el.querySelector(':scope > .cluster-label')?.setAttribute(
        'transform',
        `translate(${shape.title.x - labelBBox.width / 2}, ${shape.title.y - labelBBox.height / 2})`
      );
    }
  }

  const routedById = new Map(result.edges.map((e) => [e.id, e]));

  for (const edge of data4Layout.edges) {
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

    // The core seats each measured label: the middle sample, slid
    // radially outward when a rim label crowds its neighbors.
    // positionEdgeLabel falls back to edge.x/y when the path is not
    // trimmed, so an unlabeled edge gets the path's midpoint, and a
    // label never lands at the origin.
    const labelAt = routed?.label ?? points[Math.floor(points.length / 2)]!;
    const edgeWithPath = { ...edge, points, x: labelAt.x, y: labelAt.y };

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
};
