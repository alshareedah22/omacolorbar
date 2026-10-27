# OmaColorBar: color icons for Omarchy's built-in bar widgets

Date: 2026-10-27 · Status: design approved in chat, awaiting spec review

## Goal

Give the icons of Omarchy's built-in bar widgets (network, Bluetooth, audio, battery
and the rest) multi-color gradient icons in the same style as the BlackCode plugins
(OmaDBngin, OmaLangy, OmaTablePlus, Power Menu), without changing anything else about
those widgets: their popups, clicks, scroll actions, tooltips and settings stay
Omarchy's own.

## Constraints

- Never edit `/usr/share/omarchy/` and never load Omarchy's internal QML files by path.
- Omarchy has no icon-override setting, and a built-in widget's popup opens only from a
  live instance of that widget on the bar (`shell.summon` → `bar.summonBarWidget` finds
  the widget by its slot), so a widget that only *imitates* a built-in cannot open the
  built-in popup.
- A plugin has one bar-widget entry point; it may be added to the bar many times
  (`allowMultiple`), each copy with its own settings.
- Arch Linux trademark policy: the Arch logo is shown unaltered, in its official color
  `#1793D1`, never as a gradient.

## Approach (verified by a spike on 2026-10-27)

Each OmaColorBar copy **hosts the real built-in widget** and gives that widget's button
a color icon. This is the mechanism the verified marketplace plugin Stack
(`ianswope.stack`) uses to host other widgets:

1. The manifest declares a `service` entry point. The shell injects `barWidgetRegistry`
   into a plugin's service; the bar widget reads it back with
   `bar.shell.serviceFor(<own plugin id>)` (or `bar.barWidgetRegistry` when a bar hands
   it over directly).
2. The bar widget creates the built-in widget from `registry.widgets[id].component` in a
   `Loader`, and injects `bar`, `moduleName` (the built-in id) and `settings`, twice
   (immediately and with `Qt.callLater`), exactly as `Bar.qml` does.
3. It finds the hosted widget's `BarIconButton` (the item that has `iconComponent` and
   `glyphPaintedWidth`) and sets `iconComponent` to OmaColorBar's icon component.
   `BarIconButton` hides its glyph whenever `iconComponent` is set.
4. It binds to the button's `text` (the glyph Omarchy chose for the current state), looks
   the glyph up in `Icons.js`, and shows the matching drawing. If there is no drawing,
   it sets `iconComponent` back to `null`, so Omarchy's original glyph shows.

Spike result: hosting `omarchy.network` this way showed a color Ethernet icon, and a
click opened Omarchy's own network popup (Ethernet 1 Gbit, ping, traffic, DNS
provider); a second click closed it. The shell log had no warnings.

## Repository layout

| Path | Purpose |
|---|---|
| `manifest.json` | id `blackcode.omacolorbar`, kinds `service` + `bar-widget`, `allowMultiple: true`, settings schema |
| `Service.qml` | Receives `barWidgetRegistry` (plus the other injected service properties); does nothing else |
| `Panel.qml` | The bar widget: hosting, button lookup, icon swap, fallback and warning states |
| `Icons.js` | Pure table and functions: built-in id → glyph codepoint → drawing; level parsing; no QML |
| `LevelIcon.qml` | Code-drawn icons with a fill level: battery, Wi-Fi strength, speaker volume |
| `icons/*.svg` | Fixed gradient drawings; `icons/menu-omarchy.svg`, `icons/menu-arch.svg` |
| `icon.svg` | The plugin's own icon |
| `colorbar` | Helper: `swap` and `restore` for `~/.config/omarchy/shell.json` |
| `tests/` | Node tests for `Icons.js` and `colorbar`; SVG checks |
| `README.md`, `LICENSE` (MIT), `preview.png` | Docs and the marketplace poster |

## Settings (per copy)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `icon` | enum of supported ids | `omarchy.network` | Which built-in widget this copy hosts |
| `menuLogo` | `Omarchy` / `Arch` | `Omarchy` | Logo for the copy that hosts `omarchy.menu`; ignored by other copies |
| `host` | object | `{}` | The hosted widget's own settings, passed to it as `settings` |

