const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const path = require("path")
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8")

test("the card never uses the shell's inline save", () => {
  for (const f of ["SettingsPanel.qml", "Panel.qml", "OpenAppsRow.qml"])
    assert.ok(read(f).indexOf("updateEntryInline") === -1, f)
})

test("the card writes through ShellEntry with a backup and atomic writes", () => {
  const src = read("SettingsPanel.qml")
  for (const s of ["ShellEntry.planSave", "blockAllReads: true", "preload: false",
                   "shell.json.omacolorbar-settings-backup", "atomicWrites: true", "waitForJob"])
    assert.ok(src.indexOf(s) !== -1, s)
  assert.ok(src.indexOf("shell.json.omacolorbar-backup\"") === -1, "never touches the swap backup")
})

test("middle-click opens the panel; microphone and agents need Shift; right-click on the logo", () => {
  const src = read("Panel.qml")
  assert.ok(/acceptedButtons: root\.isMenu \? \(Qt\.MiddleButton \| Qt\.RightButton\) : Qt\.MiddleButton/.test(src))
  assert.ok(src.indexOf('isMenu: hostId === "omarchy.menu"') !== -1)
  assert.ok(src.indexOf("omarchy.microphone") !== -1 && src.indexOf("omarchy.agents") !== -1)
  assert.ok(src.indexOf("Qt.ShiftModifier") !== -1)
  assert.ok(src.indexOf("mouse.accepted = false") !== -1)
})

test("the panel never offers the menu to another copy and warns before microphone/agents", () => {
  const src = read("SettingsPanel.qml")
  assert.ok(src.indexOf('id !== "omarchy.menu"') !== -1)
  assert.ok(src.indexOf("pendingSwitch") !== -1 && src.indexOf("Shift+middle-click") !== -1)
  assert.ok(src.indexOf("ShellEntry.planRestore") !== -1)
})

test("the service answers SUPER+CTRL+ALT+C over IPC and reopens the panel after a rebuild", () => {
  const src = read("Service.qml")
  assert.ok(/target: "omacolorbar"/.test(src) && /function toggleSettings\(\)/.test(src))
  assert.ok(read("Panel.qml").indexOf("service.takePending(root)") !== -1)
})

test("only the same widget on the same screen reopens the panel after a rebuild", () => {
  const src = read("Service.qml")
  assert.ok(src.indexOf("copy.hostId !== pendingHost || copy.screenName !== pendingScreen") !== -1)
  assert.ok(src.indexOf('copy.screenName === ""') !== -1, "waits until the copy knows its screen")
  assert.ok(read("SettingsPanel.qml").indexOf("reopenLater(tab, screenName, copy ? copy.hostId") !== -1)
  assert.ok(read("Panel.qml").indexOf("onScreenNameChanged: claimPending()") !== -1)
})
