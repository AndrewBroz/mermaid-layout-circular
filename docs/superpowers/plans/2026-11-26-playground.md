# Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A GitHub Pages playground in mermaid-layout-circular and in
pele-layout-circular: pick an example, edit its text, flip frontmatter
controls, see it drawn.

**Architecture:** Each repo's `demo/` gets the same two pure modules
(`frontmatter.ts` edits frontmatter with the `yaml` library; `share.ts`
reads and writes the URL hash) and its own page wiring
(`playground.ts`) for its renderer. The playground becomes
`demo/index.html`; today's grid moves to `demo/gallery.html`. Vite
builds the demo; a Pages workflow deploys it.

**Tech Stack:** TypeScript, Vite 7, vitest 4, `yaml` 2.x (dev
dependency), mermaid 12 / Pele 1.13.

**Spec:** `docs/superpowers/specs/2026-11-26-playground-design.md`
(in mermaid-layout-circular). Read it first.

## Global Constraints

- No runtime dependencies. `yaml` goes in `devDependencies` and is
  imported only from `demo/`. The peer ranges don't change.
- Never rename or delete a picture in `docs/media`.
- Docs follow `../layout-circular/docs/DOCS-STYLE.md`: short plain
  sentences, one idea each.
- `npm test`, `npm run lint` and `npm run build` pass before every
  commit.
- Stage files by name. Never `git add -A`. Check `git status --short`
  before each commit; screenshots and `.playwright-mcp/` stay out.
- Commit subject: `type: lowercase summary — clause`. Body in prose.
  Last line of the body: `(generated using Claude Opus 5.5)`. No
  `Co-Authored-By` or session trailers.
- Work on branch `feat/playground` in each repo. Merge into `main`
  locally with `git merge --no-ff -m "Merge feat/playground: <summary>"`.

## Review Focus

1. Fast typing in mermaid: `mermaid.render` is async, so an older
   render can finish after a newer one. Only the latest text's result
   may reach the preview. (Task 3 test via a render token.)
2. A shared link with non-ASCII text (accents, emoji, CJK) opens with
   the same text. (Task 2 test.)
3. A broken hash (`#text=%%%`, `#example=nope`) opens the water cycle
   and doesn't throw. (Task 2 test.)
4. Frontmatter a visitor typed: comments, flow maps, quoted values,
   CRLF line endings. Controls read it right, and toggling keeps the
   comments. (Task 1 tests.)
5. After a render error, the next valid text draws normally and no
   stray mermaid error SVG is left in `<body>`. (Task 3: initialize
   with `suppressErrorRendering: true`; checked by rendering.)

---

## mermaid-layout-circular

### Task 1: The frontmatter module

**Files:**
- Create: `demo/frontmatter.ts`
- Test: `demo/frontmatter.test.ts`
- Modify: `package.json` (devDependency `yaml@^2.9.1`)

**Interfaces:**
- Produces:
  - `type ConfigPath = readonly string[]` — a path under `config`.
  - `readConfig(text: string): Record<string, unknown> | undefined` —
    the `config` map of the text's frontmatter. `{}` when there is no
    frontmatter or no `config`. `undefined` when the frontmatter
    doesn't parse as YAML.
  - `setConfig(text: string, path: ConfigPath, value: string | undefined): string`
    — sets `config.<path>` to `value`, or deletes it when `value` is
    `undefined`. Returns the text unchanged when the frontmatter
    doesn't parse.

Frontmatter is the block from a first line `---` to the next line
`---`, as mermaid reads it. Allow `\r\n`. Edit with `yaml`'s
`parseDocument`, `setIn` and `deleteIn`, and write back with
`doc.toString()`, so comments and key order stay.

- [ ] **Step 1: Install** `npm install -D yaml@^2.9.1`.

- [ ] **Step 2: Write the failing tests** in `demo/frontmatter.test.ts`:

