# OmaColorBar 1.2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The OmaColorBar tray copy also shows every open app (one color icon per app, count badge, click focuses/cycles, `+N` overflow list, right-click hide/unhide), and every OmaColorBar icon renders at the right size and sharpness at any monitor and theme scale.

**Architecture:** Window data comes from Quickshell's `ToplevelManager.toplevels` (Wayland foreign-toplevel). `Apps.appForWindow` maps a window's `appId` to its desktop entry; the pure `OpenApps.js` groups windows into ordered app groups, applies exclusions, splits at the limit and picks the window a click focuses. `OpenAppsRow.qml` draws the row next to the hosted tray inside `Panel.qml`; `HiddenStore.qml` keeps right-click hides in a Quickshell state file. All sizes come from Omarchy `Style` tokens; every `Image` uses `sourceSize = size × max(2, Screen.devicePixelRatio)`.

**Tech Stack:** QML (Quickshell 0.3.x: `Quickshell.Wayland` `ToplevelManager`, `DesktopEntries`, `Quickshell.iconPath`, `Quickshell.statePath`, `Quickshell.Io` `FileView`; Omarchy `qs.Commons` `Style`/`Color`, `qs.Ui` `PopupCard`), JavaScript (`.pragma library`, `node --test`), Python 3 stdlib (`unittest`).

**Spec:** `docs/superpowers/specs/2026-10-27-omacolorbar-1.2-design.md` (builds on the 1.1 and 1.0 specs)

**Scratch folder:** `export SCRATCH=/tmp/claude-1000/-home-blackcode-desktop/e4b4a5c1-17c8-4668-b6e7-8f0ea7793e33/scratchpad`

**Repo:** `~/.config/omarchy/plugins/blackcode.omacolorbar` (live plugin folder), branch `v1.2` (already created, holds the spec). Merge to `main` locally in Task 7; never push without the user's yes.

## Global Constraints

- Never edit `/usr/share/omarchy/` (read it for reference only).
- Never call `bar.shell.updateEntryInline` from OmaColorBar: it rewrites every `blackcode.omacolorbar` entry on the bar.
- `.js` files loaded by Qt (`Icons.js`, `Apps.js`, `OpenApps.js`) must not use `Array.from` or `codePointAt`; they must not use `.import` (tests load them standalone through `tests/load.js`, which strips `.import`).
- Display scale: every width, height, implicit size, spacing, margin and font size in OmaColorBar QML comes from Omarchy `Style` tokens (`Style.bar.iconCanvas`, `Style.bar.statusSlot`, `Style.space(n)`, `Style.bar.iconFont`, `Style.font.*`); the only numeric literal allowed for these is `0`. Every `Image.sourceSize.width/height` is `<displayed size> * Math.max(2, Screen.devicePixelRatio)` (`import QtQuick.Window`).
- The bar never shows a blank slot because of OmaColorBar: no icon → neutral app glyph (`icons/app.svg`), image error → glyph.
- Only installed app icons are used for apps: desktop entry `Icon=` via `Quickshell.iconPath(name, true)`, or an absolute path as `file://` URL.
- Settings on the tray copy's own entry, defaults: `openApps` `true`, `openAppsLimit` `6` (1–20), `hiddenApps` `[]`, `showTerminals` `false`.
- Hidden-apps state file: `Quickshell.statePath("omacolorbar-hidden-apps.json")`, a JSON array of app keys (desktop entry ids).
- Terminal = desktop entry `categories` contains `"TerminalEmulator"`.
- Commits: `git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit`, message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests: `cd ~/.config/omarchy/plugins/blackcode.omacolorbar && node --test tests/ && python3 -I -m unittest discover -s tests -p "test_*.py"`.
- Live work (Tasks 1 and 7, controller only): back up `~/.config/omarchy/shell.json` and restore it unless told to keep; after QML changes `omarchy restart shell` and wait ~10 s (run waits with `run_in_background`); before any click the cursor must be still for 5 s, restore it afterwards (`$SCRATCH/click X Y [right]`; monitors DP-3 x 0–1919, DP-2 x 1920–3839); monitor scale changes are temporary and restored to `1`.
- Push and marketplace steps need the user's explicit yes.

## Rulings made while planning

1. **No `updateEntryInline`; state file instead** (spec "Hide and show"). Cost if wrong: hides live outside `shell.json`, which the README explains.
2. **Window → app matching is exact** (`appForWindow`: startupClass, desktop id, or last desktop-id segment of 4+ chars equal to the app id or its last segment), unlike the fuzzy tray matching: a window always reports its real app id, so fuzzy rules would only add wrong icons. Cost if wrong: some windows are not shown.
3. **Vertical bars:** the row flows top-to-bottom when `bar.vertical` (a `Grid` with one column), so it never breaks a side bar.
4. **Duplicates:** `TrayAdapter` exposes `shownKeys` (desktop ids of the apps it gave an icon); the row skips those. `Apps.matchAppEntry` returns the matched app object so the adapter knows the id.
5. **Order:** each app key gets a sequence number the first time the row sees it during the session; groups sort by it. On start, keys are numbered in `ToplevelManager.toplevels` order.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `Apps.js` | modify | add `matchAppEntry`, `appForWindow`; `matchApp` uses `matchAppEntry` |
| `OpenApps.js` | create | pure: `isTerminal`, `group`, `split`, `nextWindow`, `clampLimit`, `withKey`, `withoutKey`, `parseHidden` |
| `HiddenStore.qml` | create | reads/writes the hidden-apps state file |
| `OpenAppsRow.qml` | create | the open-apps row: icons, badges, tooltips, click/cycle, `+N` popup, right-click popup |
| `TrayAdapter.qml` | modify | records `shownKeys` |
| `Panel.qml` | modify | tray layout = hosted tray + row; DPI-aware `sourceSize` |
| `icons/app.svg` | create (via `tools/make_icons.py`) | neutral app glyph |
| `manifest.json` | modify | four settings, version 1.2.0, description |
| `tests/apps.test.js`, `tests/openapps.test.js`, `tests/scale.test.js`, `tests/manifest.test.js` | modify/create | tests |
| `README.md`, `preview.png` | modify | docs, poster |

---

### Task 1: Live checks before building (controller)

Proves the four platform facts the build relies on. Throwaway; nothing kept in the repo.

**Files (throwaway):** `~/.config/omarchy/plugins/blackcode.spike-open/{manifest.json,Service.qml,Panel.qml}`, `$SCRATCH/spike-open-findings.md`

- [ ] **Step 1: Write the spike plugin**

`manifest.json`:
```json
{
  "schemaVersion": 1,
  "id": "blackcode.spike-open",
  "name": "SpikeOpen",
  "version": "0.0.1",
  "author": "BlackCode",
  "license": "MIT",
  "description": "Throwaway spike: logs open windows, desktop categories, state file, pixel ratio",
  "kinds": ["service", "bar-widget"],
  "entryPoints": { "service": "Service.qml", "barWidget": "Panel.qml" },
  "barWidget": { "displayName": "Spike open", "description": "spike", "category": "Appearance", "allowMultiple": false, "defaultSection": "right", "defaults": {}, "schema": [] }
}
```

