# mermaid-layout-circular

The circular layout for the mermaid codebase. Read `README.md` and
`docs/DECISIONS.md` first.

## Where work belongs

- The placement math lives in layout-circular (`../layout-circular`).
  Change it there, never by copying it here.
- What only mermaid needs stays in `src/render.ts`.
- The Pele layout is `../pele-layout-circular`. The Obsidian plugin is
  `../obsidian-mermaid-circular`.
- Record each decision in the repo where the change is made, when it
  is made.

## Rules

- No runtime dependencies. mermaid is a peer; layout-circular is
  compiled into the bundle.
- Rendering goes through mermaid's `InternalHelpers`. Keep the peer
  range in `package.json` matched to the versions tested.
- Visual changes are judged by rendering. `npm run dev` serves the
  gallery at `/` and the trials at `/trials.html?suite=ordering`
  (also `spacing`, `samples`).

## Docs

README and docs follow `../layout-circular/docs/DOCS-STYLE.md`.
Redraw README pictures with `npm run docs:images`. It renders every
demo case with a `doc` name in `demo/cases.ts`, on macOS, in the
installed Chrome. Never rename or delete a picture the latest npm
README still uses; npm loads README images from `main`.

## Gates

`npm test`, `npm run lint` and `npm run build`, all green before
committing.
