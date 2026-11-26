# Playground design

Date: 2026-11-26. Covers mermaid-layout-circular and
pele-layout-circular.

## Why

Visitors should be able to try the circular layout before they install
anything. Today the only way to see it on your own diagram is to set
up mermaid or Pele. Each package gets a playground on GitHub Pages: a
page where a visitor picks an example, edits its text, and sees it
drawn. Each README links to it.

## What the page does

```
┌───────────────────────────────────────────────────────────┐
│ mermaid-layout-circular · playground       README · npm   │
│ Example: [ The water cycle            ▾ ]                 │
│ [■ Circular]  [ Clockwise ▾ ]  [□ Straight edges]  …      │
├────────────────────────────┬──────────────────────────────┤
│ ---                        │                              │
│ config:                    │      (live preview)          │
│   layout: circular         │                              │
│ ---                        │                              │
│ flowchart LR               │                              │
│   E[Evaporation] --> …     │                              │
└────────────────────────────┴──────────────────────────────┘
```

Decided by Andrew:

- **An example drop-down.** Picking an example puts its text in the
  editor.
- **A quick editor.** A row of controls for the frontmatter settings,
  so a visitor learns what is available without knowing the syntax.
- **One preview, not two side by side.** A **Circular** toggle switches
  between the circular layout and the renderer's default (dagre in
  mermaid, Pele's own layout in Pele).
- **A Straight edges toggle** switches between `curve: linear` and the
  default curved arrows.
- **A README link** to the playground in both repos.

Proposed by Claude and accepted in the playback:

- **The controls write into the text.** The editor text is the only
  state. A control edits the frontmatter in the text. Typing a setting
  by hand moves the control to match. What is drawn is always the
  text, so a visitor can copy it into their own diagram.
- **Direction** is a select, Clockwise or Counter-clockwise. It writes
  `layout: circular` or `layout: circular-ccw`. It is disabled while
  Circular is off.
- **Hand-drawn** is a toggle in mermaid only. It writes
  `look: handDrawn`. Pele has no hand-drawn look.
- **The editor is a plain `<textarea>`.** No code-editor library. The
  preview redraws a short moment after typing stops. A render error
  shows in place of the drawing, and the last good drawing is not
  kept.
- **Each example has its own link,** so a visitor can share it.

## Approaches

