import QtQuick
import Quickshell
import qs.Commons
import "Apps.js" as Apps

// Gives every tray icon in the hosted tray its app's own color icon. The tray builds its
// icons in Repeaters (drawer and pinned rows, both orientations), so they are re-scanned.
// No match, an empty icon path or an image error leaves or puts back the tray's own image.
Item {
  id: adapter

  property var host: null
  property bool enabled: false
  // Tray icons already set to the bar's icon size (destroyed ones drop out on the next host).
  property var sized: []
  property var adapted: []
  property var adaptedKeys: []
  property var shownKeys: []
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

  // Returns the desktop id of the app the icon was given ("" when it has none or was put back
  // after a load error), so it is not adapted again; an unmatched icon returns null and is
  // tried again on the next scan.
  function adapt(trayIcon) {
    var data = trayIcon.parent ? trayIcon.parent.modelData : null
    if (!data) return null
    var entry = Apps.matchAppEntry({ id: data.id, title: data.title, tooltipTitle: data.tooltipTitle }, apps)
    var source = sourceFor(entry ? String(entry.icon) : "")
    if (source === "") return null
    var image = trayIcon.children[0]
    var restored = false
    function check() {
      if (restored || image.status !== Image.Error) return
      restored = true
      var at = adapter.adapted.indexOf(trayIcon)
      if (at !== -1) {
        var ks = adapter.adaptedKeys.slice()
        ks[at] = ""
        adapter.adaptedKeys = ks
      }
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
    return restored || !entry.desktopId ? "" : String(entry.desktopId)
  }

  function scan() {
    var live = []
    var liveKeys = []
    for (var j = 0; j < adapted.length; j++) {
      if (!adapted[j]) continue
      live.push(adapted[j])
      liveKeys.push(adaptedKeys[j])
    }
    var found = trayIcons(host, 0, [])
    for (var i = 0; i < found.length; i++) {
      // Every tray icon at the bar's icon size, the same as the open apps next to them
      // (Omarchy draws tray icons smaller, at Style.space(12)).
      if (sized.indexOf(found[i]) === -1) {
        found[i].width = Qt.binding(function() { return Style.bar.iconCanvas })
        found[i].height = Qt.binding(function() { return Style.bar.iconCanvas })
        sized.push(found[i])
      }
      if (live.indexOf(found[i]) !== -1) continue
      var key = adapt(found[i])
      if (key === null) continue
      live.push(found[i])
      liveKeys.push(key)
    }
    adapted = live
    adaptedKeys = liveKeys
    var keys = []
    for (var k = 0; k < adapted.length; k++)
      if (adapted[k] && adaptedKeys[k] !== "" && keys.indexOf(adaptedKeys[k]) === -1) keys.push(adaptedKeys[k])
    if (JSON.stringify(keys) !== JSON.stringify(shownKeys)) shownKeys = keys
  }

  onHostChanged: {
    sized = []
    adapted = []
    adaptedKeys = []
    shownKeys = []
  }
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
