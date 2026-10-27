import QtQuick
import Quickshell
import "Apps.js" as Apps

// Gives every tray icon in the hosted tray its app's own color icon. The tray builds its
// icons in Repeaters (drawer and pinned rows, both orientations), so they are re-scanned.
// No match, an empty icon path or an image error leaves or puts back the tray's own image.
Item {
  id: adapter

  property var host: null
  property bool enabled: false
  property var adapted: []
  property var apps: []

  function readApps() {
    var values = DesktopEntries.applications.values
    var out = []
    for (var i = 0; i < values.length; i++) {
      var e = values[i]
      if (e.noDisplay) continue
      out.push({ name: e.name, icon: e.icon, wmClass: e.startupClass, desktopId: e.id })
    }
    apps = out
  }

  // A tray icon: the Tray.qml TrayIcon item, with icon and symbolic, holding its Image.
  function trayIcons(item, depth, out) {
    if (!item || depth > 14) return out
    if ("icon" in item && "symbolic" in item && item.children.length > 0 && "fillMode" in item.children[0]) out.push(item)
    var kids = item.children || []
    for (var i = 0; i < kids.length; i++) trayIcons(kids[i], depth + 1, out)
    return out
  }

  function sourceFor(name) {
    if (name === "") return ""
    if (name.charAt(0) === "/") return "file://" + name
    return Quickshell.iconPath(name, true)
  }

  // Puts back the bindings Tray.qml's TrayIcon declares; its source goes through the
  // tray's trayIconSource(), which is on the hosted item.
  function restore(trayIcon) {
    var image = trayIcon.children[0]
    var tray = adapter.host
    image.source = Qt.binding(function() {
      return tray && typeof tray.trayIconSource === "function" ? tray.trayIconSource(trayIcon.icon) : String(trayIcon.icon || "")
    })
    image.visible = Qt.binding(function() { return !trayIcon.symbolic })
    image.layer.enabled = Qt.binding(function() { return trayIcon.symbolic })
    if (trayIcon.children.length > 1) trayIcon.children[1].visible = Qt.binding(function() { return trayIcon.symbolic })
  }

  // True once the icon was given an app icon (or put back after a load error), so it is not
  // adapted again; an unmatched icon returns false and is tried again on the next scan.
  function adapt(trayIcon) {
    var data = trayIcon.parent ? trayIcon.parent.modelData : null
    if (!data) return false
    var source = sourceFor(Apps.matchApp({ id: data.id, title: data.title, tooltipTitle: data.tooltipTitle }, apps))
    if (source === "") return false
    var image = trayIcon.children[0]
    var restored = false
    function check() {
      if (restored || image.status !== Image.Error) return
      restored = true
      console.warn("[omacolorbar] tray: " + source + " failed to load; using the tray's own image")
      adapter.restore(trayIcon)
    }
    // Connected before the source is set: a missing local file can fail synchronously.
    image.statusChanged.connect(check)
    image.source = source
    // A symbolic tray icon is drawn tinted through a MultiEffect; show the app icon as is.
    image.visible = true
    image.layer.enabled = false
    if (trayIcon.children.length > 1) trayIcon.children[1].visible = false
    check()
    return true
  }

  function scan() {
    var live = adapted.filter(function(item) { return item })
    var found = trayIcons(host, 0, [])
    for (var i = 0; i < found.length; i++) {
      if (live.indexOf(found[i]) !== -1) continue
      if (adapt(found[i])) live.push(found[i])
    }
    adapted = live
  }

  onHostChanged: adapted = []
  Component.onCompleted: readApps()

  Connections {
    target: DesktopEntries.applications
    function onValuesChanged() { adapter.readApps() }
  }

  Timer {
    interval: 1000
    repeat: true
    triggeredOnStart: true
    running: adapter.enabled && adapter.host !== null
    onTriggered: adapter.scan()
  }
}
