const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const path = require("path")

// QML files OmaColorBar owns. Every size must come from Omarchy's Style tokens so the bar
// scales with the theme, and every Image must render at the screen's pixel density.
const FILES = ["Panel.qml", "TrayAdapter.qml", "HiddenStore.qml", "OpenAppsRow.qml", "SettingsCard.qml"]

// Size properties whose value must be a Style token (or a parent/layout expression), not a
// literal. A value counts as a literal when it starts with a number; the bare value 0 is allowed.
const SIZE_NAMES = "width|height|implicitWidth|implicitHeight|pixelSize|spacing|margins|leftMargin|rightMargin|topMargin|bottomMargin|radius|padding|topPadding|bottomPadding|leftPadding|rightPadding|iconSize"
const SIZE_PROP = new RegExp("\\b(" + SIZE_NAMES + ")\\s*:\\s*([^;{}]*)", "g")
const PIXEL_RATIO = /Math\.max\(\s*2\s*,\s*Screen\.devicePixelRatio\s*\)/
const SOURCE_SIZE = /sourceSize\.(width|height)\s*:/

// 1-based line of every size-property match whose value is a numeric literal (other than 0).
// Scans every match on a line; comments are ignored.
function literalSizes(src) {
  const out = []
  src.split("\n").forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "")
    for (const m of code.matchAll(SIZE_PROP)) {
      const value = m[2].trim()
      if (/^-?\d/.test(value) && value.replace(/[\s;,)}\]]+$/, "") !== "0") out.push(i + 1)
    }
  })
  return out
}

// 1-based lines that set sourceSize without the Math.max(2, Screen.devicePixelRatio) factor.
function badSourceSize(src) {
  return src.split("\n").map((l, i) => [i + 1, l])
    .filter(([, l]) => SOURCE_SIZE.test(l) && !PIXEL_RATIO.test(l))
    .map(([n]) => n)
}

const CLEAN = ["width: 0", "width: 0;", "width: Style.space(1)", "width: icon.height", "height: parent.height * 0.5", "x: 16", "// width: 16", "width: 0 /* c */"]
const FLAGGED = ["Item { width: 0; height: 8 }", "width: 16 * 2", "width: 16 + x", "width: 16 /* c */", "height: 8,", "height: 8)", "padding: 4", "iconSize: 12", "radius: 6"]

test("self-check: literalSizes flags literal-first size values on any match", () => {
  for (const s of FLAGGED) assert.deepStrictEqual(literalSizes(s), [1], s)
  for (const s of CLEAN) assert.deepStrictEqual(literalSizes(s), [], s)
  assert.deepStrictEqual(literalSizes("a\nwidth: 16"), [2])
  assert.deepStrictEqual(literalSizes("Item { width: 0; height: 8 }"), [1])
})

test("self-check: badSourceSize requires Math.max(2, Screen.devicePixelRatio)", () => {
  assert.deepStrictEqual(badSourceSize("sourceSize.width: width * Math.max(2, Screen.devicePixelRatio)"), [])
  assert.deepStrictEqual(badSourceSize("sourceSize.width: width*Math.max( 2 ,Screen.devicePixelRatio )"), [])
  assert.deepStrictEqual(badSourceSize("sourceSize.width: width * 2"), [1])
  assert.deepStrictEqual(badSourceSize("sourceSize.height: height * Screen.devicePixelRatio"), [1])
  assert.deepStrictEqual(badSourceSize("sourceSize.height: height * Math.max(3, Screen.devicePixelRatio)"), [1])
})

for (const f of FILES) {
  const src = fs.readFileSync(path.join(__dirname, "..", f), "utf8")
  test(f + ": no hard-coded sizes", () => assert.deepStrictEqual(literalSizes(src), []))
  test(f + ": sourceSize uses Math.max(2, Screen.devicePixelRatio)", () => assert.deepStrictEqual(badSourceSize(src), []))
}
