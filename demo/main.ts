import mermaid from 'mermaid';
import circularLayouts, { setCircularLayoutOptions } from '../src/index.js';
import { cases } from './cases.js';

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
