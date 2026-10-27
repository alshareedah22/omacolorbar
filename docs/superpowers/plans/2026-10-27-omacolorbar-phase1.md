# OmaColorBar Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship OmaColorBar 1.0.0: an Omarchy bar-widget plugin whose copies each host one built-in bar widget and replace its glyph with a color gradient icon, plus a `colorbar` helper that swaps the user's bar over and back.

**Architecture:** `Service.qml` receives the shell's widget registry; `Panel.qml` creates the real built-in widget from that registry, finds its `BarIconButton` and sets `iconComponent` to a color icon chosen by `Icons.js` from the button's glyph. Fixed icons are SVG files made by `tools/make_icons.py`; level icons (battery, Wi-Fi, speaker) are SVG text from `Levels.js`. The hosted widget's own settings live in `shell.json`'s `plugins[]` entry for the built-in id, which the shell already uses when that widget is not in the layout.

**Tech Stack:** QML (Quickshell, Omarchy shell `qs.Ui` / `qs.Commons`), JavaScript (`.pragma library`, tested with `node --test`), Python 3 standard library (`colorbar`, `tools/make_icons.py`, tests with `unittest`).

**Spec:** `docs/superpowers/specs/2026-10-27-omacolorbar-design.md`

## Global Constraints

- Never edit `/usr/share/omarchy/`; never load Omarchy QML files by path. Built-in widgets come only from the registry (`registry.widgets[id].component`).
- Plugin id `blackcode.omacolorbar`; the working copy must live at `~/.config/omarchy/plugins/blackcode.omacolorbar` for the shell to load it.
- Phase 1 ids, in this order: `omarchy.menu`, `omarchy.network`, `omarchy.bluetooth`, `omarchy.audio`, `omarchy.microphone`, `omarchy.power`, `omarchy.monitor`, `omarchy.system-update`, `omarchy.agents`, `omarchy.tailscale`.
- Arch logo: unaltered official path, solid `#1793D1`, no gradient, no shadow.
- Style: 64×64 viewBox, two-stop gradients with `gradientUnits="userSpaceOnUse"` (a straight line has no width, so bounding-box gradients vanish on it), shadow = same shapes in `#000` at opacity .35 offset 1.5,1.5; inactive parts `#3b4252`.
- The bar never shows a blank slot because of OmaColorBar: no drawing → the button's original `iconComponent`; problems → `icons/warning.svg` with a tooltip.
- Commits: `git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit`, message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Editing a plugin file hot-reloads the plugin but the shell sometimes keeps an old copy; after QML changes run `omarchy restart shell` and wait ~9 s before judging the bar.
- Before clicking anything on screen, wait until the cursor has been still for 5 s; put the cursor back afterwards. Monitors: DP-3 left (x 0–1919), DP-2 right (x 1920–3839).
- Any change to `~/.config/omarchy/shell.json` during the build: back it up first and restore it when the check ends, unless the user asked to keep the change.

---

## File Structure

| File | Responsibility |
|---|---|
| `manifest.json` | Plugin metadata, `service` + `bar-widget` entry points, settings schema |
| `Service.qml` | Holds what the shell injects into a service (`barWidgetRegistry` and the rest) |
| `Panel.qml` | Hosting, button lookup, icon swap, Tailscale state, warning state, reading `shell.json` |
| `Icons.js` | Supported ids, glyph tables, `split`, `drawingFor`, `hostSettingsFrom`, `onBarDirectly` |
| `Levels.js` | `wifi`, `speaker`, `battery`, `svgFor`, `dataUri` |
| `tools/make_icons.py` | Writes every file in `icons/` |
| `icons/*.svg` | Generated fixed icons |
| `colorbar` | `swap` / `restore` for `shell.json` |
| `tests/load.js` | Loads a `.pragma library` file into Node |
| `tests/*.test.js` | Node tests |
| `tests/test_colorbar.py` | `colorbar` tests |
| `icon.svg`, `README.md`, `LICENSE`, `preview.png` | Release files |

---

### Task 1: Scaffold the plugin in place

**Files:**
- Move: `~/Projects/omacolorbar` → `~/.config/omarchy/plugins/blackcode.omacolorbar`
- Create: `manifest.json`, `Service.qml`, `LICENSE`, `.gitignore`, `tests/load.js`, `tests/manifest.test.js`

**Interfaces:**
- Produces: `tests/load.js` exporting `load(file) → object` with every top-level `function` and `var` of a `.pragma library` file.

- [ ] **Step 1: Move the repo into the plugins folder**

```bash
mv ~/Projects/omacolorbar ~/.config/omarchy/plugins/blackcode.omacolorbar
cd ~/.config/omarchy/plugins/blackcode.omacolorbar && git status --short && git log --oneline -1
```
Expected: clean tree, last commit `Spec: settings in plugins[], Tailscale state, Levels.js`.

- [ ] **Step 2: Write the failing manifest test** — `tests/manifest.test.js`

```js
const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const path = require("path")

const root = path.join(__dirname, "..")
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"))

test("manifest declares a service and a bar widget whose files exist", () => {
  assert.strictEqual(manifest.id, "blackcode.omacolorbar")
  assert.deepStrictEqual(manifest.kinds, ["service", "bar-widget"])
  for (const file of Object.values(manifest.entryPoints)) assert.ok(fs.existsSync(path.join(root, file)), file)
  assert.strictEqual(manifest.barWidget.allowMultiple, true)
})

test("settings schema has icon and menuLogo with their defaults", () => {
  const byKey = Object.fromEntries(manifest.barWidget.schema.map(s => [s.key, s]))
  assert.strictEqual(byKey.icon.type, "enum")
  assert.strictEqual(byKey.icon.defaultValue, "omarchy.network")
  assert.deepStrictEqual(byKey.menuLogo.options, ["Omarchy", "Arch"])
  assert.strictEqual(manifest.barWidget.defaults.menuLogo, "Omarchy")
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node --test tests/`
Expected: FAIL (`ENOENT ... manifest.json`).

- [ ] **Step 4: Create `manifest.json`**

```json
{
  "schemaVersion": 1,
  "id": "blackcode.omacolorbar",
  "name": "OmaColorBar",
  "version": "1.0.0",
  "author": "BlackCode",
  "license": "MIT",
  "description": "OmaColorBar: color gradient icons for Omarchy's built-in bar widgets. Each copy hosts the real widget, so its popup, clicks and settings stay Omarchy's own",
  "kinds": [
    "service",
    "bar-widget"
  ],
  "entryPoints": {
    "service": "Service.qml",
    "barWidget": "Panel.qml"
  },
  "barWidget": {
    "displayName": "Color icon",
    "description": "One of Omarchy's bar widgets, with a color icon",
    "category": "Appearance",
    "allowMultiple": true,
    "defaultSection": "right",
    "defaults": {
      "icon": "omarchy.network",
      "menuLogo": "Omarchy"
    },
    "schema": [
      {
        "key": "icon",
        "type": "enum",
        "label": "Icon",
        "options": [
          "omarchy.menu",
          "omarchy.network",
          "omarchy.bluetooth",
          "omarchy.audio",
          "omarchy.microphone",
          "omarchy.power",
          "omarchy.monitor",
          "omarchy.system-update",
          "omarchy.agents",
          "omarchy.tailscale"
        ],
        "defaultValue": "omarchy.network",
        "description": "Which built-in widget this copy shows. Its popup, clicks and settings stay Omarchy's own."
      },
      {
        "key": "menuLogo",
        "type": "enum",
        "label": "Menu logo",
        "options": [
          "Omarchy",
          "Arch"
        ],
        "defaultValue": "Omarchy",
        "description": "For the copy set to omarchy.menu: the Omarchy logo in green, or the Arch Linux logo in its official blue."
      }
    ]
  }
}
```

- [ ] **Step 5: Create `Service.qml`**

```qml
import QtQuick

// The shell injects its bar widget registry only into a plugin's service entry point,
// never into a bar widget. Panel.qml reads it back with bar.shell.serviceFor(), which a
// plugin may call for its own id. The other properties are the rest of what a service
// is handed; nothing here does any work.
QtObject {
  property var barWidgetRegistry: null
  property var pluginRegistry: null
  property var shell: null
  property var manifest: ({})
  property string omarchyPath: ""
}
```

- [ ] **Step 6: Create a placeholder `Panel.qml` so the entry point exists**

```qml
import QtQuick

// Replaced in Task 5.
Item {
  property var bar: null
  property var settings: ({})
  property string moduleName: "blackcode.omacolorbar"
}
```

- [ ] **Step 7: Create `tests/load.js`**

```js
// Loads a QML ".pragma library" JavaScript file into Node: drops the pragma and any
// ".import" lines and returns every top-level function and var.
const fs = require("fs")
const path = require("path")

module.exports = function load(file) {
  const src = fs.readFileSync(path.join(__dirname, "..", file), "utf8")
    .replace(/^\.pragma library\s*$/m, "")
    .replace(/^\.import .*$/gm, "")
  const names = [...src.matchAll(/^(?:function\s+(\w+)|var\s+(\w+))/gm)].map(m => m[1] || m[2])
  return new Function(src + "\nreturn {" + names.join(",") + "}")()
}
```

- [ ] **Step 8: Create `LICENSE` (MIT, `Copyright (c) 2026 BlackCode`, standard MIT text) and `.gitignore`**

