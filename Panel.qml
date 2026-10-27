import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Icons.js" as Icons
import "Levels.js" as Levels

// One copy hosts one built-in bar widget, built from the shell's widget registry the way
// the bar builds it, and draws a color icon in place of that widget's glyph. Clicks,
// scroll, tooltips and popups stay the built-in widget's own.
Item {
  id: root

  // Injected by the bar.
  property var bar: null
  property var settings: ({})
  property string moduleName: Icons.PLUGIN_ID

  function setting(name, fallback) {
    var value = settings ? settings[name] : undefined
    return value === undefined || value === null ? fallback : value
  }

  readonly property string hostId: String(setting("icon", "omarchy.network"))
  readonly property string menuLogo: String(setting("menuLogo", "Omarchy"))
  readonly property bool supported: Icons.SUPPORTED.indexOf(hostId) !== -1
  // How the hosted widget's icons are swapped (see the spec's adapter table).
  readonly property string adapter: hostId === "omarchy.indicators" ? "indicator"
    : hostId === "omarchy.tray" ? "tray" : "button"

  // The registry reaches a plugin only through its own service (Service.qml).
  property var registry: null
  property int registryAttempts: 0
  readonly property bool registryLost: registry === null && registryAttempts >= 20
  readonly property var hostComponent: componentFor(hostId, registry ? registry.revision : 0)

  readonly property string problem: !supported ? "OmaColorBar does not support " + hostId
    : registryLost ? "OmaColorBar could not reach the widget registry"
    : registry !== null && hostComponent === null ? "Omarchy has no widget " + hostId
    : ""

  // The hosted widget's own settings, from shell.json's plugins[] entry for its id.
  property var hostSettings: ({})
  property bool duplicate: false

  property var button: null
  property var originalIcon: null
  property int attachTries: 0
  property string tailscaleState: ""
  // Indicator buttons already given a color icon. The indicators widget builds and
  // rebuilds them (active and inactive blocks, orientation), so they are re-scanned.
  property var adapted: []

  readonly property var drawing: supported
    ? Icons.drawingFor(hostId, button ? String(button.text) : "", { menuLogo: menuLogo, tailscale: tailscaleState })
    : null
  readonly property string drawingSource: !drawing ? ""
    : drawing.kind === "svg" ? Qt.resolvedUrl("icons/" + drawing.name + ".svg").toString()
    : Levels.dataUri(drawing)

  implicitWidth: problem !== "" ? warning.implicitWidth : slot.implicitWidth
  implicitHeight: problem !== "" ? warning.implicitHeight : slot.implicitHeight

  function resolveRegistry() {
    var direct = bar && bar.barWidgetRegistry ? bar.barWidgetRegistry : null
    if (direct) { registry = direct; return }
    var own = bar && bar.shell && typeof bar.shell.serviceFor === "function" ? bar.shell.serviceFor(moduleName) : null
    registry = own && own.barWidgetRegistry ? own.barWidgetRegistry : null
  }

  function componentFor(id, revision) {
    if (!registry || !registry.widgets) return null
    var key = bar && typeof bar.canonicalWidgetId === "function" ? bar.canonicalWidgetId(id) : id
    var entry = registry.widgets[key]
    return entry ? entry.component : null
  }

  // What Bar.qml injects into every widget; the hosted widget is not told it is hosted.
  function inject(item) {
    if (!item) return
    if ("bar" in item) item.bar = root.bar
    if ("moduleName" in item) item.moduleName = root.hostId
    if ("settings" in item) item.settings = root.hostSettings
  }

  // The hosted widget's BarIconButton: the item with iconComponent and glyph metrics.
  function findButton(item, depth) {
    if (!item || depth > 8) return null
    if ("iconComponent" in item && "glyphPaintedWidth" in item) return item
    if ("labelVisible" in item && "fontFamily" in item && "text" in item) return item
    var kids = item.children || []
    for (var i = 0; i < kids.length; i++) {
      var found = findButton(kids[i], depth + 1)
      if (found) return found
    }
    return null
  }

  // Tailscale's own icon: the item with crossed and warning.
  function findFlags(item, depth) {
    if (!item || depth > 6) return null
    if ("crossed" in item && "warning" in item) return item
    var kids = item.children || []
    for (var i = 0; i < kids.length; i++) {
      var found = findFlags(kids[i], depth + 1)
      if (found) return found
    }
    return null
  }

  // Every BarIndicator inside the hosted indicators widget.
  function findIndicators(item, depth, out) {
    if (!item || depth > 14) return out
    if ("activeText" in item && "effectiveActive" in item && "iconComponent" in item) out.push(item)
    var kids = item.children || []
    for (var i = 0; i < kids.length; i++) findIndicators(kids[i], depth + 1, out)
    return out
  }

  function indicatorIconFor(item) {
    return function() { return Icons.indicatorDrawing(String(item.text), item.effectiveActive) ? indicatorIcon : null }
  }

  function scanIndicators() {
    var live = adapted.filter(function(item) { return item })
    var found = findIndicators(loader.item, 0, [])
    for (var i = 0; i < found.length; i++) {
      if (live.indexOf(found[i]) !== -1) continue
      found[i].iconComponent = Qt.binding(indicatorIconFor(found[i]))
      live.push(found[i])
    }
    adapted = live
  }

  function attach() {
    var found = findButton(loader.item, 0)
    if (!found) {
      if (attachTries++ < 20) attachRetry.restart()
      else console.warn("[omacolorbar] " + hostId + ": no BarIconButton found; leaving its own icon")
      return
    }
    button = found
    // A text-glyph button (the menu): hide its glyph and lay the icon over it.
    if (!("iconComponent" in found)) {
      found.labelVisible = false
      glyphOverlay.createObject(found, {})
      markDuplicate()
      return
    }
    originalIcon = found.iconComponent
    // No drawing: the button's own icon (null = its glyph, or Tailscale's component).
    found.iconComponent = Qt.binding(function() {
      return root.hostId === "omarchy.tailscale" || root.drawing !== null ? colorIcon : root.originalIcon
    })
    markDuplicate()
  }

  function markDuplicate() {
    if (!duplicate || !button || !("tooltipText" in button)) return
    var note = "OmaColorBar: " + hostId + " is also on the bar directly"
    if (String(button.tooltipText).indexOf(note) === -1)
      button.tooltipText = (button.tooltipText ? button.tooltipText + "\n" : "") + note
  }

  function readShell() {
    var config
    try { config = JSON.parse(shellView.text()) } catch (e) { return }
    hostSettings = Icons.hostSettingsFrom(config, hostId)
    duplicate = Icons.onBarDirectly(config, hostId)
  }

  onHostSettingsChanged: if (loader.item && "settings" in loader.item) loader.item.settings = hostSettings
  onDuplicateChanged: markDuplicate()
  Component.onCompleted: resolveRegistry()

  Timer {
    interval: 250
    repeat: true
    running: root.registry === null && root.registryAttempts < 20
    onTriggered: { root.registryAttempts++; root.resolveRegistry() }
  }

  Timer {
    id: attachRetry
    interval: 100
    onTriggered: root.attach()
  }

  Timer {
    interval: 1000
    repeat: true
    running: root.adapter === "indicator" && loader.item !== null
    onTriggered: root.scanIndicators()
  }

  TrayAdapter {
    host: loader.item
    enabled: root.adapter === "tray"
  }

  FileView {
    id: shellView
    path: Quickshell.env("HOME") + "/.config/omarchy/shell.json"
    watchChanges: true
    printErrors: false
    onLoaded: root.readShell()
    onFileChanged: reload()
  }

  Component {
    id: glyphOverlay
    Image {
      anchors.centerIn: parent
      width: Style.bar.iconCanvas
      height: Style.bar.iconCanvas
      source: root.drawingSource
      sourceSize.width: width * 2
      sourceSize.height: height * 2
      fillMode: Image.PreserveAspectFit
      smooth: true
    }
  }

  // An indicator's icon: picks its drawing from the BarIndicator it sits in
  // (Image -> Loader -> optical canvas -> the button).
  Component {
    id: indicatorIcon
    Image {
      id: indicatorImage
      property var button: null
      readonly property var drawing: button ? Icons.indicatorDrawing(String(button.text), button.effectiveActive) : null
      // The Loader may set the parent after completion, so look on both.
      function findButton() {
        for (var p = parent, i = 0; p && i < 6; p = p.parent, i++)
          if ("effectiveActive" in p && "activeText" in p) { button = p; return }
      }
      Component.onCompleted: findButton()
      onParentChanged: findButton()
      source: drawing ? Qt.resolvedUrl("icons/" + drawing.name + ".svg") : ""
      sourceSize.width: width * 2
      sourceSize.height: height * 2
      fillMode: Image.PreserveAspectFit
      smooth: true
    }
  }

  Component {
    id: colorIcon
    Item {
      id: icon

      // Tailscale draws its own icon: keep it, invisible, to read its state from it.
      Loader {
        id: original
        anchors.fill: parent
        active: root.hostId === "omarchy.tailscale"
        sourceComponent: root.originalIcon
        opacity: root.drawing ? 0 : 1
      }
      readonly property var flags: root.findFlags(original.item, 0)
      Binding {
        target: root
        property: "tailscaleState"
        when: original.active
        value: icon.flags ? (icon.flags.warning ? "login" : (icon.flags.crossed ? "off" : "on")) : ""
      }

      // Centered on the button; a label (battery percentage) sits left of the icon.
      Row {
        anchors.centerIn: parent
        spacing: Style.space(4)
        visible: root.drawing !== null

        Text {
          anchors.verticalCenter: parent.verticalCenter
          visible: text !== ""
          text: root.drawing ? root.drawing.label : ""
          textFormat: Text.PlainText
          color: root.bar ? root.bar.foreground : Color.foreground
          font.family: root.bar ? root.bar.fontFamily : Style.font.family
          font.pixelSize: Style.bar.iconFont
        }

        Image {
          width: icon.height
          height: icon.height
          source: root.drawingSource
          sourceSize.width: width * 2
          sourceSize.height: height * 2
          fillMode: Image.PreserveAspectFit
          smooth: true
        }
      }
    }
  }

  Item {
    id: slot
    visible: root.problem === ""
    implicitWidth: loader.item && loader.item.visible ? loader.item.implicitWidth : 0
    implicitHeight: loader.item && loader.item.visible ? loader.item.implicitHeight : 0
    width: implicitWidth
    height: implicitHeight

    Loader {
      id: loader
      anchors.fill: parent
      active: root.problem === ""
      sourceComponent: root.hostComponent
      onLoaded: {
        // A new hosted item (the icon setting changed): forget the old one so attach() starts fresh.
        attachRetry.stop()
        root.attachTries = 0
        root.button = null
        root.originalIcon = null
        root.tailscaleState = ""
        root.adapted = []
        root.inject(item)
        // Again on the next frame, as the bar does: some widgets read these while building.
        Qt.callLater(function() {
          root.inject(loader.item)
          if (root.adapter === "button") root.attach()
          else if (root.adapter === "indicator") root.scanIndicators()
        })
      }
    }
  }

  BarIconButton {
    id: warning
    visible: root.problem !== ""
    anchors.fill: parent
    bar: root.bar
    tooltipText: root.problem
    iconComponent: Component {
      Image {
        source: Qt.resolvedUrl("icons/warning.svg")
        sourceSize.width: width * 2
        sourceSize.height: height * 2
        fillMode: Image.PreserveAspectFit
        smooth: true
      }
    }
  }
}
