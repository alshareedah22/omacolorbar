# OmaColorBar 1.3 plan

Spec: `docs/superpowers/specs/2026-10-29-omacolorbar-1.3-design.md`.
Tests: `node --test tests/` and `python3 -I -m unittest discover -s tests -p "test_*.py"`.

1. **Distro logos.** `tools/make_distro_logos.py <simple-icons package dir>` writes
   `icons/distro-<slug>.svg` (64×64, the 24×24 path scaled 2.5 and offset 2, filled with
   the brand hex). `Icons.js` gets `LOGOS` (name → file, `themed` for black brands,
   drawn in the bar foreground) and `logoFor(name)` with the Omarchy fallback.
   CachyOS is not in Simple Icons: dropped. Tests: every logo file exists and is safe,
   unknown names fall back, old values `Omarchy`/`Arch` still map to the old files.
2. **ShellEntry locking and restore.** `planSave` refuses `icon` changes on the menu
   entry and `icon: "omarchy.menu"` on any other (`"locked"`). `copies(config)` lists
   every copy (section, index, icon). `planRestore(current, backup)` accepts the backup
   only when it parses, has a layout and still has the menu copy. Tests.
3. **Service.** Copy registry (`register`/`unregister`), `pendingTab` to reopen the
   panel after Omarchy rebuilds the bar on a save, `IpcHandler { target: "omacolorbar" }`
   with `toggleSettings()` (opens the menu copy's panel on the focused screen).
4. **SettingsPanel.qml** replaces `SettingsCard.qml`: tabs Widgets / Appearance / Open
   apps; Widgets lists copies with dropdowns (menu locked, microphone/agents note) and
   Undo; Appearance has the logo grid and icon size; Open apps has today's controls
   plus icons and search in Hidden apps. Open-apps data comes from the tray copy via
   the service.
5. **Panel.qml.** Right-click on the menu copy opens the panel; register with the
   service; `iconScale` on the drawn icon; reopen after a rebuild.
6. **Manifest** 1.3.0: `menuLogo` options, `iconScale`.
7. **colorbar bind / unbind** add or remove one marked line in
   `~/.config/hypr/bindings.lua`. Python tests.
8. **README**, then live test on the bar.
