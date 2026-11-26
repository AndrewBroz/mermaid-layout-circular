# Publishing

## npm

The package publishes as `mermaid-layout-circular`. Releases ride
tags: bump the version, tag `v<version>`, push the tag, and
`.github/workflows/release.yml` runs the gates and publishes with
provenance. The workflow skips cleanly if the version is already on
the registry.

One-time setup, in order:

1. First publish happens locally (trusted publishing can only be
   configured for a package that already exists): `npm login`, then
   `npm publish` from a clean checkout of main.
2. On npmjs.com: package → Settings → Trusted publisher → GitHub
   Actions, repository `AndrewBroz/mermaid-layout-circular`,
   workflow `release.yml`. After this, no tokens exist anywhere.
3. Within 48 hours of saving the trusted publisher, publish a new
   version from the workflow. npm marks the configuration as not yet
   validated until a workflow run publishes with it. Re-running an
   old tag doesn't count, because the workflow skips versions
   already on the registry.

## Demo site

`.github/workflows/pages.yml` builds the demo site
(`vite build demo`) and deploys it to GitHub Pages on every push to
main. Repo setting, once: Pages → Source → GitHub Actions. The
playground lands at `https://andrewbroz.github.io/mermaid-layout-circular/`
and the gallery at `/gallery.html`, with
`/review.html?set=circles|user|kinks` and `/trials.html` intact.

## Obsidian community plugins

The plugin submits from its own repo
([obsidian-mermaid-circular](https://github.com/AndrewBroz/obsidian-mermaid-circular))
via a PR to
[obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases),
appending to `community-plugins.json`:

```json
{
  "id": "mermaid-circular",
  "name": "Mermaid Circular Layout",
  "author": "Andrew Broz",
  "description": "Adds a circular layout for mermaid flowcharts: set layout: circular in a diagram's frontmatter and cycles render as rings.",
  "repo": "AndrewBroz/obsidian-mermaid-circular"
}
```

Already satisfied on the plugin repo: release tags match
`manifest.json` exactly, releases carry `main.js` + `manifest.json`,
`id`/`name` follow the naming rules, LICENSE and README present.
The PR text and any exchanges with reviewers are written by the
author, not generated.

## README pictures

Redraw them with `npm run docs:images`, on macOS (mermaid's font list
starts with fonts macOS has). `--only id,id` redraws some of them. npm
shows README images from `main`, not from the published version. So
never rename or delete a picture the latest npm README still uses. Add
the new file, and delete the old one after the next publish. Redrawing
a picture under its own name is fine.
