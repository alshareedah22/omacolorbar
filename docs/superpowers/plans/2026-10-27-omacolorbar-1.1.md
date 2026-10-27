# OmaColorBar 1.1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship OmaColorBar 1.1.0: color icons for `omarchy.weather`, `omarchy.indicators` (color when on, gray when off) and `omarchy.tray` (each tray app shows its own installed app icon).

**Architecture:** Hosting is unchanged from 1.0.0 (`Service.qml` gets the registry, `Panel.qml` creates the real widget in a `Loader`). `Panel.qml` picks an adapter from the icon id: weather uses the 1.0.0 button adapter (new glyph table in `Icons.js`); indicators get an indicator adapter in `Panel.qml` that sets `iconComponent` on every `BarIndicator` it finds; the tray gets `TrayAdapter.qml`, which re-points each tray icon's `Image.source` to the app icon chosen by `Apps.js` `matchApp`.

**Tech Stack:** QML (Quickshell 0.3.x, Omarchy `qs.Ui` / `qs.Commons`, `Quickshell.DesktopEntries`, `Quickshell.iconPath`), JavaScript (`.pragma library`, `node --test`), Python 3 standard library (`colorbar`, `tools/make_icons.py`, `unittest`).

**Spec:** `docs/superpowers/specs/2026-10-27-omacolorbar-1.1-design.md` (builds on `2026-10-27-omacolorbar-design.md`)

**Scratch folder:** commands use `$SCRATCH`; set it once (`export SCRATCH=/tmp/claude-1000/-home-blackcode-desktop/e4b4a5c1-17c8-4668-b6e7-8f0ea7793e33/scratchpad`).

**Repo:** `~/.config/omarchy/plugins/blackcode.omacolorbar` (the live plugin folder; the shell loads it from here, so there is no separate worktree). Work on branch `v1.1`: `git switch -c v1.1` before Task 2. Merge to `main` locally in Task 7; never push without the user's yes.

## Global Constraints