`Service.qml`: byte copy of OmaColorBar's `Service.qml`.

`Panel.qml`:
```qml
import QtQuick
import QtQuick.Window
import Quickshell
import Quickshell.Io
import Quickshell.Wayland

Item {
  id: root
  property var bar: null
  property var settings: ({})
  property string moduleName: "blackcode.spike-open"
  implicitWidth: 1
  implicitHeight: 1

  function log() {
    var tops = ToplevelManager.toplevels.values
    console.log("[spike-open] toplevels=" + tops.length + " dpr=" + Screen.devicePixelRatio
      + " statePath=" + Quickshell.statePath("omacolorbar-hidden-apps.json"))
    for (var i = 0; i < tops.length; i++)
      console.log("[spike-open] top appId=" + tops[i].appId + " title=" + tops[i].title + " activated=" + tops[i].activated)
    var apps = DesktopEntries.applications.values
    for (var j = 0; j < apps.length; j++) {
      var c = apps[j].categories
      if (String(c).indexOf("TerminalEmulator") !== -1 || String(apps[j].id).indexOf("chrom") !== -1)
        console.log("[spike-open] app id=" + apps[j].id + " class=" + apps[j].startupClass + " categories=" + JSON.stringify(c))
    }
  }

  FileView {
    id: state
    path: Quickshell.statePath("omacolorbar-hidden-apps.json")
    printErrors: true
    atomicWrites: true
    onLoaded: console.log("[spike-open] state read: " + text())
    onLoadFailed: function(err) {
      console.log("[spike-open] state missing (" + err + "), writing")
      state.setText(JSON.stringify(["spike.test"]))
    }
    onSaved: console.log("[spike-open] state saved")
    onSaveFailed: function(err) { console.log("[spike-open] state save FAILED " + err) }
  }

  Timer {
    interval: 3000
    running: true
    onTriggered: {
      root.log()
      var tops = ToplevelManager.toplevels.values
      console.log("[spike-open] activate is " + (tops.length > 0 ? typeof tops[0].activate : "n/a"))
    }
  }
}
```

- [ ] **Step 2: Put it on the bar, restart, read the log**

```bash
cp ~/.config/omarchy/shell.json "$SCRATCH/shell.json.spike-open-backup"
python3 - <<'EOF'
import json, os
p = os.path.expanduser("~/.config/omarchy/shell.json")
c = json.load(open(p))
c["bar"]["layout"]["right"].append({"id": "blackcode.spike-open"})
json.dump(c, open(p, "w"), indent=2)
EOF
omarchy plugin list | grep spike-open   # `omarchy plugin enable blackcode.spike-open` if needed
omarchy restart shell
```
Wait ~10 s, then read `[spike-open]` lines from `$(ls -dt /run/user/1000/quickshell/by-id/* | head -1)/log.log`. Restart the shell once more and confirm the second run logs `state read: ["spike.test"]`.

