import mermaid from 'mermaid';
import circularLayouts, { setCircularLayoutOptions } from '../src/index.js';
import type { CircularLayoutOptions } from '../src/index.js';

mermaid.registerLayoutLoaders(circularLayouts);
mermaid.initialize({ startOnLoad: false, theme: 'neutral' });

const fm = '---\nconfig:\n  layout: circular\n---\n';

const diagrams: Record<string, string> = {
  chords:
    fm +
    `flowchart LR
  A --> B --> C --> D --> E --> F --> G --> H --> A
  A --> E
  B --> F
  C --> G
  A --> C
`,
  scrambled:
    fm +
    `flowchart LR
  A --> C
  A --> B
  B --> C
  C --> D
  D --> E
  E --> A
`,
  months:
    fm +
    `flowchart LR
  N1[Jan] --> N2[Feb] --> N3[Mar] --> N4[Apr] --> N5[May] --> N6[Jun]
  N6 --> N7[Jul] --> N8[Aug] --> N9[Sep] --> N10[Oct] --> N1
`,
};

interface Variant {
  label: string;
  options: CircularLayoutOptions;
  only?: keyof typeof diagrams;
}

const suites: Record<string, Variant[]> = {
  bow: [
    { label: 'bow 0 — straight chords', options: { bow: 0 }, only: 'chords' },
    { label: 'bow 0.35 — the default', options: { bow: 0.35 }, only: 'chords' },
    { label: 'bow 0.6 — deep', options: { bow: 0.6 }, only: 'chords' },
    { label: 'bow -0.4 — outward', options: { bow: -0.4 }, only: 'chords' },
  ],
  swerve: [
    { label: 'swerve 0 — diameters stab the center', options: { swerve: 0 }, only: 'chords' },
    { label: 'swerve 0.2', options: { swerve: 0.2 }, only: 'chords' },
    { label: 'swerve 0.35 — wide braid', options: { swerve: 0.35 }, only: 'chords' },
  ],
  ordering: [
    { label: 'follow-edges', options: { ordering: 'follow-edges' } },
    { label: 'input order', options: { ordering: 'input' } },
  ],
  spacing: [
    { label: 'spacing 16', options: { spacing: 16 }, only: 'months' },
    { label: 'spacing 40 — the default', options: { spacing: 40 }, only: 'months' },
    { label: 'spacing 90', options: { spacing: 90 }, only: 'months' },
  ],
  samples: [
    { label: '6 samples', options: { samples: 6 }, only: 'months' },
    { label: '24 samples — the default', options: { samples: 24 }, only: 'months' },
  ],
};

const params = new URLSearchParams(location.search);
const suiteName = params.get('suite') ?? 'bow';
const suite = suites[suiteName] ?? suites.bow!;
document.querySelector('#heading')!.textContent = `trials — ${suiteName}`;

const rows = document.querySelector('#rows')!;
let serial = 0;

for (const variant of suite) {
  const row = document.createElement('div');
  row.className = 'row';
  const h = document.createElement('h2');
  h.textContent = variant.label;
  const cells = document.createElement('div');
  cells.className = 'cells';
  row.append(h, cells);
  rows.append(row);

  const names = variant.only ? [variant.only] : (Object.keys(diagrams) as (keyof typeof diagrams)[]);
  for (const name of names) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cells.append(cell);
    setCircularLayoutOptions(variant.options);
    try {
      const { svg } = await mermaid.render(`trial-${serial++}`, diagrams[name]!);
      cell.innerHTML = svg;
    } catch (error) {
      const message = document.createElement('div');
      message.className = 'error';
      message.textContent = String(error);
      cell.replaceChildren(message);
    }
  }
}

(document.body as HTMLElement).dataset.done = 'true';
