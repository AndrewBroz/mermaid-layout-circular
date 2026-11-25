// Redraws the README and gallery pictures in docs/media: each demo
// case with a `doc` name, rendered by the repo's own mermaid in the
// installed Chrome, at 2x, on a white card. Run with
// `npm run docs:images`; pass `--only id,id` to redraw some of them.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cases } from '../demo/cases.ts';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'docs/media');
const onlyArg = process.argv.indexOf('--only');
const only = onlyArg === -1 ? undefined : new Set(process.argv[onlyArg + 1].split(','));
const docs = cases
  .map((c) => c.doc)
  .filter((doc) => doc !== undefined && (!only || only.has(doc)));

await mkdir(out, { recursive: true });
const server = await createServer({
  root: resolve(root, 'demo'),
  configFile: false,
  logLevel: 'warn',
  server: { port: 0 },
});
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    viewport: { width: 1600, height: 1400 },
  });
  const page = await context.newPage();
  for (const doc of docs) {
    await page.goto(`${base}docs.html?case=${doc}`);
    await page.waitForSelector('body[data-done]');
    const shot = page.locator('#shot');
    const box = await shot.boundingBox();
    await shot.screenshot({ path: resolve(out, `${doc}.png`), omitBackground: true });
    console.log(`${doc}.png  natural width ${Math.round(box.width)}`);
  }
} finally {
  await browser.close();
  await server.close();
}