- [ ] **Step 3: Record** in `$SCRATCH/spike-open-findings.md` (PASS/FAIL + evidence):
1. `ToplevelManager.toplevels` lists the open windows; record the `appId` of Chrome/Chromium windows, Ghostty, Claude, Nautilus (whatever is open) and whether each matches a desktop entry's `startupClass` or id exactly.
2. `categories` is a list and terminal apps contain `TerminalEmulator`.
3. The state file is written on the first run and read back after a restart; record the real path.
4. `Screen.devicePixelRatio` value (1 at scale 1). Then `hyprctl keyword monitor DP-2,1920x1080@60,1920x0,1.5` (use the monitor's real mode/position from `hyprctl monitors -j`), restart the shell, read the value again (expect 1.5), and restore the monitor's original line (`hyprctl reload` restores the config).
5. The `activate is function` log line confirms `Toplevel.activate()` exists (focusing itself is checked live in Task 7).

- [ ] **Step 4: Clean up**
```bash
cp "$SCRATCH/shell.json.spike-open-backup" ~/.config/omarchy/shell.json
omarchy plugin disable blackcode.spike-open 2>/dev/null
rm -rf ~/.config/omarchy/plugins/blackcode.spike-open
rm -f "<state file path from check 3>"
omarchy restart shell
```

- [ ] **Step 5: Decide** — all of 1–4 PASS → continue. Check 3 FAIL → stop and ask the user (hides would be session-only). Check 1 shows app ids that match no desktop entry for common apps → write the real ids into the SDD ledger; Task 2's tests use them. Check 4 shows `devicePixelRatio` stays 1 at scale 1.5 → ledger note; Task 3 still uses `Math.max(2, …)` (2× is already sharp at 1.5).

---

### Task 2: App matching for windows and duplicate keys (`Apps.js`)

**Files:**
- Modify: `Apps.js`
- Modify: `tests/apps.test.js`

**Interfaces:**
- Produces: `Apps.matchAppEntry(tray, apps) → app object | null` (same rules and scoring as today's `matchApp`); `Apps.matchApp(tray, apps) → string` unchanged behavior (`entry ? String(entry.icon) : ""`); `Apps.appForWindow(appId: string, apps: [{name, icon, wmClass, desktopId, terminal}]) → app object | null`.

- [ ] **Step 1: Failing tests** — append to `tests/apps.test.js`:

```js
const WIN_APPS = [
  { name: "Claude", icon: "claude-desktop", wmClass: "com.anthropic.Claude", desktopId: "com.anthropic.Claude" },
  { name: "Ghostty", icon: "com.mitchellh.ghostty", wmClass: "com.mitchellh.ghostty", desktopId: "com.mitchellh.ghostty", terminal: true },
  { name: "Chromium", icon: "chromium", wmClass: "chromium", desktopId: "chromium" },
  { name: "HEY", icon: "/home/u/.local/share/applications/icons/HEY.png", wmClass: "chrome-app.hey.com__-Default", desktopId: "HEY" },
  { name: "Files", icon: "org.gnome.Nautilus", wmClass: "", desktopId: "org.gnome.Nautilus" },
  { name: "App", icon: "app", wmClass: "", desktopId: "app" }
]

test("matchAppEntry returns the matched app object; matchApp its icon", () => {
  const e = A.matchAppEntry({ id: "Claude_status_icon_1", title: "", tooltipTitle: "" }, APPS)
  assert.strictEqual(e.desktopId, "com.anthropic.Claude")
  assert.strictEqual(A.matchAppEntry({ id: "", title: "", tooltipTitle: "" }, APPS), null)
  assert.strictEqual(A.matchApp({ id: "Claude_status_icon_1", title: "", tooltipTitle: "" }, APPS), "claude-desktop")
})

test("appForWindow matches a window's app id exactly", () => {
  assert.strictEqual(A.appForWindow("com.anthropic.Claude", WIN_APPS).name, "Claude")
  assert.strictEqual(A.appForWindow("com.mitchellh.ghostty", WIN_APPS).name, "Ghostty")
  assert.strictEqual(A.appForWindow("Chromium", WIN_APPS).name, "Chromium")
  assert.strictEqual(A.appForWindow("chrome-app.hey.com__-Default", WIN_APPS).name, "HEY")
  assert.strictEqual(A.appForWindow("org.gnome.Nautilus", WIN_APPS).name, "Files")
  assert.strictEqual(A.appForWindow("nautilus", WIN_APPS).name, "Files")   // last desktop-id segment
})

test("appForWindow never guesses", () => {
  assert.strictEqual(A.appForWindow("", WIN_APPS), null)
  assert.strictEqual(A.appForWindow("chromium-browser-beta", WIN_APPS), null)
  assert.strictEqual(A.appForWindow("my-app", WIN_APPS), null)   // "app" segment shorter than 4
  assert.strictEqual(A.appForWindow("app", WIN_APPS).name, "App")   // exact desktop id still matches
  assert.strictEqual(A.appForWindow("anything", []), null)
})
```

If Task 1 recorded different real app ids, add one assertion per real id (ledger note).

- [ ] **Step 2: Run** `node --test tests/apps.test.js` → FAIL (`matchAppEntry is not a function`).

- [ ] **Step 3: Implement** — in `Apps.js`, rename the body of `matchApp` to `matchAppEntry`, tracking the app instead of its icon, and add `matchApp` and `appForWindow`:

```js
// Each rule scores one app: the length of the key it matched, or 0 for no match.
// The best-scoring app wins within a rule; ties keep list order.
// Rules run in order (window class, desktop id, name) and the first rule with a match wins.
function matchAppEntry(tray, apps) {
  // … existing body of matchApp, unchanged, except the final loop:
  for (var r = 0; r < rules.length; r++) {
    var best = 0, app = null
    for (var i = 0; i < list.length; i++) {
      var s = rules[r](list[i])
      if (s > best) { best = s; app = list[i] }
    }
    if (best > 0) return app
  }
  return null
}

function matchApp(tray, apps) {
  var entry = matchAppEntry(tray, apps)
  return entry ? String(entry.icon) : ""
}

// The installed app a window belongs to. A window reports its real app id
// ("com.anthropic.Claude", "chromium", "org.gnome.Nautilus"), so only exact matches count:
// window class, desktop id, or a last desktop-id segment of 4+ characters.
function appForWindow(appId, apps) {
  var id = normalize(appId)
  if (id === "") return null
  var tail = normalize(lastSegment(appId))
  var list = apps || []
  var rules = [
    function(a) { return normalize(a.wmClass) === id },
    function(a) { return normalize(a.desktopId) === id },
    function(a) {
      var seg = normalize(lastSegment(a.desktopId))
      return seg.length >= 4 && (seg === id || seg === tail)
    }
  ]
  for (var r = 0; r < rules.length; r++)
    for (var i = 0; i < list.length; i++)
      if (list[i] && rules[r](list[i])) return list[i]
  return null
}
```

- [ ] **Step 4: Run** `node --test tests/` → all pass (existing `matchApp` tests unchanged).

- [ ] **Step 5: Commit**
```bash
git add Apps.js tests/apps.test.js
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "Apps.js: matchAppEntry and exact window-to-app matching

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Display scale for the existing icons

**Files:**
- Create: `tests/scale.test.js`
- Modify: `Panel.qml`

**Interfaces:**
- Produces: `tests/scale.test.js` checks every QML file listed in its `FILES` array; Tasks 5 and 6 add `TrayAdapter.qml`, `OpenAppsRow.qml`, `HiddenStore.qml` to `FILES`.

- [ ] **Step 1: Failing test** — `tests/scale.test.js`:

```js
const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const path = require("path")

// QML files OmaColorBar owns. Every size must come from Omarchy's Style tokens so the bar
// scales with the theme, and every Image must render at the screen's pixel density.
const FILES = ["Panel.qml"]
const SIZE_PROPS = /\b(width|height|implicitWidth|implicitHeight|pixelSize|spacing|margins|leftMargin|rightMargin|topMargin|bottomMargin|radius)\s*:\s*(-?\d+(\.\d+)?)\s*($|\/\/|;|})/

for (const f of FILES) {
  const lines = fs.readFileSync(path.join(__dirname, "..", f), "utf8").split("\n")
  test(f + ": no hard-coded sizes", () => {
    const bad = lines.map((l, i) => [i + 1, l]).filter(([, l]) => {
      const m = l.replace(/\/\/.*$/, "").match(SIZE_PROPS)
      return m && Number(m[2]) !== 0
    })
    assert.deepStrictEqual(bad, [])
  })
  test(f + ": sourceSize follows the screen's pixel ratio", () => {
    const bad = lines.map((l, i) => [i + 1, l]).filter(([, l]) => /sourceSize\.(width|height)\s*:/.test(l) && !/devicePixelRatio/.test(l))
    assert.deepStrictEqual(bad, [])
  })
}
```

- [ ] **Step 2: Run** `node --test tests/scale.test.js` → FAIL: the three `sourceSize … * 2` pairs in `Panel.qml`.

- [ ] **Step 3: Fix `Panel.qml`** — add `import QtQuick.Window` after `import QtQuick`, and change each of the six `sourceSize` lines:

```qml
      sourceSize.width: width * Math.max(2, Screen.devicePixelRatio)
      sourceSize.height: height * Math.max(2, Screen.devicePixelRatio)
```
(in `glyphOverlay`, `colorIcon`'s `Image`, and the warning `BarIconButton`'s `Image`).

- [ ] **Step 4: Run all tests** → pass.

- [ ] **Step 5: Commit**
```bash
git add Panel.qml tests/scale.test.js
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "Icons render at the screen's pixel density; scale test

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `OpenApps.js` (pure grouping, limit, cycling, hidden list)

**Files:**
- Create: `OpenApps.js`
- Create: `tests/openapps.test.js`

**Interfaces:**
- Produces (all pure):
  - `isTerminal(categories) → bool` — `categories` an array (or array-like) of strings.
  - `clampLimit(value) → int` — integer 1–20; non-numbers → 6.
  - `group(windows, opts) → [{ key, name, icon, windows: [int] }]` — `windows`: `[{ key, name, icon, terminal, seen, used }]` (`key` "" = no app; `seen` = the key's first-seen sequence; `used` = last activation sequence, 0 = never); `opts`: `{ hidden: [string], trayKeys: [string], showTerminals: bool }`. Groups sorted by `seen` (then key); each group's `windows` = indices into `windows`, in list order.
  - `split(groups, limit) → { shown: [group], overflow: [group] }` (limit through `clampLimit`).
  - `nextWindow(group, windows, activeIndex) → int` — if `activeIndex` is in the group: the next index in `group.windows` (wrapping); otherwise the group's window with the highest `used` (ties: first).
  - `parseHidden(text) → [string]` — JSON array of strings; anything else → `[]`.
  - `withKey(list, key) → [string]`, `withoutKey(list, key) → [string]` — new sorted, de-duplicated arrays.

- [ ] **Step 1: Failing tests** — `tests/openapps.test.js`:

```js
const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const path = require("path")
const load = require("./load")

const O = load("OpenApps.js")
const w = (key, seen, used, extra) => Object.assign({ key, name: key, icon: key + "-icon", terminal: false, seen, used }, extra || {})
const NONE = { hidden: [], trayKeys: [], showTerminals: false }

test("isTerminal and clampLimit", () => {
  assert.strictEqual(O.isTerminal(["System", "TerminalEmulator"]), true)
  assert.strictEqual(O.isTerminal(["Network"]), false)
  assert.strictEqual(O.isTerminal(undefined), false)
  assert.strictEqual(O.clampLimit(4), 4)
  assert.strictEqual(O.clampLimit(0), 1)
  assert.strictEqual(O.clampLimit(99), 20)
  assert.strictEqual(O.clampLimit("x"), 6)
  assert.strictEqual(O.clampLimit(2.7), 2)
})

test("group: one entry per app, first-seen order, window indices kept", () => {
  const wins = [w("chromium", 2, 5), w("files", 1, 0), w("chromium", 2, 9), w("", 0, 0)]
  const groups = O.group(wins, NONE)
  assert.deepStrictEqual(groups.map(g => g.key), ["files", "chromium"])
  assert.deepStrictEqual(groups[1].windows, [0, 2])
  assert.strictEqual(groups[1].icon, "chromium-icon")
})

test("group: terminals, hidden and tray apps are left out", () => {
  const wins = [w("ghostty", 1, 0, { terminal: true }), w("claude", 2, 0), w("spotify", 3, 0), w("files", 4, 0)]
  const opts = { hidden: ["spotify"], trayKeys: ["claude"], showTerminals: false }
  assert.deepStrictEqual(O.group(wins, opts).map(g => g.key), ["files"])
  assert.deepStrictEqual(O.group(wins, Object.assign({}, opts, { showTerminals: true })).map(g => g.key), ["ghostty", "files"])
})

test("split at the limit", () => {
  const groups = ["a", "b", "c", "d"].map((k, i) => ({ key: k, windows: [i] }))
  assert.deepStrictEqual(O.split(groups, 6).overflow, [])
  assert.deepStrictEqual(O.split(groups, 4).shown.map(g => g.key), ["a", "b", "c", "d"])
  const s = O.split(groups, 2)
  assert.deepStrictEqual([s.shown.map(g => g.key), s.overflow.map(g => g.key)], [["a", "b"], ["c", "d"]])
})

test("nextWindow: latest used first, then cycles", () => {
  const wins = [w("c", 1, 5), w("x", 2, 0), w("c", 1, 9), w("c", 1, 0)]
  const g = { key: "c", windows: [0, 2, 3] }
  assert.strictEqual(O.nextWindow(g, wins, 1), 2)    // another app focused: latest used
  assert.strictEqual(O.nextWindow(g, wins, 2), 3)    // focused: next in order
  assert.strictEqual(O.nextWindow(g, wins, 3), 0)    // wraps
  assert.strictEqual(O.nextWindow({ key: "z", windows: [1] }, wins, -1), 1)
})

test("hidden list helpers", () => {
  assert.deepStrictEqual(O.parseHidden('["b","a"]'), ["b", "a"])
  assert.deepStrictEqual(O.parseHidden("nope"), [])
  assert.deepStrictEqual(O.parseHidden('{"a":1}'), [])
  assert.deepStrictEqual(O.parseHidden('["a", 3]'), ["a"])
  assert.deepStrictEqual(O.withKey(["b"], "a"), ["a", "b"])
  assert.deepStrictEqual(O.withKey(["a"], "a"), ["a"])
  assert.deepStrictEqual(O.withoutKey(["a", "b"], "a"), ["b"])
})

test("OpenApps.js avoids Array.from, codePointAt and .import", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "OpenApps.js"), "utf8").replace(/\/\/.*$/gm, "")
  assert.ok(!/\b(Array\.from|codePointAt)\b|^\.import/m.test(src))
})
```

- [ ] **Step 2: Run** `node --test tests/openapps.test.js` → FAIL (file missing).

- [ ] **Step 3: Write `OpenApps.js`**

```js
.pragma library

// Open apps next to the tray, as pure functions: the row hands in its windows (already
// matched to apps) and gets back what to draw. One entry per app, in first-seen order.

function isTerminal(categories) {
  if (!categories) return false
  for (var i = 0; i < categories.length; i++) if (String(categories[i]) === "TerminalEmulator") return true
  return false
}

function clampLimit(value) {
  var n = Math.floor(Number(value))
  if (isNaN(n)) return 6
  return Math.min(20, Math.max(1, n))
}

function group(windows, opts) {
  var o = opts || {}
  var hidden = o.hidden || [], tray = o.trayKeys || []
  var byKey = {}, out = []
  for (var i = 0; i < (windows || []).length; i++) {
    var win = windows[i]
    if (!win || win.key === "" || hidden.indexOf(win.key) !== -1 || tray.indexOf(win.key) !== -1) continue
    if (win.terminal && !o.showTerminals) continue
    var g = byKey[win.key]
    if (!g) {
      g = byKey[win.key] = { key: win.key, name: win.name, icon: win.icon, seen: win.seen, windows: [] }
      out.push(g)
    }
    g.windows.push(i)
  }
  out.sort(function(a, b) { return a.seen - b.seen || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) })
  return out.map(function(g) { return { key: g.key, name: g.name, icon: g.icon, windows: g.windows } })
}

function split(groups, limit) {
  var n = clampLimit(limit)
  return { shown: groups.slice(0, n), overflow: groups.slice(n) }
}

// The window a click on this app focuses: the next one when the app is already focused,
// otherwise the one used most recently.
function nextWindow(group, windows, activeIndex) {
  var list = group.windows
  var at = list.indexOf(activeIndex)
  if (at !== -1) return list[(at + 1) % list.length]
  var best = list[0]
  for (var i = 1; i < list.length; i++) if (windows[list[i]].used > windows[best].used) best = list[i]
  return best
}

function parseHidden(text) {
  var value
  try { value = JSON.parse(String(text)) } catch (e) { return [] }
  if (!(value instanceof Array)) return []
  return value.filter(function(k) { return typeof k === "string" && k !== "" })
}

function unique(list) {
  var out = []
  for (var i = 0; i < list.length; i++) if (out.indexOf(list[i]) === -1) out.push(list[i])
  return out.sort()
}

function withKey(list, key) { return unique((list || []).concat([key])) }

function withoutKey(list, key) { return unique((list || []).filter(function(k) { return k !== key })) }
```

- [ ] **Step 4: Run all tests** → pass.

- [ ] **Step 5: Commit**
```bash
git add OpenApps.js tests/openapps.test.js
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "OpenApps.js: group open windows by app, limit, cycling, hidden list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Hidden store, app glyph and tray keys

**Files:**
- Create: `HiddenStore.qml`
- Modify: `tools/make_icons.py` (add `app`), generate `icons/app.svg`
- Modify: `TrayAdapter.qml` (`shownKeys`, uses `Apps.matchAppEntry`)
- Modify: `tests/scale.test.js` (`FILES` += `"TrayAdapter.qml", "HiddenStore.qml"`)
- Modify: `tests/svg.test.js` only if it lists icons explicitly (it scans the folder; check)

**Interfaces:**
- Consumes: `OpenApps.parseHidden`, `withKey`, `withoutKey` (Task 4); `Apps.matchAppEntry` (Task 2).
- Produces: `HiddenStore { readonly property var keys; function hide(key); function show(key) }`; `TrayAdapter.shownKeys: [string]` (desktop ids of apps it gave an icon to; recomputed each scan from live adapted icons); `icons/app.svg`.

- [ ] **Step 1: `icons/app.svg`** — in `tools/make_icons.py` add to `ICONS` (after `"warning"`), a neutral rounded-square app glyph in the same style:

```python
    "app": lambda: icon("app", '<rect x="8" y="8" width="48" height="48" rx="12" fill="url(#a)"/>'
                               '<rect x="20" y="20" width="10" height="10" rx="2" fill="#ffffff" opacity=".9"/>'
                               '<rect x="34" y="20" width="10" height="10" rx="2" fill="#ffffff" opacity=".9"/>'
                               '<rect x="20" y="34" width="10" height="10" rx="2" fill="#ffffff" opacity=".9"/>'
                               '<rect x="34" y="34" width="10" height="10" rx="2" fill="#ffffff" opacity=".9"/>'),
```
and `"app": ("#64748b", "#94a3b8", "#334155")` to `PALETTE` (check `icon()`'s signature and `PALETTE` shape in the file first and follow them exactly). Run `python3 tools/make_icons.py`; the count goes up by one. Run `node --test tests/svg.test.js` → pass.

- [ ] **Step 2: `HiddenStore.qml`**

```qml
import QtQuick
import Quickshell
import Quickshell.Io
import "OpenApps.js" as OpenApps

// Apps hidden from the open-apps row with a right-click, kept in OmaColorBar's own state
// file so they survive restarts. Never written to shell.json: the shell's inline save
// rewrites every OmaColorBar entry at once.
Item {
  id: store

  property var keys: []
  property bool warned: false

  function hide(key) { save(OpenApps.withKey(keys, key)) }
  function show(key) { save(OpenApps.withoutKey(keys, key)) }

  function save(next) {
    keys = next
    file.setText(JSON.stringify(next))
  }

  FileView {
    id: file
    path: Quickshell.statePath("omacolorbar-hidden-apps.json")
    printErrors: false
    atomicWrites: true
    onLoaded: {
      var text = file.text()
      store.keys = OpenApps.parseHidden(text)
      if (text.trim() !== "" && store.keys.length === 0 && text.trim() !== "[]" && !store.warned) {
        store.warned = true
        console.warn("[omacolorbar] " + file.path + " is not a JSON list of app ids; ignoring it")
      }
    }
    onLoadFailed: store.keys = []
    onSaveFailed: function(error) { console.warn("[omacolorbar] could not save hidden apps: " + error) }
  }
}
```

- [ ] **Step 3: `TrayAdapter.qml`** — add `property var shownKeys: []`; in `adapt()`, replace the `Apps.matchApp(...)` call with:

```qml
    var entry = Apps.matchAppEntry({ id: data.id, title: data.title, tooltipTitle: data.tooltipTitle }, apps)
    var source = sourceFor(entry ? String(entry.icon) : "")
```
store the key on the tray icon's adapter bookkeeping: keep a parallel array `adaptedKeys` (same index as `adapted`; `""` for icons restored after an error), and at the end of `scan()`:

```qml
    var keys = []
    for (var k = 0; k < adapted.length; k++)
      if (adapted[k] && adaptedKeys[k] !== "" && keys.indexOf(adaptedKeys[k]) === -1) keys.push(adaptedKeys[k])
    if (JSON.stringify(keys) !== JSON.stringify(shownKeys)) shownKeys = keys
```
Keep `adapted` and `adaptedKeys` filtered together (drop entries whose item is gone). On restore after an image error, set that icon's key to `""`. `onHostChanged` resets both arrays and `shownKeys`.

- [ ] **Step 4:** add `"TrayAdapter.qml", "HiddenStore.qml"` to `FILES` in `tests/scale.test.js`. Run all tests → pass (fix any literal sizes the scan finds in `TrayAdapter.qml` by using `Style` tokens; `TrayAdapter.qml` should have none).

- [ ] **Step 5: Commit**
```bash
git add HiddenStore.qml TrayAdapter.qml tools/make_icons.py icons/app.svg tests/scale.test.js
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "Hidden-apps store, app glyph, tray reports the apps it shows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The open-apps row in the tray copy

**Files:**
- Create: `OpenAppsRow.qml`
- Modify: `Panel.qml`
- Modify: `manifest.json` (schema + defaults for the four settings)
- Modify: `tests/manifest.test.js`, `tests/scale.test.js` (`FILES` += `"OpenAppsRow.qml"`)

**Interfaces:**
- Consumes: `Apps.appForWindow`, `OpenApps.*`, `HiddenStore`, `TrayAdapter.shownKeys`, `Panel.setting(name, fallback)`.
- Produces: `OpenAppsRow { bar; enabled; limit; showTerminals; manualHidden: [string]; trayKeys: [string] }`.

- [ ] **Step 1: Failing manifest test** — add to `tests/manifest.test.js`:

```js
test("open-apps settings in the schema with their defaults", () => {
  const schema = Object.fromEntries(manifest.barWidget.schema.map(s => [s.key, s]))
  assert.strictEqual(manifest.barWidget.defaults.openApps, true)
  assert.strictEqual(manifest.barWidget.defaults.openAppsLimit, 6)
  assert.deepStrictEqual(manifest.barWidget.defaults.hiddenApps, [])
  assert.strictEqual(manifest.barWidget.defaults.showTerminals, false)
  assert.strictEqual(schema.openApps.type, "bool")
  assert.strictEqual(schema.openAppsLimit.type, "int")
  assert.strictEqual(schema.openAppsLimit.min, 1)
  assert.strictEqual(schema.openAppsLimit.max, 20)
  assert.strictEqual(schema.hiddenApps.type, "list")
  assert.strictEqual(schema.showTerminals.type, "bool")
})
```
Before writing it, check the schema type names Omarchy uses (`grep -h '"type"' /usr/share/omarchy/shell/plugins/*/manifest.json /usr/share/omarchy/shell/plugins/*/*.manifest.json | sort | uniq -c`) and use those exact names (e.g. `bool` vs `boolean`, `int` vs `number`, `list` vs `stringList`) in both the test and the manifest; record the names in the report. Run `node --test tests/manifest.test.js` → FAIL.

- [ ] **Step 2: Manifest** — add to `barWidget.defaults`: `"openApps": true, "openAppsLimit": 6, "hiddenApps": [], "showTerminals": false`; add four schema entries (labels: "Open apps", "Open apps limit", "Hidden apps", "Show terminals"; descriptions say they apply to the copy set to `omarchy.tray`, and that right-click hides are stored separately). Run tests → pass.

- [ ] **Step 3: `OpenAppsRow.qml`**

```qml
import QtQuick
import QtQuick.Window
import Quickshell
import Quickshell.Wayland
import qs.Commons
import qs.Ui
import "Apps.js" as Apps
import "OpenApps.js" as OpenApps

// Open apps next to the hosted tray: one color icon per app, a count at 2+ windows,
// click focuses (and cycles), extra apps behind +N, right-click hides. Sizes come from
// Omarchy's Style tokens so the row scales with the theme and the monitor.
Item {
  id: row

  property var bar: null
  property bool enabled: true
  property int limit: 6
  property bool showTerminals: false
  property var manualHidden: []
  property var trayKeys: []

  readonly property bool vertical: bar ? bar.vertical === true : false
  readonly property int slot: Style.bar.statusSlot
  readonly property int iconSize: Style.bar.iconCanvas
  readonly property color foreground: bar ? bar.foreground : Color.foreground
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family

  property var apps: []           // [{name, icon, wmClass, desktopId, terminal}]
  property var windows: []        // [{key, name, icon, terminal, seen, used}], same order as tops
  property var tops: []           // the Toplevel objects behind `windows`
  property var seenSeq: ({})      // app key -> first-seen sequence
  property int seenCounter: 0
  property var usedTops: []       // Toplevel objects ...
  property var usedSeq: []        // ... and their last activation sequence
  property int usedCounter: 0
  property var groups: []
  property var shown: []
  property var overflow: []
  property var menuGroup: null    // app the right-click card is for (null = the +N card)
  property bool menuOpen: false
  property bool moreOpen: false

  readonly property var hiddenAll: OpenApps.withoutKey(store.keys.concat(manualHidden || []), "")

  implicitWidth: !enabled ? 0 : vertical ? slot : grid.implicitWidth
  implicitHeight: !enabled ? 0 : vertical ? grid.implicitHeight : slot
  visible: enabled && (shown.length > 0 || overflow.length > 0)

  function sourceFor(name) {
    if (!name) return ""
    if (String(name).charAt(0) === "/") return "file://" + name
    return Quickshell.iconPath(String(name), true)
  }

  function readApps() {
    var values = DesktopEntries.applications.values, out = []
    for (var i = 0; i < values.length; i++) {
      var e = values[i]
      out.push({ name: e.name, icon: e.icon, wmClass: e.startupClass, desktopId: e.id, terminal: OpenApps.isTerminal(e.categories) })
    }
    apps = out
    refresh()
  }

  function usedOf(top) {
    var at = usedTops.indexOf(top)
    return at === -1 ? 0 : usedSeq[at]
  }

  function markUsed(top) {
    if (!top) return
    var t = usedTops.filter(function(x) { return x }), s = []
    for (var i = 0; i < usedTops.length; i++) if (usedTops[i]) s.push(usedSeq[i])
    var at = t.indexOf(top)
    usedCounter++
    if (at === -1) { t.push(top); s.push(usedCounter) } else s[at] = usedCounter
    usedTops = t
    usedSeq = s
    refresh()
  }

  function refresh() {
    var list = ToplevelManager.toplevels ? ToplevelManager.toplevels.values : []
    var wins = [], objs = [], seen = seenSeq, counter = seenCounter
    for (var i = 0; i < list.length; i++) {
      var app = Apps.appForWindow(list[i].appId, apps)
      var key = app ? String(app.desktopId) : ""
      if (key !== "" && seen[key] === undefined) seen[key] = ++counter
      wins.push({ key: key, name: app ? String(app.name) : "", icon: app ? String(app.icon || "") : "",
                  terminal: app ? app.terminal === true : false, seen: key !== "" ? seen[key] : 0, used: usedOf(list[i]) })
      objs.push(list[i])
    }
    seenSeq = seen
    seenCounter = counter
    tops = objs
    windows = wins
    groups = OpenApps.group(wins, { hidden: hiddenAll, trayKeys: trayKeys, showTerminals: showTerminals })
    var parts = OpenApps.split(groups, limit)
    shown = parts.shown
    overflow = parts.overflow
  }

  function focusApp(group) {
    var idx = OpenApps.nextWindow(group, windows, tops.indexOf(ToplevelManager.activeToplevel))
    if (tops[idx]) tops[idx].activate()
  }

  function nameOf(group) {
    return group.name + (group.windows.length > 1 ? " (" + group.windows.length + " windows)" : "")
  }

  onHiddenAllChanged: refresh()
  onTrayKeysChanged: refresh()
  onLimitChanged: refresh()
  onShowTerminalsChanged: refresh()
  Component.onCompleted: readApps()

  HiddenStore { id: store }

  Connections {
    target: DesktopEntries.applications
    function onValuesChanged() { row.readApps() }
  }
  Connections {
    target: ToplevelManager.toplevels
    function onValuesChanged() { row.refresh() }
  }
  Connections {
    target: ToplevelManager
    function onActiveToplevelChanged() { row.markUsed(ToplevelManager.activeToplevel) }
  }

  // One app: its icon (or the neutral glyph), and a count at 2+ windows.
  component AppIcon: Item {
    id: appIcon
    required property var group
    width: row.slot
    height: row.slot

    Image {
      id: image
      anchors.centerIn: parent
      width: row.iconSize
      height: row.iconSize
      source: status === Image.Error || row.sourceFor(appIcon.group.icon) === "" ? Qt.resolvedUrl("icons/app.svg") : row.sourceFor(appIcon.group.icon)
      sourceSize.width: width * Math.max(2, Screen.devicePixelRatio)
      sourceSize.height: height * Math.max(2, Screen.devicePixelRatio)
      fillMode: Image.PreserveAspectFit
      smooth: true
    }

    Rectangle {
      visible: appIcon.group.windows.length > 1
      anchors.right: parent.right
      anchors.bottom: parent.bottom
      width: Math.max(height, count.implicitWidth + Style.space(4))
      height: Style.space(10)
      radius: height / 2
      color: Color.popups ? Color.popups.border : row.foreground
      Text {
        id: count
        anchors.centerIn: parent
        text: String(appIcon.group.windows.length)
        color: Color.background
        font.family: row.fontFamily
        font.pixelSize: Style.font.caption
        font.bold: true
      }
    }

    MouseArea {
      anchors.fill: parent
      acceptedButtons: Qt.LeftButton | Qt.RightButton
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onEntered: if (row.bar) row.bar.showTooltip(appIcon, row.nameOf(appIcon.group))
      onExited: if (row.bar) row.bar.hideTooltip(appIcon)
      onClicked: function(mouse) {
        if (mouse.button === Qt.RightButton) {
          row.menuGroup = appIcon.group
          menuCard.anchorTarget = appIcon
          row.menuOpen = true
        } else {
          row.focusApp(appIcon.group)
        }
      }
    }
  }

  Grid {
    id: grid
    columns: row.vertical ? 1 : row.shown.length + (row.overflow.length > 0 ? 1 : 0)
    spacing: 0

    Repeater {
      model: row.shown
      delegate: AppIcon { required property var modelData; group: modelData }
    }

    // +N: the apps over the limit.
    Item {
      id: more
      visible: row.overflow.length > 0
      width: visible ? row.slot : 0
      height: visible ? row.slot : 0
      Text {
        anchors.centerIn: parent
        text: "+" + row.overflow.length
        color: row.foreground
        font.family: row.fontFamily
        font.pixelSize: Style.bar.iconFont
        font.bold: true
      }
      MouseArea {
        anchors.fill: parent
        acceptedButtons: Qt.LeftButton | Qt.RightButton
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onEntered: if (row.bar) row.bar.showTooltip(more, row.overflow.length + " more open apps")
        onExited: if (row.bar) row.bar.hideTooltip(more)
        onClicked: function(mouse) {
          if (mouse.button === Qt.RightButton) {
            row.menuGroup = null
            menuCard.anchorTarget = more
            row.menuOpen = true
          } else {
            row.moreOpen = !row.moreOpen
          }
        }
      }
    }
  }

  // The +N list: click an app to focus it.
  PopupCard {
    id: moreCard
    anchorItem: more
    owner: row
    bar: row.bar
    open: row.moreOpen
    onOpenChanged: if (!open) row.moreOpen = false
    contentWidth: moreCard.fittedContentWidth(Style.space(220))
    contentHeight: moreCard.fittedContentHeight(moreColumn.implicitHeight)

    Column {
      id: moreColumn
      anchors.fill: parent
      spacing: Style.space(4)
      Repeater {
        model: row.overflow
        delegate: Item {
          required property var modelData
          width: moreColumn.width
          height: row.slot + Style.space(4)
          Row {
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.space(8)
            Image {
              width: row.iconSize
              height: row.iconSize
              source: status === Image.Error || row.sourceFor(modelData.icon) === "" ? Qt.resolvedUrl("icons/app.svg") : row.sourceFor(modelData.icon)
              sourceSize.width: width * Math.max(2, Screen.devicePixelRatio)
              sourceSize.height: height * Math.max(2, Screen.devicePixelRatio)
              fillMode: Image.PreserveAspectFit
            }
            Text {
              text: row.nameOf(modelData)
              color: row.foreground
              font.family: row.fontFamily
              font.pixelSize: Style.font.body
            }
          }
          MouseArea {
            anchors.fill: parent
            cursorShape: Qt.PointingHandCursor
            onClicked: { row.moreOpen = false; row.focusApp(modelData) }
          }
        }
      }
    }
  }

  // Right-click: hide this app, and the hidden list to bring apps back.
  PopupCard {
    id: menuCard
    property Item anchorTarget: more
    anchorItem: anchorTarget
    owner: row
    bar: row.bar
    open: row.menuOpen
    onOpenChanged: if (!open) row.menuOpen = false
    contentWidth: menuCard.fittedContentWidth(Style.space(240))
    contentHeight: menuCard.fittedContentHeight(menuColumn.implicitHeight)

    Column {
      id: menuColumn
      anchors.fill: parent
      spacing: Style.space(6)

      Text {
        visible: row.menuGroup !== null
        text: row.menuGroup ? "Hide " + row.menuGroup.name + " from bar" : ""
        color: row.foreground
        font.family: row.fontFamily
        font.pixelSize: Style.font.body
        MouseArea {
          anchors.fill: parent
          cursorShape: Qt.PointingHandCursor
          onClicked: { var key = row.menuGroup.key; row.menuOpen = false; store.hide(key) }
        }
      }

      Text {
        text: "Hidden apps (" + row.hiddenAll.length + ")"
        color: Qt.darker(row.foreground, 1.4)
        font.family: row.fontFamily
        font.pixelSize: Style.font.caption
        font.bold: true
      }

      Text {
        visible: row.hiddenAll.length === 0
        text: "None"
        color: Qt.darker(row.foreground, 1.5)
        font.family: row.fontFamily
        font.pixelSize: Style.font.bodySmall
        font.italic: true
      }

      Repeater {
        model: row.hiddenAll
        delegate: Text {
          required property var modelData
          readonly property bool manual: (row.manualHidden || []).indexOf(modelData) !== -1
          readonly property var app: row.apps.filter(function(a) { return String(a.desktopId) === modelData })[0]
          text: (app ? app.name : modelData) + (manual ? "  (set in shell.json)" : "  (click to show)")
          color: manual ? Qt.darker(row.foreground, 1.5) : row.foreground
          font.family: row.fontFamily
          font.pixelSize: Style.font.bodySmall
          MouseArea {
            anchors.fill: parent
            enabled: !parent.manual
            cursorShape: Qt.PointingHandCursor
            onClicked: store.show(parent.modelData)
          }
        }
      }
    }
  }
}
```

Notes for the implementer (verify against Omarchy's source, read-only, before relying on them; adjust and record in the report):
- `Color.background`, `Color.foreground`, `Color.popups.border` and the `Style.font.*` token names: check `/usr/share/omarchy/shell/Commons/Color.qml` and `Style.qml`; use the real names.
- `PopupCard` requires `anchorItem` and `bar`; check how `Tray.qml` closes its popup on outside click (`owner` + `close()`), and make sure closing sets `menuOpen`/`moreOpen` back to false (the `onOpenChanged` lines above). If `PopupCard` expects `owner.close()`, add `function close() { menuOpen = false; moreOpen = false }` to the row.
- `bar.showTooltip`/`hideTooltip` exist on the plugin bar API (`Ui/PluginBarApi.qml`).
- `ToplevelManager.toplevels.values` and `Toplevel.activate()` per Task 1's findings.
- QML property `enabled` on `Item` already exists (it disables input); the row uses it with the same meaning (off = no row), which is fine.

- [ ] **Step 4: Host the row in `Panel.qml`** — give the tray copy the row next to the hosted widget. Replace the `slot` Item with:

```qml
  readonly property bool openAppsOn: adapter === "tray" && setting("openApps", true) === true
  readonly property real hostedWidth: loader.item && loader.item.visible ? loader.item.implicitWidth : 0
  readonly property real hostedHeight: loader.item && loader.item.visible ? loader.item.implicitHeight : 0
  readonly property real rowGap: openRow.visible && (hostedWidth > 0 || hostedHeight > 0) ? Style.space(4) : 0
  readonly property bool verticalBar: bar ? bar.vertical === true : false

  Item {
    id: slot
    visible: root.problem === ""
    implicitWidth: root.verticalBar ? Math.max(root.hostedWidth, openRow.visible ? openRow.implicitWidth : 0)
      : root.hostedWidth + root.rowGap + (openRow.visible ? openRow.implicitWidth : 0)
    implicitHeight: root.verticalBar ? root.hostedHeight + root.rowGap + (openRow.visible ? openRow.implicitHeight : 0)
      : Math.max(root.hostedHeight, openRow.visible ? openRow.implicitHeight : 0)
    width: implicitWidth
    height: implicitHeight

    Loader {
      id: loader
      width: root.hostedWidth
      height: root.verticalBar ? root.hostedHeight : parent.height
      active: root.problem === ""
      sourceComponent: root.hostComponent
      onLoaded: { /* unchanged body */ }
    }

    OpenAppsRow {
      id: openRow
      x: root.verticalBar ? 0 : root.hostedWidth + root.rowGap
      y: root.verticalBar ? root.hostedHeight + root.rowGap : 0
      height: root.verticalBar ? implicitHeight : parent.height
      bar: root.bar
      enabled: root.openAppsOn
      limit: OpenApps.clampLimit(root.setting("openAppsLimit", 6))
      showTerminals: root.setting("showTerminals", false) === true
      manualHidden: root.setting("hiddenApps", [])
      trayKeys: trayAdapter.shownKeys
    }
  }
```
Keep the Loader's existing `onLoaded` body exactly. Add `import "OpenApps.js" as OpenApps` to `Panel.qml`, and give the existing `TrayAdapter` instance `id: trayAdapter`. Every non-tray copy is unchanged: `openRow.enabled` is false so it has zero size and is invisible.

- [ ] **Step 5:** add `"OpenAppsRow.qml"` to `FILES` in `tests/scale.test.js`. Run all tests → pass; any literal size the scan reports is replaced by a `Style` token (the code above uses none).

- [ ] **Step 6: Commit**
```bash
git add OpenAppsRow.qml Panel.qml manifest.json tests/manifest.test.js tests/scale.test.js
git -c user.name=BlackCode -c user.email=aalsheraidah@gmail.com commit -m "Open apps next to the tray: color icons, counts, +N list, right-click hide

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Release files, live check at every scale, poster, merge (controller runs the live parts)

**Files:**
- Modify: `manifest.json` (version, description), `tests/manifest.test.js`, `README.md` — by a subagent (Step 1)
- Modify: `preview.png`, `~/Pictures/omarchy-plugin-posters/omacolorbar.html` — controller

- [ ] **Step 1 (subagent): release files**
  - Test: change the version test to `"1.2.0"`; run → FAIL; set `"version": "1.2.0"`; description: `"OmaColorBar: color icons for Omarchy's built-in bar widgets, tray apps, open apps and weather. Each copy hosts the real widget, so its popup and clicks stay Omarchy's own; settings are read from plugins[]"`; run → pass.
  - README: new section "Open apps" (what shows, what is left out and why: terminals, tray apps, windows with no app; click/cycle; count; `+N`; right-click hide and the Hidden apps list; where hides are stored: the state file path, and that `hiddenApps` in `shell.json` adds manual hides that can only be removed there); Settings table gets the four keys with defaults; a "Menu logo" line: `"menuLogo": "Arch"` or `"Omarchy"` on the copy set to `omarchy.menu`; "Display scale" line: every icon follows the theme's sizes and the monitor scale; "Updating from 1.1.0": no swap needed, the tray copy shows open apps after `omarchy restart shell`; to turn it off set `"openApps": false` on the tray copy. No em dashes.
  - Commit: `"OmaColorBar 1.2.0: README and manifest"` with the trailer.

- [ ] **Step 2 (controller): live checks at scale 1** — `cp ~/.config/omarchy/shell.json "$SCRATCH/shell.json.pre-1.2"`; `omarchy restart shell`; wait. Screenshot and read after each; record PASS/FAIL in the ledger:
  1. Open apps appear right after the tray with color icons; Ghostty (terminal) absent; Claude only once (tray).
  2. Open a second Chromium window → one icon with badge `2`; click focuses the latest window; click again cycles.
  3. Set `"openAppsLimit": 2` on the tray copy entry (back up first) → `+N` shows the rest; click opens the list; clicking an app focuses it; restore the setting.
  4. Right-click an app → "Hide … from bar" → it disappears; the state file holds its key; `omarchy restart shell` → still hidden; right-click `+N` or another icon → Hidden apps → click it → back.
  5. `"openApps": false` → the tray copy is exactly 1.1.0; restore.
  6. Every other OmaColorBar icon still shows (menu, network, bluetooth, audio, monitor, power, agents, tailscale, weather); no `[omacolorbar]` warnings or QML errors in the log.

- [ ] **Step 3 (controller): every scale** — for monitor scale 1.5 and 2 on DP-2 (`hyprctl keyword monitor DP-2,<mode>,<pos>,1.5`, then `,2`; `<mode>`/`<pos>` from `hyprctl monitors -j`): `omarchy restart shell`, wait, screenshot the full DP-2 bar and read it at full resolution. Check every OmaColorBar icon, the weather icon, the tray app icon, open-app icons, the count badge, `+N`, the `+N` popup and the right-click card: sharp (no blur or jaggies), sized like Omarchy's own icons next to them, nothing clipped or overlapping. Then restore with `hyprctl reload` and confirm scale 1. Any failure → fix on `v1.2` (test first where possible), commit, re-check.

- [ ] **Step 4 (controller): poster** — `omacolorbar.html`: kicker "RELEASE 1.2.0"; the top bar shows the tray (Claude) followed by 3–4 open-app icons (real installed icons copied into `~/Pictures/omarchy-plugin-posters/icons/`), one with a count badge, and a `+2`; features line "New in 1.2: Open apps · Hide/show · Any scale". `./render.sh omacolorbar.html`, read, fix overflow, copy to `preview.png`, commit `"Poster for 1.2.0"` with the trailer.

- [ ] **Step 5 (controller): merge locally** — restore `shell.json` from `$SCRATCH/shell.json.pre-1.2` if any test setting is left, `git switch main && git merge --ff-only v1.2`, report, and ask before `git push` and the marketplace step.
