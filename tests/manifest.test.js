const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const path = require("path")

const root = path.join(__dirname, "..")
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"))

test("manifest declares a service and a bar widget whose files exist", () => {
  assert.strictEqual(manifest.id, "blackcode.omacolorbar")
  assert.deepStrictEqual(manifest.kinds, ["service", "bar-widget"])
  for (const file of Object.values(manifest.entryPoints)) assert.ok(fs.existsSync(path.join(root, file)), file)
  assert.strictEqual(manifest.barWidget.allowMultiple, true)
})

test("settings schema has icon and menuLogo with their defaults", () => {
  const byKey = Object.fromEntries(manifest.barWidget.schema.map(s => [s.key, s]))
  assert.strictEqual(byKey.icon.type, "enum")
  assert.strictEqual(byKey.icon.defaultValue, "omarchy.network")
  assert.deepStrictEqual(byKey.menuLogo.options, ["Omarchy", "Arch"])
  assert.strictEqual(manifest.barWidget.defaults.menuLogo, "Omarchy")
})

test("version 1.1.0", () => {
  assert.strictEqual(manifest.version, "1.1.0")
})
