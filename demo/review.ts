import mermaid from 'mermaid';
import circularLayouts from '../src/index.js';
import { cases, frontmatter } from './cases.js';
import type { Case } from './cases.js';

mermaid.registerLayoutLoaders(circularLayouts);
mermaid.initialize({ startOnLoad: false, theme: 'neutral' });

/** The gallery's diagrams with every node redrawn as a circle — the
 *  shape that exposed the bounding-box modeling, kept as a standing
 *  review set. */
const circleCases: Case[] = [
  {
    title: 'circles: the water cycle',
    text:
      frontmatter('circular') +
      `flowchart LR
  E((Evaporation)) --> C((Condensation))
  C --> P((Precipitation))
  P --> R((Runoff))
  R --> O((Collection))
  O --> E
`,
  },
  {
    title: 'circles: counter-clockwise',
    text:
      frontmatter('circular-ccw') +
      `flowchart LR
  E((Evaporation)) --> C((Condensation))
  C --> P((Precipitation))
  P --> R((Runoff))
  R --> O((Collection))
  O --> E
`,
  },
  {
    title: 'circles: hand-drawn look',
    text:
      frontmatter('circular', '  look: handDrawn\n  theme: neutral\n') +
      `flowchart LR
  L((Listen)) --> T((Think))
  T --> S((Speak))
  S --> H((Be heard))
  H --> L
`,
  },
  {
    title: 'circles: scrambled statements, ordering follows the edges',
    text:
      frontmatter('circular') +
      `flowchart LR
  D((D)) --> E((E))
  A((A)) --> B((B))
  C((C)) --> D
  E --> A
  B --> C
`,
  },
  {
    title: 'circles: a chord shortcut and edge labels',
    text:
      frontmatter('circular') +
      `flowchart LR
  W((Wake)) -->|coffee| Wk((Work))
  Wk -->|lunch| M((Meetings))
  M -->|escape| F((Focus))
  F -->|dusk| Hm((Home))
  Hm -->|sleep| W
  Wk -.->|skip the day| Hm
`,
  },
  {
    title: 'circles: mixed sizes — the radius listens to the widest node',
    text:
      frontmatter('circular') +
      `flowchart LR
  A((A very long circle node label)) --> B((Decide))
  B --> C((C))
  C --> D((Plain))
  D --> E((Subroutine with a long name))
  E --> A
`,
  },
  {
    title: 'circles: self-loop and an opposite edge',
    text:
      frontmatter('circular') +
      `flowchart LR
  A((Draft)) --> B((Review))
  B --> A
  B --> C((Publish))
  C --> A
  A --> A
`,
  },
  {
    title: 'circles: spurs hang off the ring',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  Sun((Sun)) --> E((Evaporation))
  E --> C((Condensation))
  C --> P((Precipitation))
  P --> R((Runoff))
  R --> O((Collection))
  O --> E
  P --> F((Flooding))
  F --> D((Damage))
  O --> G((Groundwater))
`,
  },
  {
    title: 'circles: a Krebs-style cycle with inputs and outputs',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  A((Citrate)) --> B((Isocitrate)) --> C((Ketoglutarate)) --> D((Succinyl-CoA))
  D --> E((Succinate)) --> F((Fumarate)) --> G((Malate)) --> H((Oxaloacetate)) --> A
  AcCoA((Acetyl-CoA)) --> A
  C --> CO2a((CO2))
  D --> CO2b((CO2 again))
  G --> NADH((NADH))
`,
  },
  {
    title: 'circles: hub and spoke',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  Hub((Registry)) --> A((Alpha))
  Hub --> B((Bravo))
  Hub --> C((Charlie))
  Hub --> D((Delta))
  Hub --> E((Echo))
  B --> L(("Bravo's log"))
`,
  },
  {
    title: 'circles: a wheel missing a rim arc, meshing a gear',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart TB
  P(("Captain
  Planet!"))
  Earth((Earth)) <--> P
  Fire((Fire)) <--> P
  Wind((Wind)) <--> P
  Water((Water)) <--> P
  Heart((Heart)) <--> P
  Heart <--> Water
  Heart <--> Earth
  Earth <--> Fire
  Fire <--> Wind
  Water <--> Vapor((Vapor))
  Vapor <--> Ice((Ice))
  Ice <--> Water
`,
  },
  {
    title: 'circles: a wheel — the axle takes the middle',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  A((Plan)) --> B((Build)) --> C((Test)) --> D((Ship)) --> E((Watch)) --> F((Learn)) --> A
  A --> Hub((Vision))
  B --> Hub
  C --> Hub
  D --> Hub
  E --> Hub
  F --> Hub
`,
  },
  {
    title: 'circles: a circle off a circle — the debug loop hangs off Build',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  P((Plan)) --> B((Build)) --> S((Ship)) --> L((Learn)) --> P
  B --> D((Debug))
  D --> F((Fix)) --> T((Test)) --> D
`,
  },
  {
    title: 'circles: a figure-eight — two cycles sharing Sleep',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  W((Wake)) --> K((Work)) --> N((Dine)) --> S((Sleep)) --> W
  S --> R((Dream)) --> T((Toss)) --> S
`,
  },
  {
    title: 'circles: three gears',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  A((Mine)) --> B((Smelt)) --> C((Cast)) --> D((Sell)) --> E((Invest)) --> A
  B --> F((Scrap))
  F --> G((Sort)) --> B
  F --> H((Shred))
  H --> I((Melt)) --> F
`,
  },
  {
    title: 'circles: a subgraph on the cycle',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  E((Evaporation)) --> C((Condensation))
  subgraph Atmosphere
    C --> P((Precipitation))
  end
  P --> R((Runoff))
  subgraph Land
    R --> O((Collection))
  end
  O --> E
`,
  },
  {
    title: 'circles: a subgraph around a pendant cycle',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  P((Plan)) --> B((Build)) --> S((Ship)) --> L((Learn)) --> P
  B --> D((Debug))
  subgraph The debug loop
    D --> F((Fix)) --> T((Test)) --> D
  end
`,
  },
  {
    title: 'circles: ten nodes',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  N1((January)) --> N2((February)) --> N3((March)) --> N4((April)) --> N5((May))
  N5 --> N6((June)) --> N7((July)) --> N8((August)) --> N9((September)) --> N10((October))
  N10 --> N1
`,
  },
  {
    title: 'circles: three nodes',
    text:
      frontmatter('circular') +
      `flowchart LR
  Rock((Rock)) --> Paper((Paper)) --> Scissors((Scissors)) --> Rock
`,
  },
  {
    title: 'circles: two nodes, both ways',
    text:
      frontmatter('circular') +
      `flowchart LR
  Ping((Ping)) --> Pong((Pong))
  Pong --> Ping
`,
  },
];

/** The two graphs from the shape-true-borders review: four meshed
 *  triangles, long labels and short. */
const userCases: Case[] = [
  {
    title: 'four meshed triangles, long labels',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart TD
  A((Acrobat))
  B((Boobytrap))
  C((Crawfish))
  D((Daffodil))
  E((Exotic))
  F((Flash))
  G((Garish))
  H((Halcyon))
  J((Jambalaya))
  A --> B --> C --> A
  A --> D --> E --> A
  D --> F --> G --> D
  E --> H --> J --> E
`,
  },
  {
    title: 'four meshed triangles, single letters',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart TD
  A((A))
  B((B))
  C((C))
  D((D))
  E((E))
  F((F))
  G((G))
  H((H))
  J((J))
  A --> B --> C --> A
  A --> D --> E --> A
  D --> F --> G --> D
  E --> H --> J --> E
`,
  },
];

const sets: Record<string, { subtitle: string; cases: Case[] }> = {
  existing: { subtitle: 'the existing gallery, unchanged sources', cases },
  circles: { subtitle: 'the same gallery with every node a circle', cases: circleCases },
  user: { subtitle: 'the four-meshed-triangles review pair', cases: userCases },
};

const setName = new URLSearchParams(location.search).get('set') ?? 'existing';
const set = sets[setName] ?? sets['existing']!;
document.querySelector('#subtitle')!.textContent = set.subtitle;

const gallery = document.querySelector('#gallery')!;
for (const [i, c] of set.cases.entries()) {
  const figure = document.createElement('figure');
  if (c.wide) {
    figure.classList.add('wide');
  }
  const caption = document.createElement('figcaption');
  caption.textContent = c.title;
  const holder = document.createElement('div');
  holder.className = 'diagram';
  figure.append(caption, holder);
  gallery.append(figure);
  try {
    const { svg } = await mermaid.render(`diagram-${i}`, c.text);
    holder.innerHTML = svg;
  } catch (error) {
    const message = document.createElement('div');
    message.className = 'error';
    message.textContent = String(error);
    holder.replaceChildren(message);
  }
}

document.title = `review — ${setName}, ${set.cases.length} cases`;
(document.body as HTMLElement).dataset.done = 'true';
