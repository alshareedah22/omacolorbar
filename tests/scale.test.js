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