`.gitignore`:
```
__pycache__/
*.pyc
```

- [ ] **Step 9: Run the tests**

Run: `node --test tests/`
Expected: 2 tests pass.

- [ ] **Step 10: Commit**

```bash
git add -A
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "Scaffold: manifest, service entry point, test loader

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `Icons.js`, the glyph tables

**Files:**
- Create: `Icons.js`
- Test: `tests/icons.test.js`

**Interfaces:**
- Produces:
  - `PLUGIN_ID: string` = `"blackcode.omacolorbar"`
  - `SUPPORTED: string[]` (Global Constraints order)
  - `split(text: string) → {key: string, label: string}` — `key` is the hex of the last private-use code point (`""` if none), `label` is the rest, trimmed
  - `drawingFor(hostId: string, text: string, options: {menuLogo?: "Omarchy"|"Arch", tailscale?: ""|"on"|"off"|"login"}) → Drawing|null`
  - `Drawing` is one of `{kind:"svg", name, label}`, `{kind:"level", shape:"wifi"|"speaker", level, label}`, `{kind:"battery", level:0..9, charging:bool, full:bool, label}`
  - `svgNames() → string[]` every SVG name `drawingFor` can return, plus `"warning"`
  - `hostSettingsFrom(config: object, hostId: string) → object` the `plugins[]` entry for `hostId` without `id`, or `{}`
  - `onBarDirectly(config: object, hostId: string) → bool`

- [ ] **Step 1: Write the failing tests** — `tests/icons.test.js`

```js
const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const path = require("path")
const load = require("./load")

const I = load("Icons.js")
const g = cp => String.fromCodePoint(parseInt(cp, 16))

test("SUPPORTED matches the manifest's icon options", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"))
  const icon = manifest.barWidget.schema.find(s => s.key === "icon")
  assert.deepStrictEqual(I.SUPPORTED, icon.options)
})

test("split takes the last private-use glyph and keeps the rest as a label", () => {
  assert.deepStrictEqual(I.split(g("f0928")), { key: "f0928", label: "" })
  assert.deepStrictEqual(I.split("73% " + g("f0079")), { key: "f0079", label: "73%" })
  assert.deepStrictEqual(I.split("hello"), { key: "", label: "hello" })
  assert.deepStrictEqual(I.split(""), { key: "", label: "" })
})

test("network: Wi-Fi levels, Ethernet, disconnected", () => {
  ;["f092f", "f091f", "f0922", "f0925", "f0928"].forEach((cp, level) =>
    assert.deepStrictEqual(I.drawingFor("omarchy.network", g(cp), {}), { kind: "level", shape: "wifi", level, label: "" }))
  assert.strictEqual(I.drawingFor("omarchy.network", g("f0200"), {}).name, "ethernet")
  assert.strictEqual(I.drawingFor("omarchy.network", g("f092e"), {}).name, "offline")
})

test("bluetooth, audio, microphone, monitor, update, agents", () => {
  const name = (id, cp) => I.drawingFor(id, g(cp), {}).name
  assert.strictEqual(name("omarchy.bluetooth", "f00b2"), "bt-off")
  assert.strictEqual(name("omarchy.bluetooth", "f00b1"), "bt-connected")
  assert.strictEqual(name("omarchy.bluetooth", "f00af"), "bt-on")
  assert.strictEqual(name("omarchy.audio", "f02cb"), "headphones")
  assert.strictEqual(name("omarchy.audio", "eee8"), "muted")
  ;["f026", "f027", "f028"].forEach((cp, i) =>
    assert.deepStrictEqual(I.drawingFor("omarchy.audio", g(cp), {}), { kind: "level", shape: "speaker", level: i + 1, label: "" }))
  assert.strictEqual(name("omarchy.microphone", "f036c"), "mic-on")
  assert.strictEqual(name("omarchy.microphone", "f036d"), "mic-off")
  assert.strictEqual(name("omarchy.monitor", "f0379"), "monitor-one")
  assert.strictEqual(name("omarchy.monitor", "f037a"), "monitor-many")
  assert.strictEqual(name("omarchy.system-update", "f021"), "update")
  assert.strictEqual(name("omarchy.agents", "f16a3"), "agents")
})

test("power: 10 discharging steps, 9 charging steps, full, label kept", () => {
  const dis = ["f007a", "f007b", "f007c", "f007d", "f007e", "f007f", "f0080", "f0081", "f0082", "f0079"]
  const chg = ["f089c", "f0086", "f0087", "f0088", "f089d", "f0089", "f089e", "f008a", "f008b"]
  dis.forEach((cp, level) => assert.deepStrictEqual(I.drawingFor("omarchy.power", g(cp), {}),
    { kind: "battery", level, charging: false, full: false, label: "" }))
  chg.forEach((cp, level) => assert.deepStrictEqual(I.drawingFor("omarchy.power", g(cp), {}),
    { kind: "battery", level, charging: true, full: false, label: "" }))
  assert.deepStrictEqual(I.drawingFor("omarchy.power", g("f0085"), {}),
    { kind: "battery", level: 9, charging: true, full: true, label: "" })
  assert.strictEqual(I.drawingFor("omarchy.power", "73% " + g("f0079"), {}).label, "73%")
})

test("menu follows the menuLogo setting, Tailscale its state", () => {
  assert.strictEqual(I.drawingFor("omarchy.menu", g("e900"), {}).name, "menu-omarchy")
  assert.strictEqual(I.drawingFor("omarchy.menu", g("e900"), { menuLogo: "Arch" }).name, "menu-arch")
  assert.strictEqual(I.drawingFor("omarchy.tailscale", "", { tailscale: "on" }).name, "tailscale-on")
  assert.strictEqual(I.drawingFor("omarchy.tailscale", "", { tailscale: "login" }).name, "tailscale-login")
  assert.strictEqual(I.drawingFor("omarchy.tailscale", "", {}), null)
})

test("unknown glyphs and unknown widgets have no drawing", () => {
  assert.strictEqual(I.drawingFor("omarchy.network", g("f0001"), {}), null)
  assert.strictEqual(I.drawingFor("omarchy.network", "", {}), null)
  assert.strictEqual(I.drawingFor("omarchy.clock", g("f0928"), {}), null)
})

test("svgNames lists every SVG drawing plus warning", () => {
  const names = I.svgNames()
  for (const n of ["menu-omarchy", "menu-arch", "ethernet", "offline", "bt-off", "bt-on", "bt-connected",
    "headphones", "muted", "mic-on", "mic-off", "monitor-one", "monitor-many", "update", "agents",
    "tailscale-on", "tailscale-off", "tailscale-login", "warning"]) assert.ok(names.includes(n), n)
})

test("hostSettingsFrom and onBarDirectly read shell.json", () => {
  const cfg = {
    bar: { layout: { left: [{ id: "omarchy.menu" }], center: [], right: [{ id: "blackcode.omacolorbar", icon: "omarchy.power" }] } },
    plugins: [{ id: "omarchy.power", showPercentage: true }]
  }
  assert.deepStrictEqual(I.hostSettingsFrom(cfg, "omarchy.power"), { showPercentage: true })
  assert.deepStrictEqual(I.hostSettingsFrom(cfg, "omarchy.audio"), {})
  assert.deepStrictEqual(I.hostSettingsFrom({}, "omarchy.audio"), {})
  assert.strictEqual(I.onBarDirectly(cfg, "omarchy.menu"), true)
  assert.strictEqual(I.onBarDirectly(cfg, "omarchy.power"), false)
  assert.strictEqual(I.onBarDirectly({}, "omarchy.power"), false)
})