```ts
const body = 'flowchart LR\n  A --> B\n';
const fm = (yaml: string) => `---\n${yaml}---\n${body}`;

test('reads config', () => {
  expect(readConfig(fm('config:\n  layout: circular\n'))).toEqual({ layout: 'circular' });
});
test('no frontmatter reads as empty', () => {
  expect(readConfig(body)).toEqual({});
});
test('broken YAML reads as undefined and is not edited', () => {
  const text = fm('config:\n  layout: [\n');
  expect(readConfig(text)).toBeUndefined();
  expect(setConfig(text, ['layout'], 'circular')).toBe(text);
});
test('flow maps and quoted values read the same', () => {
  expect(readConfig(fm('config: { layout: "circular-ccw", flowchart: { curve: linear } }\n')))
    .toEqual({ layout: 'circular-ccw', flowchart: { curve: 'linear' } });
});
test('CRLF frontmatter reads', () => {
  expect(readConfig('---\r\nconfig:\r\n  layout: circular\r\n---\r\n' + body))
    .toEqual({ layout: 'circular' });
});
test('adds a block to text without one', () => {
  expect(setConfig(body, ['layout'], 'circular')).toBe(fm('config:\n  layout: circular\n'));
});
test('sets a nested key', () => {
  expect(setConfig(fm('config:\n  layout: circular\n'), ['flowchart', 'curve'], 'linear'))
    .toBe(fm('config:\n  layout: circular\n  flowchart:\n    curve: linear\n'));
});
test('deleting the last key removes its map', () => {
  expect(setConfig(fm('config:\n  layout: circular\n  flowchart:\n    curve: linear\n'), ['flowchart', 'curve'], undefined))
    .toBe(fm('config:\n  layout: circular\n'));
});
test('deleting the last key of all removes the block', () => {
  expect(setConfig(fm('config:\n  layout: circular\n'), ['layout'], undefined)).toBe(body);
});
test('other keys and comments stay', () => {
  const text = fm('title: Water\n# the layout\nconfig:\n  layout: circular # here\n  theme: neutral\n');
  const out = setConfig(text, ['look'], 'handDrawn');
  expect(out).toContain('# the layout');
  expect(out).toContain('# here');
  expect(out).toContain('title: Water');
  expect(readConfig(out)).toEqual({ layout: 'circular', theme: 'neutral', look: 'handDrawn' });
});
test('a flow map stays a flow map', () => {
  const out = setConfig(fm('config: { layout: circular }\n'), ['layout'], 'circular-ccw');
  expect(out).toBe(fm('config: { layout: circular-ccw }\n'));
});
test('deleting a missing key changes nothing', () => {
  const text = fm('config:\n  layout: circular\n');
  expect(setConfig(text, ['look'], undefined)).toBe(text);
});
```

- [ ] **Step 3: Run** `npx vitest run demo/frontmatter.test.ts`.
  Expected: FAIL, module not found.

- [ ] **Step 4: Implement** `readConfig` and `setConfig` in
  `demo/frontmatter.ts`. After a delete, walk up the path: delete each
  map left empty, then `config` if empty. If the document's top map
  is then empty, drop the `---` block. Keep the text's own line ending
  when writing the block back. If the `yaml` output for a flow map
  differs in spacing from the test, adjust the test to `yaml`'s
  output, not the code.

- [ ] **Step 5: Run** `npx vitest run demo/frontmatter.test.ts`.
  Expected: PASS. Then the three gates.

- [ ] **Step 6: Commit** `demo/frontmatter.ts`,
  `demo/frontmatter.test.ts`, `package.json`, `package-lock.json`.
  Subject: `feat: playground frontmatter edits — yaml keeps comments and order`.

### Task 2: The share module and the example list

**Files:**
- Create: `demo/share.ts`
- Test: `demo/share.test.ts`
- Modify: `demo/cases.ts` (new `example` field, set on listed cases)

