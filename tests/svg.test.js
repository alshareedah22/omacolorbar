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
