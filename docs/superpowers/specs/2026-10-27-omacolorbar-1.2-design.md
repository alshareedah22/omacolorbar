# OmaColorBar 1.2.0: open apps next to the tray

Date: 2026-10-27 · Status: approved 2026-10-27
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
| Logo choice | Already exists: `"menuLogo": "Arch"` / `"Omarchy"` on the OmaColorBar menu copy's own layout entry (`{"id": "blackcode.omacolorbar", "icon": "omarchy.menu", "menuLogo": "Arch"}`, already in the manifest schema); README documents it, nothing new is built |
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
| `hiddenApps` | list of strings | `[]` | extra app keys to hide, edited by hand (right-click hiding is stored separately, see Hide and show) |
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
- Planning finding (replaces the spike): `bar.shell.updateEntryInline(own id, …)` rewrites
  **every** layout entry whose id is `blackcode.omacolorbar` (`shell.qml` `updateEntryInline`
  loops over all matching entries), so saving from one copy would overwrite every copy on the
  bar. It is never used.
- Right-click hides are stored in OmaColorBar's own state file
  (`Quickshell.statePath("omacolorbar-hidden-apps.json")`, a JSON list of app keys), read at
  start and written on every hide/unhide. They survive restarts and never touch `shell.json`.
- Effective hidden set = state file ∪ the `hiddenApps` setting. The "Hidden apps" submenu lists
  both; entries from `hiddenApps` show "set in shell.json" and cannot be unhidden from the bar.
- The plan's first task checks live that the state file can be written and read back after
  `omarchy restart shell`; if it cannot, the controller stops and asks the user.

## Display scale (user requirement: every icon, every feature, any scale)

Two scales apply and both must work: the monitor scale (Hyprland, e.g. 1, 1.25, 1.5, 2) and
Omarchy's theme scale (`base-size`, `[spacing] scale`, bar tokens in `Commons/Style.qml`).

- Every size in OmaColorBar QML comes from Omarchy's `Style` tokens (`Style.bar.iconCanvas`,
  `Style.bar.statusSlot`, `Style.space(n)`, `Style.bar.iconFont`, font tokens); no hard-coded
  pixel widths, heights, margins or font sizes. This covers the 1.0/1.1 icons, weather, the
  tray app icons, the open-app icons, count badges, the `+N` button, its popup and the
  right-click menu.
- Every `Image` renders at the screen's pixel density: `sourceSize` = displayed size ×
  `max(2, devicePixelRatio)` of the screen it is on, so drawings and app icons are sharp at
  fractional and 2× scales (1.1.0 used a fixed ×2; this replaces it everywhere).
- Text and badges stay inside their slot at every scale (no clipping, no overlap with the
  next icon); the row's implicit size follows the tokens so the bar lays it out like
  Omarchy's own widgets.
- Tests: a Node test scans `Panel.qml`, `TrayAdapter.qml` and `OpenAppsRow.qml` and fails on
  numeric literals for `width`/`height`/`implicitWidth`/`implicitHeight`/`pixelSize`/
  `spacing`/margins (0 allowed) and on `sourceSize` without `devicePixelRatio`. Live: the
  controller checks the whole bar (every OmaColorBar icon, weather, tray, open apps, badge,
  `+N`, popup, right-click menu) at monitor scale 1, 1.5 and 2 on one monitor (temporary
  `hyprctl keyword monitor`, restored afterwards) and reads screenshots for sharpness, size
  and clipping.

## Failure behavior

| Situation | Behavior |
|---|---|
| Window with no matching desktop entry | not shown |
| Matched icon empty or fails to load | neutral app glyph |
| Window closes while its menu or the `+N` list is open | menu/list closes or drops that entry |
| `ToplevelManager` unavailable | open-apps row empty; tray as in 1.1.0 |
| State file unreadable or invalid JSON | treated as an empty list; a warning is logged once |

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
