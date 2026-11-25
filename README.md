# mermaid-layout-circular

A circular layout for mermaid flowcharts.

[mermaid](https://mermaid.js.org) turns text into diagrams. It lays
out flowcharts in rows, so a cycle comes out as a line with one long
arrow looping back. This package adds a circular layout. A layout
decides where each box goes, and the path each arrow takes. Here the
nodes sit at even spacing on a circle. Each arrow follows the circle to the
next node.

In Obsidian, use the
[obsidian-mermaid-circular](https://github.com/AndrewBroz/obsidian-mermaid-circular)
plugin instead. Obsidian is a notes app that can draw mermaid
diagrams.

<img src="docs/media/water-cycle.png" width="470" alt="Five boxes on a circle, Evaporation at the top, joined clockwise by curved arrows.">

Pick the layout in the diagram's frontmatter. That is the settings
block between two `---` lines at the top of the diagram. This is the
text for the picture above:

```
---
config:
  layout: circular
---
flowchart LR
  E[Evaporation] --> C[Condensation]
  C --> P[Precipitation]
  P --> R[Runoff]
  R --> O[Collection]
  O --> E
```

mermaid's default layout, called dagre, draws the same text like this:

<img src="docs/media/water-cycle-dagre.png" width="640" alt="The same five boxes in a row, with one long arrow looping back from Collection to Evaporation.">

This answers a request open in mermaid since 2022,
[mermaid-js/mermaid#3228](https://github.com/mermaid-js/mermaid/issues/3228).

## Which package to use

The same circular layout comes in four packages. Pick the one that
matches how you draw diagrams.

| You draw diagrams with | Use |
| --- | --- |
| mermaid, in a web page or app | this package |
| Pele, in a web page or app | [pele-layout-circular](https://github.com/AndrewBroz/pele-layout-circular) |
| Obsidian, in your notes | [obsidian-mermaid-circular](https://github.com/AndrewBroz/obsidian-mermaid-circular), a plugin |
| your own code | [layout-circular](https://github.com/AndrewBroz/layout-circular), the shared placement math |

The first three use layout-circular to decide where each node goes.
They place nodes the same way. They differ in how boxes and text are drawn.

Pele is another program that draws diagrams from mermaid's text.

## Install

```sh
npm install mermaid mermaid-layout-circular
```

Register the layout once, before mermaid draws anything:

```ts
import mermaid from 'mermaid';
import circularLayouts from 'mermaid-layout-circular';

mermaid.registerLayoutLoaders(circularLayouts);
```

Works with mermaid 11.12 and later, up to mermaid 12.

### From a CDN

A web page can load both packages from jsDelivr, with no build step:

```html
<pre class="mermaid">
---
config:
  layout: circular
---
flowchart LR
  A --> B --> C --> D --> A
</pre>

<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@12/dist/mermaid.esm.min.mjs';
  import circularLayouts from 'https://cdn.jsdelivr.net/npm/mermaid-layout-circular@0.10/dist/mermaid-layout-circular.js';

  mermaid.registerLayoutLoaders(circularLayouts);
  await mermaid.run();
</script>
```

## Write a circular diagram

`layout: circular` places the first node at the top and runs
clockwise. `layout: circular-ccw` runs counter-clockwise.

The rest of the flowchart language works as usual: node shapes, edge
labels, styles, classes and themes. The direction after `flowchart`
(LR, TB) has no effect on this layout.

mermaid's hand-drawn look works too:

<img src="docs/media/hand-drawn.png" width="360" alt="Four sketchy boxes on a circle, Listen at the top, joined clockwise by hand-drawn arrows.">

```
---
config:
  layout: circular
  look: handDrawn
  theme: neutral
---
flowchart LR
  L[Listen] --> T[Think]
  T --> S[Speak]
  S --> H[Be heard]
  H --> L
```

## Straight edges

By default, an arrow between two neighbours on the circle is curved
along it. Set `flowchart.curve` to `linear` to draw straight lines
instead, so the ring becomes a polygon.

An arrow between two nodes that are not neighbours is called a chord.
A chord is always a straight line across the circle. When two straight
arrows join the same two nodes, they are drawn as parallel lines, each
with its label on its own side.

| Curved arrows (the default) | `curve: linear` |
| --- | --- |
| <img src="docs/media/daily-arcs.png" width="360" alt="Five boxes on a circle joined by curved labelled arrows, and a dotted chord from Work to Home."> | <img src="docs/media/daily-straight.png" width="360" alt="The same five boxes joined by straight labelled arrows, a pentagon, with the same dotted chord."> |

The text for the straight version is below. The curved one is the
same without the `flowchart` and `curve` lines.

```
---
config:
  layout: circular
  flowchart:
    curve: linear
---
flowchart LR
  W[Wake] -->|coffee| Wk[Work]
  Wk -->|lunch| M[Meetings]
  M -->|escape| F[Focus]
  F -->|dusk| Hm[Home]
  Hm -->|sleep| W
  Wk -.->|skip the day| Hm
```

## Groups

A subgraph (a group of nodes) keeps its members next to each other on
the circle. A small group is drawn as a tight box. The circle turns,
if needed, so the box clears every other node.

A group that covers half the circle or more is drawn as a band, a
strip that follows the circle. A box around that much of a circle
would cover the middle. When arrows cross the top of a box, its title
moves to the bottom.

<table>
<tr>
<td align="center"><img src="docs/media/lifecycle-box.png" width="480" alt="Eight boxes on a circle. Build and Test sit inside a grey box titled Make, at the bottom right."><br>A small group: a box</td>
</tr>
<tr>
<td align="center"><img src="docs/media/lifecycle-band.png" width="480" alt="The same circle, with six of its eight boxes inside a curved grey strip titled Funded."><br>A group around half the ring or more: a band</td>
</tr>
</table>

More group examples are in the [gallery](docs/GALLERY.md#groups).

## More shapes

Not every diagram is one plain cycle. The layout keeps the main cycle
on the circle, called the ring, and places everything else around it.

<table>
<tr>
<td align="center"><img src="docs/media/branches.png" width="325" alt="Four boxes on a ring. Idea points in from above, and Build log and Release notes point outward."><br>Branches hang off the ring</td>
<td align="center"><img src="docs/media/hub.png" width="393" alt="Registry in the middle with arrows out to five boxes around it, and Bravo's log hanging off Bravo."><br>A hub goes in the middle</td>
</tr>
</table>

<table>
<tr>
<td align="center"><img src="docs/media/satellite.png" width="414" alt="A four-box ring, and beyond Build a smaller circle of Debug, Fix and Test."><br>A cycle off the ring gets its own circle</td>
<td align="center"><img src="docs/media/figure-eight.png" width="318" alt="Two circles meeting at Sleep: Wake, Work and Dine on the right, Dream and Toss on the left."><br>Two cycles sharing a node: a figure-eight</td>
</tr>
</table>

<table>
<tr>
<td align="center"><img src="docs/media/wheel.png" width="283" alt="Six boxes on a ring from Plan to Learn, each with a straight arrow to Vision in the middle."><br>A wheel: a ring around a hub</td>
<td align="center"><img src="docs/media/three-gears.png" width="448" alt="Three circles in a chain, Mine to Invest, then Smelt to Sort, then Scrap to Melt."><br>Cycles linked in a chain, each turning the other way</td>
</tr>
</table>

A branch is a node that hangs off the ring, pointing outward. A hub is
one node linked to most of the others. A satellite is a second, smaller
cycle hanging off the ring, drawn as its own circle.

The source of every picture on this page is in
[docs/GALLERY.md](docs/GALLERY.md), along with more examples. The
[live gallery](https://andrewbroz.github.io/mermaid-layout-circular/)
draws every case in your browser.

## Hubs

The layout puts a node in the middle only when the diagram's shape
calls for it. Two shapes do.

- A wheel. One node on the ring links to more ring nodes than any
  other node does, and the ring still closes without it. A node linked
  to every other ring node counts even if the ring has gaps.
- A star. The diagram has no cycle, and one node has more links than
  any other, at least three.

You can turn this off, or name the hub yourself. This is set in code,
next to the registration, not in frontmatter:

```ts
import { setCircularLayoutOptions } from 'mermaid-layout-circular';

setCircularLayoutOptions({ hub: 'none' }); // never use a hub
setCircularLayoutOptions({ hub: 'Hub' });  // the node with id Hub is the hub
```

A node's id is the name before its brackets in the diagram text. In
the hub picture above, `Hub[Registry]` has the id `Hub`.

## Options

mermaid's settings have no place for layout options, so you set them in
code with `setCircularLayoutOptions`, next to the registration:

```ts
setCircularLayoutOptions({ spacing: 60 });
```

Two things to know:

- `spacing`, the gap between nodes, starts from mermaid's own
  `flowchart.nodeSpacing`.
- A diagram's own frontmatter wins over options set in code. A diagram
  that says `circular-ccw` or `curve: linear` gets that, whatever the
  code set.

[All options](https://github.com/AndrewBroz/layout-circular/blob/main/docs/OPTIONS.md)
are listed in layout-circular, with their defaults.

## Limits

- An arrow that points at a subgraph itself, not a node in it, is
  dropped, with a warning in the console.
- With `look: handDrawn`, a band is drawn with plain lines.
- If the page scales the diagram with a CSS transform, edge labels can
  overlap. mermaid measures labels in screen pixels.
- Only flowcharts are supported.
- The package uses mermaid's `InternalHelpers`, which mermaid marks as
  not for outside use. mermaid's own elk and tidy-tree layouts use them
  too.

## Development

`npm test`, `npm run lint` and `npm run build` are the checks.
`npm run dev` serves the gallery locally. `npm run docs:images` redraws
the pictures in this README and the gallery. The reasons behind the
design are in [docs/DECISIONS.md](docs/DECISIONS.md).

## License

MIT
