import mermaid from 'mermaid';
import mermaidPackage from 'mermaid/package.json';
import ownPackage from '../package.json';
import circularLayouts from '../src/index.js';
import { examples, type Example } from './cases.js';
import { readConfig, setConfig, type ConfigPath } from './frontmatter.js';
import { readHash, writeHash } from './share.js';

mermaid.registerLayoutLoaders(circularLayouts);
// suppressErrorRendering stops mermaid adding its error picture to
// the page; the playground shows the message itself.
mermaid.initialize({ startOnLoad: false, theme: 'neutral', suppressErrorRendering: true });

const find = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const editor = find<HTMLTextAreaElement>('#editor');
const preview = find<HTMLDivElement>('#preview');
const picker = find<HTMLSelectElement>('#example');
const circular = find<HTMLInputElement>('#circular');
const direction = find<HTMLSelectElement>('#direction');
const straight = find<HTMLInputElement>('#straight');
const handDrawn = find<HTMLInputElement>('#hand-drawn');
const layoutLine = find<HTMLElement>('#layout-line');
const controls = [circular, direction, straight, handDrawn];

find('#versions').textContent =
  `${ownPackage.name} ${ownPackage.version} · mermaid ${mermaidPackage.version}`;

// The drop-down: the visitor's own text while they edit, the water
// cycle, then the gallery's examples under its section names.
const yours = new Option('Your diagram', '');
for (const example of examples) {
  const option = new Option(example.label, example.name);
  if (!example.section) {
    picker.append(option);
    continue;
  }
  let group = picker.querySelector<HTMLOptGroupElement>(`optgroup[label="${example.section}"]`);
  if (!group) {
    group = document.createElement('optgroup');
    group.label = example.section;
    picker.append(group);
  }
  group.append(option);
}

// Drawing. mermaid renders asynchronously, so each render takes a
// token, and a result whose token is no longer the latest is dropped.
let latest = 0;
const draw = async () => {
  const token = ++latest;
  try {
    const { svg } = await mermaid.render(`playground-${token}`, editor.value);
    // mermaid's default securityLevel, strict, sanitizes the SVG, so text
    // from a shared link can't run script here.
    if (token === latest) {
      preview.innerHTML = svg;
    }
  } catch (error) {
    if (token === latest) {
      const message = document.createElement('div');
      message.className = 'error';
      message.textContent = error instanceof Error ? error.message : String(error);
      preview.replaceChildren(message);
    }
  }
};

// The controls show what the text says. Direction is remembered while
// Circular is off, so turning it back on restores it.
let counterClockwise = false;
const syncControls = () => {
  const config = readConfig(editor.value);
  for (const control of controls) {
    control.disabled = config === undefined;
  }
  if (config) {
    const { layout, flowchart, look } = config;
    const isCircular = typeof layout === 'string' && layout.startsWith('circular');
    if (isCircular) {
      counterClockwise = layout === 'circular-ccw';
    }
    circular.checked = isCircular;
    direction.value = counterClockwise ? 'circular-ccw' : 'circular';
    direction.disabled = !isCircular;
    layoutLine.textContent = `layout: ${counterClockwise ? 'circular-ccw' : 'circular'}`;
    const curve =
      typeof flowchart === 'object' && flowchart !== null
        ? (flowchart as Record<string, unknown>).curve
        : undefined;
    straight.checked = curve === 'linear';
    handDrawn.checked = look === 'handDrawn';
  }
  for (const control of controls) {
    control.closest('label')?.classList.toggle('disabled', control.disabled);
  }
};

/** Marks the text as the visitor's own and puts it in the link. */
const markYours = () => {
  if (!yours.parentElement) {
    picker.prepend(yours);
  }
  picker.value = '';
  history.replaceState(null, '', writeHash({ text: editor.value }));
};

const show = (text: string) => {
  editor.value = text;
  syncControls();
  void draw();
};

const showExample = (example: Example, link: boolean) => {
  yours.remove();
  picker.value = example.name;
  history.replaceState(null, '', link ? writeHash({ example: example.name }) : location.pathname);
  show(example.text);
};

/** Shows what the hash shares, or the water cycle. */
const showHash = () => {
  const shared = readHash(location.hash);
  if (shared && 'text' in shared) {
    show(shared.text);
    markYours();
    return;
  }
  const example = shared && examples.find((e) => e.name === shared.example);
  showExample(example ?? examples[0]!, example !== undefined);
};

let typing: ReturnType<typeof setTimeout> | undefined;
editor.addEventListener('input', () => {
  syncControls();
  markYours();
  clearTimeout(typing);
  // Redraw once typing pauses, not on every keystroke.
  typing = setTimeout(() => void draw(), 300);
});

picker.addEventListener('change', () => {
  const example = examples.find((e) => e.name === picker.value);
  if (example) {
    showExample(example, true);
  }
});

/** Writes one setting into the text and redraws. */
const write = (path: ConfigPath, value: string | undefined) => {
  clearTimeout(typing);
  show(setConfig(editor.value, path, value));
  markYours();
};

const layout = () => (counterClockwise ? 'circular-ccw' : 'circular');
circular.addEventListener('change', () =>
  write(['layout'], circular.checked ? layout() : undefined)
);
direction.addEventListener('change', () => {
  counterClockwise = direction.value === 'circular-ccw';
  write(['layout'], layout());
});
straight.addEventListener('change', () =>
  write(['flowchart', 'curve'], straight.checked ? 'linear' : undefined)
);
handDrawn.addEventListener('change', () =>
  write(['look'], handDrawn.checked ? 'handDrawn' : undefined)
);

window.addEventListener('hashchange', showHash);
showHash();