Keys other than `icon`, `menuLogo` and `host` are not passed to the hosted widget.

## Icon catalogue

Glyphs are listed as Unicode codepoints as they appear in Omarchy's source today.

### Phase 1 (version 1.0.0)

| Built-in id | Glyph → state | Drawing |
|---|---|---|
| `omarchy.menu` | fixed (Omarchy font `e900`) | `menu-omarchy.svg` (the block logo, green gradient light `#c8e69c` → `#a8cd76` → deep `#5e9a35`) or `menu-arch.svg` (official Arch logo from `/usr/share/pixmaps/archlinux-logo.svg`, solid `#1793D1`) |
| `omarchy.network` | `f092f` `f091f` `f0922` `f0925` `f0928` Wi-Fi 0–4; `f0200` Ethernet; `f092e` disconnected | Wi-Fi: `LevelIcon` (wifi, level 0–4); Ethernet and disconnected: SVG |
| `omarchy.bluetooth` | `f00b2` off; `f00b1` connected; `f00af` on | 3 SVGs |
| `omarchy.audio` | `f02cb` headphones; `eee8` muted or zero; `f026` low; `f027` medium; `f028` high | headphones and muted: SVG; volume: `LevelIcon` (speaker, 1–3) |
| `omarchy.microphone` | `f036c` on; `f036d` muted | 2 SVGs |
| `omarchy.power` | discharging `f007a`…`f0082`, `f0079` (10 steps); charging `f089c` `f0086` `f0087` `f0088` `f089d` `f0089` `f089e` `f008a` `f008b` (9 steps); `f0085` full / charged | `LevelIcon` (battery, level 0–9, charging flag, full) |
| `omarchy.monitor` | `f0379` one screen; `f037a` several screens | 2 SVGs |
| `omarchy.system-update` | fixed `f021` | 1 SVG |
| `omarchy.agents` | fixed `f16a3` | 1 SVG |
| `omarchy.tailscale` | none: it already uses its own `iconComponent` (`TailscaleIcon` with `crossed` / `warning`) | 3 SVGs (connected, off, needs login); state source is open question 2 |

Text next to the glyph: when the button text is more than the glyph (battery with
percentage shown, e.g. `"73% 󰁹"`), the icon component draws the color icon plus the
remaining text in the bar's font and foreground color, and the slot keeps Omarchy's width.

### Phase 2 (version 1.1.0)

- `omarchy.weather`: 13 condition glyphs (`e302` `e308` `e30a` `e30d` `e318` `e31a` `e31d`
  `e327` `e32b` `e32e` `e333` `e33d` `e3ad`) plus temperature text.
- `omarchy.indicators`: Do Not Disturb, night light, stay awake, screen recording,
  dictation, reminder; several buttons inside one widget, so the button lookup becomes
  "every indicator button".
- Optional widgets: `omarchy.dropbox`, `omarchy.media`, `omarchy.elsewhen`.

Out of scope (text, not icons): clock, workspaces, tray, active window, keyboard layout, spacer.

## Visual style

Style A from the brainstorm: each icon has its own hues as a two-stop linear gradient,
a white highlight where it helps, and a soft shadow (the same shapes, black at 35%
opacity, offset 1.5/64). SVG viewBox `0 0 64 64`. At bar size the icon fills
`Style.bar.iconCanvas`, like any `BarIconButton` icon.

