import mermaid from 'mermaid';
import circularLayouts, { setCircularLayoutOptions } from '../src/index.js';

mermaid.registerLayoutLoaders(circularLayouts);
mermaid.initialize({ startOnLoad: false, theme: 'neutral' });

const params = new URLSearchParams(location.search);
const bow = params.get('bow');
const ordering = params.get('ordering');
const spacing = params.get('spacing');
setCircularLayoutOptions({
  ...(bow !== null && { bow: Number(bow) }),
  ...(ordering !== null && { ordering: ordering as 'follow-edges' | 'input' }),
  ...(spacing !== null && { spacing: Number(spacing) }),
});

interface Case {
  title: string;
  wide?: boolean;
  text: string;
}

const frontmatter = (layout: string, extra = '') =>
  `---\nconfig:\n  layout: ${layout}\n${extra}---\n`;

const waterCycle = `flowchart LR
  E[Evaporation] --> C[Condensation]
  C --> P[Precipitation]
  P --> R[Runoff]
  R --> O[Collection]
  O --> E
`;

const cases: Case[] = [
  {
    title: 'a pure cycle — the water cycle, circular layout',
    text: frontmatter('circular') + waterCycle,
  },
  {
    title: 'the same diagram, dagre — what issue #3228 complains about',
    text: frontmatter('dagre') + waterCycle,
  },
  {
    title: 'the same cycle counter-clockwise — layout: circular-ccw',
    text: frontmatter('circular-ccw') + waterCycle,
  },
  {
    title: 'hand-drawn look — the dress andrewbroz.net will wear',
    text:
      frontmatter('circular', '  look: handDrawn\n  theme: neutral\n') +
      `flowchart LR
  L[Listen] --> T[Think]
  T --> S[Speak]
  S --> H[Be heard]
  H --> L
`,
  },
  {
    title: 'statements written scrambled — ordering follows the edges',
    text:
      frontmatter('circular') +
      `flowchart LR
  D --> E
  A --> B
  C --> D
  E --> A
  B --> C
`,
  },
  {
    title: 'a chord shortcut and edge labels',
    text:
      frontmatter('circular') +
      `flowchart LR
  W[Wake] -->|coffee| Wk[Work]
  Wk -->|lunch| M[Meetings]
  M -->|escape| F[Focus]
  F -->|dusk| Hm[Home]
  Hm -->|sleep| W
  Wk -.->|skip the day| Hm
`,
  },
  {
    title: 'mixed shapes and sizes — the radius listens to the widest node',
    text:
      frontmatter('circular') +
      `flowchart LR
  A([A very long stadium node label]) --> B{Decide}
  B --> C((C))
  C --> D[Plain]
  D --> E[[Subroutine with a long name]]
  E --> A
`,
  },
  {
    title: 'self-loop and an opposite edge',
    text:
      frontmatter('circular') +
      `flowchart LR
  A[Draft] --> B[Review]
  B --> A
  B --> C[Publish]
  C --> A
  A --> A
`,
  },
  {
    title: 'spurs — the cycle keeps the ring, the rest hangs off it',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  Sun --> E[Evaporation]
  E --> C[Condensation]
  C --> P[Precipitation]
  P --> R[Runoff]
  R --> O[Collection]
  O --> E
  P --> F[Flooding]
  F --> D[Damage]
  O --> G[Groundwater]
`,
  },
  {
    title: 'a Krebs-style cycle with inputs and outputs',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  A[Citrate] --> B[Isocitrate] --> C[Ketoglutarate] --> D[Succinyl-CoA]
  D --> E[Succinate] --> F[Fumarate] --> G[Malate] --> H[Oxaloacetate] --> A
  AcCoA[Acetyl-CoA] --> A
  C --> CO2a[CO2]
  D --> CO2b[CO2 again]
  G --> NADH
`,
  },
  {
    title: 'ten nodes',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  N1[January] --> N2[February] --> N3[March] --> N4[April] --> N5[May]
  N5 --> N6[June] --> N7[July] --> N8[August] --> N9[September] --> N10[October]
  N10 --> N1
`,
  },
  {
    title: 'three nodes',
    text:
      frontmatter('circular') +
      `flowchart LR
  Rock --> Paper --> Scissors --> Rock
`,
  },
  {
    title: 'two nodes, both ways',
    text:
      frontmatter('circular') +
      `flowchart LR
  Ping --> Pong
  Pong --> Ping
`,
  },
];

const gallery = document.querySelector('#gallery')!;

for (const [i, c] of cases.entries()) {
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

document.title = `mermaid-layout-circular — ${cases.length} cases`;
(document.body as HTMLElement).dataset.done = 'true';