**Interfaces:**
- Produces:
  - `type Shared = { example: string } | { text: string }`
  - `readHash(hash: string): Shared | undefined` — parses
    `#example=<name>` or `#text=<base64url>`. `undefined` for an
    empty or broken hash.
  - `writeHash(shared: Shared): string` — the hash, with `#`.
  - In `cases.ts`: `Case.example?: { label: string; section?: 'Shapes' | 'Groups' | 'Arrows' | 'Other' }`,
    and `examples: Case[]`, the cases with `example`, water cycle
    first, then in `docs/GALLERY.md` order.

The example's link name is its `doc` name. Text is UTF-8, encoded as
base64url without padding (`TextEncoder`, `btoa`, then `+/` → `-_`).

- [ ] **Step 1: Write the failing tests** in `demo/share.test.ts`:

```ts
test('example round-trips', () => {
  expect(readHash(writeHash({ example: 'hub' }))).toEqual({ example: 'hub' });
});
test('non-ASCII text round-trips', () => {
  const text = 'flowchart LR\n  A[Évaporation 🌧️] --> B[凝結]\n';
  expect(readHash(writeHash({ text }))).toEqual({ text });
});
test('the text hash is URL-safe', () => {
  expect(writeHash({ text: '>>>???' })).toMatch(/^#text=[A-Za-z0-9_-]*$/);
});
test.each(['', '#', '#text=%%%', '#text=@@', '#nothing=1'])('broken hash %j reads as undefined', (h) => {
  expect(readHash(h)).toBeUndefined();
});
test('every example has a doc name and the water cycle is first', () => {
  expect(examples[0]?.doc).toBe('water-cycle');
  for (const c of examples) expect(c.doc).toBeTruthy();
});
test('every GALLERY.md heading is an example', () => {
  const md = readFileSync('docs/GALLERY.md', 'utf8');
  const headings = [...md.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
  expect(examples.slice(1).map((c) => c.example?.label)).toEqual(headings);
});
```

An unknown example name (`#example=nope`) parses here. The page
treats a name no example has as no hash (Task 3).

- [ ] **Step 2: Run** `npx vitest run demo/share.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** `readHash` and `writeHash` in
  `demo/share.ts`. Catch decode errors and return `undefined`;
  decode with `TextDecoder` in `fatal` mode so bad UTF-8 is caught too.

- [ ] **Step 4: Add `example`** to `Case` and set it on the water
  cycle (label `The water cycle`, no section) and on the case behind
  each `### ` heading of `docs/GALLERY.md`, labelled with the heading
  and its `## ` section. Match each heading to its case by the picture
  name under it. Export `examples`. Leave `water-cycle-dagre` and
  `hand-drawn` unlisted.

- [ ] **Step 5: Run** the tests and the three gates. Expected: PASS.

- [ ] **Step 6: Commit** `demo/share.ts`, `demo/share.test.ts`,
  `demo/cases.ts`. Subject: `feat: playground links and examples — the gallery's headings, water cycle first`.

### Task 3: The playground page, and the gallery moves

**Files:**
- Rename: `demo/index.html` → `demo/gallery.html`, `demo/main.ts` → `demo/gallery.ts` (`git mv`; fix the script src)
- Create: `demo/index.html`, `demo/playground.ts`
- Modify: `demo/vite.config.ts` (add `gallery` input)

**Interfaces:**
- Consumes: `readConfig`, `setConfig` (Task 1); `readHash`,
  `writeHash`, `examples` (Task 2).

What the page does is in the spec, sections "What the page does",
"How each control maps to the frontmatter" and "Links". Points the
spec leaves to this task:

- Controls: Circular (checkbox), Direction (select, Clockwise /
  Counter-clockwise), Straight edges (checkbox), Hand-drawn
  (checkbox). Each control's `<label>` shows the line it writes, such
  as `layout: circular`, in `<code>`, so the syntax is visible.
- `mermaid.initialize({ startOnLoad: false, theme: 'neutral', suppressErrorRendering: true })`.
- Render through a monotonically increasing token: each render takes
  the next token, and a result whose token isn't the latest is
  dropped.
- Typing re-reads the controls at once and redraws 300 ms after the
  last keystroke. A control change redraws at once.
