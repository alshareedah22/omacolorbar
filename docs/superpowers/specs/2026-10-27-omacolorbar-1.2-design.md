# OmaColorBar 1.2.0: open apps next to the tray

Date: 2026-10-27 · Status: design approved in chat, awaiting spec review
Builds on: `2026-10-27-omacolorbar-1.1-design.md` (and its scope-changes note). Everything
there still holds unless this document says otherwise.

## Goal

The OmaColorBar tray copy (`icon: "omarchy.tray"`) also shows every open app, each with its
own color app icon, next to Omarchy's hosted tray, so tray apps and open apps read as one
group. A setting limits how many open-app icons show; the rest go into a `+N` button. Apps
can be hidden and shown again from a right-click menu.

## Decisions (user)

| Topic | Decision |
|---|---|
| Placement | Inside the tray copy, drawn right after the hosted tray (Omarchy's tray cannot take outside items) |
| Grouping | One icon per app; a count badge at 2+ windows; click focuses the latest window, clicking again cycles |
| Terminals | Not shown by default (desktop entry category `TerminalEmulator`); a setting can show them |
| Order | Order opened; new apps go to the end and into `+N` first |
| Overflow | `+N` button opening a list of the extra apps |
| Hide/show | Right-click an icon → "Hide from bar"; a "Hidden apps" submenu unhides |
| Duplicates | An app already shown by the tray (e.g. Claude) is not shown again |
| Logo choice | Already exists (`"menuLogo": "Arch"` / `"Omarchy"` on the `omarchy.menu` entry in `plugins[]`); README documents it, nothing new is built |
| Window source | Quickshell `ToplevelManager.toplevels` (Wayland foreign-toplevel: `appId`, `title`, `activated`, `activate()`); no Hyprland dispatch |

## Constraints

- All 1.0.0/1.1.0 constraints (never edit `/usr/share/omarchy/`; no `Array.from`/`codePointAt`
  in `.js` loaded by Qt; no blank slot because of OmaColorBar; commits by BlackCode with the
  Co-Authored-By trailer; push and marketplace only with the user's yes).
- Only installed app icons are shown (desktop entry `Icon=` via `Quickshell.iconPath`, or an
  absolute path); an app with no icon gets a neutral app glyph, never an empty slot.
- With `openApps: false` the tray copy behaves exactly like 1.1.0.

## Settings

On the tray copy's own layout entry (`{"id": "blackcode.omacolorbar", "icon": "omarchy.tray", …}`),
added to the manifest `barWidget` schema and defaults:

| Key | Type | Default | Meaning |
|---|---|---|---|
| `openApps` | bool | `true` | show open apps next to the tray |
| `openAppsLimit` | int (1–20) | `6` | icons shown before `+N` |
| `hiddenApps` | list of strings | `[]` | app keys hidden by the user |
| `showTerminals` | bool | `false` | also show terminal apps |

The hosted tray's own settings stay in `plugins[]` (`omarchy.tray`), as in 1.1.0.

## Components

| File | Change | Responsibility |
|---|---|---|
| `OpenApps.js` | new, pure, Node-tested | `appKey(toplevel, apps)`, `group(toplevels, apps, opts)` → ordered app groups, `split(groups, limit)` → `{shown, overflow}`, `nextWindow(group, current)` |
| `OpenAppsRow.qml` | new | the row: icons, badges, `+N` button and popup, right-click menu, tooltips |
| `Panel.qml` | modify | for `adapter === "tray"`, lay out hosted tray + `OpenAppsRow` side by side; pass settings |
| `TrayAdapter.qml` | modify (small) | expose the app keys the tray currently shows (for the duplicate rule) |
| `manifest.json` | modify | schema/defaults for the four settings, version 1.2.0 |
| `Apps.js` | reuse | app lookup for a window (`appId` → desktop entry via wmClass / desktop id / name) |

### App key and grouping (`OpenApps.js`)

- A window's app = the desktop entry matched from its `appId` (startupClass, then desktop id,
  then last desktop-id segment, case-insensitive, 4-character guard as in `Apps.js`). Key =
  desktop entry id; windows with no matching entry are skipped.
- Terminal = the matched entry's categories contain `TerminalEmulator`; skipped unless
  `showTerminals`.
- Skipped too: keys in `hiddenApps`, keys the tray currently shows.
- Groups keep first-seen order (the row remembers when each key first appeared during the
  session; on start, `ToplevelManager.toplevels` order is used).
- `split(groups, limit)`: first `limit` groups shown, rest overflow.
- `nextWindow`: if the group's active window is focused, the next window in the group's
  order; otherwise the most recently activated window of the group.

## Hide and show

- Right-click an open-app icon → menu: "Hide from bar", and "Hidden apps (N)" with one entry
  per hidden app (click to show again). Right-click on `+N` shows the same "Hidden apps" list.
- Saving goes through `bar.shell.updateEntryInline(<own entry>, {…hiddenApps})`.
- **Spike first (plan task 1):** prove on the live bar that OmaColorBar may save its own
  entry this way and that the value survives `omarchy restart shell`. If it may not, the
  controller stops and asks the user; the proposed fallback is that right-click hiding
  lasts for the session and `hiddenApps` in `shell.json` makes it permanent (documented
  limit, like the tray's Pin/Hide).

## Failure behavior

| Situation | Behavior |
|---|---|
| Window with no matching desktop entry | not shown |
| Matched icon empty or fails to load | neutral app glyph |
| Window closes while its menu or the `+N` list is open | menu/list closes or drops that entry |
| `ToplevelManager` unavailable | open-apps row empty; tray as in 1.1.0 |
| Saving hidden apps not allowed | per spike outcome (see Hide and show) |

## Testing

- Node (`tests/openapps.test.js`): grouping by app, first-seen order, terminal/hidden/tray
  exclusion, `showTerminals`, `split` at the limit (0 overflow, exact limit, over), `nextWindow`
  cycling, windows without a match skipped, no `Array.from`/`codePointAt`.
- Python: `colorbar` unchanged; existing tests pass.
- Live: Chrome with 2 windows → one icon, badge 2, click cycles; Ghostty not shown; Claude
  shown once (tray); limit 2 with 4 apps → `+2` and its list focuses apps; hide → gone,
  unhide → back, survives restart (if the spike allows); `openApps: false` → 1.1.0 behavior;
  no `[omacolorbar]` warnings.

## Release

Version 1.2.0; README (open apps, settings table incl. `menuLogo`, hide/show, limits) and
poster updated. Push and the marketplace step need the user's yes.
