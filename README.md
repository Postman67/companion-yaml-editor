# Companion Button Editor

A compact outline editor for [Bitfocus Companion](https://github.com/bitfocus/companion) buttons, for when a
button's actions, feedbacks and logic get too long to manage comfortably in Companion's own editor.

Each action or feedback is one line: its name, the connection, and a summary of its settings. `if` / `else`
blocks are indented and fold away. Click a line to edit it in place. Every change is sent straight to
Companion with the same calls its own editor uses, so both stay in sync live.

It is installed **into an existing Companion** (e.g. the macOS app from the installer), without modifying
`Companion.app`: it's packaged as a Companion connection module, and Companion serves the editor page at
`/instance/<connection label>/`. Open that from any browser that can reach Companion, e.g.
`http://mac-mini.local:8000/instance/button_editor/`.

## What it can do

- Browse pages and buttons, with live button previews.
- Outline view of every step, press/release/duration set, feedback and local variable, including nested
  logic (`if`, `while`, groups, `and`/`or` feedbacks).
- Drag actions and feedbacks by their handle (⠿) to reorder them, or to move them into or out of `if`/`else`
  blocks and groups (drop on a group's label to add to its end). Up/down arrows work too.
- Edit: settings (with the value/expression toggle), name, enable/disable, invert, connection, move up/down,
  duplicate, delete, and add from a searchable list.
- Button presses show a thumbnail of the target button, and link to it.
- Raw tab: the button's full stored config as YAML.

Not yet: adding steps or duration groups, style overrides, store-result settings, learn, and
dedicated controls for some internal field types (those fall back to editing the raw value).

## Install

Companion must be running on the machine you install from (Companion only accepts module imports locally).

```bash
npm install
npm run install-companion
```

This builds the module, imports it into Companion (like _Modules → Import module package_), and adds a
connection called `button_editor`, or updates the existing one. It prints the editor's URL.

Companion's address is read from the launcher settings
(`~/Library/Application Support/companion/config.json`). Override it, or the connection label, with:

```bash
node scripts/install.mjs --url http://127.0.0.1:8000 --label my_editor
```

Running it again reinstalls in place (it briefly disables the connection to swap the files). Bumping the
`version` in `package.json` installs the new version and removes the old one.

## Compatibility

Targets **Companion 5.1.x**. Companion's internal api is not versioned, so the procedures and payloads used
here are typed by hand in [`src/web/api/CompanionApi.ts`](src/web/api/CompanionApi.ts); see
[`docs/companion-5.1-api.md`](docs/companion-5.1-api.md). The install script warns if it sees another version.

Some logic is ported from Companion (MIT licence) so the editor behaves identically, marked at the top of
each file in [`src/web/companion/`](src/web/companion/).

## Development

| Path | What |
| --- | --- |
| `src/module/` | The Companion module: serves the page over Companion's `/instance/<label>/` route |
| `src/web/` | The editor page (React): `api/` Companion types and calls, `stores/` live state, `outline/` the editor, `raw/` the YAML view |
| `scripts/build.mjs` | Bundles the page into the module and packs `companion-yaml-editor-<version>.tgz` |
| `scripts/install.mjs` | Installs the package into a running Companion |
| `scripts/import-config.mjs` | Loads a Companion export into a **test** Companion (wipes its config) |
| `test/` | Vitest unit tests for the pure logic |

```bash
npm run check-types
npm test
```

To test against real buttons without risking a live system, run a separate Companion (from source, on another
port and config dir) and load a copy of your export with `scripts/import-config.mjs`. Point its connections
somewhere harmless first: a test Companion with real device addresses will connect to, and can control, real
equipment.
