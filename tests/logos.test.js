const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const path = require("path")
const load = require("./load")
const I = load("Icons.js")
const g = hex => String.fromCodePoint(parseInt(hex, 16))

test("every logo has a name and an existing SVG", () => {
  assert.ok(I.LOGOS.length >= 20)
  const names = I.LOGOS.map(l => l.name)
  assert.strictEqual(new Set(names).size, names.length)
  for (const l of I.LOGOS) assert.ok(fs.existsSync(path.join(__dirname, "..", "icons", l.file + ".svg")), l.file)
})

test("the old menuLogo values keep their drawings, unknown ones fall back to Omarchy", () => {
  assert.strictEqual(I.logoFor("Omarchy").file, "menu-omarchy")
  assert.strictEqual(I.logoFor("Arch").file, "menu-arch")
  assert.strictEqual(I.logoFor("Ubuntu").file, "distro-ubuntu")
  assert.strictEqual(I.logoFor("nope").file, "menu-omarchy")
  assert.strictEqual(I.logoFor(undefined).file, "menu-omarchy")
})

test("the menu drawing follows the logo and marks black logos as themed", () => {
  assert.strictEqual(I.drawingFor("omarchy.menu", g("e900"), { menuLogo: "Debian" }).name, "distro-debian")
  assert.strictEqual(I.drawingFor("omarchy.menu", g("e900"), { menuLogo: "Slackware" }).themed, true)
  assert.ok(!I.drawingFor("omarchy.menu", g("e900"), { menuLogo: "Fedora" }).themed)
})

test("svgNames lists every logo", () => {
  const names = I.svgNames()
  for (const l of I.LOGOS) assert.ok(names.includes(l.file), l.file)
})

test("the logo list matches the generator", () => {
  const py = fs.readFileSync(path.join(__dirname, "..", "tools", "make_distro_logos.py"), "utf8")
  const slugs = [...py.matchAll(/\("([a-z]+)", "[^"]+"\)/g)].map(m => "distro-" + m[1])
  const files = I.LOGOS.map(l => l.file).filter(f => f.startsWith("distro-"))
  assert.deepStrictEqual(files, slugs)
})
