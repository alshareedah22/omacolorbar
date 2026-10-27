# OmaColorBar: color icons for Omarchy's bar

Color gradient icons for the built-in widgets in the Omarchy bar. Each icon hosts the real Omarchy widget, so clicks, popups and settings stay Omarchy's own.

![OmaColorBar: color icons in the Omarchy bar](preview.png)

## What it does

Every copy of the widget wraps one built-in widget and only replaces its icon with a color one. The popup, click and scroll actions, tooltip and settings come from the original, unchanged. The icon follows the widget's state (connected, muted, offline, ...).

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
omarchy plugin add https://github.com/alshareedah22/omacolorbar --enable
~/.config/omarchy/plugins/blackcode.omacolorbar/colorbar swap
```

`colorbar swap` saves `~/.config/omarchy/shell.json` as `shell.json.omacolorbar-backup`, then replaces each supported built-in with a color copy in the same place. Settings of a swapped widget move to its `plugins[]` entry. Restart the shell afterwards: `omarchy restart shell`.

## Settings

| Setting     | Values                                          | Default           |
|-------------|-------------------------------------------------|-------------------|
| Icon        | any built-in listed above                       | `omarchy.network` |
| Menu logo   | `Omarchy`, `Arch` (for the `omarchy.menu` copy) | `Omarchy`         |

The built-in widget's own settings (for example `showPercentage` on power) live in its entry in `plugins[]` of `shell.json`, as Omarchy keeps them.

## Undo

```bash
~/.config/omarchy/plugins/blackcode.omacolorbar/colorbar restore
```

This puts the backup back and removes it. Any changes made since the swap, including settings Omarchy saved into `plugins[]`, are replaced by the backup.

`colorbar swap` refuses to run while a backup exists ("run restore first, or swap --force"). `swap --force` keeps the existing backup, which holds your original, and swaps the current file; it never overwrites the original.

You can also set the entries back by hand: replace `{"id":"blackcode.omacolorbar","icon":"omarchy.audio"}` with `{"id":"omarchy.audio"}`.

## When Omarchy changes

- A widget state with no color glyph yet falls back to the original glyph, so nothing goes blank.
- If a built-in widget disappears from Omarchy, its copy shows a warning icon instead of failing silently.
- If the same built-in is also on the bar directly, the copy's tooltip adds: "OmaColorBar: omarchy.audio is also on the bar directly".

## Known limits

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
