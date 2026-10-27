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
