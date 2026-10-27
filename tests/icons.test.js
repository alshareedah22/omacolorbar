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

// Qt's V4 engine splits strings into UTF-16 units, so a glyph above U+FFFF reaches
// split() as two surrogates. These literals are explicit surrogate pairs.
test("high-plane glyphs written as surrogate pairs", () => {
  assert.deepStrictEqual(I.split("󰈀"), { key: "f0200", label: "" })
  assert.strictEqual(I.drawingFor("omarchy.network", "󰈀", {}).name, "ethernet")
  assert.deepStrictEqual(I.split("73% 󰁹"), { key: "f0079", label: "73%" })
  const d = I.drawingFor("omarchy.power", "73% 󰁽", {})
  assert.strictEqual(d.kind, "battery")
  assert.strictEqual(d.label, "73%")
})

const usesCodePointApis = src => /\b(Array\.from|codePointAt)\b/.test(src.replace(/\/\/.*$/gm, ""))

test("Icons.js avoids Array.from and codePointAt (Qt V4 iterates UTF-16 units, see split())", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "Icons.js"), "utf8")
  assert.strictEqual(usesCodePointApis(src), false)
  // The check itself catches the old implementation.
  assert.strictEqual(usesCodePointApis('var chars = Array.from(String(text || ""))\nchars[i].codePointAt(0)'), true)
})
