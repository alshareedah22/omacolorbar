# OmaColorBar: color icons for Omarchy's bar

Color icons for Omarchy's built-in bar widgets, with color drawings for weather, tray apps that each show their own installed app icon, and a color icon for each open app. Each icon hosts the real Omarchy widget, so clicks and popups stay Omarchy's own. A hosted widget's own settings are read from `plugins[]` in `shell.json` (see Known limits). This plugin's own settings live on each copy's entry and can be changed from the bar (see Settings panel).

![OmaColorBar: color icons in the Omarchy bar](preview.png)

## What's new in 1.4.0

- **No setup step**: `omarchy plugin add https://github.com/alshareedah22/omacolorbar --enable` is the whole install. On first enable the plugin swaps every supported widget for its color copy and adds SUPER+CTRL+ALT+C (when that key is free) by itself.
- **44 menu logos**: added CachyOS, Garuda, Artix, Asahi, Nobara, KDE neon, Kubuntu, Xubuntu, Lubuntu, Ubuntu MATE, deepin, Solus, MX Linux, Qubes OS, Tails, Parrot, Raspberry Pi, SUSE, FreeBSD, OpenBSD and NetBSD, from Simple Icons 16.36.0.
- **Logo search** on the Appearance tab, and a denser grid.

## What's new in 1.3.0

- **Settings panel**: one panel for every color icon, with Widgets, Appearance and Open apps tabs. It replaces the per-icon settings card.
- **Open it your way**: right-click the logo, press SUPER+CTRL+ALT+C (`colorbar bind`), or middle-click any icon.
- **23 distro logos** for the menu icon, each in its official color: Omarchy, Arch, Debian, Ubuntu, Fedora, Linux Mint, openSUSE, Manjaro, EndeavourOS, Gentoo, Void, NixOS, Alpine, Pop!_OS, elementary OS, Zorin OS, Kali, Rocky Linux, AlmaLinux, Red Hat, CentOS, Slackware and Tux.
- **Icon size**: 80 to 130 percent, for every icon at once.
- **Logo locked to the menu**: the logo can no longer be switched to another widget by mistake, and no other icon can become the menu.
- **Safer switches**: before an icon becomes Microphone or Agents (which use middle-click themselves), the panel says how to reach the settings afterwards.
- **Undo last change** puts the bar layout back from the rolling backup.
- **Hidden apps** show each app's icon and get a search box.
- The panel stays where it was after a change (it used to close, or jump to another monitor).

## What it does

Every copy of the widget wraps one built-in widget and only replaces its icon with a color one. The popup, click and scroll actions and tooltip come from the original, unchanged; the built-in widget's settings are read from `plugins[]`. The icon follows the widget's state (connected, muted, offline, ...).

Icons:

- `omarchy.menu`: the Omarchy logo in green, the Arch Linux logo in blue, or one of 42 other distro logos in their official colors. This copy is locked to the menu.
- `omarchy.network` (Wi-Fi, ethernet, offline)
- `omarchy.bluetooth` (off, on, connected)
- `omarchy.audio` (volume levels, muted, headphones)
- `omarchy.microphone` (on, muted)
- `omarchy.power`
- `omarchy.monitor` (one or many)
- `omarchy.system-update`
- `omarchy.agents`
- `omarchy.tailscale` (on, off, login needed)
- `omarchy.tray` (each tray app shows its own installed app icon, for example Claude and ChatGPT; apps without one keep their tray image; also shows the open apps, see Open apps)
- `omarchy.weather` (a color drawing for each condition)

## Install

```bash
omarchy plugin add https://github.com/alshareedah22/omacolorbar --enable
```

That is all. Enabling puts one entry on the bar, which starts the plugin, and the plugin then sets itself up:

- every supported built-in widget on the bar becomes its color copy in the same place (its settings move to its `plugins[]` entry);
- the bar before the change is saved as `~/.config/omarchy/shell.json.omacolorbar-backup`;
- SUPER+CTRL+ALT+C opens the settings panel, added to `~/.config/hypr/bindings.lua` only if that key is free (`colorbar unbind` removes it).

The setup runs only on that first enable, while no color copy is on the bar yet. Later changes, an `unswap`, or a widget you add by hand are never redone.

Manual setup is still there: `~/.config/omarchy/plugins/blackcode.omacolorbar/colorbar swap` swaps a layout, `colorbar bind` adds the key. `colorbar swap` and `colorbar restore` take an optional path to a `shell.json` (default `~/.config/omarchy/shell.json`), for example `colorbar swap ~/test/shell.json`. `swap` changes nothing, and writes no backup, when the layout has no supported built-in.

