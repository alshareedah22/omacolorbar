# OmaColorBar 1.3: settings panel, locked logo, distro logos

Date: 2026-10-29 · Status: design approved in chat, awaiting spec review

## Why

On 2026-10-29 a middle-click on the logo copy opened its card and the widget dropdown
switched it to `omarchy.microphone`. The microphone uses plain middle-click itself, so
the card then needed Shift+middle-click, which nothing on screen said. The user had no
way back from the bar. 1.3 replaces the per-copy card with one plugin-wide settings
panel that can always be reached.

## Decisions (from chat, 2026-10-29)

1. **One settings panel** for the whole plugin, with tabs. 1.3 ships **Widgets**,
   **Appearance** and **Open apps**. **Behavior** and **About/Backup** wait for 1.4.
2. **Opening it:**
   - **Right-click on the logo copy** (`omarchy.menu`) opens the panel. This replaces
     Omarchy's own right-click there (open a terminal); the terminal is still on
     SUPER+RETURN. Left-click still opens the Omarchy menu.
   - **SUPER+CTRL+ALT+C** opens/closes the panel (checked free on 2026-10-29 against
     `/usr/share/omarchy/default/hypr/bindings/*.lua` and `~/.config/hypr/bindings.lua`).
   - Middle-click on any copy also opens the panel (on microphone and agents,
     Shift+middle-click, as today).
3. **The logo copy is locked to `omarchy.menu`.** The panel never offers a different
   widget for it, and no other copy can switch to `omarchy.menu`. Microphone stays
   available for other copies.
4. **Distro logos.** The logo copy chooses its logo from a list of Linux distros, each
   drawn unaltered in its official color (as Arch `#1793D1` is today). `menuLogo`
   keeps its two old values (`Omarchy`, `Arch`) so existing configs keep working.

## Settings panel

A `PopupCard`-style panel anchored to the logo copy (or the copy that was
middle-clicked; centered on the focused screen when opened by the keybinding). One
instance per bar, owned by the logo copy; other copies ask it to open through the
service.

### Widgets tab

- Lists every OmaColorBar copy in `shell.json`, grouped left / center / right, each with
  its live icon.
- The logo copy shows "Menu (locked)" with no dropdown.
- Other copies: a dropdown of widgets not used by another copy, `omarchy.menu`
  excluded. Choosing microphone or agents shows an inline note before saving:
  "Settings on this icon open with Shift+middle-click, right-click on the logo, or
  SUPER+CTRL+ALT+C."
- **Undo last change** restores `shell.json.omacolorbar-settings-backup` (the rolling
  backup the card already writes), after checking it parses and still contains the
  logo copy.

Adding, removing and reordering copies stays in Omarchy's own bar settings for 1.3.

### Appearance tab

- **Logo** (logo copy only): grid of distro logos, each tile in official color with
  its name. Writes `menuLogo`.
- **Icon size**: 80–130 % of the current size, step 5. New key `iconScale`, default 100.
  Applies to every copy.

### Open apps tab

Everything on today's card for the tray copy: Open apps on/off, Apps shown (1–20),
Show terminals, Hidden apps (now with each app's icon and a search box).

## Distro logo set

Source: Simple Icons (CC0 SVG paths, each with its brand hex). Shipped as
`icons/distro-<slug>.svg`, filled with the brand color. Logos are trademarks of their
projects; the README says so and that they are shown unaltered.

Initial list (24): Omarchy (existing), Arch (existing), Debian, Ubuntu, Fedora,
Linux Mint, openSUSE, Manjaro, EndeavourOS, CachyOS, Gentoo, Void, NixOS, Alpine,
Pop!_OS, elementary OS, Zorin OS, Kali, Rocky Linux, AlmaLinux, Red Hat, CentOS,
Slackware, Tux (generic Linux). Any not in Simple Icons is dropped from the list
rather than redrawn by hand.

`menuLogo` becomes an enum of these names; unknown values fall back to Omarchy.

## Implementation notes

- `SettingsCard.qml` becomes `SettingsPanel.qml` with a tab row; reuses `ShellEntry.js`
  (find entry, atomic write, rolling backup) unchanged except a `lockedIcons` rule:
  `planSave` refuses `icon` changes on the menu entry and refuses `icon: "omarchy.menu"`
  elsewhere (error `"locked"`).
- Right-click: `Panel.qml` adds `Qt.RightButton` to its MouseArea only when
  `hostId === "omarchy.menu"`; other copies' right-click is untouched.
- Keybinding: `Service.qml` adds an `IpcHandler { target: "omacolorbar" }` with
  `toggleSettings()`. A bind in `~/.config/hypr/bindings.lua` (user file, not
  `/usr/share`) runs `qs ipc call omacolorbar toggleSettings` (exact command confirmed
  on the live shell). `colorbar` gets `bind`/`unbind` subcommands so the plugin never
  edits the user's bindings without being asked.
- Tests: extend `tests/` for `planSave` locking, the logo fallback, and backup-restore
  validation.

## Out of scope for 1.3

Color modes and per-widget colors, hover effects, badge styles and click actions,
choosing the open-settings button, drawer timing, export/import, update check
(1.4 Behavior and About/Backup tabs).