1. **One playground per repo, YAML edited with the `yaml` library.**
   Chosen. Each repo's `demo/` gets a playground page, built by Vite
   and deployed by that repo's Pages workflow. The controls parse the
   frontmatter with [`yaml`](https://eemeli.org/yaml/)'s Document API,
   change one key, and write it back. This keeps a visitor's comments
   and key order. It reads every YAML form a visitor might type, such
   as `flowchart: { curve: linear }`. `yaml` is a dev dependency used
   by the demo only. The published package keeps no runtime
   dependencies. The cost is one dev dependency per repo and about
   35 KB gzipped on the page.
2. **One playground per repo, hand-written line edits.** No new
   dependency. It adds and removes the exact lines the controls
   write. It misreads a setting written in any other YAML form, and
   the controls then disagree with the drawing. Rejected.
3. **One combined playground with a renderer switch.** It would live
   in one repo and serve the other's package, against the repo
   boundaries. Rejected.
4. **Shared playground code in layout-circular.** It would put page
   code into the placement-math package. Rejected.

The two playgrounds repeat about a hundred lines of page code. That is
the cost of keeping each repo self-contained.

## How each control maps to the frontmatter

Settings live under `config:` in the frontmatter, as both renderers
read them. Paths below are under `config`.

| Control | On | Off | Reads as on when |
| --- | --- | --- | --- |
| Circular | sets `layout` to `circular` or `circular-ccw`, per Direction | deletes `layout` | `layout` starts with `circular` |
| Direction | `layout: circular` | `layout: circular-ccw` | `layout` is `circular-ccw` (Counter-clockwise) |
| Straight edges | sets `flowchart.curve: linear` | deletes `flowchart.curve` | `flowchart.curve` is `linear` |
| Hand-drawn (mermaid) | sets `look: handDrawn` | deletes `look` | `look` is `handDrawn` |

Rules:

- Deleting the last key of a map deletes the map: no empty
  `flowchart:` or `config:` is left behind. If the frontmatter ends
  up empty, the `---` block goes too.
- Text with no frontmatter gets a new block at the top when a control
  turns something on.
- Direction is remembered while Circular is off. Turning Circular back
  on restores it.
- A value the controls don't write, such as `layout: elk` or
  `curve: basis`, shows its control as off. Turning the control on
  replaces the value.
- Frontmatter that does not parse as YAML disables the controls until
  it parses again. The preview still tries to draw and shows the
  renderer's error.
- mermaid `%%{init: …}%%` directives are left alone. The controls
  read and write the frontmatter only.

## Examples

The drop-down offers the examples in `docs/GALLERY.md`, under its
section names (Shapes, Groups, Arrows, Other) as `<optgroup>`s, with
its headings as the labels. Each is already a demo case with a `doc`
name. The existing `Case` type in `demo/cases.ts` gets one optional
field holding the label and, optionally, the gallery section. Only
cases with it are listed. A case that shows the default layout, such
as `water-cycle-dagre`, is not listed; the Circular toggle shows that.
mermaid's `hand-drawn` case is not listed either; the Hand-drawn
toggle shows that look.

The water cycle (`water-cycle`) is the first entry and the one a bare
link opens. It is in the README, not in `docs/GALLERY.md`, so it
stands alone above the section groups, with no section. (Claude's
call: this needs no doc edits and no new picture.)

In Pele, a case's text is `circularSource(c)`.

## Links

- The URL hash names the example: `#example=<doc name>`.
- Once the visitor edits the text, the hash holds the text instead:
  `#text=<base64url of the UTF-8 text>`. No compression library.
  Opening such a link fills the editor with that text and sets the
  drop-down to a "Your diagram" entry. (Claude's call: "each example
  has its own link" read as "a visitor can share what they made".)
- The hash is updated with `history.replaceState`, so editing does not
  fill the back button's history.

## Where it goes

### mermaid-layout-circular

- The playground becomes the site's front page, `demo/index.html`.
  The current grid of every case moves to `demo/gallery.html`. Both
  pages are in the Pages build (`demo/vite.config.ts`), with trials and
  review as before.
- `npm run dev` serves the playground at `/`; the gallery moves to
  `/gallery.html`. `CLAUDE.md` and `docs/PUBLISHING.md` say so.
  `scripts/render-docs.mjs` loads `docs.html` and needs no change.
- README: a line near the top links the playground. The "live gallery"
  links in README and `docs/GALLERY.md` point to `gallery.html`.

### pele-layout-circular

- Same layout: the playground at `demo/index.html`, the side-by-side
  grid moved to `demo/gallery.html`.
- A new `demo/vite.config.ts` and `.github/workflows/pages.yml`,
  copied from mermaid's, including the deploy retries.
- Pages is turned on once in the repo settings: Pages → Source →
  GitHub Actions. Andrew does this, or approves Claude doing it with
  `gh api`.
- The page keeps the demo's light and dark theme switch.
- README: a line near the top links the playground. Pele has no live
  gallery link yet. README and `docs/GALLERY.md` each get one, worded
  as mermaid's, pointing to `gallery.html`. The existing
  `[gallery](docs/GALLERY.md#groups)` link stays as it is. (Claude's
  call.)
- `CLAUDE.md` and `docs/PUBLISHING.md` describe the Pages site, as in
  mermaid.

## Testing

- The frontmatter editing is a pure module, `demo/frontmatter.ts`
  (text in, text out), with vitest tests for every rule above.
- The page is judged by rendering it: every example, each control on
  and off, a phone-width viewport, and a pasted link.
- `npm test`, `npm run lint` and `npm run build` pass in both repos.
- After the first push, check the Pages run and the live page.

## Decisions to record

Each repo's `docs/DECISIONS.md` gets an entry for its playground, when
the change lands there.

## Non-goals

- No side-by-side comparison on the playground. The gallery pages keep
  theirs.
- No code-option controls, such as `hub` or `spacing`. They are set in
  code, not in frontmatter.
- No syntax highlighting or code-editor library.
- No playground for obsidian-mermaid-circular.

## Left to the builder

- The page's look, within each demo's existing style.
- The debounce delay and the layout on phones (stacked).
- The exact optional field added to `Case`.
- Header links (README, npm) and showing the package and renderer
  versions.
