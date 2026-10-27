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
