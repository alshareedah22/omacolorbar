const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const path = require("path")
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8")

// Open apps live in the tray drawer on a horizontal bar (spec: "Change 2026-10-27").
test("Panel.qml follows the hosted tray's reveal and drawer", () => {
  const src = read("Panel.qml")
  for (const s of ["tray.revealProgress", "tray.drawerCount", "tray.allItems", "tray.expanded = true",
                   "function onExpandedChanged()"])
    assert.ok(src.indexOf(s) !== -1, s)
})

test("Panel.qml has a keepOpen HoverHandler over the whole copy", () => {
  const src = read("Panel.qml")
  assert.ok(/HoverHandler\s*\{\s*id:\s*keepOpen/.test(src))
  assert.ok(src.indexOf("keepOpen.hovered") !== -1)
})

test("Panel.qml draws its own chevron when the tray shows none", () => {
  const src = read("Panel.qml")
  assert.ok(src.indexOf('text: "\\uf053"') !== -1, "the Omarchy chevron glyph")
  assert.ok(/id:\s*ownChevronButton/.test(src))
  assert.ok(/Behavior on ownProgress\s*\{\s*NumberAnimation\s*\{\s*duration:\s*600;\s*easing\.type:\s*Easing\.OutCubic/.test(src),
            "same animation as Tray.qml")
})

test("OpenAppsRow.qml clips and slides its icons in drawer mode", () => {
  const src = read("OpenAppsRow.qml")
  assert.ok(src.indexOf("clip: row.drawer") !== -1)
  assert.ok(src.indexOf("enabled: row.revealed") !== -1, "nothing takes input while hidden")
  assert.ok(/x:\s*row\.drawer \? grid\.implicitWidth \* \(1 - row\.reveal\)/.test(src))
})

test("middle-click over the hosted tray passes through in drawer mode", () => {
  const src = read("Panel.qml")
  assert.ok(src.indexOf("mouse.x >= root.areaWidth") !== -1)
  assert.ok(src.indexOf("mouse.x < root.revealStart") !== -1)
})
