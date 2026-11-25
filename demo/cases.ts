export interface Case {
  title: string;
  /** The base name of this case's picture in docs/media, if it has one. */
  doc?: string;
  wide?: boolean;
  text: string;
}

export const frontmatter = (layout: string, extra = '') =>
  `---\nconfig:\n  layout: ${layout}\n${extra}---\n`;

const waterCycle = `flowchart LR
  E[Evaporation] --> C[Condensation]
  C --> P[Precipitation]
  P --> R[Runoff]
  R --> O[Collection]
  O --> E
`;

export const cases: Case[] = [
  {
    title: 'a pure cycle — the water cycle, circular layout',
    doc: 'water-cycle',
    text: frontmatter('circular') + waterCycle,
  },
  {
    title: 'the same diagram, dagre — what issue #3228 complains about',
    doc: 'water-cycle-dagre',
    text: frontmatter('dagre') + waterCycle,
  },
  {
    title: 'the same cycle counter-clockwise — layout: circular-ccw',
    doc: 'water-cycle-ccw',
    text: frontmatter('circular-ccw') + waterCycle,
  },
  {
    title: 'straight edges — flowchart.curve: linear draws the ring as a polygon',
    text:
      frontmatter('circular', '  flowchart:\n    curve: linear\n') +
      `flowchart LR
  A[Plan] -->|then| B[Build] --> C[Ship] --> A
  C --> B
`,
  },
  {
    title: 'hand-drawn look — the dress andrewbroz.net will wear',
    doc: 'hand-drawn',
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
    doc: 'daily-arcs',
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
    title: 'the same, with straight edges — flowchart.curve: linear',
    doc: 'daily-straight',
    text:
      frontmatter('circular', '  flowchart:\n    curve: linear\n') +
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
    title: 'two straight edges between the same nodes — parallel lines, labels aside',
    doc: 'parallel-lines',
    text:
      frontmatter('circular', '  flowchart:\n    curve: linear\n') +
      `flowchart LR
  A[Plan] -->|then| B[Build]
  C[Ship] --> A
  B -->|ready| C
  C -->|fix| B
`,
  },
  {
    title: 'mixed shapes and sizes — the radius listens to the widest node',
    doc: 'mixed-shapes',
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
    doc: 'self-loop',
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
    title: 'branches — nodes off the ring hang outward',
    doc: 'branches',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  P[Plan] --> B[Build] --> S[Ship] --> L[Learn] --> P
  I[Idea] --> P
  S --> N[Release notes]
  B --> G[Build log]
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
    doc: 'krebs',
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
    title: 'hub and spoke — the center is earned, not assumed',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  Hub[Registry] --> A[Alpha]
  Hub --> B[Bravo]
  Hub --> C[Charlie]
  Hub --> D[Delta]
  Hub --> E[Echo]
  B --> L[Bravo's log]
`,
  },
  {
    title: 'a wheel missing a rim arc, meshing a gear — the axle holds anyway',
    doc: 'captain-planet',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart TB
  P[Captain
  Planet!]
  Earth <--> P
  Fire <--> P
  Wind <--> P
  Water <--> P
  Heart <--> P
  Heart <--> Water
  Heart <--> Earth
  Earth <--> Fire
  Fire <--> Wind
  Water <--> Vapor
  Vapor <--> Ice
  Ice <--> Water
`,
  },
  {
    title: 'a wheel — the ring keeps its shape, the axle takes the middle',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  A[Plan] --> B[Build] --> C[Test] --> D[Ship] --> E[Watch] --> F[Learn] --> A
  A --> Hub[Vision]
  B --> Hub
  C --> Hub
  D --> Hub
  E --> Hub
  F --> Hub
`,
  },
  {
    title: 'a circle off a circle — the debug loop hangs off Build',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  P[Plan] --> B[Build] --> S[Ship] --> L[Learn] --> P
  B --> D[Debug]
  D --> F[Fix] --> T[Test] --> D
`,
  },
  {
    title: 'a figure-eight — two cycles sharing Sleep',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  W[Wake] --> K[Work] --> N[Dine] --> S[Sleep] --> W
  S --> R[Dream] --> T[Toss] --> S
`,
  },
  {
    title: 'three gears — each loop spins against the one it meshes with',
    doc: 'three-gears',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  A[Mine] --> B[Smelt] --> C[Cast] --> D[Sell] --> E[Invest] --> A
  B --> F[Scrap]
  F --> G[Sort] --> B
  F --> H[Shred]
  H --> I[Melt] --> F
`,
  },
  {
    title: 'a spur and a satellite on one node — they share its fan side by side',
    doc: 'spur-and-satellite',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  P[Plan] --> B[Build] --> S[Ship] --> L[Learn] --> P
  B --> D[Debug]
  D --> F[Fix] --> T[Test] --> D
  B --> Log[Build log]
  S --> Notes[Release notes]
`,
  },
  {
    title: 'a subgraph on the cycle — the box wraps one arc',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  E[Evaporation] --> C[Condensation]
  subgraph Atmosphere
    C --> P[Precipitation]
  end
  P --> R[Runoff]
  subgraph Land
    R --> O[Collection]
  end
  O --> E
`,
  },
  {
    title: 'a subgraph around a pendant cycle — the box wraps the satellite',
    doc: 'group-satellite',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  P[Plan] --> B[Build] --> S[Ship] --> L[Learn] --> P
  B --> D[Debug]
  subgraph The debug loop
    D --> F[Fix] --> T[Test] --> D
  end
`,
  },
  {
    title: 'a small subgraph — a box, turned clear of the other nodes',
    doc: 'lifecycle-box',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  I[Idea] --> S[Spec]
  subgraph Make
    B[Build]
    T[Test]
  end
  S --> B --> T --> P[Ship] --> I
`,
  },
  {
    title: 'a subgraph spanning most of the ring — a band follows the ring',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  I[Idea]
  subgraph Funded
    S[Spec]
    D[Design]
    B[Build]
    T[Test]
    P[Deploy]
    M[Monitor]
  end
  I --> S --> D --> B --> T --> P --> M --> R[Retire] --> I
`,
  },
  {
    title: 'a subgraph nested in a band is a band too, its title between the two',
    doc: 'nested-band',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  P[Plan]
  subgraph Engineering
    D[Design]
    subgraph CI
      C[Code]
      T[Test]
    end
    R[Release]
  end
  P --> D --> C --> T --> R --> V[Review] --> P
  style CI fill:#ffd
`,
  },
  {
    title: 'spokes cross the top of a box — its title moves to the bottom',
    doc: 'title-bottom',
    wide: true,
    text:
      frontmatter('circular') +
      `flowchart LR
  Hub[Registry] --> A[Alpha]
  Hub --> B[Bravo]
  Hub --> C[Charlie]
  Hub --> D[Delta]
  Hub --> E[Echo]
  Hub --> F[Foxtrot]
  subgraph Archive
    C
    D
  end
`,
  },
  {
    title: 'a compact hub — three spokes, the README picture',
    doc: 'hub',
    text:
      frontmatter('circular') +
      `flowchart LR
  Hub[Registry] --> A[Alpha]
  Hub --> B[Bravo]
  Hub --> C[Charlie]
`,
  },
  {
    title: 'a compact wheel — five on the ring, Vision at the axle',
    doc: 'wheel',
    text:
      frontmatter('circular') +
      `flowchart LR
  A[Plan] --> B[Build] --> C[Test] --> D[Ship] --> E[Learn] --> A
  A --> V[Vision]
  B --> V
  C --> V
  D --> V
  E --> V
`,
  },
  {
    title: 'a compact satellite — written from Build, so the debug loop rises above it',
    doc: 'satellite',
    text:
      frontmatter('circular') +
      `flowchart LR
  B[Build] --> S[Ship] --> L[Learn] --> P[Plan] --> B
  B --> D[Debug]
  D --> F[Fix] --> T[Test] --> D
`,
  },
  {
    title: 'a compact figure-eight — written from Sleep, so the two circles stack',
    doc: 'figure-eight',
    text:
      frontmatter('circular') +
      `flowchart LR
  S[Sleep] --> W[Wake] --> K[Work] --> N[Dine] --> S
  S --> R[Dream] --> T[Toss] --> S
`,
  },
  {
    title: 'a band around four of five — the README picture beside the box',
    doc: 'lifecycle-band',
    text:
      frontmatter('circular') +
      `flowchart LR
  I[Idea]
  subgraph Funded
    S[Spec]
    B[Build]
    T[Test]
    P[Ship]
  end
  I --> S --> B --> T --> P --> I
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

