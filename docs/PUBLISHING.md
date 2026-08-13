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

## Demo site

`.github/workflows/pages.yml` builds the demo gallery
(`vite build demo`) and deploys it to GitHub Pages on every push to
main. Repo setting, once: Pages → Source → GitHub Actions. The
gallery lands at `https://andrewbroz.github.io/mermaid-layout-circular/`,
with `/review.html?set=circles|user|kinks` and `/trials.html` intact.

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

After the npm package exists, the plugin's dependency moves from
`github:AndrewBroz/mermaid-layout-circular` to the npm semver range,
which retires the `allowScripts` commit-hash pin.