- Never edit `/usr/share/omarchy/`; built-in widgets come only from the registry (`registry.widgets[id].component`).
- Icon ids, final order (manifest `icon` options, `Icons.SUPPORTED`, `colorbar` `SUPPORTED` all equal): `omarchy.menu`, `omarchy.network`, `omarchy.bluetooth`, `omarchy.audio`, `omarchy.microphone`, `omarchy.power`, `omarchy.monitor`, `omarchy.system-update`, `omarchy.agents`, `omarchy.tailscale`, `omarchy.tray`, `omarchy.indicators`, `omarchy.weather`.
- Style: 64×64 viewBox, two-stop gradients with `gradientUnits="userSpaceOnUse"`, shadow = same shapes in `#000` at opacity .35 offset 1.5,1.5. No `<script>`, `href=`, `url(http`, `on*=` and no `<mask>`/`<filter>` (Qt's SVG renderer is SVG Tiny 1.2).
- Indicator off variants use the gray pair `#6b7280`→`#9ca3af`, generated from the same shape function as the color variant.
- `Icons.js` and `Apps.js` must not use `Array.from` or `codePointAt` (Qt V4 iterates UTF-16 units; see `Icons.split`).
- The bar never shows a blank slot because of OmaColorBar: no drawing → Omarchy's own glyph or image; image load error → original restored.
- Tray: no logo is redrawn; only the app's installed icon (`Icon=` of its `.desktop` entry via `Quickshell.iconPath`, or an absolute `Icon=` path).
- Commits: `git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit`, message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests: `cd ~/.config/omarchy/plugins/blackcode.omacolorbar && node --test tests/ && python3 -I -m unittest discover -s tests -p "test_*.py"`.
- Live work (Tasks 1 and 7, run by the controller, not a subagent): back up `~/.config/omarchy/shell.json` first and restore it at the end unless the user asked to keep the change; after QML changes run `omarchy restart shell` and wait ~9 s; before any click the cursor must be still for 5 s, and put it back afterwards (click helper `$SCRATCH/click X Y`; monitors DP-3 x 0–1919, DP-2 x 1920–3839).
- Push and marketplace steps need the user's explicit yes.

## Spec corrections found while planning (rulings)

1. **Weather has no temperature on the bar.** `panels/weather/Panel.qml:349,408` set `label` to the condition glyph only, and the button's `text` is that label. The weather drawing therefore has an empty label. The 1.0.0 label pass-through stays, so a later Omarchy that adds text still shows it. Cost if wrong: none, the label code path is already tested.
2. **Indicators use `iconComponent`, not an overlay.** `Ui/BarIndicator.qml` is a `BarIconButton`, so it has `iconComponent` like the 1.0.0 buttons; the menu-style overlay (`labelVisible`) does not apply. Unknown glyph → `iconComponent` stays `null` → Omarchy's glyph. Cost if wrong: one adapter rewrite.
3. **Dictation glyphs.** `bar/indicators/Dictation.qml`: recording = `f036c` (active), transcribing = `f051f` (active), inactive = `f036c`. Both glyphs map to `ind-dictation`, gray `ind-dictation-off` when inactive.
4. **Weather glyph sources.** `iconForOpenMeteoCode` only calls `iconForCode`, so scanning `iconForCode` (with `\uXXXX` decoded) covers every glyph.
5. **Tray adapter lives in `TrayAdapter.qml` from the start** (it owns the app list and per-icon state); the indicator adapter stays in `Panel.qml`. The spec allows the split; doing it up front avoids moving code later.
6. **Tray pin/hide may not persist.** `Tray.qml` `persistTrayState` calls `bar.shell.updateEntryInline("omarchy.tray", …)`, which the shell denies to other plugins (1.0.0 known limit). If the spike shows that pin/hide is the *only* failing check, the controller stops and asks the user whether to ship tray with that documented limit or drop it, since the spec says to drop tray on any failure.
7. **Matching guard.** `matchApp` containment rules (1 and 2) ignore normalised strings shorter than 4 characters, so a desktop id like `app` cannot match every tray id.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `tools/make_icons.py` | modify | adds 15 `weather-*` and 12 `ind-*` SVGs |
| `icons/weather-*.svg`, `icons/ind-*.svg` | generated | 27 new icons |
| `Icons.js` | modify | weather glyph table, `INDICATORS`, `indicatorDrawing`, `svgNames`, `SUPPORTED` |
| `Apps.js` | create | `normalize`, `leadingWord`, `matchApp` (pure, Node-tested) |
| `Panel.qml` | modify | `adapter` property, indicator adapter, hosts `TrayAdapter` |
| `TrayAdapter.qml` | create | finds tray icons, swaps their image to the matched app icon |
| `manifest.json` | modify | 3 new icon options, version 1.1.0, description |
| `colorbar` | modify | `SUPPORTED` gains the 3 ids |
| `tests/icons.test.js` | modify | weather, indicators, installed-source scans |
| `tests/apps.test.js` | create | `matchApp` cases |
| `tests/test_colorbar.py` | modify | swaps the 3 new ids |
| `README.md`, `preview.png` | modify | 1.1.0 docs and poster |

---

### Task 1: Tray spike (controller, live, throwaway)

Proves the tray can be hosted and its icon replaced. Nothing from this task is kept in the repo.

**Files (all throwaway, deleted at the end):**
- Create: `~/.config/omarchy/plugins/blackcode.spike-tray/manifest.json`
- Create: `~/.config/omarchy/plugins/blackcode.spike-tray/Service.qml`
- Create: `~/.config/omarchy/plugins/blackcode.spike-tray/Panel.qml`
- Create: `$SCRATCH/spike-tray-findings.md`

- [ ] **Step 1: Write the spike plugin**

`manifest.json`:
```json
{
  "schemaVersion": 1,
  "id": "blackcode.spike-tray",
  "name": "SpikeTray",
  "version": "0.0.1",
  "author": "BlackCode",
  "license": "MIT",
  "description": "Throwaway spike: hosts omarchy.tray and shows Claude's app icon in its slot",
  "kinds": ["service", "bar-widget"],
  "entryPoints": { "service": "Service.qml", "barWidget": "Panel.qml" },
  "barWidget": { "displayName": "Spike tray", "description": "spike", "category": "Appearance", "allowMultiple": false, "defaultSection": "right", "defaults": {}, "schema": [] }
}
```

`Service.qml`: a byte-for-byte copy of OmaColorBar's `Service.qml`.

`Panel.qml`:
```qml
import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons

// Throwaway spike: host omarchy.tray, log every tray item, show Claude's app icon.
Item {
  id: root
  property var bar: null
  property var settings: ({})
  property string moduleName: "blackcode.spike-tray"
  property var registry: null
  property var traySettings: ({})
  property var done: []

  implicitWidth: loader.item ? loader.item.implicitWidth : 0
  implicitHeight: loader.item ? loader.item.implicitHeight : 0

  function resolveRegistry() {
    var own = bar && bar.shell && typeof bar.shell.serviceFor === "function" ? bar.shell.serviceFor(moduleName) : null
    registry = own && own.barWidgetRegistry ? own.barWidgetRegistry : null
  }
  function inject(item) {
    if (!item) return
    if ("bar" in item) item.bar = root.bar
    if ("moduleName" in item) item.moduleName = "omarchy.tray"
    if ("settings" in item) item.settings = root.traySettings
  }
  function trayIcons(item, depth, out) {
    if (!item || depth > 14) return out
    if ("icon" in item && "symbolic" in item) out.push(item)
    var kids = item.children || []
    for (var i = 0; i < kids.length; i++) trayIcons(kids[i], depth + 1, out)
    return out
  }
  function scan() {
    var icons = trayIcons(loader.item, 0, [])
    for (var i = 0; i < icons.length; i++) {
      var t = icons[i]
      if (done.indexOf(t) !== -1) continue
      done.push(t)
      var m = t.parent ? t.parent.modelData : null
      console.log("[spike-tray] item id=" + (m ? m.id : "?") + " title=" + (m ? m.title : "?")
        + " tooltip=" + (m ? m.tooltipTitle : "?") + " symbolic=" + t.symbolic + " kids=" + t.children.length)
      if (m && String(m.id).toLowerCase().indexOf("claude") === 0) {
        var img = t.children[0]
        var path = Quickshell.iconPath("claude-desktop", true)
        console.log("[spike-tray] claude icon path=" + path)
        img.source = path
        img.visible = true
        img.layer.enabled = false
        if (t.children[1]) t.children[1].visible = false
      }
    }
  }
  Component.onCompleted: {
    resolveRegistry()
    var apps = DesktopEntries.applications.values
    console.log("[spike-tray] desktop entries: " + apps.length)
    for (var i = 0; i < apps.length; i++)
      if (String(apps[i].id).indexOf("Claude") !== -1 || String(apps[i].name) === "ChatGPT")
        console.log("[spike-tray] app id=" + apps[i].id + " name=" + apps[i].name + " icon=" + apps[i].icon
          + " class=" + apps[i].startupClass + " noDisplay=" + apps[i].noDisplay)
  }

  FileView {
    path: Quickshell.env("HOME") + "/.config/omarchy/shell.json"
    printErrors: false
    onLoaded: {
      try {
        var plugins = JSON.parse(text()).plugins || []
        for (var i = 0; i < plugins.length; i++) if (plugins[i].id === "omarchy.tray") root.traySettings = plugins[i]
      } catch (e) {}
      root.inject(loader.item)
    }
  }
  Timer { interval: 250; repeat: true; running: root.registry === null; onTriggered: root.resolveRegistry() }
  Timer { interval: 1000; repeat: true; running: loader.item !== null; onTriggered: root.scan() }
  Loader {
    id: loader
    sourceComponent: root.registry && root.registry.widgets["omarchy.tray"] ? root.registry.widgets["omarchy.tray"].component : null
    onLoaded: { root.inject(item); Qt.callLater(function() { root.inject(loader.item) }) }
  }
}
```

- [ ] **Step 2: Put the spike on the bar**

```bash
cp ~/.config/omarchy/shell.json "$SCRATCH/shell.json.spike-tray-backup"
python3 - <<'EOF'
import json, os
p = os.path.expanduser("~/.config/omarchy/shell.json")
c = json.load(open(p))
right = c["bar"]["layout"]["right"]
i = next(n for n, e in enumerate(right) if e.get("id") == "omarchy.tray")
entry = right[i]
right[i] = {"id": "blackcode.spike-tray"}
plugins = c.setdefault("plugins", [])
if not any(x.get("id") == "omarchy.tray" for x in plugins):
    plugins.append(entry)
json.dump(c, open(p, "w"), indent=2)
EOF
omarchy plugin list | grep spike-tray   # enable it with `omarchy plugin enable blackcode.spike-tray` if it is not enabled
omarchy restart shell
```
Wait ~9 s (run the wait with `run_in_background`).

- [ ] **Step 3: Read the log and the bar**

Claude Desktop must be running (start it if not). Read the shell log for `[spike-tray]` lines (`journalctl --user -b --since "-2 min" | grep spike-tray`, or the quickshell log the 1.0.0 work used). Take a screenshot of the right side of the bar and read it.

Record in `$SCRATCH/spike-tray-findings.md`, one line each, PASS/FAIL with evidence:
1. The hosted tray shows its items (count matches the real tray).
2. Claude's tray item id, title, tooltipTitle, `symbolic` value.
3. `Quickshell.iconPath("claude-desktop", true)` is non-empty and Claude's slot shows the color Claude icon.
4. Left-click Claude's icon: Claude's window opens or focuses.
5. Right-click Claude's icon: its menu opens; Escape closes it.
6. Pin/hide from the tray's manage panel changes the bar (and whether it is still there after `omarchy restart shell`).
7. The `DesktopEntries` line for `com.anthropic.Claude` shows `icon=claude-desktop class=com.anthropic.Claude`, so `startupClass` and `noDisplay` are readable (decides the app-list source for Task 5).
8. ChatGPT's tray id/title, if ChatGPT runs a tray icon (start it if installed).

- [ ] **Step 4: Clean up**

```bash
cp "$SCRATCH/shell.json.spike-tray-backup" ~/.config/omarchy/shell.json
omarchy plugin disable blackcode.spike-tray 2>/dev/null
rm -rf ~/.config/omarchy/plugins/blackcode.spike-tray
omarchy restart shell
```
Confirm the bar is back as before (screenshot).

- [ ] **Step 5: Decide**

- Checks 1, 3, 4, 5, 6 pass → continue with every task.
- Only check 6 fails → stop and ask the user (ruling 6).
- Any of 1, 3, 4, 5 fails → skip Tasks 4 and 5; Task 6's README lists tray as not shipped in 1.1.0 with the reason.
- Write the decision and the Claude/ChatGPT ids into the SDD ledger; Task 4 uses the real ids as test data if they differ from the spec's `Claude_status_icon_1`.

---

### Task 2: Weather and indicator drawings

**Files:**
- Modify: `tools/make_icons.py`
- Generate: `icons/weather-*.svg` (15), `icons/ind-*.svg` (12)
- Modify: `Icons.js`
- Modify: `tests/icons.test.js`, `tests/svg.test.js`

**Interfaces:**
- Produces: `Icons.GLYPHS["omarchy.weather"]` (used by `Icons.drawingFor("omarchy.weather", text, {})` → `{kind:"svg", name, label}` or `null`); `Icons.INDICATORS` (glyph hex → base name); `Icons.indicatorDrawing(text: string, active: bool) → {kind:"svg", name: string, label: ""} | null`; `svgNames()` includes every new name. `SUPPORTED` is **not** changed in this task.

- [ ] **Step 1: Write the failing tests** — append to `tests/icons.test.js` before the installed-source section:

```js
test("weather: every condition glyph has its drawing, label kept", () => {
  const want = {
    e30d: "weather-clear-day", e32b: "weather-clear-night",
    e302: "weather-partly-day", e32e: "weather-partly-night",
    e33d: "weather-cloudy",
    e313: "weather-fog-day", e346: "weather-fog-night",
    e308: "weather-showers-day", e333: "weather-showers-night",
    e318: "weather-rain",
    e30a: "weather-snow-day", e327: "weather-snow-night",
    e31a: "weather-heavy-snow", e3ad: "weather-sleet", e31d: "weather-thunder"
  }
  for (const [cp, name] of Object.entries(want))
    assert.deepStrictEqual(I.drawingFor("omarchy.weather", g(cp), {}), { kind: "svg", name, label: "" }, cp)
  assert.strictEqual(I.drawingFor("omarchy.weather", "21° " + g("e30d"), {}).label, "21°")
  assert.strictEqual(I.drawingFor("omarchy.weather", "", {}), null)
})

test("indicators: color when active, gray when not", () => {
  const want = { f0176: "ind-stayawake", f009b: "ind-dnd", f050e: "ind-nightlight", f0ec2: "ind-recording",
    f036c: "ind-dictation", f051f: "ind-dictation", f088c: "ind-reminder" }
  for (const [cp, name] of Object.entries(want)) {
    assert.deepStrictEqual(I.indicatorDrawing(g(cp), true), { kind: "svg", name, label: "" }, cp)
    assert.deepStrictEqual(I.indicatorDrawing(g(cp), false), { kind: "svg", name: name + "-off", label: "" }, cp)
  }
  assert.strictEqual(I.indicatorDrawing(g("f0001"), true), null)
  assert.strictEqual(I.indicatorDrawing("", true), null)
})

test("svgNames lists the weather and both indicator variants", () => {
  const names = I.svgNames()
  for (const n of ["weather-clear-day", "weather-thunder", "weather-fog-night", "ind-dnd", "ind-dnd-off",
    "ind-dictation", "ind-dictation-off", "ind-reminder-off"]) assert.ok(names.includes(n), n)
})
```

Append to the installed-source section (after the existing installed test, reusing `SHELL`, `installed`, `privateUse`, `functionBody`):

```js
const decode = s => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))

test("every weather glyph in the installed Omarchy has a drawing", { skip: !installed && "Omarchy not installed" }, () => {
  const glyphs = privateUse(decode(functionBody("panels/weather/Model.js", "iconForCode")))
  assert.ok(glyphs.length >= 15, "found " + glyphs.length)
  assert.deepStrictEqual(glyphs.filter(cp => !I.drawingFor("omarchy.weather", g(cp), {})), [])
})

test("every indicator glyph in the installed Omarchy has a drawing", { skip: !installed && "Omarchy not installed" }, () => {
  const dir = path.join(SHELL, "bar/indicators")
  const missing = []
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".qml")))
    for (const cp of privateUse(decode(fs.readFileSync(path.join(dir, f), "utf8"))))
      if (!I.indicatorDrawing(g(cp), true)) missing.push(f + " " + cp)
  assert.deepStrictEqual(missing, [])
})
```

Add to `tests/svg.test.js`:

```js
test("indicator off variants are gray and match their color shapes", () => {
  for (const base of ["stayawake", "dnd", "nightlight", "recording", "dictation", "reminder"]) {
    const on = fs.readFileSync(path.join(dir, "ind-" + base + ".svg"), "utf8")
    const off = fs.readFileSync(path.join(dir, "ind-" + base + "-off.svg"), "utf8")
    assert.ok(off.includes("#6b7280") && off.includes("#9ca3af"), base)
    const shapes = s => s.replace(/<defs>.*?<\/defs>/, "")
    assert.strictEqual(shapes(on), shapes(off), base)
  }
})

test("no SVG uses features Qt's SVG Tiny renderer drops", () => {
  for (const f of fs.readdirSync(dir)) {
    const s = fs.readFileSync(path.join(dir, f), "utf8")
    assert.ok(!/<mask|<filter|<clipPath/.test(s), f)
  }
})
```

- [ ] **Step 2: Run, expect failures**

Run: `node --test tests/`
Expected: FAIL — `indicatorDrawing is not a function`, weather drawings `null`, missing `icons/ind-*.svg`.

- [ ] **Step 3: Add the drawings to `tools/make_icons.py`**

Add `import math` to the imports. After the `dots()` helper add:

```python
WEATHER_DEFS = (gradient("sun", "#f59e0b", "#fde047") + gradient("moon", "#c4b5fd", "#e0e7ff")
                + gradient("cloud", "#94a3b8", "#e2e8f0"))
RAIN = "#38bdf8"
SNOW = "#ffffff"
BOLT = "#facc15"
CLOUD_D = "M18 48 h30 a10 10 0 0 0 0 -20 a14 14 0 0 0 -26 -4 a10 10 0 0 0 -4 24 z"


def framed(defs, body):
    shadow = re.sub(r'(fill|stroke)="(?!none)[^"]*"', r'\1="#000"', body)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
            f'<defs>{defs}</defs>'
            f'<g opacity=".35" transform="translate(1.5 1.5)">{shadow}</g>{body}</svg>\n')


def sun(cx, cy, r, ray_in, ray_out, width):
    rays = "".join(
        f'<path d="M{cx + ray_in * math.cos(a):.1f} {cy + ray_in * math.sin(a):.1f} '
        f'L{cx + ray_out * math.cos(a):.1f} {cy + ray_out * math.sin(a):.1f}" '
        f'fill="none" stroke="url(#sun)" stroke-width="{width}" stroke-linecap="round"/>'
        for a in (i * math.pi / 4 for i in range(8)))
    return rays + f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#sun)"/>'


def moon(cx, cy, r):
    # crescent opening to the right: outer arc down the left side, flatter inner arc back up
    return (f'<path d="M{cx} {cy - r} A{r} {r} 0 0 0 {cx} {cy + r} '
            f'A{r * 1.3:.1f} {r * 1.3:.1f} 0 0 1 {cx} {cy - r} Z" fill="url(#moon)"/>')


def cloud(dx=0, dy=0, scale=1.0, opacity=None):
    op = f' opacity="{opacity}"' if opacity else ""
    return f'<g transform="translate({dx} {dy}) scale({scale})"{op}><path d="{CLOUD_D}" fill="url(#cloud)"/></g>'


def drops(*xs, y=48):
    return "".join(f'<path d="M{x} {y} l-3 9" fill="none" stroke="{RAIN}" stroke-width="4" stroke-linecap="round"/>'
                   for x in xs)


def flakes(*points):
    return "".join(f'<circle cx="{x}" cy="{y}" r="3.2" fill="{SNOW}"/>' for x, y in points)


SMALL_SUN = sun(20, 20, 9, 13, 18, 3.5)
SMALL_MOON = moon(20, 20, 12)
FOG = "".join(f'<path d="M{x1} {y} H{x2}" fill="none" stroke="url(#cloud)" stroke-width="4.5" stroke-linecap="round"/>'
              for x1, x2, y in ((10, 54, 40), (16, 48, 49), (10, 54, 58)))
BOLT_D = f'<path d="M34 36 L24 50 H32 L28 62 L42 45 H34 L38 36 Z" fill="{BOLT}"/>'


def weather(body):
    return framed(WEATHER_DEFS, body)


GRAY = ("#6b7280", "#9ca3af")
INDICATOR_COLORS = {
    "stayawake": ("#d97706", "#fbbf24"),
    "dnd": ("#ef4444", "#f97316"),
    "nightlight": ("#f97316", "#fde68a"),
    "recording": ("#dc2626", "#f87171"),
    "dictation": ("#0ea5e9", "#a78bfa"),
    "reminder": ("#10b981", "#6ee7b7"),
}
INDICATOR_SHAPES = {
    "stayawake": ('<path d="M20 6 q4 4 0 8 q-4 4 0 8 M30 6 q4 4 0 8 q-4 4 0 8" fill="none" stroke="url(#b)" stroke-width="3.5" stroke-linecap="round"/>'
                  '<path d="M10 26 h34 v12 a14 14 0 0 1 -14 14 h-6 a14 14 0 0 1 -14 -14 z" fill="url(#a)"/>'
                  '<path d="M44 30 h4 a7 7 0 0 1 0 14 h-4" fill="none" stroke="url(#b)" stroke-width="5"/>'
                  '<rect x="6" y="54" width="42" height="5" rx="2.5" fill="url(#b)"/>'),
    "dnd": ('<path d="M32 6 a4 4 0 0 1 4 4 v2 a16 16 0 0 1 12 15 v13 l6 6 v2 H10 v-2 l6 -6 V27 a16 16 0 0 1 12 -15 v-2 a4 4 0 0 1 4 -4 z" fill="url(#a)"/>'
            '<path d="M26 52 a6 6 0 0 0 12 0 z" fill="url(#b)"/>'
            '<path d="M10 8 L54 56" fill="none" stroke="url(#b)" stroke-width="5" stroke-linecap="round"/>'),
    "nightlight": ('<path d="M30 8 A24 24 0 0 0 30 56 A31.2 31.2 0 0 1 30 8 Z" fill="url(#a)"/>'
                   '<circle cx="44" cy="18" r="3.5" fill="url(#b)"/><circle cx="52" cy="32" r="2.5" fill="url(#b)"/>'
                   '<circle cx="44" cy="44" r="3" fill="url(#b)"/>'),
    "recording": ('<circle cx="32" cy="32" r="24" fill="none" stroke="url(#a)" stroke-width="6"/>'
                  '<circle cx="32" cy="32" r="12" fill="url(#b)"/>'),
    "dictation": MIC.format(f="url(#a)", s="url(#b)"),
    "reminder": ('<path d="M8 16 a10 10 0 0 1 12 -8 M56 16 a10 10 0 0 0 -12 -8" fill="none" stroke="url(#b)" stroke-width="5" stroke-linecap="round"/>'
                 '<circle cx="32" cy="35" r="21" fill="url(#a)"/>'
                 '<path d="M32 22 V35 L41 41" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'),
}


def indicator(shape, colors):
    a, b = colors
    return framed(gradient("a", a, b) + gradient("b", b, a), INDICATOR_SHAPES[shape])
```

Add to `ICONS` (after `"warning"`):

```python
    "weather-clear-day": lambda: weather(sun(32, 32, 13, 19, 27, 5)),
    "weather-clear-night": lambda: weather(moon(30, 32, 22) + flakes((48, 16), (54, 30))),
    "weather-partly-day": lambda: weather(SMALL_SUN + cloud(6, 10, 0.85)),
    "weather-partly-night": lambda: weather(SMALL_MOON + cloud(6, 10, 0.85)),
    "weather-cloudy": lambda: weather(cloud(-6, -6, 0.75, ".7") + cloud(4, 6, 0.95)),
    "weather-fog-day": lambda: weather(SMALL_SUN + cloud(8, -8, 0.7) + FOG),
    "weather-fog-night": lambda: weather(SMALL_MOON + cloud(8, -8, 0.7) + FOG),
    "weather-showers-day": lambda: weather(SMALL_SUN + cloud(6, -2, 0.85) + drops(30, 44)),
    "weather-showers-night": lambda: weather(SMALL_MOON + cloud(6, -2, 0.85) + drops(30, 44)),
    "weather-rain": lambda: weather(cloud(0, -8) + drops(22, 33, 44)),
    "weather-snow-day": lambda: weather(SMALL_SUN + cloud(6, -2, 0.85) + flakes((30, 52), (44, 56))),
    "weather-snow-night": lambda: weather(SMALL_MOON + cloud(6, -2, 0.85) + flakes((30, 52), (44, 56))),
    "weather-heavy-snow": lambda: weather(cloud(0, -8) + flakes((20, 48), (32, 48), (44, 48), (26, 58), (38, 58))),
    "weather-sleet": lambda: weather(cloud(0, -8) + drops(22, 40) + flakes((31, 54), (49, 54))),
    "weather-thunder": lambda: weather(cloud(0, -10) + BOLT_D),
```

After the `ICONS` dict, add the indicator pairs:

```python
for _name, _colors in INDICATOR_COLORS.items():
    ICONS["ind-" + _name] = (lambda n=_name, c=_colors: indicator(n, c))
    ICONS["ind-" + _name + "-off"] = (lambda n=_name: indicator(n, GRAY))
```

- [ ] **Step 4: Generate the icons**

Run: `python3 tools/make_icons.py`
Expected: `wrote 46 icons to …/icons`

- [ ] **Step 5: Add the tables to `Icons.js`**

In `GLYPHS`, after `"omarchy.agents"`:

```js
  "omarchy.agents": { f16a3: svg("agents") },
  "omarchy.weather": {
    e30d: svg("weather-clear-day"), e32b: svg("weather-clear-night"),
    e302: svg("weather-partly-day"), e32e: svg("weather-partly-night"),
    e33d: svg("weather-cloudy"),
    e313: svg("weather-fog-day"), e346: svg("weather-fog-night"),
    e308: svg("weather-showers-day"), e333: svg("weather-showers-night"),
    e318: svg("weather-rain"),
    e30a: svg("weather-snow-day"), e327: svg("weather-snow-night"),
    e31a: svg("weather-heavy-snow"), e3ad: svg("weather-sleet"), e31d: svg("weather-thunder")
  }
```

After `TAILSCALE_STATES`:

```js
// Indicator glyph -> drawing (bar/indicators/*.qml activeText / inactiveText). Dictation
// shows f036c while recording and when off, f051f while transcribing.
var INDICATORS = {
  f0176: "ind-stayawake", f009b: "ind-dnd", f050e: "ind-nightlight", f0ec2: "ind-recording",
  f036c: "ind-dictation", f051f: "ind-dictation", f088c: "ind-reminder"
}

// Color when the mode is on, the gray "-off" drawing when it is off.
function indicatorDrawing(text, active) {
  var base = INDICATORS[split(text).key]
  return base ? { kind: "svg", name: active ? base : base + "-off", label: "" } : null
}
```

In `svgNames()`, before `return names`:

```js
  for (var g in INDICATORS) {
    if (names.indexOf(INDICATORS[g]) === -1) names.push(INDICATORS[g])
    if (names.indexOf(INDICATORS[g] + "-off") === -1) names.push(INDICATORS[g] + "-off")
  }
```

- [ ] **Step 6: Run the tests**

Run: `node --test tests/ && python3 -I -m unittest discover -s tests -p "test_*.py"`
Expected: all pass (the installed-source tests run, Omarchy is installed).

- [ ] **Step 7: Look at the new icons**

Render a contact sheet and read it: `for f in icons/weather-*.svg icons/ind-*.svg; do rsvg-convert -w 96 -h 96 "$f" -o "$SCRATCH/sheet-$(basename "$f" .svg).png"; done && montage "$SCRATCH"/sheet-*.png -tile 9x -geometry +6+6 -background '#1e1e2e' "$SCRATCH/icons-1.1.png"` (if `rsvg-convert` or `montage` is missing, use `magick` for both). Read `$SCRATCH/icons-1.1.png`. Every icon must be recognisable at bar size: sun/moon/cloud readable, crescent opens right, drops and flakes below the cloud, nothing clipped at the 64×64 edge. Fix coordinates in `make_icons.py` and regenerate if not.

- [ ] **Step 8: Commit**

```bash
git add tools/make_icons.py icons/ Icons.js tests/icons.test.js tests/svg.test.js
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "Weather and indicator drawings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Indicator adapter, weather and indicators on the bar

**Files:**
- Modify: `Panel.qml`
- Modify: `manifest.json`, `Icons.js` (`SUPPORTED`), `colorbar` (`SUPPORTED`)
- Modify: `tests/test_colorbar.py`

**Interfaces:**
- Consumes: `Icons.indicatorDrawing(text, active)`, `Icons.drawingFor("omarchy.weather", …)` from Task 2.
- Produces: `Panel.qml` `readonly property string adapter` (`"button"` | `"indicator"` | `"tray"`); `Panel.qml` `property var adapted: []` and `function scanIndicators()`. Task 5 adds the `TrayAdapter` instance next to them. `SUPPORTED` now ends `…, "omarchy.tailscale", "omarchy.indicators", "omarchy.weather"`.

- [ ] **Step 1: Write the failing Python test** — add to the test class that holds `test_swaps_supported_ids_in_place`:

```python
    def test_swaps_the_new_ids_and_moves_their_settings(self):
        config = {"bar": {"layout": {"left": [], "center": [
            {"id": "omarchy.indicators", "alwaysShow": True}, {"id": "omarchy.weather"}], "right": []}}}
        out = colorbar.swapped(config)
        self.assertEqual(out["bar"]["layout"]["center"], [
            {"id": "blackcode.omacolorbar", "icon": "omarchy.indicators"},
            {"id": "blackcode.omacolorbar", "icon": "omarchy.weather"}])
        self.assertIn({"id": "omarchy.indicators", "alwaysShow": True}, out["plugins"])
```

- [ ] **Step 2: Run, expect failure**

Run: `python3 -I -m unittest discover -s tests -p "test_*.py"`
Expected: FAIL — the center entries are unchanged.

- [ ] **Step 3: Add the two ids**

`manifest.json` `icon` options: append `"omarchy.indicators"`, `"omarchy.weather"` after `"omarchy.tailscale"`.
`Icons.js` `SUPPORTED` and `colorbar` `SUPPORTED`: append the same two strings in the same order.

- [ ] **Step 4: Run all tests**

Run: `node --test tests/ && python3 -I -m unittest discover -s tests -p "test_*.py"`
Expected: all pass (both `SUPPORTED`-equals-manifest tests included).

- [ ] **Step 5: Add the indicator adapter to `Panel.qml`**

After `readonly property bool supported …` add:

```qml
  // How the hosted widget's icons are swapped (see the spec's adapter table).
  readonly property string adapter: hostId === "omarchy.indicators" ? "indicator"
    : hostId === "omarchy.tray" ? "tray" : "button"
```

After `property string tailscaleState: ""` add:

```qml
  // Indicator buttons already given a color icon. The indicators widget builds and
  // rebuilds them (active and inactive blocks, orientation), so they are re-scanned.
  property var adapted: []
```

After `findFlags(...)` add:

```qml
  // Every BarIndicator inside the hosted indicators widget.
  function findIndicators(item, depth, out) {
    if (!item || depth > 14) return out
    if ("activeText" in item && "effectiveActive" in item && "iconComponent" in item) out.push(item)
    var kids = item.children || []
    for (var i = 0; i < kids.length; i++) findIndicators(kids[i], depth + 1, out)
    return out
  }

  function indicatorIconFor(item) {
    return function() { return Icons.indicatorDrawing(String(item.text), item.effectiveActive) ? indicatorIcon : null }
  }

  function scanIndicators() {
    var live = adapted.filter(function(item) { return item })
    var found = findIndicators(loader.item, 0, [])
    for (var i = 0; i < found.length; i++) {
      if (live.indexOf(found[i]) !== -1) continue
      found[i].iconComponent = Qt.binding(indicatorIconFor(found[i]))
      live.push(found[i])
    }
    adapted = live
  }
```

In the `Loader`'s `onLoaded`, reset `root.adapted = []` next to the other resets, and replace the `Qt.callLater` line with:

```qml
        Qt.callLater(function() {
          root.inject(loader.item)
          if (root.adapter === "button") root.attach()
          else if (root.adapter === "indicator") root.scanIndicators()
        })
```

After the `attachRetry` Timer add:

```qml
  Timer {
    interval: 1000
    repeat: true
    running: root.adapter === "indicator" && loader.item !== null
    onTriggered: root.scanIndicators()
  }
```

After the `glyphOverlay` Component add:

```qml
  // An indicator's icon: picks its drawing from the BarIndicator it sits in
  // (Image -> Loader -> optical canvas -> the button).
  Component {
    id: indicatorIcon
    Image {
      id: indicatorImage
      property var button: null
      readonly property var drawing: button ? Icons.indicatorDrawing(String(button.text), button.effectiveActive) : null
      // The Loader may set the parent after completion, so look on both.
      function findButton() {
        for (var p = parent, i = 0; p && i < 6; p = p.parent, i++)
          if ("effectiveActive" in p && "activeText" in p) { button = p; return }
      }
      Component.onCompleted: findButton()
      onParentChanged: findButton()
      source: drawing ? Qt.resolvedUrl("icons/" + drawing.name + ".svg") : ""
      sourceSize.width: width * 2
      sourceSize.height: height * 2
      fillMode: Image.PreserveAspectFit
      smooth: true
    }
  }
```

- [ ] **Step 6: Check the QML parses**

Run: `qmllint Panel.qml 2>&1 | grep -i error` if `qmllint` is installed (unresolved `qs.*` imports are expected warnings, not errors); otherwise skip. Run the tests again: `node --test tests/ && python3 -I -m unittest discover -s tests -p "test_*.py"` → all pass.

- [ ] **Step 7: Commit**

```bash
git add Panel.qml manifest.json Icons.js colorbar tests/test_colorbar.py
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "Indicators (color on, gray off) and weather icons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `Apps.js` app matching (skip if the spike dropped tray)

**Files:**
- Create: `Apps.js`
- Create: `tests/apps.test.js`

**Interfaces:**
- Produces: `Apps.matchApp(tray: {id, title, tooltipTitle}, apps: [{name, icon, wmClass, desktopId}]) → string` (an icon name or absolute path, or `""`); `Apps.normalize(s) → string`; `Apps.leadingWord(id) → string`.

- [ ] **Step 1: Write the failing tests** — `tests/apps.test.js`:

```js
const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const path = require("path")
const load = require("./load")

const A = load("Apps.js")

const APPS = [
  { name: "Claude Code URL Handler", icon: "", wmClass: "", desktopId: "claude-code-url-handler" },
  { name: "Claude", icon: "claude-desktop", wmClass: "com.anthropic.Claude", desktopId: "com.anthropic.Claude" },
  { name: "ChatGPT", icon: "chatgpt", wmClass: "", desktopId: "chatgpt" },
  { name: "Steam", icon: "steam", wmClass: "steam", desktopId: "steam" },
  { name: "Files", icon: "org.gnome.Nautilus", wmClass: "org.gnome.Nautilus", desktopId: "org.gnome.Nautilus" },
  { name: "App", icon: "/opt/app/icon.png", wmClass: "", desktopId: "app" }
]

test("normalize and leadingWord", () => {
  assert.strictEqual(A.normalize("Com.Anthropic-Claude_1"), "comanthropicclaude1")
  assert.strictEqual(A.normalize(undefined), "")
  assert.strictEqual(A.leadingWord("Claude_status_icon_1"), "claude")
  assert.strictEqual(A.leadingWord("nm-applet"), "nm")
  assert.strictEqual(A.leadingWord(""), "")
})

test("Claude's tray item finds the Claude desktop icon", () => {
  assert.strictEqual(A.matchApp({ id: "Claude_status_icon_1", title: "", tooltipTitle: "" }, APPS), "claude-desktop")
})

test("ChatGPT by title, Steam by window class, case does not matter", () => {
  assert.strictEqual(A.matchApp({ id: "chrome_status_icon_1", title: "ChatGPT", tooltipTitle: "" }, APPS), "chatgpt")
  assert.strictEqual(A.matchApp({ id: "steam", title: "Steam", tooltipTitle: "" }, APPS), "steam")
  assert.strictEqual(A.matchApp({ id: "x_status_icon", title: "", tooltipTitle: "chatgpt" }, APPS), "chatgpt")
})

test("absolute icon paths come back as they are", () => {
  assert.strictEqual(A.matchApp({ id: "x", title: "App", tooltipTitle: "" }, APPS), "/opt/app/icon.png")
})

test("short ids do not match by containment, apps without an icon are skipped, no match is empty", () => {
  assert.strictEqual(A.matchApp({ id: "myappindicator", title: "", tooltipTitle: "" }, APPS), "")
  assert.strictEqual(A.matchApp({ id: "nm-applet", title: "Network", tooltipTitle: "" }, APPS), "")
  assert.strictEqual(A.matchApp({ id: "", title: "", tooltipTitle: "" }, APPS), "")
  assert.strictEqual(A.matchApp({ id: "Claude_status_icon_1" }, []), "")
})

test("Apps.js avoids Array.from and codePointAt", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "Apps.js"), "utf8").replace(/\/\/.*$/gm, "")
  assert.ok(!/\b(Array\.from|codePointAt)\b/.test(src))
})
```

If the spike recorded different Claude or ChatGPT tray ids, use those in the two tests above instead (ledger note from Task 1).

- [ ] **Step 2: Run, expect failure**

Run: `node --test tests/apps.test.js`
Expected: FAIL — `Apps.js` not found.

- [ ] **Step 3: Write `Apps.js`**

```js
.pragma library

// Which installed app a tray item belongs to, so its own color icon can stand in for the
// tray image. Pure: the tray adapter hands in the tray item and the desktop entries.

// Lowercase letters and digits only: "com.anthropic.Claude" -> "comanthropicclaude".
function normalize(s) {
  return String(s === undefined || s === null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, "")
}

// "Claude_status_icon_1" -> "claude", "nm-applet" -> "nm".
function leadingWord(id) {
  var m = String(id || "").toLowerCase().match(/^[a-z0-9]+/)
  return m ? m[0] : ""
}

// Containment only for strings long enough to mean something ("app" is in everything).
function contains(haystack, needle) {
  return needle.length >= 4 && haystack.indexOf(needle) !== -1
}

function lastSegment(desktopId) {
  var parts = String(desktopId || "").split(".")
  return parts[parts.length - 1]
}

// First match wins, rule by rule over every app: window class, desktop id, name.
function matchApp(tray, apps) {
  var t = tray || {}
  var id = normalize(t.id)
  var title = normalize(t.title)
  var tip = normalize(t.tooltipTitle)
  var word = leadingWord(t.id)
  var list = (apps || []).filter(function(a) { return a && String(a.icon || "") !== "" })
  var rules = [
    function(a) { var w = normalize(a.wmClass); return w !== "" && (w === id || contains(id, w)) },
    function(a) {
      var full = normalize(a.desktopId), last = normalize(lastSegment(a.desktopId))
      return [full, last].some(function(d) { return d !== "" && (contains(id, d) || contains(title, d)) })
    },
    function(a) { var n = normalize(a.name); return n !== "" && (n === title || n === tip || n === word) }
  ]
  for (var r = 0; r < rules.length; r++)
    for (var i = 0; i < list.length; i++)
      if (rules[r](list[i])) return String(list[i].icon)
  return ""
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/`
Expected: all pass. Check by hand that `nm-applet`/"Network" stays `""` and Claude matches by rule 2 (`claude` from `com.anthropic.Claude` inside `claudestatusicon1`), not by rule 3.

- [ ] **Step 5: Commit**

```bash
git add Apps.js tests/apps.test.js
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "Apps.js: match a tray item to its installed app

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Tray adapter (skip if the spike dropped tray)

**Files:**
- Create: `TrayAdapter.qml`
- Modify: `Panel.qml`, `manifest.json`, `Icons.js` (`SUPPORTED`), `colorbar` (`SUPPORTED`)
- Modify: `tests/test_colorbar.py`

**Interfaces:**
- Consumes: `Apps.matchApp` (Task 4); `Panel.qml` `adapter` (Task 3).
- Produces: `TrayAdapter { host: <hosted tray item>; enabled: bool }`. `SUPPORTED` final order (Global Constraints).

- [ ] **Step 1: Write the failing Python test** — next to the Task 3 test:

```python
    def test_swaps_the_tray(self):
        config = {"bar": {"layout": {"left": [], "center": [], "right": [{"id": "omarchy.tray", "pinned": ["a"]}]}}}
        out = colorbar.swapped(config)
        self.assertEqual(out["bar"]["layout"]["right"], [{"id": "blackcode.omacolorbar", "icon": "omarchy.tray"}])
        self.assertIn({"id": "omarchy.tray", "pinned": ["a"]}, out["plugins"])
```

- [ ] **Step 2: Run, expect failure**

Run: `python3 -I -m unittest discover -s tests -p "test_*.py"`
Expected: FAIL.

- [ ] **Step 3: Add the id** — insert `"omarchy.tray"` after `"omarchy.tailscale"` (before `"omarchy.indicators"`) in `manifest.json` `icon` options, `Icons.js` `SUPPORTED` and `colorbar` `SUPPORTED`. Run all tests → pass.

- [ ] **Step 4: Write `TrayAdapter.qml`**

If the spike found `startupClass`/`noDisplay` unreadable from `DesktopEntries`, stop and rule in the ledger before writing this step (fall back to reading the `.desktop` files with `Process` + `grep`, per the spec). Otherwise:

```qml
import QtQuick
import Quickshell
import "Apps.js" as Apps

// Gives every tray icon in the hosted tray its app's own color icon. The tray builds its
// icons in Repeaters (drawer and pinned rows, both orientations), so they are re-scanned.
// No match, an empty icon path or an image error leaves or puts back the tray's own image.
Item {
  id: adapter

  property var host: null
  property bool enabled: false
  property var adapted: []
  property var apps: []

  function readApps() {
    var values = DesktopEntries.applications.values
    var out = []
    for (var i = 0; i < values.length; i++) {
      var e = values[i]
      if (e.noDisplay) continue
      out.push({ name: e.name, icon: e.icon, wmClass: e.startupClass, desktopId: e.id })
    }
    apps = out
  }

  // A tray icon: the Tray.qml TrayIcon item, with icon and symbolic, holding its Image.
  function trayIcons(item, depth, out) {
    if (!item || depth > 14) return out
    if ("icon" in item && "symbolic" in item && item.children.length > 0 && "fillMode" in item.children[0]) out.push(item)
    var kids = item.children || []
    for (var i = 0; i < kids.length; i++) trayIcons(kids[i], depth + 1, out)
    return out
  }

  function sourceFor(name) {
    if (name === "") return ""
    if (name.charAt(0) === "/") return "file://" + name
    return Quickshell.iconPath(name, true)
  }

  function restore(trayIcon) {
    var image = trayIcon.children[0]
    image.source = Qt.binding(function() { return String(trayIcon.icon || "") })
    image.visible = Qt.binding(function() { return !trayIcon.symbolic })
    image.layer.enabled = Qt.binding(function() { return trayIcon.symbolic })
    if (trayIcon.children.length > 1) trayIcon.children[1].visible = Qt.binding(function() { return trayIcon.symbolic })
  }

  function adapt(trayIcon) {
    var data = trayIcon.parent ? trayIcon.parent.modelData : null
    if (!data) return
    var source = sourceFor(Apps.matchApp({ id: data.id, title: data.title, tooltipTitle: data.tooltipTitle }, apps))
    if (source === "") return
    var image = trayIcon.children[0]
    image.source = source
    // A symbolic tray icon is drawn tinted through a MultiEffect; show the app icon as is.
    image.visible = true
    image.layer.enabled = false
    if (trayIcon.children.length > 1) trayIcon.children[1].visible = false
    image.statusChanged.connect(function() {
      if (image.status === Image.Error) {
        console.warn("[omacolorbar] tray: " + source + " failed to load; using the tray's own image")
        adapter.restore(trayIcon)
      }
    })
  }

  function scan() {
    var live = adapted.filter(function(item) { return item })
    var found = trayIcons(host, 0, [])
    for (var i = 0; i < found.length; i++) {
      if (live.indexOf(found[i]) !== -1) continue
      adapt(found[i])
      live.push(found[i])
    }
    adapted = live
  }

  onHostChanged: adapted = []
  Component.onCompleted: readApps()

  Connections {
    target: DesktopEntries.applications
    function onValuesChanged() { adapter.readApps() }
  }

  Timer {
    interval: 1000
    repeat: true
    triggeredOnStart: true
    running: adapter.enabled && adapter.host !== null
    onTriggered: adapter.scan()
  }
}
```

- [ ] **Step 5: Host it from `Panel.qml`** — after the indicator scan `Timer`:

```qml
  TrayAdapter {
    host: loader.item
    enabled: root.adapter === "tray"
  }
```

- [ ] **Step 6: Run all tests**

Run: `node --test tests/ && python3 -I -m unittest discover -s tests -p "test_*.py"`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add TrayAdapter.qml Panel.qml manifest.json Icons.js colorbar tests/test_colorbar.py
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "Tray: each app shows its own color icon

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Release files for 1.1.0

**Files:**
- Modify: `manifest.json` (version, description)
- Modify: `README.md`
- Modify: `tests/manifest.test.js`

- [ ] **Step 1: Failing test** — add to `tests/manifest.test.js`:

```js
test("version 1.1.0", () => {
  assert.strictEqual(manifest.version, "1.1.0")
})
```
Run `node --test tests/manifest.test.js` → FAIL.

- [ ] **Step 2: Manifest** — `"version": "1.1.0"`; description: `"OmaColorBar: color icons for Omarchy's built-in bar widgets, tray apps, indicators and weather. Each copy hosts the real widget, so its popup and clicks stay Omarchy's own; settings are read from plugins[]"`. Run the tests → pass.

- [ ] **Step 3: README**

- "What it does": rename "Phase 1 icons" to "Icons" and add:
  - `omarchy.tray` (each tray app shows its own installed app icon, for example Claude and ChatGPT; apps without one keep their tray image)
  - `omarchy.indicators` (stay awake, do not disturb, night light, screen recording, dictation, reminder: color when on, gray when off)
  - `omarchy.weather` (a color drawing for each condition)
- New section "Updating from 1.0.0" after "Install": run `~/.config/omarchy/plugins/blackcode.omacolorbar/colorbar swap --force` to also swap the tray, indicators and weather. `--force` keeps your original backup. Then `omarchy restart shell`.
- New section "Tray icons": the match rule in plain words (window class, then desktop file name, then app name; the icon comes from the app's `.desktop` file through the icon theme; no match or a missing icon keeps the tray's own image).
- Known limits: add the tray pin/hide result from the spike (if pin/hide works for the session only: "Pinning or hiding a tray app from the tray's manage panel lasts until the next restart; set `pinned`/`hidden` in the `omarchy.tray` entry of `plugins[]` to keep it"). If tray was dropped in Task 1: "Tray icons are not in 1.1.0: <reason from the spike>", and remove the tray bullets above.
- Settings table: Icon values "any widget listed above".

- [ ] **Step 4: Commit**

```bash
git add manifest.json README.md tests/manifest.test.js
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "OmaColorBar 1.1.0: README and manifest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Live check, poster, merge (controller)

**Files:**
- Modify: `preview.png`; the poster source `~/Pictures/omarchy-plugin-posters/omacolorbar.html`

- [ ] **Step 1: Swap the real bar** (the user already consented to their bar being swapped in 1.0.0; this extends it to the new ids)

```bash
cp ~/.config/omarchy/shell.json "$SCRATCH/shell.json.pre-1.1"
~/.config/omarchy/plugins/blackcode.omacolorbar/colorbar swap --force
omarchy restart shell
```
Wait ~9 s. Confirm `shell.json.omacolorbar-backup` is unchanged (`cmp` against its copy taken before the swap).

- [ ] **Step 2: Checks** — screenshot and read after each; record PASS/FAIL in the ledger:
1. Weather shows its color condition icon; left-click opens Omarchy's weather panel.
2. Stay awake: toggle it on (`omarchy-toggle-idle` or its click) → color cup; off → hidden; hover the indicator area → gray cup at reduced opacity. Put it back as it was.
3. Night light or DND toggled on → color icon; restore.
4. Tray (if shipped): Claude's slot shows the color Claude icon; left-click opens Claude; right-click opens its menu (Escape); ChatGPT's icon if it is running; an app with no `.desktop` match keeps its own image.
5. `journalctl --user -b --since "-5 min" | grep omacolorbar` shows no warnings except expected ones.
6. All tests pass on the branch.

Fix failures on `v1.1` (each fix: test where possible, commit), restart the shell, re-check.

- [ ] **Step 3: Poster** — in `~/Pictures/omarchy-plugin-posters/omacolorbar.html`: kicker "RELEASE 1.1.0"; the top bar shows the color tray icons (Claude, ChatGPT), indicators and weather next to the 1.0.0 icons (take the drawings from `icons/`); features line adds "tray apps · indicators · weather". Render with `./render.sh omacolorbar.html`, read the PNG, fix overflow, copy to `preview.png`.

```bash
git add preview.png
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "Poster for 1.1.0

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Merge locally** — `git switch main && git merge --ff-only v1.1`. Tell the user the result and ask before `git push` and before the marketplace step (comment on #13001 if still pending, otherwise a `[Verify]` update request).
