import QtQuick
import Quickshell
import Quickshell.Io
import "OpenApps.js" as OpenApps

// Apps hidden from the open-apps row with a right-click, kept in OmaColorBar's own state
// file so they survive restarts. Never written to shell.json: the shell's inline save
// rewrites every OmaColorBar entry at once.
Item {
  id: store

  property var keys: []
  property bool warned: false

  function hide(key) { save(OpenApps.withKey(keys, key)) }
  function show(key) { save(OpenApps.withoutKey(keys, key)) }

  function save(next) {
    keys = next
    file.setText(JSON.stringify(next))
  }

  FileView {
    id: file
    path: Quickshell.statePath("omacolorbar-hidden-apps.json")
    printErrors: false
    atomicWrites: true
    // The bar makes one widget per monitor, each with its own store: reload on a change
    // so a hide on one monitor reaches the others.
    watchChanges: true
    onFileChanged: reload()
    onLoaded: {
      var text = file.text()
      store.keys = OpenApps.parseHidden(text)
      if (text.trim() !== "" && store.keys.length === 0 && text.trim() !== "[]" && !store.warned) {
        store.warned = true
        console.warn("[omacolorbar] " + file.path + " is not a JSON list of app ids; ignoring it")
      }
    }
    onLoadFailed: store.keys = []
    onSaveFailed: function(error) { console.warn("[omacolorbar] could not save hidden apps: " + error) }
  }
}
