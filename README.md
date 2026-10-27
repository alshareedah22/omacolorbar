# OmaColorBar: color icons for Omarchy's bar

Color gradient icons for the built-in widgets in the Omarchy bar. Each icon hosts the real Omarchy widget, so clicks and popups stay Omarchy's own. Its settings are read from `plugins[]` in `shell.json` (see Known limits).

![OmaColorBar: color icons in the Omarchy bar](preview.png)

## What it does

Every copy of the widget wraps one built-in widget and only replaces its icon with a color one. The popup, click and scroll actions and tooltip come from the original, unchanged; its settings are read from `plugins[]`. The icon follows the widget's state (connected, muted, offline, ...).

Phase 1 icons:

- `omarchy.menu` (Omarchy logo in green, or the Arch Linux logo in blue)
- `omarchy.network` (Wi-Fi, ethernet, offline)
- `omarchy.bluetooth` (off, on, connected)
- `omarchy.audio` (volume levels, muted, headphones)
- `omarchy.microphone` (on, muted)
- `omarchy.power`
- `omarchy.monitor` (one or many)
- `omarchy.system-update`
- `omarchy.agents`
- `omarchy.tailscale` (on, off, login needed)

## Install

```bash
omarchy plugin add https://github.com/alshareedah22/omacolorbar
~/.config/omarchy/plugins/blackcode.omacolorbar/colorbar swap
```

`colorbar swap` saves `~/.config/omarchy/shell.json` as `shell.json.omacolorbar-backup`, then replaces each supported built-in with a color copy in the same place. Settings of a swapped widget move to its `plugins[]` entry. Restart the shell afterwards: `omarchy restart shell`.

Do not use `--enable` on `plugin add`: it puts a bare `blackcode.omacolorbar` entry (default network icon) on the bar, and the swap then adds a real network copy too. If you already enabled it, remove the bare `blackcode.omacolorbar` entry (the one without `icon`).

`colorbar swap` and `colorbar restore` take an optional path to a `shell.json` (default `~/.config/omarchy/shell.json`), for example `colorbar swap ~/test/shell.json`. `swap` changes nothing, and writes no backup, when the layout has no supported built-in.

## Settings

| Setting     | Values                                          | Default           |
|-------------|-------------------------------------------------|-------------------|
| Icon        | any built-in listed above                       | `omarchy.network` |
| Menu logo   | `Omarchy`, `Arch` (for the `omarchy.menu` copy) | `Omarchy`         |

The built-in widget's own settings (for example `showPercentage` on power) live in its entry in `plugins[]` of `shell.json`. The copy reads them from there, so they apply when you edit `plugins[]` or use Omarchy's settings UI. A hosted widget cannot save them itself (see Known limits).

## Undo

```bash
~/.config/omarchy/plugins/blackcode.omacolorbar/colorbar restore
```

This puts the backup back and removes it. Any changes made since the swap, including settings Omarchy saved into `plugins[]`, are replaced by the backup.

`colorbar swap` refuses to run while a backup exists ("run restore first, or swap --force"). `swap --force` keeps the existing backup, which holds your original, and swaps the current file; it never overwrites the original.

You can also set the entries back by hand: replace `{"id":"blackcode.omacolorbar","icon":"omarchy.audio"}` with `{"id":"omarchy.audio"}`. The widget's settings stay in `plugins[]`, where Omarchy still reads them.

## Remove

Put the original bar back first, then remove the plugin:

```bash
~/.config/omarchy/plugins/blackcode.omacolorbar/colorbar restore
omarchy plugin remove blackcode.omacolorbar
```

If the backup is gone, replace each `{"id": "blackcode.omacolorbar", "icon": "<id>"}` entry in `~/.config/omarchy/shell.json` with `{"id": "<id>"}` before removing the plugin.

## When Omarchy changes

- A widget state with no color glyph yet falls back to the original glyph, so nothing goes blank.
- If a built-in widget disappears from Omarchy, its copy shows a warning icon instead of failing silently.
- If the same built-in is also on the bar directly, the copy's tooltip adds: "OmaColorBar: omarchy.audio is also on the bar directly".

## Known limits

- Settings are not saved from the hosted widget. Omarchy's shell scopes `updateEntryInline` to the calling plugin, so a hosted widget saving under its built-in id (power's right-click "show percentage", Tailscale's remembered choices) is denied and lasts only until the next restart. Set them in the widget's `plugins[]` entry or in Omarchy's settings UI instead; the copy re-reads `plugins[]`.
- The shell lets a plugin summon only widgets it owns, so hosted copies cannot open other panels: scrolling over the color audio or monitor icon changes the value but shows no on-screen display, and the Wi-Fi QR and speed-test actions in the network popup do nothing. Verified live for audio (scroll over the color icon changed the volume, no on-screen display appeared); the network and monitor cases are read from the shell source (`shell.qml`, `_summon`).
- Bluetooth's cross-monitor scan hand-off (`bar.moduleWidgets`) is unavailable to hosted copies.
- Popup shortcuts: `qs -p /usr/share/omarchy/shell ipc call omarchy.audio toggle` opens the popup of the color copy. `omarchy-shell shell toggle omarchy.audio` did not open it on the tested Omarchy version. Clicking the icon always works.
- Power settings (right-click to show the percentage) were not tested here: the test machine has no battery.
- Duplicate check (verified): with `omarchy.audio` added to the bar next to its color copy, the copy's tooltip shows the warning above.
- `omarchy.system-update` and `omarchy.power` can be hidden by Omarchy itself (no update pending, no battery). Their copies stay hidden too.

## Tests

```bash
node --test tests/
python3 -I -m unittest discover -s tests -p "test_*.py"
```

## Trademarks

The Arch Linux logo is a trademark of Arch Linux, shown unaltered in its official color. The Omarchy logo is Omarchy's.

## License

MIT
