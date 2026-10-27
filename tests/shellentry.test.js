const test = require("node:test")
const assert = require("node:assert")
const load = require("./load")
const S = load("ShellEntry.js")

function cfg() {
  return {
    version: 1,
    bar: {
      position: "top",
      layout: {
        left: [{ id: "blackcode.omacolorbar", icon: "omarchy.menu" }, { id: "omarchy.workspaces" }],
        center: [{ id: "omarchy.clock" }],
        right: [
          { id: "blackcode.omacolorbar", icon: "omarchy.tray", openAppsLimit: 4 },
          { id: "blackcode.omacolorbar" },
          { id: "omarchy.tray" }
        ]
      }
    },
    plugins: [{ id: "omarchy.tray", hidden: ["x"] }]
  }
}

test("findEntry finds the copy by icon in any section", () => {
  assert.deepStrictEqual(S.findEntry(cfg(), "omarchy.menu"), { section: "left", index: 0 })
  assert.deepStrictEqual(S.findEntry(cfg(), "omarchy.tray"), { section: "right", index: 0 })
})

test("an entry without icon is the default network copy", () => {
  assert.deepStrictEqual(S.findEntry(cfg(), "omarchy.network"), { section: "right", index: 1 })
})

test("findEntry reports none and many", () => {
  assert.deepStrictEqual(S.findEntry(cfg(), "omarchy.audio"), { error: "none" })
  const c = cfg()
  c.bar.layout.center.push({ id: "blackcode.omacolorbar", icon: "omarchy.menu" })
  assert.deepStrictEqual(S.findEntry(c, "omarchy.menu"), { error: "many" })
})

test("findEntry on a config without a layout is invalid", () => {
  assert.deepStrictEqual(S.findEntry(null, "omarchy.menu"), { error: "invalid" })
  assert.deepStrictEqual(S.findEntry({ bar: {} }, "omarchy.menu"), { error: "invalid" })
})

test("usedIcons lists every OmaColorBar copy's icon", () => {
  assert.deepStrictEqual(S.usedIcons(cfg()), ["omarchy.menu", "omarchy.tray", "omarchy.network"])
  assert.deepStrictEqual(S.usedIcons({}), [])
})

test("withEntryKeys changes only that entry and leaves the input alone", () => {
  const before = cfg()
  const out = S.withEntryKeys(before, "right", 0, { openAppsLimit: 8, showTerminals: true })
  assert.deepStrictEqual(before, cfg())
  const expected = cfg()
  expected.bar.layout.right[0] = { id: "blackcode.omacolorbar", icon: "omarchy.tray", openAppsLimit: 8, showTerminals: true }
  assert.deepStrictEqual(out, expected)
})

test("withEntryKeys removes keys set to null and keeps key order", () => {
  const out = S.withEntryKeys(cfg(), "right", 0, { openAppsLimit: null })
  assert.deepStrictEqual(out.bar.layout.right[0], { id: "blackcode.omacolorbar", icon: "omarchy.tray" })
  assert.deepStrictEqual(Object.keys(S.withEntryKeys(cfg(), "left", 0, { icon: "omarchy.audio" }).bar.layout.left[0]), ["id", "icon"])
})

test("serialize matches the shell's own format", () => {
  assert.strictEqual(S.serialize({ a: [1] }), '{\n  "a": [\n    1\n  ]\n}\n')
})

test("no Array.from or codePointAt", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "ShellEntry.js"), "utf8")
  assert.ok(src.indexOf("Array.from") === -1 && src.indexOf("codePointAt") === -1)
})

test("planSave: next text for a change to one copy", () => {
  const raw = S.serialize(cfg())
  const plan = S.planSave(raw, "omarchy.menu", { menuLogo: "Arch" })
  assert.strictEqual(JSON.parse(plan.next).bar.layout.left[0].menuLogo, "Arch")
  assert.strictEqual(JSON.parse(plan.next).bar.layout.right[0].openAppsLimit, 4)
})

test("planSave: unchanged when the text would be identical", () => {
  const raw = S.serialize(cfg())
  assert.deepStrictEqual(JSON.parse(JSON.stringify(S.planSave(raw, "omarchy.menu", { icon: "omarchy.menu" }))), { unchanged: true })
})

test("planSave: invalid JSON and missing layout are 'invalid'", () => {
  assert.strictEqual(S.planSave("{nope", "omarchy.menu", {}).error, "invalid")
  assert.strictEqual(S.planSave("{}", "omarchy.menu", {}).error, "invalid")
})

test("planSave: no copy with that icon is 'none'", () => {
  assert.strictEqual(S.planSave(S.serialize(cfg()), "omarchy.audio", {}).error, "none")
})

test("planSave: two copies with the same icon are 'many'", () => {
  const c = cfg()
  c.bar.layout.center.push({ id: "blackcode.omacolorbar", icon: "omarchy.menu" })
  assert.strictEqual(S.planSave(S.serialize(c), "omarchy.menu", {}).error, "many")
})

test("planSave: switching to an icon another copy uses is 'used'", () => {
  const raw = S.serialize(cfg())
  assert.strictEqual(S.planSave(raw, "omarchy.menu", { icon: "omarchy.tray" }).error, "used")
  assert.ok(S.planSave(raw, "omarchy.menu", { icon: "omarchy.audio" }).next)
})
