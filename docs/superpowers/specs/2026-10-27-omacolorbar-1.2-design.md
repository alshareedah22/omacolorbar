# OmaColorBar 1.2.0: open apps next to the tray

Date: 2026-10-27 · Status: approved 2026-10-27
Builds on: `2026-10-27-omacolorbar-1.1-design.md` (and its scope-changes note). Everything
there still holds unless this document says otherwise.

## Goal

The OmaColorBar tray copy (`icon: "omarchy.tray"`) also shows every open app, each with its
own color app icon, next to Omarchy's hosted tray, so tray apps and open apps read as one
group. A setting limits how many open-app icons show; the rest go into a `+N` button. Apps
can be hidden and shown again from a right-click menu. Every OmaColorBar copy gets a settings
card on middle-click, so its settings can be changed from the bar instead of `shell.json`.

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
| Settings from the bar | Middle-click any OmaColorBar copy → its settings card (user, 2026-10-27); details in Settings card |
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
| `SettingsCard.qml` | new | middle-click card: rows per copy, writes via `ShellEntry.js` |
| `ShellEntry.js` | new, pure, Node-tested | `findEntry(config, icon)` → `{section, index}` or an error (`none`/`many`), `withEntryKeys(config, section, index, changes)` → new config, `usedIcons(config)` |
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

## Settings card (middle-click)

User request 2026-10-27: change OmaColorBar settings from the top bar, not only in
`shell.json`. Omarchy keeps each plugin's `barWidget.schema` (`shell.qml`) but has no screen
that shows it, so OmaColorBar draws its own card.

**Opening it**
- Middle-click any OmaColorBar copy opens a `PopupCard` (`qs.Ui`) anchored to that copy.
  An outside click (or middle-click again) closes it.
- A `MouseArea` over the copy accepts only `Qt.MiddleButton`, so left/right clicks, scroll,
  hover and tooltips still reach the hosted Omarchy widget.
- Two hosted widgets use middle-click themselves: `omarchy.microphone` (opens the audio panel)
  and `omarchy.agents` (next provider). On those two copies plain middle-click passes through
  to the widget and **Shift+middle-click** opens the card. Shift+middle-click works on every
  copy.
  Ruling: this keeps Omarchy's own actions working. If it is wrong, both copies lose their
  middle-click action instead.

**Contents** (only the rows that apply to this copy)

| Row | Shown on | Control | Writes |
|---|---|---|---|
| Widget | every copy | list of the 12 supported widgets; ones already on the bar as another OmaColorBar copy are disabled | `icon` |
| Menu logo | `omarchy.menu` copy | Omarchy / Arch | `menuLogo` |
| Open apps | tray copy | on/off | `openApps` |
| Apps shown | tray copy | − / value / + (1–20) | `openAppsLimit` |
| Show terminals | tray copy | on/off | `showTerminals` |
| Hidden apps | tray copy | one row per hidden app with "Show"; `hiddenApps` entries read "set in shell.json" and have no button | state file (see Hide and show) |
| Open shell.json | every copy | button: opens the file in the user's editor (`omarchy-launch-editor`) and closes the card | nothing |

**Saving** (the copy writes `shell.json` itself; `updateEntryInline` is never used, see
Hide and show)
- A change applies right away, with no Save button. The card re-reads `shell.json` from disk
  before each write.
- It finds its own layout entry: `id == "blackcode.omacolorbar"` with the same `icon` as this
  copy, in `bar.layout.left/center/right`.
  - No match, or more than one match: nothing is written. The card shows "Edit shell.json:
    this copy can't be found uniquely" next to the Open shell.json button.
- Only that entry's keys change. Every other entry, key and the file's key order stay as they
  were. The file is written as 2-space indented JSON, the format Omarchy writes.
- Before each write the current file is copied to `~/.config/omarchy/shell.json.omacolorbar-settings-backup`
  (one rolling copy). This is separate from the `colorbar swap` backup, which is never
  touched.
- The write is atomic (temp file + rename, `FileView.atomicWrites`), so the shell never reads
  a half-written file.
- The shell's own `shell.json` watch applies the change. A new `icon` reloads the copy as a
  different widget, and the card closes because its copy is rebuilt.
- The plan's spike checks live that a write reaches the bar without `omarchy restart shell`.
  If it does not, the card says "Restart the shell to apply" after a write (no automatic
  restart).

## Display scale (user requirement: every icon, every feature, any scale)

Two scales apply and both must work: the monitor scale (Hyprland, e.g. 1, 1.25, 1.5, 2) and
Omarchy's theme scale (`base-size`, `[spacing] scale`, bar tokens in `Commons/Style.qml`).

- Every size in OmaColorBar QML comes from Omarchy's `Style` tokens (`Style.bar.iconCanvas`,
  `Style.bar.statusSlot`, `Style.space(n)`, `Style.bar.iconFont`, font tokens); no hard-coded
  pixel widths, heights, margins or font sizes. This covers the 1.0/1.1 icons, weather, the
  tray app icons, the open-app icons, count badges, the `+N` button, its popup, the
  right-click menu and the settings card.
- Every `Image` renders at the screen's pixel density: `sourceSize` = displayed size ×
  `max(2, devicePixelRatio)` of the screen it is on, so drawings and app icons are sharp at
  fractional and 2× scales (1.1.0 used a fixed ×2; this replaces it everywhere).