## Updating

Already using OmaColorBar? Update in place; your bar layout and settings are kept.

```bash
omarchy plugin update blackcode.omacolorbar
omarchy restart shell
```

`omarchy plugin update` shows the changes and asks before applying them (add `--yes` to skip the question). Without the Omarchy command, `git -C ~/.config/omarchy/plugins/blackcode.omacolorbar pull` does the same. Then follow the note for the version you came from.

### From 1.3.0

Nothing to do: the new logos appear on the Appearance tab.

### From 1.2.0

No swap is needed. To open the settings panel from the keyboard, add the shortcut once:

```bash
~/.config/omarchy/plugins/blackcode.omacolorbar/colorbar bind
```

It adds SUPER+CTRL+ALT+C to `~/.config/hypr/bindings.lua` (it refuses if that key is already yours), and `colorbar unbind` removes it. Right-click on the logo now opens the settings panel instead of a terminal; SUPER+RETURN still opens a terminal. Your `menuLogo` (Omarchy or Arch) keeps working.

### From 1.1.0

Same as from 1.2.0. The tray copy also starts showing open apps; to turn that off, set `"openApps": false` on the tray copy, or use the panel's Open apps tab.

### From 1.0.0

```bash
~/.config/omarchy/plugins/blackcode.omacolorbar/colorbar swap --force
omarchy restart shell
```

This also swaps the tray and weather. `--force` keeps your original backup. Then run `colorbar bind` as above if you want the shortcut.

## Tray icons

A tray app gets its color icon by matching it to an installed app. The match tries the window class first, then the app's desktop file name, then the app name (compared with the tray item's title or tooltip). Generic Electron tray ids such as `chrome_status_icon_1` only match by title. The icon comes from the app's `.desktop` file (`Icon=`) through the icon theme. If nothing matches, or the icon fails to load, the tray keeps its own image.

Omarchy's bar weather shows only the condition icon (no temperature), so the drawing replaces that icon.

## Open apps

The `omarchy.tray` copy shows one color icon for each open app, inside the tray drawer. Collapsed, the tray shows only its `<` and pinned apps. Hover the `<` and the drawer opens: from left to right you see the `<`, the open apps (and `+N`), then the tray apps (for example Claude), then the pinned apps. Move away and they hide again. The drawer stays open while the pointer is on the open apps or one of their menus is open. OmaColorBar draws this one `<` for the whole group (right-click it for Omarchy's tray icons panel), also when no app has a tray icon. On a vertical bar the open apps stay visible below the tray.

- Icon sizes: tray app icons are drawn at the bar's icon size (Omarchy's tray draws them smaller). Open app icons are 85% of that size, so they match the visible logo of tray icons that keep a transparent margin. Each takes the same slot width as a tray item.
- One icon per app. At 2 or more windows of the same app, the icon has a count badge.
- Click focuses the app's latest window. Click again to cycle through its windows.
- Apps beyond `openAppsLimit` (default 6) go behind `+N`. Click `+N` for a list and click an app in it to focus it.
- Right-click an icon and choose "Hide ... from bar" to hide that app. Right-click an icon or `+N` to see "Hidden apps" and click one to show it again. Right-click the same icon again, or click outside the bar, to close the menu.

Left out on purpose:

- Terminals (apps with the desktop category `TerminalEmulator`), unless `showTerminals` is on. Terminals are usually open all day and would fill the drawer.
- Apps the tray already shows (for example Claude), so they appear once.
- Windows whose app id matches no installed app, because there is no icon to show for them.

Hides made with a right-click are stored in the Quickshell state folder, in `~/.local/state/quickshell/by-shell/<id>/omacolorbar-hidden-apps.json`. The `hiddenApps` setting in `shell.json` adds manual hides (desktop entry ids). Those can only be removed there, not from the bar.

## Settings panel

One panel holds the settings of every copy. Open it with:

- right-click on the logo (the `omarchy.menu` copy). This replaces Omarchy's right-click there, which opened a terminal.
- SUPER+CTRL+ALT+C, after `colorbar bind` (adds one marked line to `~/.config/hypr/bindings.lua`; `colorbar unbind` removes it). The key runs `qs -p /usr/share/omarchy/shell ipc call omacolorbar toggleSettings`. `openTab Widgets|Appearance|"Open apps"` opens a given tab.
- middle-click on any copy. On microphone and agents, and over the tray's apps, plain middle-click keeps the widget's own action; use Shift+middle-click there.

Tabs:

