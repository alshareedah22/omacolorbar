const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const path = require("path")
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8")

test("the card never uses the shell's inline save", () => {
  for (const f of ["SettingsCard.qml", "Panel.qml", "OpenAppsRow.qml"])
    assert.ok(read(f).indexOf("updateEntryInline") === -1, f)
})

test("the card writes through ShellEntry with a backup and atomic writes", () => {
  const src = read("SettingsCard.qml")
  for (const s of ["ShellEntry.planSave", "blockAllReads: true", "preload: false",
                   "shell.json.omacolorbar-settings-backup", "atomicWrites: true", "waitForJob"])
    assert.ok(src.indexOf(s) !== -1, s)
  assert.ok(src.indexOf("shell.json.omacolorbar-backup\"") === -1, "never touches the swap backup")
})

test("middle-click opens the card; microphone and agents need Shift", () => {
  const src = read("Panel.qml")
  assert.ok(/acceptedButtons:\s*Qt\.MiddleButton/.test(src))
  assert.ok(src.indexOf("omarchy.microphone") !== -1 && src.indexOf("omarchy.agents") !== -1)
  assert.ok(src.indexOf("Qt.ShiftModifier") !== -1)
  assert.ok(src.indexOf("mouse.accepted = false") !== -1)
})
