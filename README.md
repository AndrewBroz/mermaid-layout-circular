# mermaid-layout-circular

A circular layout engine for [mermaid](https://mermaid.js.org) flowcharts.
Write an ordinary flowchart, set `layout: circular`, and the nodes are
placed evenly around a circle with the edges drawn as arcs of that same
circle. The rest of the flowchart language keeps working: node shapes,
edge labels, css classes, and `look: handDrawn`.

Mermaid's default engine, dagre, is built for hierarchies. Given a cycle,
it breaks the loop, lays the nodes out in a line, and routes one long
arrow back around the outside. The result never looks like a cycle. This
package addresses the request in
[mermaid-js/mermaid#3228](https://github.com/mermaid-js/mermaid/issues/3228),
open since 2022, that cycles be represented more naturally.

Here is the same five-node flowchart rendered both ways:

| `layout: circular` | `layout: dagre` (mermaid default) |
| --- | --- |
| ![The water cycle as a ring of five boxes connected by arcs of one circle](docs/media/water-cycle-circular.png) | ![The same five nodes flattened into a horizontal ladder with a long return arrow](docs/media/water-cycle-dagre.png) |

Edge labels, chords between non-neighbors, and mermaid's hand-drawn look
all keep working:

| Labels and a chord | `look: handDrawn` |
| --- | --- |
| ![A five-node daily cycle with labels in the gaps and a dotted chord across the middle](docs/media/labels-and-chord.png) | ![A four-node cycle drawn in mermaid's sketchy hand-drawn style](docs/media/hand-drawn.png) |

A cycle with side branches keeps its ring: the cycle stays on the
circle and everything else hangs off it radially, the way textbook
figures would draw the Krebs cycle, for example:

![An eight-node Krebs cycle ring with Acetyl-CoA feeding in from above and CO2 and NADH branching outward](docs/media/krebs-cycle.png)

## Usage

Select the layout per diagram in frontmatter, the same way
`@mermaid-js/layout-elk` works:

```
---
config:
  layout: circular
---
flowchart LR
  A --> B --> C --> D --> A
```

Register the layout once, before rendering:

```ts
import mermaid from 'mermaid';
import circularLayouts from 'mermaid-layout-circular';

mermaid.registerLayoutLoaders(circularLayouts);
```

Subgraphs are not supported yet. A diagram containing one still renders,
but the subgraph box is skipped and a warning is logged. Diagram types
other than flowcharts are out of scope, since each one owns its layout.

To use the layout in Obsidian, install
[obsidian-mermaid-circular](https://github.com/AndrewBroz/obsidian-mermaid-circular),
a small plugin that registers it with the mermaid instance Obsidian
already bundles. Diagrams in notes then opt in with the same
frontmatter.

## Options

Mermaid's config schema has no slot for layout engine options, so the
knobs are set in code, next to registration:

```ts
import { setCircularLayoutOptions } from 'mermaid-layout-circular';

setCircularLayoutOptions({ spacing: 60, bow: 0.4 });
```

The available options and their defaults live in `CircularLayoutOptions`
and `defaults` in `src/layout.ts`. Every default was chosen by rendering
the alternatives and looking at them. The screenshots that drove those
choices are committed in `trials/`, and the verdicts are recorded in
`docs/DECISIONS.md`. When no option overrides it, `spacing` is seeded
from mermaid's own `flowchart.nodeSpacing`.

## Demo

`npm run dev` serves the demo. The gallery at `/` renders ten cases, and
`/trials.html?suite=bow` (also `swerve`, `ordering`, `spacing`,
`samples`) renders the same diagrams under different option values for
side-by-side comparison.

## Development

Three gates, all green before committing changes to `src/`:

```sh
npm test        # vitest, the placement math
npm run lint    # eslint
npm run build   # vite library build plus type declarations
```

## Caveats

The package renders through mermaid's `InternalHelpers`, which mermaid
marks as deprecated for external use. The official layout engines (elk,
tidy-tree) ship on the same seam, so the risk is shared, but a mermaid
upgrade in a consuming project is the right moment to re-run the demo
and look. The peer range is `mermaid ^11.12.0`, the earliest version
verified to carry the internals this package relies on. Developed
against 11.16.

One more limitation worth knowing: mermaid measures HTML edge labels
with `getBoundingClientRect`, which reports screen pixels. If the
rendering container is scaled by a CSS transform, label collision
checks will be off by that scale factor.

## License

MIT