- **Widgets**: every copy, grouped left / center / right, with its icon. Each one has a dropdown of widgets no other copy uses. The logo copy is locked to the menu and no other copy can become the menu. Before switching a copy to microphone or agents, the panel says how to reach the settings afterwards and asks you to confirm. **Undo last change** puts the layout from the rolling backup back. It refuses when the bar layout changed outside OmaColorBar since, or when the undo would remove the logo.
- **Appearance**: the logo grid (44 logos, with a search box) and icon size, 80 to 130 percent for every copy at once.
- **Open apps** (needs a tray copy): Open apps, Apps shown, Show terminals, and Hidden apps with each app's icon, a Show button, and a search box when more than four are hidden.

Changes save at once into `~/.config/omarchy/shell.json`: only the copies concerned change. Before each save the file is copied to `~/.config/omarchy/shell.json.omacolorbar-settings-backup` (one rolling copy, separate from the `colorbar swap` backup). If a save is refused, nothing is written and the panel says why. Omarchy rebuilds the bar after each save; the panel reopens on the same tab by itself.

## Settings

| Setting         | Values                                          | Default           |
|-----------------|-------------------------------------------------|-------------------|
| `icon`          | any widget listed above                         | `omarchy.network` |
| `menuLogo`      | a logo name from the panel, e.g. `Omarchy`, `Arch`, `Debian`, `Tux` (menu copy) | `Omarchy` |
| `iconScale`     | 80 to 130, percent of Omarchy's icon size        | `100`             |
| `openApps`      | `true`, `false` (for the `omarchy.tray` copy)   | `true`            |
| `openAppsLimit` | 1 to 20 (for the `omarchy.tray` copy)           | `6`               |
| `hiddenApps`    | list of desktop entry ids (for the tray copy)   | `[]`              |
| `showTerminals` | `true`, `false` (for the tray copy)             | `false`           |

Menu logo: pick it on the panel's Appearance tab, or set `"menuLogo"` on the copy set to `omarchy.menu` to one of: Omarchy, Arch, Debian, Ubuntu, Fedora, Linux Mint, openSUSE, Manjaro, EndeavourOS, Gentoo, Void, NixOS, Alpine, Pop!_OS, elementary OS, Zorin OS, Kali, Rocky Linux, AlmaLinux, Red Hat, CentOS, Slackware, CachyOS, Garuda, Artix, Asahi, Nobara, KDE neon, Kubuntu, Xubuntu, Lubuntu, Ubuntu MATE, deepin, Solus, MX Linux, Qubes OS, Tails, Parrot, Raspberry Pi, SUSE, FreeBSD, OpenBSD, NetBSD, Tux. An unknown name shows the Omarchy logo.

Display scale: icon sizes and slot widths come from Omarchy's bar tokens, so they follow the theme and the monitor scale. Images render at the screen's pixel density (at least 2x), so they stay sharp at scale 1, 1.5 and 2.

The built-in widget's own settings (for example `showPercentage` on power) live in its entry in `plugins[]` of `shell.json`. The copy reads them from there, so they apply when you edit `plugins[]` or use Omarchy's settings UI. The plugin's own settings above live on each copy's entry. A hosted widget cannot save them itself (see Known limits).

## Undo

```bash
~/.config/omarchy/plugins/blackcode.omacolorbar/colorbar unswap
```

`unswap` is the gentle undo. It turns every OmaColorBar copy in `bar.layout` back into its built-in widget, in the same position, and keeps everything else you changed since the swap. It needs no backup. The built-ins' settings already live in `plugins[]`, so nothing else is needed. A copy's own keys (menuLogo, openApps, openAppsLimit, hiddenApps, showTerminals) are dropped. A bare `{"id":"blackcode.omacolorbar"}` without an icon means the network widget, so it becomes `{"id":"omarchy.network"}`, or is removed if `omarchy.network` is already on the bar. Before writing, it saves the previous file as `shell.json.omacolorbar-unswap-<UTC time>`. It does not touch the swap backup, and it prints "nothing to unswap" when there are no copies.

```bash
~/.config/omarchy/plugins/blackcode.omacolorbar/colorbar restore
```

`restore` is the second option. It puts the swap-time backup back as the whole file and removes it, so every change made since the swap, including settings Omarchy saved into `plugins[]`, is discarded. It refuses a backup that is not valid JSON or has no `bar.layout` object.

`colorbar swap` refuses to run while a backup exists ("run restore first, or swap --force"). `swap --force` keeps the existing backup, which holds your original, and swaps the current file; it never overwrites the original.

