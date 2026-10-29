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
  assert.deepStrictEqual(byKey.menuLogo.options.slice(0, 2), ["Omarchy", "Arch"])
  assert.ok(byKey.menuLogo.options.includes("Debian") && byKey.menuLogo.options.includes("Tux"))
  assert.strictEqual(byKey.iconScale.defaultValue, 100)
  assert.strictEqual(manifest.barWidget.defaults.iconScale, 100)
  assert.strictEqual(manifest.barWidget.defaults.menuLogo, "Omarchy")
})

test("version 1.3.0", () => {
  assert.strictEqual(manifest.version, "1.3.0")
})

test("open-apps settings in the schema with their defaults", () => {
  const schema = Object.fromEntries(manifest.barWidget.schema.map(s => [s.key, s]))
  assert.strictEqual(manifest.barWidget.defaults.openApps, true)
  assert.strictEqual(manifest.barWidget.defaults.openAppsLimit, 6)
  assert.deepStrictEqual(manifest.barWidget.defaults.hiddenApps, [])
  assert.strictEqual(manifest.barWidget.defaults.showTerminals, false)
  assert.strictEqual(schema.openApps.type, "boolean")
  assert.strictEqual(schema.openAppsLimit.type, "integer")
  assert.strictEqual(schema.openAppsLimit.min, 1)
  assert.strictEqual(schema.openAppsLimit.max, 20)
  assert.strictEqual(schema.hiddenApps.type, "multiselect")
  assert.strictEqual(schema.showTerminals.type, "boolean")
})