| Widget | Hues |
|---|---|
| Network | `#0ea5e9` → `#22d3ee`, accent `#a5f3fc` |
| Bluetooth | `#2563eb` → `#60a5fa` |
| Audio, microphone | audio `#f97316` → `#fbbf24`; microphone `#e11d48` → `#fb7185` |
| Battery | `#16a34a` → `#4ade80`, bolt `#facc15`; under 20% the fill turns `#f97316`, under 10% `#e11d48` |
| Display | `#7c3aed` → `#38bdf8` |
| Update | `#10b981` → `#6ee7b7` |
| Agents | `#8b5cf6` → `#ec4899` |
| Tailscale | `#64748b` → `#e2e8f0` (a generic dot grid, not Tailscale's logo) |
| Inactive parts (unlit Wi-Fi arcs, empty battery) | `#3b4252` |

## Failure behavior

| Situation | Behavior |
|---|---|
| Glyph not in `Icons.js` | `iconComponent = null`: Omarchy's original glyph shows |
| Registry not available | retry every 250 ms up to 20 times, then a warning icon with tooltip "OmaColorBar could not reach the widget registry" |
| Built-in id not in the registry (renamed, removed) | warning icon, tooltip "Omarchy has no widget `<id>`" |
| Hosted widget has no `BarIconButton` | leave the widget untouched (shows its own icon) and log once |
| Same built-in also on the bar directly | works; tooltip notes the duplicate, found by reading `shell.json` (read-only, as Stack does) |

The bar never shows a blank slot because of OmaColorBar.

## `colorbar` helper

`colorbar swap [shell.json]`

1. Copies `shell.json` to `shell.json.omacolorbar-backup` (refuses if a backup already
   exists, unless `--force`).
2. Replaces every layout entry whose id is a supported built-in with
   `{"id": "blackcode.omacolorbar", "icon": "<id>", "host": {<that entry's other keys>}}`,
   in the same section and position.
3. Leaves every other entry, and every key outside `bar.layout`, unchanged.
4. Writes atomically (temporary file in the same folder, then rename).

`colorbar restore [shell.json]` puts the backup back and removes it.

It is written in Python 3 (standard library only, as the other BlackCode plugins use for
helpers) and never runs from QML on its own: the user runs it.

## Testing

Automated (`node tests/run.js`, plus `python3 -m unittest` for `colorbar`):

- `Icons.js`: every glyph above maps to a drawing; the glyph lists are also read from the
  installed Omarchy sources when present, and the test names any glyph without a drawing.
- Level parsing: battery 0–9 charging and discharging plus full, Wi-Fi 0–4, volume 1–3.
- Fallback: unknown glyph → no drawing; unknown id → warning state.
- `colorbar`: swap and restore on sample `shell.json` files (all sections, entries with
  settings, our own plugins, unknown ids, existing backup), byte-identical restore.
- SVGs: every referenced file exists, parses as XML, has no `<script>`, external `href`
  or `url(http…)`.

Live (on the user's bar, before release): every phase 1 icon renders; each popup opens
and closes; right-click, middle-click and scroll behave as before; live changes for
volume, mute, microphone mute, Bluetooth off/on, battery (if present); menu logo switch;
popup keyboard shortcuts (open question 1).

## Release

Repo `alshareedah22/omacolorbar`, MIT. README with screenshots, setup (`colorbar swap`
or adding copies in Omarchy's bar settings) and the open questions' outcomes. Poster in
the same laptop style as the other BlackCode posters. Version 1.0.0 = phase 1, submitted
to the marketplace; 1.1.0 = phase 2.

## Open questions (resolved during the build)

1. **Popup keyboard shortcuts.** `omarchy-shell shell toggle <id>` finds a widget by its
   bar slot; a hosted widget is not in a slot under its own id. Verify; if it does not
   reach the hosted widget, check whether the widget's own IPC target (its `IpcHandler`
   uses the injected `moduleName`) still works, and document the result.
2. **Tailscale state.** Its bar icon is a `TailscaleIcon` component, not a glyph. Read
   `crossed` / `warning` from the existing icon item inside the hosted button if
   reachable; otherwise move Tailscale to phase 2.
3. **Inline settings written by hosted widgets.** The power widget saves its
   right-click "show percentage" toggle with
   `bar.shell.updateEntryInline(moduleName, settings)`, i.e. under `omarchy.power`, not
   under the OmaColorBar entry. Options, in order: give the hosted widget a `bar` wrapper
   whose `shell.updateEntryInline` writes the settings into the copy's `host` key; or, if
   a wrapper is not possible, read the toggle back from `omarchy.power`'s entry and
   document it. Verify which works before release.
