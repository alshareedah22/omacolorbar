.pragma library

// Which color drawing stands for each glyph a built-in bar widget can show. All of the
// "which glyph means what" knowledge is here: after an Omarchy update that adds a glyph,
// tests/icons.test.js names it and this is the one file to change.

var PLUGIN_ID = "blackcode.omacolorbar"

var SUPPORTED = ["omarchy.menu", "omarchy.network", "omarchy.bluetooth", "omarchy.audio",
  "omarchy.microphone", "omarchy.power", "omarchy.monitor", "omarchy.system-update",
  "omarchy.agents", "omarchy.tailscale", "omarchy.tray", "omarchy.weather"]

// Logos the menu copy can show (menuLogo). Omarchy and Arch are the 1.0 drawings; the
// distro logos come from tools/make_distro_logos.py, in the same order. `themed` logos are
// black brands, drawn in the bar's text color so they show on a dark bar.
var LOGOS = [
  { name: "Omarchy", file: "menu-omarchy" }, { name: "Arch", file: "menu-arch" },
  { name: "Debian", file: "distro-debian" }, { name: "Ubuntu", file: "distro-ubuntu" },
  { name: "Fedora", file: "distro-fedora" }, { name: "Linux Mint", file: "distro-linuxmint" },
  { name: "openSUSE", file: "distro-opensuse" }, { name: "Manjaro", file: "distro-manjaro" },
  { name: "EndeavourOS", file: "distro-endeavouros" }, { name: "Gentoo", file: "distro-gentoo" },
  { name: "Void", file: "distro-voidlinux" }, { name: "NixOS", file: "distro-nixos" },
  { name: "Alpine", file: "distro-alpinelinux" }, { name: "Pop!_OS", file: "distro-popos" },
  { name: "elementary OS", file: "distro-elementary" }, { name: "Zorin OS", file: "distro-zorin" },
  { name: "Kali", file: "distro-kalilinux" }, { name: "Rocky Linux", file: "distro-rockylinux" },
  { name: "AlmaLinux", file: "distro-almalinux", themed: true }, { name: "Red Hat", file: "distro-redhat" },
  { name: "CentOS", file: "distro-centos" }, { name: "Slackware", file: "distro-slackware", themed: true },
  { name: "CachyOS", file: "distro-cachyos" }, { name: "Garuda", file: "distro-garudalinux" },
  { name: "Artix", file: "distro-artixlinux" }, { name: "Asahi", file: "distro-asahilinux" },
  { name: "Nobara", file: "distro-nobaralinux", themed: true }, { name: "KDE neon", file: "distro-kdeneon" },
  { name: "Kubuntu", file: "distro-kubuntu" }, { name: "Xubuntu", file: "distro-xubuntu" },
  { name: "Lubuntu", file: "distro-lubuntu" }, { name: "Ubuntu MATE", file: "distro-ubuntumate" },
  { name: "deepin", file: "distro-deepin" }, { name: "Solus", file: "distro-solus" },
  { name: "MX Linux", file: "distro-mxlinux", themed: true }, { name: "Qubes OS", file: "distro-qubesos" },
  { name: "Tails", file: "distro-tails" }, { name: "Parrot", file: "distro-parrotsecurity" },
  { name: "Raspberry Pi", file: "distro-raspberrypi" }, { name: "SUSE", file: "distro-suse", themed: true },
  { name: "FreeBSD", file: "distro-freebsd" }, { name: "OpenBSD", file: "distro-openbsd" },
  { name: "NetBSD", file: "distro-netbsd" },
  { name: "Tux", file: "distro-linux" }
]

function logoFor(name) {
  for (var i = 0; i < LOGOS.length; i++) if (LOGOS[i].name === name) return LOGOS[i]
  return LOGOS[0]
}

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
}

// Battery glyphs by fill step (power/Model.js: floor(percentage * 10)).
var BATTERY_DISCHARGING = ["f007a", "f007b", "f007c", "f007d", "f007e", "f007f", "f0080", "f0081", "f0082", "f0079"]
var BATTERY_CHARGING = ["f089c", "f0086", "f0087", "f0088", "f089d", "f0089", "f089e", "f008a", "f008b"]
var BATTERY_FULL = "f0085"

var TAILSCALE_STATES = ["on", "off", "login"]

// Indicator glyph -> drawing (bar/indicators/*.qml activeText / inactiveText). Dictation
// shows f036c while recording and when off, f051f while transcribing. Not used by 1.1.0
// (hosted indicators cannot reach Omarchy's idle, night light and notification services);
// kept for a later indicators plugin.
var INDICATORS = {
  f0176: "ind-stayawake", f009b: "ind-dnd", f050e: "ind-nightlight", f0ec2: "ind-recording",
  f036c: "ind-dictation", f051f: "ind-dictation", f088c: "ind-reminder"
}

// Color when the mode is on, the gray "-off" drawing when it is off.
function indicatorDrawing(text, active) {
  var base = INDICATORS[split(text).key]
  return base ? { kind: "svg", name: active ? base : base + "-off", label: "" } : null
}

function isPrivateUse(cp) { return (cp >= 0xe000 && cp <= 0xf8ff) || cp >= 0xf0000 }

// The glyph is the last private-use code point; anything else ("73% ") is a label.
function split(text) {
  // Not Array.from: QML's JS engine splits a string into UTF-16 units, so a code point
  // above U+FFFF (most Nerd Font glyphs here) would arrive as two surrogates.
  var str = String(text || "")
  var chars = []
  for (var u = 0; u < str.length; u++) {
    var hi = str.charCodeAt(u)
    var lo = u + 1 < str.length ? str.charCodeAt(u + 1) : 0
    if (hi >= 0xd800 && hi <= 0xdbff && lo >= 0xdc00 && lo <= 0xdfff) {
      chars.push(str.charAt(u) + str.charAt(u + 1))
      u++
    } else chars.push(str.charAt(u))
  }
  for (var i = chars.length - 1; i >= 0; i--) {
    var c = chars[i]
    var cp = c.length === 2 ? (c.charCodeAt(0) - 0xd800) * 0x400 + (c.charCodeAt(1) - 0xdc00) + 0x10000 : c.charCodeAt(0)
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
  if (hostId === "omarchy.menu") {
    var logo = logoFor(o.menuLogo)
    return { kind: "svg", name: logo.file, label: "", themed: logo.themed === true }
  }
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
  var names = LOGOS.map(function(l) { return l.file }).concat(["warning"])
  TAILSCALE_STATES.forEach(function(s) { names.push("tailscale-" + s) })
  for (var id in GLYPHS)
    for (var key in GLYPHS[id])
      if (GLYPHS[id][key].kind === "svg" && names.indexOf(GLYPHS[id][key].name) === -1) names.push(GLYPHS[id][key].name)
  for (var g in INDICATORS) {
    if (names.indexOf(INDICATORS[g]) === -1) names.push(INDICATORS[g])
    if (names.indexOf(INDICATORS[g] + "-off") === -1) names.push(INDICATORS[g] + "-off")
  }
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
