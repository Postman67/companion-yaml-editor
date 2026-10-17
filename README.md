# Companion YAML Editor

A text (YAML) editor for [Bitfocus Companion](https://github.com/bitfocus/companion) buttons, for when a
button's actions, feedbacks and expressions get too long to manage comfortably in the web UI.

It is installed **into an existing Companion** (e.g. the macOS app from the installer), without modifying
`Companion.app`: it's packaged as a Companion connection module, and Companion serves the editor page at
`/instance/<connection label>/`. The page talks to Companion's own tRPC websocket API, the same one the web
UI uses, so it sees every change live.

**Status:** read-only. Pick a page and a button to see its full config as YAML, updated live.
The write path (diffing the edited YAML back into Companion mutations) comes next.

## Install

Companion must be running on this machine. Then:

```bash
npm install
npm run install-companion
```

This builds the module, imports it into Companion (like _Modules → Import module package_), and adds a
connection called `yaml_editor`, or updates the existing one. It prints the editor's URL, e.g.
`http://127.0.0.1:8888/instance/yaml_editor/`.

Companion's address is read from the launcher settings
(`~/Library/Application Support/companion/config.json`). Override it, or the connection label, with:

```bash
node scripts/install.mjs --url http://127.0.0.1:8000 --label my_editor
```

Running it again reinstalls in place (it briefly disables the connection to swap the files). Bumping the
`version` in `package.json` installs the new version and removes the old one.

## Compatibility

Targets **Companion 5.0.x**. Companion's internal tRPC API is not versioned, so the procedures and payloads
used here are typed by hand in [`src/web/CompanionApi.ts`](src/web/CompanionApi.ts) against Companion
5.0.0 (`d5ae3b4085`). The install script warns if it sees another version.

## Layout

| Path | What |
| --- | --- |
| `src/module/` | The Companion module: serves the page over Companion's `/instance/<label>/` route |
| `src/web/` | The editor page (CodeMirror + tRPC client) |
| `scripts/build.mjs` | Bundles the page into the module and packs `companion-yaml-editor-<version>.tgz` |
| `scripts/install.mjs` | Installs the package into a running Companion |
| `test/` | Vitest unit tests for the pure logic |

```bash
npm run check-types
npm test
```