- Text and badges stay inside their slot at every scale (no clipping, no overlap with the
  next icon); the row's implicit size follows the tokens so the bar lays it out like
  Omarchy's own widgets.
- Tests: a Node test scans `Panel.qml`, `TrayAdapter.qml`, `OpenAppsRow.qml` and `SettingsCard.qml` and fails on
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
| `shell.json` invalid JSON when the card writes | nothing written; card shows "shell.json can't be read" |
| Write fails | the backup is kept, the card shows the error, and the setting reverts to the file's value |
| State file unreadable or invalid JSON | treated as an empty list; a warning is logged once |

## Testing

- Node (`tests/openapps.test.js`): grouping by app, first-seen order, terminal/hidden/tray
  exclusion, `showTerminals`, `split` at the limit (0 overflow, exact limit, over), `nextWindow`
  cycling, windows without a match skipped, no `Array.from`/`codePointAt`.
- Node (`tests/shellentry.test.js`): `findEntry` by icon across sections, none/many errors,
  `withEntryKeys` changes only that entry (other entries, keys and order deep-equal),
  `usedIcons`.
- Python: `colorbar` unchanged; existing tests pass.
- Live: Chrome with 2 windows → one icon, badge 2, click cycles; Ghostty not shown; Claude
  shown once (tray); limit 2 with 4 apps → `+2` and its list focuses apps; hide → gone,
  unhide → back, survives restart (if the spike allows); `openApps: false` → 1.1.0 behavior;
  no `[omacolorbar]` warnings. Settings card: middle-click opens it on each copy, and
  left/right click still reach the widget. On the microphone and agents copies, middle-click
  keeps their own action and Shift+middle opens the card. Menu logo Arch→Omarchy, openAppsLimit
  and openApps change the bar live and survive restart. A `shell.json` diff shows only the
  edited entry, and the backup file exists. Changing the widget of one copy rebuilds it.

## Release

Version 1.2.0; README (open apps, settings table incl. `menuLogo`, hide/show, limits) and
poster updated. Push and the marketplace step need the user's yes.

## Change 2026-10-27: open apps live in the tray drawer (user decision)

(The expanded order and the `<` described here were superseded by "Order change 2026-10-27" below.)

User request after seeing the row live: "all apps open will be placed inside the tray, not out".
The user chose: open apps hide behind the tray's `<` together with the tray's drawer apps (e.g.
Claude), slide out when the tray is hovered, and hide again. This replaces "drawn right after
the hosted tray, always visible" for horizontal bars.

- Layout of the tray copy (horizontal bar), left to right: open-apps drawer area, then the
  hosted Omarchy tray (its own drawer, `<`, pinned items). Expanded it reads
  `[open apps][+N][<][tray drawer apps][pinned]` (Omarchy moves its `<` to the left edge of
  the tray as its drawer opens).
- Collapsed, the open-apps area is empty space, like the tray's own collapsed drawer
  (Omarchy reserves the drawer width and masks it). Nothing in it takes clicks or hover.
- Reveal follows the hosted tray's `revealProgress` (same 600 ms OutCubic animation), so open
  apps and tray apps slide out together. The icons slide out from under the tray side and are
  clipped to the open-apps area.
- Staying open: while the tray is expanded, hovering the open apps, `+N`, or any open card of
  the row (hide menu, `+N` list) or the settings card keeps the tray expanded. Leaving the whole
  tray copy collapses it, as Omarchy's tray does.
- No tray drawer (no tray apps, or all of them pinned): OmaColorBar shows its own `<` (same
  glyph and size as Omarchy's) for the open apps, with the same hover and animation.
- Limit, `+N`, counts, click/cycle, right-click hide, settings and the settings card are
  unchanged; they now live inside the drawer.
- Middle-click on the tray copy: over the hosted tray it goes to the tray (SNI), over the
  open-apps area it opens the settings card; Shift+middle anywhere opens the card.
- Vertical bars: open apps stay always visible below the tray (unchanged). Ruling: Omarchy's
  vertical drawer slides on y with a rotated chevron; the user's bar is horizontal, so this
  release keeps the vertical layout as built. Cost if wrong: vertical-bar users see open apps
  outside the drawer.

### Order change 2026-10-27 (user decision): open apps right of `<`, before the tray apps

User: "open app should [be] inside the tray, placed before `<`, not after"; asked to choose, they picked
`[<][open apps][+N][tray drawer apps][pinned]` when expanded, `[<][pinned]` collapsed.

- Omarchy's `<` only travels the tray's own drawer width, so OmaColorBar draws the single `<`
  for the whole group (same glyph and size) and hides the hosted tray's `<` (found in the hosted
  tree, `visible: false`). Right-click on our `<` toggles the tray's "Tray icons" panel
  (`managePopupOpen`) like Omarchy's.
- Geometry (tray copy, horizontal): area width R (open apps) + chevron C to the left of the hosted
  tray; D = tray drawerExtent; p = reveal. Our `<` at x = (R + D)(1 - p) (collapsed it sits exactly
  where the tray's hidden `<` was; expanded at 0). Open apps in a clip at x = chevron + C, width R*p,
  so they end exactly where the tray's drawer apps begin.
- Everything else in the drawer section still holds (hover, keep-open, collapse, middle-click
  regions now: over the tray apps/pinned items → tray; over our `<` and open apps → card).