// Every glyph Omarchy can put on these buttons, read from the installed shell. Skipped
// where Omarchy is not installed; after an Omarchy update it names any new glyph.
const SHELL = "/usr/share/omarchy/shell/plugins"
function privateUse(text) {
  return [...new Set([...text].filter(c => { const p = c.codePointAt(0); return (p >= 0xe000 && p <= 0xf8ff) || p >= 0xf0000 })
    .map(c => c.codePointAt(0).toString(16)))]
}
function functionBody(file, name) {
  const src = fs.readFileSync(path.join(SHELL, file), "utf8")
  const start = src.indexOf("function " + name)
  if (start < 0) throw new Error(name + " not found in " + file)
  let depth = 0, i = src.indexOf("{", start)
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++
    else if (src[j] === "}" && --depth === 0) return src.slice(i, j + 1)
  }
  return src.slice(i)
}
function barText(file) {
  const src = fs.readFileSync(path.join(SHELL, file), "utf8")
  const at = src.indexOf("BarIconButton {")
  const line = src.slice(at).split("\n").find(l => /^\s*text:/.test(l))
  return line.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
}
const installed = fs.existsSync(SHELL)
test("every glyph in the installed Omarchy has a drawing", { skip: !installed && "Omarchy not installed" }, () => {
  const cases = [
    ["omarchy.network", functionBody("panels/network/Model.js", "wifiIconFor") + functionBody("panels/network/Model.js", "connectionIcon")],
    ["omarchy.bluetooth", (() => { const s = fs.readFileSync(path.join(SHELL, "panels/bluetooth/Panel.qml"), "utf8"); const a = s.indexOf("readonly property string icon"); return s.slice(a, s.indexOf("}", a)) })()],
    ["omarchy.audio", functionBody("panels/audio/Panel.qml", "outputIcon")],
    ["omarchy.microphone", barText("bar/widgets/Microphone.qml")],
    ["omarchy.power", functionBody("panels/power/Model.js", "batteryIcon")],
    ["omarchy.monitor", barText("panels/monitor/Panel.qml")],
    ["omarchy.system-update", barText("bar/widgets/SystemUpdate.qml")],
    ["omarchy.agents", barText("agents/Panel.qml")]
  ]
  const missing = []
  for (const [id, text] of cases)
    for (const cp of privateUse(text)) if (!I.drawingFor(id, g(cp), {})) missing.push(id + " " + cp)
  assert.deepStrictEqual(missing, [])
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test tests/`
Expected: FAIL (`ENOENT ... Icons.js`).

- [ ] **Step 3: Write `Icons.js`**

```js
.pragma library

// Which color drawing stands for each glyph a built-in bar widget can show. All of the
// "which glyph means what" knowledge is here: after an Omarchy update that adds a glyph,
// tests/icons.test.js names it and this is the one file to change.

var PLUGIN_ID = "blackcode.omacolorbar"

var SUPPORTED = ["omarchy.menu", "omarchy.network", "omarchy.bluetooth", "omarchy.audio",
  "omarchy.microphone", "omarchy.power", "omarchy.monitor", "omarchy.system-update",
  "omarchy.agents", "omarchy.tailscale"]

function svg(name) { return { kind: "svg", name: name } }
function level(shape, n) { return { kind: "level", shape: shape, level: n } }

var GLYPHS = {
  "omarchy.network": {
    f092f: level("wifi", 0), f091f: level("wifi", 1), f0922: level("wifi", 2),
    f0925: level("wifi", 3), f0928: level("wifi", 4),
    f0200: svg("ethernet"), f092e: svg("offline")
  },
  "omarchy.bluetooth": { f00b2: svg("bt-off"), f00b1: svg("bt-connected"), f00af: svg("bt-on") },
  "omarchy.audio": {
    f02cb: svg("headphones"), eee8: svg("muted"),
    f026: level("speaker", 1), f027: level("speaker", 2), f028: level("speaker", 3)
  },
  "omarchy.microphone": { f036c: svg("mic-on"), f036d: svg("mic-off") },
  "omarchy.monitor": { f0379: svg("monitor-one"), f037a: svg("monitor-many") },
  "omarchy.system-update": { f021: svg("update") },
  "omarchy.agents": { f16a3: svg("agents") }
}

// Battery glyphs by fill step (power/Model.js: floor(percentage * 10)).
var BATTERY_DISCHARGING = ["f007a", "f007b", "f007c", "f007d", "f007e", "f007f", "f0080", "f0081", "f0082", "f0079"]
var BATTERY_CHARGING = ["f089c", "f0086", "f0087", "f0088", "f089d", "f0089", "f089e", "f008a", "f008b"]
var BATTERY_FULL = "f0085"

var TAILSCALE_STATES = ["on", "off", "login"]

function isPrivateUse(cp) { return (cp >= 0xe000 && cp <= 0xf8ff) || cp >= 0xf0000 }

// The glyph is the last private-use code point; anything else ("73% ") is a label.
function split(text) {
  var chars = Array.from(String(text || ""))
  for (var i = chars.length - 1; i >= 0; i--) {
    var cp = chars[i].codePointAt(0)
    if (isPrivateUse(cp))
      return { key: cp.toString(16), label: (chars.slice(0, i).join("") + chars.slice(i + 1).join("")).trim() }
  }
  return { key: "", label: chars.join("").trim() }
}

function withLabel(drawing, label) {
  var out = {}
  for (var k in drawing) out[k] = drawing[k]
  out.label = label
  return out
}

function drawingFor(hostId, text, options) {
  var o = options || {}
  if (hostId === "omarchy.menu")
    return { kind: "svg", name: o.menuLogo === "Arch" ? "menu-arch" : "menu-omarchy", label: "" }
  if (hostId === "omarchy.tailscale")
    return TAILSCALE_STATES.indexOf(o.tailscale) !== -1 ? { kind: "svg", name: "tailscale-" + o.tailscale, label: "" } : null
  var p = split(text)
  if (p.key === "") return null
  if (hostId === "omarchy.power") {
    if (p.key === BATTERY_FULL) return { kind: "battery", level: 9, charging: true, full: true, label: p.label }
    var d = BATTERY_DISCHARGING.indexOf(p.key)
    if (d !== -1) return { kind: "battery", level: d, charging: false, full: false, label: p.label }
    var c = BATTERY_CHARGING.indexOf(p.key)
    if (c !== -1) return { kind: "battery", level: c, charging: true, full: false, label: p.label }
    return null
  }
  var table = GLYPHS[hostId]
  var hit = table ? table[p.key] : null
  return hit ? withLabel(hit, p.label) : null
}

function svgNames() {
  var names = ["menu-omarchy", "menu-arch", "warning"]
  TAILSCALE_STATES.forEach(function(s) { names.push("tailscale-" + s) })
  for (var id in GLYPHS)
    for (var key in GLYPHS[id])
      if (GLYPHS[id][key].kind === "svg" && names.indexOf(GLYPHS[id][key].name) === -1) names.push(GLYPHS[id][key].name)
  return names
}

// The hosted widget's settings: the shell keeps a widget's settings in plugins[] when the
// widget is not in the layout, and updateEntryInline() saves there too.
function hostSettingsFrom(config, hostId) {
  var plugins = config && Array.isArray(config.plugins) ? config.plugins : []
  for (var i = 0; i < plugins.length; i++) {
    if (plugins[i] && plugins[i].id === hostId) {
      var out = {}
      for (var k in plugins[i]) if (k !== "id") out[k] = plugins[i][k]
      return out
    }
  }
  return {}
}

function onBarDirectly(config, hostId) {
  var layout = config && config.bar && config.bar.layout ? config.bar.layout : {}
  var sections = ["left", "center", "right"]
  for (var s = 0; s < sections.length; s++) {
    var entries = Array.isArray(layout[sections[s]]) ? layout[sections[s]] : []
    for (var i = 0; i < entries.length; i++) if (entries[i] && entries[i].id === hostId) return true
  }
  return false
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/`
Expected: all pass, including "every glyph in the installed Omarchy has a drawing". If that one lists glyphs, Omarchy changed since the spec: add each listed glyph to `GLYPHS`/battery tables with the matching drawing and re-run.

- [ ] **Step 5: Commit**

```bash
git add Icons.js tests/icons.test.js
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "Icons.js: glyph tables for the phase 1 widgets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `Levels.js`, the code-drawn level icons

**Files:**
- Create: `Levels.js`
- Test: `tests/levels.test.js`

**Interfaces:**
- Consumes: the `Drawing` shapes from Task 2 (`kind: "level"` with `shape` `"wifi"`/`"speaker"`, `kind: "battery"`).
- Produces: `wifi(level 0..4) → string`, `speaker(level 1..3) → string`, `battery(level 0..9, charging, full) → string`, `svgFor(drawing) → string` (`""` for anything else), `dataUri(drawing) → string` (`"data:image/svg+xml;utf8,…"` or `""`).

- [ ] **Step 1: Write the failing tests** — `tests/levels.test.js`

```js
const test = require("node:test")
const assert = require("node:assert")
const load = require("./load")

const L = load("Levels.js")
const count = (s, needle) => s.split(needle).length - 1
const DIM = 'fill="#3b4252"'

test("wifi lights dot, middle and outer arc by level", () => {
  // 3 parts drawn twice (shadow + body); unlit parts are DIM in the body only
  assert.strictEqual(count(L.wifi(0), DIM), 3)
  assert.strictEqual(count(L.wifi(1), DIM), 2)
  assert.strictEqual(count(L.wifi(2), DIM), 2)
  assert.strictEqual(count(L.wifi(3), DIM), 1)
  assert.strictEqual(count(L.wifi(4), DIM), 0)
  assert.strictEqual(L.wifi(9), L.wifi(4))
})

test("speaker lights 1 to 3 waves", () => {
  const dimWave = 'stroke="#3b4252"'
  assert.strictEqual(count(L.speaker(1), dimWave), 2)
  assert.strictEqual(count(L.speaker(2), dimWave), 1)
  assert.strictEqual(count(L.speaker(3), dimWave), 0)
})

test("battery fill grows with the level and warns when low", () => {
  const width = s => Number(/<g opacity[\s\S]*?<\/g>[\s\S]*?<rect x="9" y="21" width="(\d+)"/.exec(s)[1])
  assert.ok(width(L.battery(0, false, false)) < width(L.battery(5, false, false)))
  assert.ok(width(L.battery(5, false, false)) < width(L.battery(9, false, false)))
  assert.ok(L.battery(0, false, false).includes('fill="#e11d48"'))
  assert.ok(L.battery(1, false, false).includes('fill="#f97316"'))
  assert.ok(!L.battery(5, false, false).includes('fill="#f97316"'))
  assert.ok(L.battery(3, true, false).includes("<path"), "charging bolt")
  assert.ok(!L.battery(3, false, false).includes("<path"), "no bolt")
})

test("svgFor and dataUri dispatch on the drawing", () => {
  assert.strictEqual(L.svgFor({ kind: "level", shape: "wifi", level: 2 }), L.wifi(2))
  assert.strictEqual(L.svgFor({ kind: "level", shape: "speaker", level: 3 }), L.speaker(3))
  assert.strictEqual(L.svgFor({ kind: "battery", level: 4, charging: true, full: false }), L.battery(4, true, false))
  assert.strictEqual(L.svgFor({ kind: "svg", name: "agents" }), "")
  assert.strictEqual(L.svgFor(null), "")
  assert.ok(L.dataUri({ kind: "level", shape: "wifi", level: 1 }).startsWith("data:image/svg+xml;utf8,%3Csvg"))
  assert.strictEqual(L.dataUri(null), "")
})

test("every level icon is self-contained SVG", () => {
  for (const s of [L.wifi(3), L.speaker(2), L.battery(7, true, false)]) {
    assert.ok(s.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'))
    assert.ok(s.includes('gradientUnits="userSpaceOnUse"'))
    assert.ok(!/script|href=|url\(http/i.test(s))
  }
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test tests/levels.test.js`
Expected: FAIL (`ENOENT ... Levels.js`).

- [ ] **Step 3: Write `Levels.js`**

```js
.pragma library

// Icons with a fill level (Wi-Fi strength, speaker volume, battery), drawn as SVG text in
// the same style as icons/*.svg: two-stop gradient, soft shadow, 64x64.

var DIM = "#3b4252"
var CASE = "#45475a"
var WIFI = ["#0ea5e9", "#22d3ee", "#a5f3fc"]
var AUDIO = ["#f97316", "#fbbf24", "#fde68a"]
var BATTERY = ["#16a34a", "#4ade80", "#facc15"]
var LOW = "#f97316"
var EMPTY = "#e11d48"

function clamp(v, lo, hi) {
  var n = Math.round(Number(v) || 0)
  return n < lo ? lo : n > hi ? hi : n
}

// userSpaceOnUse: a straight stroke has no width, so a bounding-box gradient would vanish.
function wrap(colors, body) {
  var defs = '<defs><linearGradient id="a" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="64" y2="64">'
    + '<stop offset="0" stop-color="' + colors[0] + '"/><stop offset="1" stop-color="' + colors[1] + '"/>'
    + '</linearGradient></defs>'
  var shadow = body.replace(/(fill|stroke)="(?!none)[^"]*"/g, '$1="#000"')
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' + defs
    + '<g opacity=".35" transform="translate(1.5 1.5)">' + shadow + '</g>' + body + '</svg>'
}

var ARCS = [
  "M23 42 a14 14 0 0 1 18 0 l-9 10 z",
  "M14.5 33 a26 26 0 0 1 35 0 l-5.5 6 a18 18 0 0 0 -24 0 z",
  "M6 24 a38 38 0 0 1 52 0 l-5.5 6 a30 30 0 0 0 -41 0 z"
]

// Omarchy's 5 Wi-Fi steps light the dot, then the middle arc, then the outer arc.
function wifi(level) {
  var lit = [0, 1, 1, 2, 3][clamp(level, 0, 4)]
  var body = ""
  for (var i = 0; i < ARCS.length; i++) {
    var fill = i >= lit ? DIM : i === 0 ? WIFI[2] : "url(#a)"
    body += '<path d="' + ARCS[i] + '" fill="' + fill + '"/>'
  }
  return wrap(WIFI, body)
}

var WAVES = ["M40 24 a12 12 0 0 1 0 16", "M45 18 a20 20 0 0 1 0 28", "M50 12 a28 28 0 0 1 0 40"]

function speaker(level) {
  var lit = clamp(level, 1, 3)
  var body = '<path d="M6 24 h10 l14 -12 v40 l-14 -12 h-10 z" fill="url(#a)"/>'
  for (var i = 0; i < WAVES.length; i++)
    body += '<path d="' + WAVES[i] + '" fill="none" stroke="' + (i < lit ? "url(#a)" : DIM)
      + '" stroke-width="5" stroke-linecap="round"/>'
  return wrap(AUDIO, body)
}

// level 0..9 is Omarchy's floor(percentage * 10); full is the "charged" glyph.
function battery(level, charging, full) {
  var l = clamp(level, 0, 9)
  var fill = full ? "url(#a)" : l === 0 ? EMPTY : l === 1 ? LOW : "url(#a)"
  var width = full ? 40 : Math.max(4, Math.round(40 * (l + 1) / 10))
  var body = '<rect x="4" y="16" width="50" height="32" rx="7" fill="' + CASE + '"/>'
    + '<rect x="54" y="25" width="6" height="14" rx="2" fill="' + CASE + '"/>'
    + '<rect x="9" y="21" width="' + width + '" height="22" rx="3" fill="' + fill + '"/>'
  if (charging || full) body += '<path d="M33 18 l-9 16 h8 l-4 12 12 -17 h-8 z" fill="' + BATTERY[2] + '"/>'
  return wrap(BATTERY, body)
}

function svgFor(drawing) {
  if (!drawing) return ""
  if (drawing.kind === "battery") return battery(drawing.level, drawing.charging, drawing.full)
  if (drawing.kind === "level" && drawing.shape === "wifi") return wifi(drawing.level)
  if (drawing.kind === "level" && drawing.shape === "speaker") return speaker(drawing.level)
  return ""
}

function dataUri(drawing) {
  var s = svgFor(drawing)
  return s === "" ? "" : "data:image/svg+xml;utf8," + encodeURIComponent(s)
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/`
Expected: all pass.

- [ ] **Step 5: Look at the level icons**

```bash
S=/tmp/claude-1000/-home-blackcode-desktop/e4b4a5c1-17c8-4668-b6e7-8f0ea7793e33/scratchpad/levels; mkdir -p $S
node -e '
const L = require("./tests/load")("Levels.js"); const fs = require("fs")
const all = [...[0,1,2,3,4].map(l => ["wifi"+l, L.wifi(l)]), ...[1,2,3].map(l => ["speaker"+l, L.speaker(l)]),
  ...[0,1,5,9].map(l => ["battery"+l, L.battery(l,false,false)]), ["battery-charging3", L.battery(3,true,false)], ["battery-full", L.battery(9,true,true)]]
for (const [n, s] of all) fs.writeFileSync(process.argv[1] + "/" + n + ".svg", s)' $S
cd $S && for f in *.svg; do magick -background "#1e1e2e" -density 200 $f -resize 64x64 ${f%.svg}.png; done && magick *.png +append strip.png
```
Read `$S/strip.png`. Expected: every icon visible and distinct; unlit parts gray; low battery orange/red; bolt on charging.

- [ ] **Step 6: Commit**

```bash
git add Levels.js tests/levels.test.js
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "Levels.js: Wi-Fi, speaker and battery icons with a fill level

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Fixed icons (`tools/make_icons.py`, `icons/*.svg`)

**Files:**
- Create: `tools/make_icons.py`, `icons/*.svg` (generated)
- Test: `tests/svg.test.js`

**Interfaces:**
- Consumes: `svgNames()` from Task 2.
- Produces: one `icons/<name>.svg` per `svgNames()` entry.

- [ ] **Step 1: Write the failing test** — `tests/svg.test.js`

```js
const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const path = require("path")
const load = require("./load")

const dir = path.join(__dirname, "..", "icons")

test("every drawing Icons.js can name exists as a safe SVG", () => {
  for (const name of load("Icons.js").svgNames()) {
    const file = path.join(dir, name + ".svg")
    assert.ok(fs.existsSync(file), name)
    const s = fs.readFileSync(file, "utf8")
    assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 (64 64|256 256)">/, name)
    assert.ok(s.trim().endsWith("</svg>"), name)
    assert.ok(!/<script|href=|url\(http|on\w+=/i.test(s), name)
  }
})

test("gradients use user space, the Arch logo is the official solid blue", () => {
  for (const f of fs.readdirSync(dir)) {
    const s = fs.readFileSync(path.join(dir, f), "utf8")
    if (s.includes("<linearGradient")) assert.ok(s.includes('gradientUnits="userSpaceOnUse"'), f)
  }
  const arch = fs.readFileSync(path.join(dir, "menu-arch.svg"), "utf8")
  assert.ok(arch.includes('fill="#1793d1"'))
  assert.ok(!arch.includes("linearGradient") && !arch.includes("opacity"))
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/svg.test.js`
Expected: FAIL (`menu-omarchy` missing).

- [ ] **Step 3: Write `tools/make_icons.py`**

```python
#!/usr/bin/env python3
"""Writes icons/*.svg, OmaColorBar's fixed icons, in one style: a two-stop gradient per
widget, a soft shadow (the same shapes in black at 35%), 64x64. Run it after changing a
shape or a color; the generated files are committed."""
import os
import re

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
DIM = "#3b4252"
MUTE = "#6b7280"
SLASH = "#f43f5e"
CASE = "#45475a"

PALETTE = {
    "network": ("#0ea5e9", "#22d3ee", "#a5f3fc"),
    "bluetooth": ("#2563eb", "#60a5fa", "#dbeafe"),
    "audio": ("#f97316", "#fbbf24", "#fde68a"),
    "mic": ("#e11d48", "#fb7185", "#fecdd3"),
    "display": ("#7c3aed", "#38bdf8", "#c4b5fd"),
    "update": ("#10b981", "#6ee7b7", "#d1fae5"),
    "agents": ("#8b5cf6", "#ec4899", "#fce7f3"),
    "tailscale": ("#64748b", "#e2e8f0", "#ffffff"),
    "warning": ("#f59e0b", "#fcd34d", "#78350f"),
    "omarchy": ("#c8e69c", "#5e9a35", "#a8cd76"),
}


def gradient(gid, start, end):
    # userSpaceOnUse: a straight stroke has no width, so a bounding-box gradient vanishes
    return (f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="64" y2="64">'
            f'<stop offset="0" stop-color="{start}"/><stop offset="1" stop-color="{end}"/></linearGradient>')


def icon(palette, body):
    a, b, c = PALETTE[palette]
    body = body.replace("ACCENT", c)
    shadow = re.sub(r'(fill|stroke)="(?!none)[^"]*"', r'\1="#000"', body)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
            f'<defs>{gradient("a", a, b)}{gradient("b", b, a)}</defs>'
            f'<g opacity=".35" transform="translate(1.5 1.5)">{shadow}</g>{body}</svg>\n')


SLASH_LINE = f'<path d="M12 10 L52 54" fill="none" stroke="{SLASH}" stroke-width="6" stroke-linecap="round"/>'
ARCS = ["M23 42 a14 14 0 0 1 18 0 l-9 10 z",
        "M14.5 33 a26 26 0 0 1 35 0 l-5.5 6 a18 18 0 0 0 -24 0 z",
        "M6 24 a38 38 0 0 1 52 0 l-5.5 6 a30 30 0 0 0 -41 0 z"]
RUNE = 'M23 21 l18 16 -9 8 V19 l9 8 -18 16'
SPEAKER = '<path d="M6 24 h10 l14 -12 v40 l-14 -12 h-10 z" fill="url(#a)"/>'
MIC = ('<rect x="21" y="4" width="22" height="36" rx="11" fill="{f}"/>'
       '<path d="M13 30 a19 19 0 0 0 38 0" fill="none" stroke="{s}" stroke-width="4.5" stroke-linecap="round"/>'
       '<path d="M32 49 V58 M24 58 H40" fill="none" stroke="{s}" stroke-width="4.5" stroke-linecap="round"/>')
STAND = f'<path d="M24 54 h16 l-3 -8 h-10 z" fill="{CASE}"/><rect x="18" y="54" width="28" height="4" rx="2" fill="{CASE}"/>'
DOTS = [(x, y) for y in (14, 32, 50) for x in (14, 32, 50)]


def dots(fill_for):
    return "".join(f'<circle cx="{x}" cy="{y}" r="6" fill="{fill_for(x, y)}"/>' for x, y in DOTS)


# Omarchy's menu mark, traced from the Omarchy font's U+E900 glyph.
OMARCHY_RECTS = [(0, 0, 64, 4.4), (0, 59.6, 34.4, 4.4), (39.2, 59.6, 24.8, 4.4), (0, 0, 4.4, 64), (59.6, 0, 4.4, 64),
                 (29.6, 0, 4.8, 12.8), (8.8, 8.8, 25.6, 4), (45.6, 8.8, 9.6, 4), (8.8, 8.8, 4, 46.4),
                 (0, 29.6, 12.8, 4.8), (51.2, 8.8, 4, 46.4), (8.8, 51.2, 46.4, 4), (29.6, 51.2, 4.8, 12.8)]

# The Arch Linux logo, unaltered (from archlinux-logo.svg in the filesystem package).
ARCH_PATH = ("m127.98 12.07c-10.316 25.309-16.543 41.855-28.031 66.41 7.043 7.4609 15.691 16.156 29.734 25.977-15.098-6.207"
             "-25.395-12.445-33.094-18.918-14.703 30.68-37.742 74.391-84.492 158.39 36.746-21.219 65.23-34.293 91.773-39.289"
             "-1.1406-4.8945-1.7852-10.195-1.7422-15.734l0.042969-1.1719c0.58203-23.551 12.828-41.645 27.336-40.418 14.508 "
             "1.2266 25.781 21.316 25.199 44.867-0.10938 4.4219-0.60938 8.6914-1.4805 12.641 26.258 5.1328 54.438 18.18 90.684 "
             "39.105-7.1484-13.156-13.527-25.016-19.621-36.316-9.5938-7.4336-19.605-17.117-40.023-27.594 14.035 3.6406 24.082 "
             "7.8516 31.914 12.555-61.941-115.32-66.957-130.66-88.199-180.5z")

ICONS = {
    "menu-omarchy": lambda: icon("omarchy", "".join(
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#a)"/>' for x, y, w, h in OMARCHY_RECTS)),
    "menu-arch": lambda: ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">'
                          f'<path fill="#1793d1" fill-rule="evenodd" d="{ARCH_PATH}"/></svg>\n'),
    "ethernet": lambda: icon("network",
        '<rect x="8" y="10" width="48" height="40" rx="7" fill="url(#a)"/>'
        '<path d="M18 22 h28 v14 h-5 v5 h-18 v-5 h-5 z" fill="#0b3a53"/>'
        + "".join(f'<rect x="{x}" y="24" width="3" height="6" rx="1" fill="ACCENT"/>' for x in (22, 27, 32, 37))
        + '<rect x="26" y="50" width="12" height="8" fill="url(#b)"/>'
        '<rect x="14" y="13" width="20" height="3" rx="1.5" fill="#ffffff" opacity=".45"/>'),
    "offline": lambda: icon("network", "".join(f'<path d="{d}" fill="{DIM}"/>' for d in ARCS) + SLASH_LINE),
    "bt-on": lambda: icon("bluetooth",
        '<rect x="14" y="4" width="36" height="56" rx="18" fill="url(#a)"/>'
        f'<path d="{RUNE}" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'),
    "bt-connected": lambda: icon("bluetooth",
        '<rect x="14" y="4" width="36" height="56" rx="18" fill="url(#a)"/>'
        f'<path d="{RUNE}" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'
        '<circle cx="6" cy="32" r="4" fill="ACCENT"/><circle cx="58" cy="32" r="4" fill="ACCENT"/>'),
    "bt-off": lambda: icon("bluetooth",
        f'<rect x="14" y="4" width="36" height="56" rx="18" fill="{DIM}"/>'
        f'<path d="{RUNE}" fill="none" stroke="{MUTE}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'
        + SLASH_LINE),
    "headphones": lambda: icon("audio",
        '<path d="M10 40 V32 a22 22 0 0 1 44 0 V40" fill="none" stroke="url(#a)" stroke-width="6" stroke-linecap="round"/>'
        '<rect x="5" y="36" width="15" height="22" rx="6" fill="url(#b)"/><rect x="44" y="36" width="15" height="22" rx="6" fill="url(#b)"/>'),
    "muted": lambda: icon("audio", SPEAKER +
        f'<path d="M40 24 l16 16 M56 24 l-16 16" fill="none" stroke="{SLASH}" stroke-width="5" stroke-linecap="round"/>'),
    "mic-on": lambda: icon("mic", MIC.format(f="url(#a)", s="url(#b)")
        + '<rect x="26" y="10" width="5" height="14" rx="2.5" fill="#ffffff" opacity=".55"/>'),
    "mic-off": lambda: icon("mic", MIC.format(f=DIM, s=MUTE) + SLASH_LINE),
    "monitor-one": lambda: icon("display",
        '<rect x="5" y="8" width="54" height="38" rx="5" fill="url(#a)"/>'
        '<rect x="10" y="13" width="44" height="28" rx="2" fill="url(#b)" opacity=".55"/>' + STAND),
    "monitor-many": lambda: icon("display",
        '<rect x="22" y="4" width="38" height="26" rx="4" fill="url(#b)"/>'
        '<rect x="4" y="16" width="42" height="30" rx="4" fill="url(#a)"/>' + STAND),
    "update": lambda: icon("update",
        '<path d="M50 26 A19 19 0 0 0 15 22" fill="none" stroke="url(#a)" stroke-width="6" stroke-linecap="round"/>'
        '<path d="M8 14 L15 24 L25 18" fill="none" stroke="url(#a)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
        '<path d="M14 38 A19 19 0 0 0 49 42" fill="none" stroke="url(#b)" stroke-width="6" stroke-linecap="round"/>'
        '<path d="M56 50 L49 40 L39 46" fill="none" stroke="url(#b)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'),
    "agents": lambda: icon("agents",
        '<path d="M32 7 V15" fill="none" stroke="url(#b)" stroke-width="4" stroke-linecap="round"/>'
        '<circle cx="32" cy="6" r="3.5" fill="ACCENT"/>'
        '<rect x="8" y="14" width="48" height="40" rx="12" fill="url(#a)"/>'
        '<rect x="15" y="24" width="34" height="18" rx="9" fill="#1e1b4b"/>'
        '<circle cx="25" cy="33" r="4" fill="ACCENT"/><circle cx="39" cy="33" r="4" fill="ACCENT"/>'
        '<rect x="2" y="28" width="6" height="12" rx="3" fill="url(#b)"/><rect x="56" y="28" width="6" height="12" rx="3" fill="url(#b)"/>'),
    "tailscale-on": lambda: icon("tailscale", dots(lambda x, y: "ACCENT" if y == 32 else "url(#a)")),
    "tailscale-off": lambda: icon("tailscale", dots(lambda x, y: DIM) + SLASH_LINE),
    "tailscale-login": lambda: icon("tailscale", dots(lambda x, y: "url(#a)")
        + '<circle cx="50" cy="50" r="12" fill="#f59e0b"/>'
        '<path d="M50 43 V51" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>'
        '<circle cx="50" cy="56.5" r="2.2" fill="#ffffff"/>'),
    "warning": lambda: icon("warning",
        '<path d="M32 6 L60 56 H4 Z" fill="url(#a)" stroke="url(#a)" stroke-width="4" stroke-linejoin="round"/>'
        '<path d="M32 24 V38" fill="none" stroke="ACCENT" stroke-width="6" stroke-linecap="round"/>'
        '<circle cx="32" cy="47" r="3.5" fill="ACCENT"/>'),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, make in ICONS.items():
        with open(os.path.join(OUT, name + ".svg"), "w") as f:
            f.write(make())
    print(f"wrote {len(ICONS)} icons to {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Generate the icons and run the tests**

Run: `python3 -I tools/make_icons.py && node --test tests/`
Expected: `wrote 19 icons to …/icons`; all tests pass.

- [ ] **Step 5: Look at them at bar size and large**

```bash
S=/tmp/claude-1000/-home-blackcode-desktop/e4b4a5c1-17c8-4668-b6e7-8f0ea7793e33/scratchpad/fixed; mkdir -p $S
for f in icons/*.svg; do n=$(basename ${f%.svg}); magick -background "#1e1e2e" -density 300 $f -resize 64x64 $S/$n.png; magick -background "#1e1e2e" -density 72 $f -resize 20x20 -scale 300% $S/$n-small.png; done
magick $S/*[!l].png +append $S/large.png; magick $S/*-small.png +append $S/small.png
```
Read both strips. Expected: every icon recognisable at 20 px; nothing missing (a missing stroke means a gradient problem); the Arch logo is the official shape in solid blue.

- [ ] **Step 6: Commit**

```bash
git add tools/make_icons.py icons tests/svg.test.js
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "Fixed icons: generator and 19 SVGs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `Panel.qml`, hosting and the icon swap

**Files:**
- Modify: `Panel.qml` (replace the placeholder)

**Interfaces:**
- Consumes: `Icons.PLUGIN_ID`, `Icons.SUPPORTED`, `Icons.drawingFor`, `Icons.hostSettingsFrom`, `Icons.onBarDirectly` (Task 2); `Levels.dataUri` (Task 3); `icons/<name>.svg`, `icons/warning.svg` (Task 4); `Service.qml`'s `barWidgetRegistry` (Task 1).
- Produces: a bar widget that honours settings `icon` and `menuLogo`.

- [ ] **Step 1: Write `Panel.qml`**

```qml
import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Icons.js" as Icons
import "Levels.js" as Levels

// One copy hosts one built-in bar widget, built from the shell's widget registry the way
// the bar builds it, and draws a color icon in place of that widget's glyph. Clicks,
// scroll, tooltips and popups stay the built-in widget's own.
Item {
  id: root

  // Injected by the bar.
  property var bar: null
  property var settings: ({})
  property string moduleName: Icons.PLUGIN_ID

  function setting(name, fallback) {
    var value = settings ? settings[name] : undefined
    return value === undefined || value === null ? fallback : value
  }

  readonly property string hostId: String(setting("icon", "omarchy.network"))
  readonly property string menuLogo: String(setting("menuLogo", "Omarchy"))
  readonly property bool supported: Icons.SUPPORTED.indexOf(hostId) !== -1

  // The registry reaches a plugin only through its own service (Service.qml).
  property var registry: null
  property int registryAttempts: 0
  readonly property bool registryLost: registry === null && registryAttempts >= 20
  readonly property var hostComponent: componentFor(hostId, registry ? registry.revision : 0)

  readonly property string problem: !supported ? "OmaColorBar does not support " + hostId
    : registryLost ? "OmaColorBar could not reach the widget registry"
    : registry !== null && hostComponent === null ? "Omarchy has no widget " + hostId
    : ""

  // The hosted widget's own settings, from shell.json's plugins[] entry for its id.
  property var hostSettings: ({})
  property bool duplicate: false

  property var button: null
  property var originalIcon: null
  property int attachTries: 0
  property string tailscaleState: ""

  readonly property var drawing: supported
    ? Icons.drawingFor(hostId, button ? String(button.text) : "", { menuLogo: menuLogo, tailscale: tailscaleState })
    : null
  readonly property string drawingSource: !drawing ? ""
    : drawing.kind === "svg" ? Qt.resolvedUrl("icons/" + drawing.name + ".svg").toString()
    : Levels.dataUri(drawing)

  implicitWidth: problem !== "" ? warning.implicitWidth : slot.implicitWidth
  implicitHeight: problem !== "" ? warning.implicitHeight : slot.implicitHeight

  function resolveRegistry() {
    var direct = bar && bar.barWidgetRegistry ? bar.barWidgetRegistry : null
    if (direct) { registry = direct; return }
    var own = bar && bar.shell && typeof bar.shell.serviceFor === "function" ? bar.shell.serviceFor(moduleName) : null
    registry = own && own.barWidgetRegistry ? own.barWidgetRegistry : null
  }

  function componentFor(id, revision) {
    if (!registry || !registry.widgets) return null
    var key = bar && typeof bar.canonicalWidgetId === "function" ? bar.canonicalWidgetId(id) : id
    var entry = registry.widgets[key]
    return entry ? entry.component : null
  }

  // What Bar.qml injects into every widget; the hosted widget is not told it is hosted.
  function inject(item) {
    if (!item) return
    if ("bar" in item) item.bar = root.bar
    if ("moduleName" in item) item.moduleName = root.hostId
    if ("settings" in item) item.settings = root.hostSettings
  }

  // The hosted widget's BarIconButton: the item with iconComponent and glyph metrics.
  function findButton(item, depth) {
    if (!item || depth > 8) return null
    if ("iconComponent" in item && "glyphPaintedWidth" in item) return item
    var kids = item.children || []
    for (var i = 0; i < kids.length; i++) {
      var found = findButton(kids[i], depth + 1)
      if (found) return found
    }
    return null
  }

  // Tailscale's own icon: the item with crossed and warning.
  function findFlags(item, depth) {
    if (!item || depth > 6) return null
    if ("crossed" in item && "warning" in item) return item
    var kids = item.children || []
    for (var i = 0; i < kids.length; i++) {
      var found = findFlags(kids[i], depth + 1)
      if (found) return found
    }
    return null
  }

  function attach() {
    var found = findButton(loader.item, 0)
    if (!found) {
      if (attachTries++ < 20) attachRetry.restart()
      else console.warn("[omacolorbar] " + hostId + ": no BarIconButton found; leaving its own icon")
      return
    }
    originalIcon = found.iconComponent
    button = found
    // No drawing: the button's own icon (null = its glyph, or Tailscale's component).
    found.iconComponent = Qt.binding(function() {
      return root.drawing !== null || root.hostId === "omarchy.tailscale" ? colorIcon : root.originalIcon
    })
    markDuplicate()
  }

  function markDuplicate() {
    if (!duplicate || !button || !("tooltipText" in button)) return
    var note = "OmaColorBar: " + hostId + " is also on the bar directly"
    if (String(button.tooltipText).indexOf(note) === -1)
      button.tooltipText = (button.tooltipText ? button.tooltipText + "\n" : "") + note
  }

  function readShell() {
    var config
    try { config = JSON.parse(shellView.text()) } catch (e) { return }
    hostSettings = Icons.hostSettingsFrom(config, hostId)
    duplicate = Icons.onBarDirectly(config, hostId)
  }

  onHostSettingsChanged: if (loader.item && "settings" in loader.item) loader.item.settings = hostSettings
  onDuplicateChanged: markDuplicate()
  Component.onCompleted: resolveRegistry()

  Timer {
    interval: 250
    repeat: true
    running: root.registry === null && root.registryAttempts < 20
    onTriggered: { root.registryAttempts++; root.resolveRegistry() }
  }

  Timer {
    id: attachRetry
    interval: 100
    onTriggered: root.attach()
  }

  FileView {
    id: shellView
    path: Quickshell.env("HOME") + "/.config/omarchy/shell.json"
    watchChanges: true
    printErrors: false
    onLoaded: root.readShell()
    onFileChanged: reload()
  }

  Component {
    id: colorIcon
    Item {
      id: icon

      // Tailscale draws its own icon: keep it, invisible, to read its state from it.
      Loader {
        id: original
        anchors.fill: parent
        active: root.hostId === "omarchy.tailscale"
        sourceComponent: root.originalIcon
        opacity: root.drawing ? 0 : 1
      }
      readonly property var flags: root.findFlags(original.item, 0)
      Binding {
        target: root
        property: "tailscaleState"
        when: original.active
        value: icon.flags ? (icon.flags.warning ? "login" : (icon.flags.crossed ? "off" : "on")) : ""
      }

      // Centered on the button; a label (battery percentage) sits left of the icon.
      Row {
        anchors.centerIn: parent
        spacing: Style.space(4)
        visible: root.drawing !== null

        Text {
          anchors.verticalCenter: parent.verticalCenter
          visible: text !== ""
          text: root.drawing ? root.drawing.label : ""
          textFormat: Text.PlainText
          color: root.bar ? root.bar.foreground : Color.foreground
          font.family: root.bar ? root.bar.fontFamily : Style.font.family
          font.pixelSize: Style.bar.iconFont
        }

        Image {
          width: icon.height
          height: icon.height
          source: root.drawingSource
          sourceSize.width: width * 2
          sourceSize.height: height * 2
          fillMode: Image.PreserveAspectFit
          smooth: true
        }
      }
    }
  }

  Item {
    id: slot
    visible: root.problem === ""
    implicitWidth: loader.item && loader.item.visible ? loader.item.implicitWidth : 0
    implicitHeight: loader.item && loader.item.visible ? loader.item.implicitHeight : 0
    width: implicitWidth
    height: implicitHeight

    Loader {
      id: loader
      anchors.fill: parent
      active: root.problem === ""
      sourceComponent: root.hostComponent
      onLoaded: {
        root.inject(item)
        // Again on the next frame, as the bar does: some widgets read these while building.
        Qt.callLater(function() { root.inject(loader.item); root.attach() })
      }
    }
  }

  BarIconButton {
    id: warning
    visible: root.problem !== ""
    anchors.fill: parent
    bar: root.bar
    tooltipText: root.problem
    iconComponent: Component {
      Image {
        source: Qt.resolvedUrl("icons/warning.svg")
        sourceSize.width: width * 2
        sourceSize.height: height * 2
        fillMode: Image.PreserveAspectFit
        smooth: true
      }
    }
  }
}
```

- [ ] **Step 2: Lint**

Run: `/usr/lib/qt6/bin/qmllint Panel.qml 2>&1 | grep -iE "error" ; echo lint-done`
Expected: only `lint-done` (warnings about `qs.*` imports being unresolved are fine; errors are not).

- [ ] **Step 3: Live check with one temporary copy per widget**

Back up `shell.json`, then put one copy of every phase 1 widget at the start of the right section (the built-ins stay, so each color icon sits beside the original), restart the shell and screenshot:

```bash
S=/tmp/claude-1000/-home-blackcode-desktop/e4b4a5c1-17c8-4668-b6e7-8f0ea7793e33/scratchpad
cp ~/.config/omarchy/shell.json $S/shell.json.before-task5
jq '.bar.layout.right = ([ "omarchy.menu","omarchy.network","omarchy.bluetooth","omarchy.audio","omarchy.microphone","omarchy.power","omarchy.monitor","omarchy.system-update","omarchy.agents","omarchy.tailscale" ] | map({id:"blackcode.omacolorbar", icon:.})) + .bar.layout.right' $S/shell.json.before-task5 > ~/.config/omarchy/shell.json
omarchy restart shell >/dev/null 2>&1; sleep 9
grim -o DP-2 $S/task5.png && magick $S/task5.png -crop 1100x40+820+0 +repage -scale 200% $S/task5-bar.png
L=$(ls -t /run/user/1000/quickshell/by-id/*/log.qslog | head -1); strings "$L" | grep -i omacolorbar | grep -iv "scanning\|intercept\|qmldir" | tail
```
Read `$S/task5-bar.png`. Expected: color icons for menu, network (Ethernet here), Bluetooth, audio, microphone, display, agents, Tailscale; power and update may be hidden by Omarchy itself (no battery / no update), which is correct; no warning icons; no `[omacolorbar]` warnings in the log.

- [ ] **Step 4: Check popups and live state**

Click (cursor still for 5 s first, cursor restored after) the color network, audio and Bluetooth icons one at a time; screenshot each popup; click again to close. Then change volume and mute with `wpctl set-volume @DEFAULT_AUDIO_SINK@ 30%`, `wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle` (restore both after), and mic mute with `wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle` (restore after); screenshot the bar after each. Expected: popups are Omarchy's own; the speaker level icon, muted icon and mic-off icon follow each change within a second.

- [ ] **Step 5: Check the menu logo setting**

```bash
jq '(.bar.layout.right[] | select(.id=="blackcode.omacolorbar" and .icon=="omarchy.menu")).menuLogo = "Arch"' ~/.config/omarchy/shell.json > $S/s.json && cp $S/s.json ~/.config/omarchy/shell.json
sleep 3; grim -o DP-2 $S/task5-arch.png
```
Expected: the menu copy switches to the blue Arch logo without a restart.

- [ ] **Step 6: Restore the bar**

```bash
cp $S/shell.json.before-task5 ~/.config/omarchy/shell.json
```

- [ ] **Step 7: Commit**

```bash
git add Panel.qml
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "Panel.qml: host a built-in widget and draw its color icon

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `colorbar swap` / `restore`

**Files:**
- Create: `colorbar` (executable)
- Test: `tests/test_colorbar.py`

**Interfaces:**
- Produces: `swapped(config: dict) → dict`; CLI `colorbar swap [path] [--force]`, `colorbar restore [path]`; backup at `<path>.omacolorbar-backup`.

- [ ] **Step 1: Write the failing tests** — `tests/test_colorbar.py`

```python
import importlib.machinery
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "..", "colorbar")
loader = importlib.machinery.SourceFileLoader("colorbar", SCRIPT)
spec = importlib.util.spec_from_loader("colorbar", loader)
colorbar = importlib.util.module_from_spec(spec)
loader.exec_module(colorbar)

SAMPLE = {
    "bar": {"position": "top", "layout": {
        "left": [{"id": "omarchy.menu"}, {"id": "omarchy.workspaces"}],
        "center": [{"id": "omarchy.clock", "format": "HH:mm"}],
        "right": [{"id": "blackcode.omadbngin", "label": "Icon only"}, {"id": "omarchy.power", "showPercentage": True},
                  {"id": "omarchy.audio"}, {"id": "someone.unknown"}]}},
    "idle": {"x": 1},
    "plugins": [{"id": "omarchy.audio", "step": 5}],
}


class SwappedTest(unittest.TestCase):
    def test_swaps_supported_ids_in_place(self):
        out = colorbar.swapped(SAMPLE)
        self.assertEqual(out["bar"]["layout"]["left"][0], {"id": "blackcode.omacolorbar", "icon": "omarchy.menu"})
        self.assertEqual([e.get("icon", e["id"]) for e in out["bar"]["layout"]["right"]],
                         ["blackcode.omadbngin", "omarchy.power", "omarchy.audio", "someone.unknown"])
        self.assertEqual(out["bar"]["layout"]["right"][1], {"id": "blackcode.omacolorbar", "icon": "omarchy.power"})

    def test_leaves_everything_else_alone(self):
        out = colorbar.swapped(SAMPLE)
        self.assertEqual(out["bar"]["layout"]["left"][1], {"id": "omarchy.workspaces"})
        self.assertEqual(out["bar"]["layout"]["center"], SAMPLE["bar"]["layout"]["center"])
        self.assertEqual(out["bar"]["layout"]["right"][0], {"id": "blackcode.omadbngin", "label": "Icon only"})
        self.assertEqual(out["bar"]["layout"]["right"][3], {"id": "someone.unknown"})
        self.assertEqual(out["idle"], {"x": 1})
        self.assertEqual(out["bar"]["position"], "top")

    def test_settings_move_to_plugins(self):
        plugins = {p["id"]: p for p in colorbar.swapped(SAMPLE)["plugins"]}
        self.assertEqual(plugins["omarchy.power"], {"id": "omarchy.power", "showPercentage": True})
        self.assertEqual(plugins["omarchy.audio"], {"id": "omarchy.audio", "step": 5})
        self.assertEqual(plugins["omarchy.menu"], {"id": "omarchy.menu"})

    def test_does_not_change_its_input_and_is_idempotent(self):
        before = json.dumps(SAMPLE, sort_keys=True)
        once = colorbar.swapped(SAMPLE)
        self.assertEqual(json.dumps(SAMPLE, sort_keys=True), before)
        self.assertEqual(colorbar.swapped(once), once)


class CliTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.path = os.path.join(self.dir.name, "shell.json")
        with open(self.path, "w") as f:
            json.dump(SAMPLE, f, indent=2)
            f.write("\n")
        with open(self.path, "rb") as f:
            self.original = f.read()

    def run_cli(self, *args):
        return subprocess.run([sys.executable, "-I", SCRIPT, *args], capture_output=True, text=True)

    def test_swap_then_restore_is_byte_identical(self):
        self.assertEqual(self.run_cli("swap", self.path).returncode, 0)
        with open(self.path) as f:
            self.assertEqual(json.load(f)["bar"]["layout"]["left"][0]["icon"], "omarchy.menu")
        self.assertTrue(os.path.exists(self.path + ".omacolorbar-backup"))
        self.assertEqual(self.run_cli("restore", self.path).returncode, 0)
        with open(self.path, "rb") as f:
            self.assertEqual(f.read(), self.original)
        self.assertFalse(os.path.exists(self.path + ".omacolorbar-backup"))

    def test_swap_refuses_to_overwrite_a_backup(self):
        self.run_cli("swap", self.path)
        r = self.run_cli("swap", self.path)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("backup", r.stderr)
        self.assertEqual(self.run_cli("swap", self.path, "--force").returncode, 0)

    def test_restore_without_backup_fails(self):
        r = self.run_cli("restore", self.path)
        self.assertNotEqual(r.returncode, 0)
        with open(self.path, "rb") as f:
            self.assertEqual(f.read(), self.original)

    def test_keeps_the_file_mode(self):
        os.chmod(self.path, 0o600)
        self.run_cli("swap", self.path)
        self.assertEqual(os.stat(self.path).st_mode & 0o777, 0o600)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run them to verify they fail**

Run: `python3 -I -m unittest discover -s tests -p "test_*.py"`
Expected: FAIL (`FileNotFoundError ... colorbar`).

- [ ] **Step 3: Write `colorbar`**

```python
#!/usr/bin/env python3
"""colorbar: swap Omarchy's built-in bar widgets for OmaColorBar copies, or put them back.

  colorbar swap [shell.json] [--force]   back up shell.json, then swap every supported
                                         built-in for a color copy in the same place
  colorbar restore [shell.json]          put the backup back

A swapped widget's own settings move to its plugins[] entry, where Omarchy keeps the
settings of a widget that is not in the layout (and saves inline changes)."""
import json
import os
import shutil
import sys
import tempfile

PLUGIN = "blackcode.omacolorbar"
SUPPORTED = ["omarchy.menu", "omarchy.network", "omarchy.bluetooth", "omarchy.audio",
             "omarchy.microphone", "omarchy.power", "omarchy.monitor", "omarchy.system-update",
             "omarchy.agents", "omarchy.tailscale"]
DEFAULT = os.path.expanduser("~/.config/omarchy/shell.json")
SUFFIX = ".omacolorbar-backup"


def swapped(config):
    out = json.loads(json.dumps(config))
    layout = out.get("bar", {}).get("layout", {}) if isinstance(out.get("bar"), dict) else {}
    for section in ("left", "center", "right"):
        entries = layout.get(section)
        if not isinstance(entries, list):
            continue
        for i, entry in enumerate(entries):
            if not isinstance(entry, dict) or entry.get("id") not in SUPPORTED:
                continue
            widget = entry["id"]
            entries[i] = {"id": PLUGIN, "icon": widget}
            plugins = out.setdefault("plugins", [])
            existing = next((p for p in plugins if isinstance(p, dict) and p.get("id") == widget), None)
            extra = {k: v for k, v in entry.items() if k != "id"}
            if existing is None:
                plugins.append({"id": widget, **extra})
            else:
                existing.update(extra)
    return out


def write_atomic(path, text):
    folder = os.path.dirname(os.path.abspath(path))
    mode = os.stat(path).st_mode & 0o777 if os.path.exists(path) else 0o644
    fd, tmp = tempfile.mkstemp(dir=folder, prefix=".colorbar-", suffix=".json")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(text)
        os.chmod(tmp, mode)
        os.replace(tmp, path)
    except BaseException:
        if os.path.lexists(tmp):
            os.unlink(tmp)
        raise


def fail(message):
    print("colorbar: " + message, file=sys.stderr)
    sys.exit(1)


def swap(path, force):
    backup = path + SUFFIX
    if os.path.exists(backup) and not force:
        fail(f"a backup already exists at {backup}; run restore first, or swap --force")
    with open(path) as f:
        config = json.load(f)
    shutil.copy2(path, backup)
    write_atomic(path, json.dumps(swapped(config), indent=2) + "\n")
    print(f"swapped; the original is at {backup}")


def restore(path):
    backup = path + SUFFIX
    if not os.path.exists(backup):
        fail(f"no backup at {backup}")
    os.replace(backup, path)
    print("restored")


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    force = "--force" in argv
    if not args or args[0] not in ("swap", "restore"):
        print(__doc__.strip())
        sys.exit(2)
    path = args[1] if len(args) > 1 else DEFAULT
    if not os.path.exists(path):
        fail(f"no file at {path}")
    if args[0] == "swap":
        swap(path, force)
    else:
        restore(path)


if __name__ == "__main__":
    main(sys.argv[1:])
```

Then: `chmod +x colorbar`

- [ ] **Step 4: Run the tests**

Run: `python3 -I -m unittest discover -s tests -p "test_*.py" && node --test tests/`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add colorbar tests/test_colorbar.py
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "colorbar: swap the bar to color copies and back

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Whole-bar check, shortcuts, power settings

**Files:**
- Modify: `README.md` (created here; finished in Task 8)

- [ ] **Step 1: Ask the user before swapping their real bar**

Ask: "Swap your bar to the color icons now with `colorbar swap`? `colorbar restore` puts it back exactly." Continue only on yes; otherwise run Steps 2–5 on a temporary copy as in Task 5 Step 3 and restore it at the end.

- [ ] **Step 2: Swap and screenshot**

```bash
cd ~/.config/omarchy/plugins/blackcode.omacolorbar && ./colorbar swap
omarchy restart shell >/dev/null 2>&1; sleep 9
S=/tmp/claude-1000/-home-blackcode-desktop/e4b4a5c1-17c8-4668-b6e7-8f0ea7793e33/scratchpad
grim -o DP-2 $S/task7.png && grim -o DP-3 $S/task7-left.png
```
Read both. Expected: every built-in icon in color, in its old place, next to the BlackCode plugin icons; the original built-ins are gone from the bar.

- [ ] **Step 3: Popup keyboard shortcuts**

```bash
omarchy-shell shell toggle omarchy.audio; sleep 1; grim -o DP-2 $S/task7-shortcut.png; omarchy-shell shell toggle omarchy.audio
qs -p /usr/share/omarchy/shell ipc call omarchy.audio toggle; sleep 1; grim -o DP-2 $S/task7-ipc.png; qs -p /usr/share/omarchy/shell ipc call omarchy.audio toggle
```
Record in README → "Known limits" which of the two opened the popup. If neither does, write that popups open by click only and how to reach them.

- [ ] **Step 4: Power settings persist**

If a battery is present: right-click the power copy, confirm the percentage appears, then `jq '.plugins[] | select(.id=="omarchy.power")' ~/.config/omarchy/shell.json` shows `"showPercentage": true`; restart the shell and confirm it is still shown; right-click again to turn it off. Without a battery, note "not testable here" in the task report.

- [ ] **Step 5: Duplicate warning**

Add `{"id":"omarchy.audio"}` to the right section temporarily (backup first), restart, hover the color audio icon: the tooltip ends with "OmaColorBar: omarchy.audio is also on the bar directly". Restore the file.

- [ ] **Step 6: Write `README.md`**

Sections, in this order: title and one-line description; screenshot (`preview.png`); "What it does" (hosts the real widget, popups unchanged, list of phase 1 icons); "Install" (`omarchy plugin add https://github.com/alshareedah22/omacolorbar --enable`, then `~/.config/omarchy/plugins/blackcode.omacolorbar/colorbar swap`); "Settings" (Icon, Menu logo; built-in settings in `plugins[]`); "Undo" (`colorbar restore`, or set the entries back by hand); "When Omarchy changes" (unknown glyph → original glyph; missing widget → warning icon); "Known limits" (results of Steps 3–5); "Tests" (`node --test tests/`, `python3 -I -m unittest discover -s tests -p "test_*.py"`); "Trademarks" (the Arch Linux logo is a trademark of Arch Linux, shown unaltered in its official color; the Omarchy logo is Omarchy's); License MIT.

- [ ] **Step 7: Commit**

```bash
git add README.md
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "README: setup, settings, undo and known limits

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Release 1.0.0

**Files:**
- Create: `icon.svg`, `preview.png`; Modify: `README.md` if the poster changes anything

- [ ] **Step 1: Plugin icon** — `icon.svg`: a 64×64 rounded square (`rx="14"`) in `#1e1e2e` holding a 2×2 grid of four mini icons copied from `icons/` (network Wi-Fi from `Levels.wifi(4)`, `bt-connected`, the speaker `Levels.speaker(3)`, `menu-omarchy`), each scaled to 26×26 (`<g transform="translate(x y) scale(0.40625)">`, inner content without the outer `<svg>`), with gradient ids renamed per tile (`a1`/`b1`, `a2`/`b2`…) so they don't collide. Render at 160 px and at 20 px and check it reads at both sizes.

- [ ] **Step 2: Poster** — `~/Pictures/omarchy-plugin-posters/omacolorbar.html` in the laptop style of `omadbngin.html` (`base.css`, `.laptop`, `.desk`, `.topbar`): the top bar shows the color icons; a `.pop` panel shows Omarchy's audio popup next to the color audio icon; left copy: kicker "OMARCHY PLUGIN / RELEASE 1.0.0", h1 "OMA / COLORBAR", lede "Color icons for Omarchy's own bar widgets.", pills "BAR · QUICKSHELL · NO PATCHES", features line with the phase 1 widget names. Render with `./render.sh omacolorbar.html`, read the PNG, fix overflow, copy to `preview.png`.

- [ ] **Step 3: Full test run**

Run: `node --test tests/ && python3 -I -m unittest discover -s tests -p "test_*.py" && /usr/lib/qt6/bin/qmllint Panel.qml 2>&1 | grep -ci error`
Expected: all tests pass; `0`.

- [ ] **Step 4: Commit**

```bash
git add icon.svg preview.png README.md
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "OmaColorBar 1.0.0: icon and poster

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Ask before publishing**

Ask the user to confirm: create the public GitHub repo `alshareedah22/omacolorbar` and push; then open the marketplace submission with the new-plugin issue form. Only after a yes:

```bash
gh repo create alshareedah22/omacolorbar --public --source . --push --description "Color icons for Omarchy's built-in bar widgets"
```
Then read the marketplace's `SUBMISSION.md` (`gh api repos/omacom/omarchy-plugin-marketplace/contents/SUBMISSION.md -H "Accept: application/vnd.github.raw"`), fill the submission form exactly as it asks, and watch the bot's validation and security baseline on the issue.