- The hash is written with `history.replaceState`. A loaded hash
  whose example name no example has falls back to the water cycle.
- When `readConfig` returns `undefined`, the controls are disabled.
- The page keeps the last Direction in a variable. Turning Circular
  off and on restores it. Its initial value is read from the loaded
  text, clockwise by default.
- Picking an example replaces the text and writes `#example=<doc>`.
  Any edit writes `#text=…` and selects a "Your diagram" option, added
  to the top of the drop-down only while it is in use.
- A header with the page name, links to the README on GitHub, the
  gallery (`gallery.html`) and npm, and the mermaid and package
  versions (`mermaid.version` isn't exported in all builds; import the
  versions from `package.json` with Vite's JSON import).
- Editor and preview side by side on wide screens, stacked under
  760 px. The look follows the gallery's: Georgia, `--paper`, `--ink`.

- [ ] **Step 1: Move the gallery** with `git mv`, fix its script tag,
  add `gallery` to `demo/vite.config.ts` inputs.

- [ ] **Step 2: Write `demo/index.html` and `demo/playground.ts`.**

- [ ] **Step 3: Check by rendering.** Start the dev server
  (`.claude/launch.json` running `npm run dev`). Check: each example
  draws; each control on and off changes both the text and the
  drawing; typing `flowchart: { curve: linear }` by hand ticks
  Straight edges; broken YAML disables the controls; an error, then
  valid text, draws cleanly with no stray SVG in `<body>`; a copied
  `#text=` link with an emoji opens the same text; `/gallery.html`
  still draws every case; 375 px width stacks and doesn't scroll
  sideways. Run `npx vite build demo` and open `demo/dist/index.html`
  through `npx vite preview demo` to check the built paths.

- [ ] **Step 4: Gates, then commit** the renamed and new files and
  `demo/vite.config.ts`. Subject: `feat: playground at the front of the demo site — the gallery moves to gallery.html`.

### Task 4: mermaid docs

**Files:**
- Modify: `README.md`, `docs/GALLERY.md`, `docs/PUBLISHING.md`,
  `CLAUDE.md`, `docs/DECISIONS.md`

- [ ] **Step 1: README.** After the first picture's paragraph about
  frontmatter, or right under the intro, add one sentence linking
  `https://andrewbroz.github.io/mermaid-layout-circular/` as the
  playground ("Try it in the [playground](…): pick an example, edit
  it, and switch the settings."). The two "live gallery" links go to
  `https://andrewbroz.github.io/mermaid-layout-circular/gallery.html`.
  The "Try it" section near line 205 names the playground at `/` and
  the gallery at `/gallery.html`.
- [ ] **Step 2: `docs/GALLERY.md`.** Live gallery link to
  `gallery.html`; one sentence linking the playground.
- [ ] **Step 3: `docs/PUBLISHING.md` "Demo site" and `CLAUDE.md`
  "Rules".** The playground at `/`, the gallery at `/gallery.html`.
- [ ] **Step 4: `docs/DECISIONS.md`.** A dated entry,
  `**2026-11-26 — A playground.**`: what the page does, why controls
  write into the text, why `yaml` (a dev dependency for the demo
  only), why the gallery moved, and that Pele has the same page. Link
  the spec.
- [ ] **Step 5: Gates, then commit** the five files. Subject:
  `docs: the playground — README links it, the gallery moves to gallery.html`.

## pele-layout-circular

Branch `feat/playground` in `../pele-layout-circular`.

### Task 5: Pele's playground

**Files:**
- Create: `demo/frontmatter.ts`, `demo/frontmatter.test.ts`,
  `demo/share.ts`, `demo/share.test.ts` (copied from
  mermaid-layout-circular, unchanged except the GALLERY test's
  headings check against Pele's `docs/GALLERY.md`)
- Rename: `demo/index.html` → `demo/gallery.html`, `demo/main.ts` → `demo/gallery.ts`
- Create: `demo/index.html`, `demo/playground.ts`, `demo/vite.config.ts`
  (copied from mermaid's, with Pele's inputs: `index`, `gallery`)
- Create: `.github/workflows/pages.yml` (copied from mermaid's)
- Modify: `demo/cases.ts`, `package.json`, `eslint.config.mjs` (ignore `demo/dist/`)

**Interfaces:**
- Consumes the same module interfaces as Tasks 1 and 2.
- A Pele case's text is `circularSource(c)`. The first Pele case,
  `anatomy` ("All the parts in one diagram"), is in Pele's gallery,
  so its list differs from mermaid's.

Differences from mermaid's page:

- Render with `render(text).svg` from `pele`, after
  `register(withCircularLayout(flowchart))`. It is synchronous, so no
  token is needed.
- No Hand-drawn control.
- Keep the light and dark theme switch and the `--pele-*` variables
  from the current demo.
- The header shows the Pele and package versions.

- [ ] **Step 1:** `npm install -D yaml@^2.9.1`; copy the two modules
  and their tests; run `npx vitest run demo`. Expected: the share
  test's examples checks FAIL (no `example` field yet), the rest pass.
- [ ] **Step 2:** Add `example` to Pele's `Case` and `examples`, as in
  Task 2 Step 4. Run the tests. Expected: PASS.
- [ ] **Step 3:** Move the gallery, add `demo/vite.config.ts`, write
  the page.
- [ ] **Step 4: Check by rendering**, as in Task 3 Step 3, minus the
  async and Hand-drawn checks, plus the theme switch.
- [ ] **Step 5:** Copy `pages.yml`. Check its build line is
  `npx vite build demo` and its artifact path is `demo/dist`.
- [ ] **Step 6: Gates, then commit** the new and renamed files,
  `demo/cases.ts`, `package.json`, `package-lock.json`,
  `eslint.config.mjs`, `.github/workflows/pages.yml`. Subject:
  `feat: a playground on GitHub Pages — the gallery moves to gallery.html`.

### Task 6: Pele docs

**Files:**
- Modify: `README.md`, `docs/GALLERY.md`, `docs/PUBLISHING.md`,
  `CLAUDE.md`, `docs/DECISIONS.md`

- [ ] **Step 1: README.** One sentence near the top linking
  `https://andrewbroz.github.io/pele-layout-circular/` as the
  playground, worded as mermaid's. A new live-gallery link to
  `gallery.html`, worded as mermaid's, next to the GALLERY.md link at
  the end of "More shapes". The `#groups` link stays.
- [ ] **Step 2: `docs/GALLERY.md`.** A live-gallery link and a
  playground link, worded as mermaid's.
- [ ] **Step 3: `docs/PUBLISHING.md`** gets a "Demo site" section as
  mermaid's (workflow, one-time Pages setting, URLs). **`CLAUDE.md`**
  says `npm run dev` serves the playground at `/` and the gallery at
  `/gallery.html`.
- [ ] **Step 4: `docs/DECISIONS.md`.** A dated entry, as in Task 4,
  pointing to mermaid-layout-circular's spec by URL.
- [ ] **Step 5: Gates, then commit.** Subject: `docs: the playground — README links it, and the gallery is live`.

## Ship

### Task 7: Review, merge, deploy

- [ ] **Step 1:** A whole-branch review of both branches. Fix what it
  finds.
- [ ] **Step 2:** In each repo: `git checkout main`,
  `git merge --no-ff feat/playground -m "Merge feat/playground: <summary>"`,
  gates, `git push`.
- [ ] **Step 3:** Pele's Pages setting: Andrew turns it on (Pages →
  Source → GitHub Actions), or approves
  `gh api -X POST repos/AndrewBroz/pele-layout-circular/pages -f build_type=workflow`.
  Do this before Pele's push, so its first Pages run deploys.
- [ ] **Step 4:** Watch both pushes' `ci` and `pages` runs
  (`gh run watch`, in the background). Open both live playgrounds and
  the two gallery pages, and draw one example in each.
