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
