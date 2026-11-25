import mermaid from 'mermaid';
import circularLayouts from '../src/index.js';
import { cases } from './cases.js';

// Renders the one case named by ?case=<doc>, at natural size, for
// scripts/render-docs.mjs to screenshot. Same setup as the gallery.
mermaid.registerLayoutLoaders(circularLayouts);
mermaid.initialize({ startOnLoad: false, theme: 'neutral' });

const doc = new URLSearchParams(location.search).get('case');
const found = cases.find((c) => c.doc === doc);
if (!found) {
  throw new Error(`no case with doc ${doc}`);
}

const shot = document.querySelector<HTMLElement>('#shot')!;
const { svg } = await mermaid.render('doc', found.text);
shot.innerHTML = svg;

// mermaid sizes its SVG to fit the page. Draw it at its own size
// instead, so every picture has the same text size.
const el = shot.querySelector('svg')!;
el.style.maxWidth = 'none';
el.setAttribute('width', String(el.viewBox.baseVal.width));
el.setAttribute('height', String(el.viewBox.baseVal.height));

await document.fonts.ready;
document.body.dataset.done = 'true';