You can also set the entries back by hand: replace `{"id":"blackcode.omacolorbar","icon":"omarchy.audio"}` with `{"id":"omarchy.audio"}`. The widget's settings stay in `plugins[]`, where Omarchy still reads them.

## Remove

Undo the swap first, then remove the plugin:

```bash
~/.config/omarchy/plugins/blackcode.omacolorbar/colorbar unbind
~/.config/omarchy/plugins/blackcode.omacolorbar/colorbar unswap
omarchy plugin remove blackcode.omacolorbar
```

`colorbar unbind` removes the SUPER+CTRL+ALT+C line if you added it (it does nothing otherwise).

You can use `colorbar restore` instead of `unswap` if you want the old file back exactly.

If you remove the plugin first, the bar simply shows nothing in those spots: Omarchy draws an empty slot for a missing plugin. To fix it, reinstall the plugin and run `colorbar unswap`, or edit `~/.config/omarchy/shell.json` by hand and replace each `{"id": "blackcode.omacolorbar", "icon": "<id>"}` entry with `{"id": "<id>"}`.

The plugin may leave these files behind. All of them are safe to delete:

- `~/.config/omarchy/shell.json.omacolorbar-backup`
- `~/.config/omarchy/shell.json.omacolorbar-settings-backup`
- `~/.config/omarchy/shell.json.omacolorbar-unswap-*`
- the hidden-apps state file `~/.local/state/quickshell/by-shell/<id>/omacolorbar-hidden-apps.json`

## When Omarchy changes

- A widget state with no color glyph yet falls back to the original glyph, so nothing goes blank.
- If a built-in widget disappears from Omarchy, its copy shows a warning icon instead of failing silently.
- If the same built-in is also on the bar directly, the copy's tooltip adds: "OmaColorBar: omarchy.audio is also on the bar directly".

## Known limits

- The hosted widget's own settings are not saved from the bar. (The plugin's own settings are, through the settings panel.) Omarchy's shell scopes `updateEntryInline` to the calling plugin, so a hosted widget saving under its built-in id (power's right-click "show percentage", Tailscale's remembered choices) is denied and lasts only until the next restart. Set them in the widget's `plugins[]` entry or in Omarchy's settings UI instead; the copy re-reads `plugins[]`.
- The shell lets a plugin summon only widgets it owns, so hosted copies cannot open other panels: scrolling over the color audio or monitor icon changes the value but shows no on-screen display, and the Wi-Fi QR and speed-test actions in the network popup do nothing. Verified live for audio (scroll over the color icon changed the volume, no on-screen display appeared); the network and monitor cases are read from the shell source (`shell.qml`, `_summon`).
- Bluetooth's cross-monitor scan hand-off (`bar.moduleWidgets`) is unavailable to hosted copies.
- Popup shortcuts: `qs -p /usr/share/omarchy/shell ipc call omarchy.audio toggle` opens the popup of the color copy. `omarchy-shell shell toggle omarchy.audio` did not open it on the tested Omarchy version. Clicking the icon always works.
- Pin and Hide in the tray's manage panel ("Tray icons") have no effect when OmaColorBar hosts the tray, not even for the session. The tray saves them through a shell call that only works for Omarchy's own tray entry. To pin or hide an app, set `pinned` or `hidden` (lists of tray item ids, for example `"Claude_status_icon_1"`) in the `omarchy.tray` entry of `plugins[]` in `~/.config/omarchy/shell.json`, then run `omarchy restart shell`. Or keep the tray on Omarchy's own widget.
- After a hot reload of the plugin (Omarchy reloads a local plugin when its files change), SUPER+CTRL+ALT+C can reach the old instance; run `omarchy restart shell`.
- Power settings (right-click to show the percentage) were not tested here: the test machine has no battery.
- Duplicate check (verified): with `omarchy.audio` added to the bar next to its color copy, the copy's tooltip shows the warning above.
- Indicators are not included: when another plugin hosts Omarchy's indicators, Stay awake, Night light and Do not disturb cannot read their state, so they would stay off. Keep `omarchy.indicators` as Omarchy's own widget.
- `omarchy.system-update` and `omarchy.power` can be hidden by Omarchy itself (no update pending, no battery). Their copies stay hidden too.

## Tests

```bash
node --test tests/
python3 -I -m unittest discover -s tests -p "test_*.py"
```

## Trademarks

The Arch Linux logo is a trademark of Arch Linux, shown unaltered in its official color. The Omarchy logo is Omarchy's. The other distro logos come from Simple Icons and are trademarks of their projects, shown unaltered in their brand colors; see `icons/LOGOS.md` for sources and the licenses some of them carry. 

## License

MIT
