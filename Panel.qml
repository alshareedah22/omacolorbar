import QtQuick
import QtQuick.Window
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Icons.js" as Icons
import "Levels.js" as Levels
import "OpenApps.js" as OpenApps

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
  readonly property string adapter: hostId === "omarchy.tray" ? "tray" : "button"

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

  TrayAdapter {
    id: trayAdapter
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
      sourceSize.width: width * Math.max(2, Screen.devicePixelRatio)
      sourceSize.height: height * Math.max(2, Screen.devicePixelRatio)
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
          sourceSize.width: width * Math.max(2, Screen.devicePixelRatio)
          sourceSize.height: height * Math.max(2, Screen.devicePixelRatio)
          fillMode: Image.PreserveAspectFit
          smooth: true
        }
      }
    }
  }

  readonly property bool openAppsOn: adapter === "tray" && setting("openApps", true) === true
  readonly property real hostedWidth: loader.item && loader.item.visible ? loader.item.implicitWidth : 0
  readonly property real hostedHeight: loader.item && loader.item.visible ? loader.item.implicitHeight : 0
  readonly property bool verticalBar: bar ? bar.vertical === true : false

  // Horizontal tray copy: the open apps live in the tray's drawer. Left to right: the
  // open-apps area (its full width reserved even when collapsed, as Omarchy reserves the
  // tray drawer's), then the hosted tray. The icons slide out from the tray side with the
  // tray's own reveal (600 ms OutCubic) and hide behind its `<`. When the tray shows no `<`
  // (no tray apps), OmaColorBar draws its own at the right end of the area.
  readonly property bool drawerMode: openAppsOn && !verticalBar
  readonly property bool drawerActive: drawerMode && openRow.visible
  readonly property var tray: adapter === "tray" ? loader.item : null
  // The tray draws its `<` whenever it has an unpinned or pinned app (Tray.qml shows the
  // drawer block for allItems.length > 0, even at drawerCount 0); use it then, so two `<`
  // never sit side by side.
  readonly property bool trayChevron: tray !== null && tray.visible === true
    && ((tray.drawerCount || 0) > 0 || (tray.allItems ? tray.allItems.length > 0 : false))
  readonly property bool ownChevron: drawerActive && !trayChevron
  property bool ownExpanded: false
  property real ownProgress: ownExpanded ? 1 : 0
  Behavior on ownProgress {
    NumberAnimation { duration: 600; easing.type: Easing.OutCubic }
  }
  readonly property real reveal: !drawerMode ? 1
    : trayChevron ? (typeof tray.revealProgress === "number" ? tray.revealProgress : 0)
    : ownProgress
  readonly property real rowWidth: openRow.visible ? openRow.implicitWidth : 0
  readonly property real chevronWidth: ownChevron ? ownChevronButton.implicitWidth : 0
  readonly property real areaWidth: drawerMode ? rowWidth + chevronWidth : 0
  // Left edge of the part of the area that is showing: the own `<`, or the sliding icons.
  readonly property real revealStart: ownChevron ? ownChevronButton.x : rowWidth * (1 - reveal)
  readonly property bool pointerInArea: keepOpen.hovered && keepOpen.point.position.x < areaWidth
  // Over the shown part of the area (never the empty collapsed area): open the drawer.
  readonly property bool overRevealed: drawerActive && pointerInArea
    && keepOpen.point.position.x >= revealStart && (ownChevron || reveal > 0)
  readonly property bool holdOpen: openRow.cardOpen

  readonly property real rowGap: !drawerMode && openRow.visible && (hostedWidth > 0 || hostedHeight > 0) ? Style.space(4) : 0

  function openDrawer() {
    if (!drawerActive) return
    if (trayChevron) tray.expanded = true
    else ownExpanded = true
  }

  // Leaving the whole copy, with no card of the row (or the settings card) open, collapses.
  function settleDrawer() {
    if (keepOpen.hovered || holdOpen) return
    if (trayChevron && tray.expanded === true) tray.expanded = false
    ownExpanded = false
  }

  onOverRevealedChanged: if (overRevealed) openDrawer()
  onHoldOpenChanged: if (!holdOpen) settleDrawer()
  onOwnChevronChanged: if (!ownChevron) ownExpanded = false
  // The last open app went away (or open apps were turned off) while the drawer was held open.
  onDrawerActiveChanged: if (!drawerActive) settleDrawer()

  // The tray collapses itself when the pointer leaves its drawer; keep it open while the
  // pointer is on the shown open apps or a card of the row is open.
  Connections {
    target: root.drawerActive && root.trayChevron ? root.tray : null
    ignoreUnknownSignals: true
    function onExpandedChanged() {
      if (!root.tray.expanded && (root.pointerInArea && root.reveal > 0 || root.holdOpen)) root.tray.expanded = true
    }
  }

  Item {
    id: slot
    visible: root.problem === ""
    implicitWidth: root.verticalBar ? Math.max(root.hostedWidth, openRow.visible ? openRow.implicitWidth : 0)
      : root.drawerMode ? root.areaWidth + root.hostedWidth
      : root.hostedWidth + root.rowGap + (openRow.visible ? openRow.implicitWidth : 0)
    implicitHeight: root.verticalBar ? root.hostedHeight + root.rowGap + (openRow.visible ? openRow.implicitHeight : 0)
      : Math.max(root.hostedHeight, openRow.visible ? openRow.implicitHeight : 0)
    width: implicitWidth
    height: implicitHeight

    // Passive: tells whether the pointer is anywhere on this copy (tray and open apps).
    HoverHandler {
      id: keepOpen
      onHoveredChanged: if (!hovered) root.settleDrawer()
    }

    Loader {
      id: loader
      width: root.hostedWidth
      x: root.verticalBar ? (parent.width - width) / 2 : root.areaWidth
      height: root.verticalBar ? root.hostedHeight : parent.height
      active: root.problem === ""
      sourceComponent: root.hostComponent
      onLoaded: {
        // A new hosted item (the icon setting changed): forget the old one so attach() starts fresh.
        attachRetry.stop()
        root.attachTries = 0
        root.button = null
        root.originalIcon = null
        root.tailscaleState = ""
        root.inject(item)
        // Again on the next frame, as the bar does: some widgets read these while building.
        Qt.callLater(function() {
          root.inject(loader.item)
          if (root.adapter === "button") root.attach()
        })
      }
    }

    OpenAppsRow {
      id: openRow
      x: root.verticalBar ? (parent.width - width) / 2
        : root.drawerMode ? root.chevronWidth
        : root.hostedWidth + root.rowGap
      y: root.verticalBar ? root.hostedHeight + root.rowGap : 0
      height: root.verticalBar ? implicitHeight : parent.height
      bar: root.bar
      enabled: root.openAppsOn
      drawer: root.drawerMode
      reveal: root.reveal
      limit: OpenApps.clampLimit(root.setting("openAppsLimit", 6))
      showTerminals: root.setting("showTerminals", false) === true
      manualHidden: Array.isArray(root.setting("hiddenApps", [])) ? root.setting("hiddenApps", []) : []
      trayKeys: trayAdapter.shownKeys
      settingsOpen: settingsCard.open
    }

    // Own `<` when the tray shows none: same glyph and size as Omarchy's, at the right end
    // of the area when collapsed, sliding left as the icons come out (Tray.qml's
    // x: drawerExtent - revealExtent).
    BarIconButton {
      id: ownChevronButton
      visible: root.ownChevron
      bar: root.bar
      width: implicitWidth
      height: implicitHeight
      anchors.verticalCenter: parent.verticalCenter
      x: root.rowWidth * (1 - root.reveal)
      text: "\uf053"
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
        sourceSize.width: width * Math.max(2, Screen.devicePixelRatio)
        sourceSize.height: height * Math.max(2, Screen.devicePixelRatio)
        fillMode: Image.PreserveAspectFit
        smooth: true
      }
    }
  }

  // Middle-click opens this copy's settings card. Microphone and agents use middle-click
  // themselves, so on those two the card needs Shift+middle-click and plain middle-click
  // goes to the widget. Only the middle button is taken: left/right clicks, scroll and
  // hover still reach the hosted widget.
  readonly property bool hostUsesMiddle: hostId === "omarchy.microphone" || hostId === "omarchy.agents"

  function close() { settingsCard.open = false }

  MouseArea {
    anchors.fill: parent
    z: 10
    acceptedButtons: Qt.MiddleButton
    onPressed: function(mouse) {
      var shift = (mouse.modifiers & Qt.ShiftModifier) !== 0
      // The hosted tray uses plain middle-click itself (secondary activate); only the
      // open-apps area opens the card without Shift. On a horizontal bar that area is left
      // of the tray (the drawer) and takes nothing while collapsed; on a vertical bar the
      // row is below the tray.
      var overHosted = root.adapter === "tray" && (root.verticalBar ? mouse.y < root.hostedHeight
        : root.drawerMode ? mouse.x >= root.areaWidth : mouse.x < root.hostedWidth)
      var overHidden = root.drawerActive && mouse.x < root.revealStart
      if (!shift && (root.hostUsesMiddle || overHosted || overHidden)) {
        mouse.accepted = false
        return
      }
      settingsCard.open = !settingsCard.open
    }
  }

  SettingsCard {
    id: settingsCard
    anchorItem: root
    bar: root.bar
    owner: root
    icon: root.hostId
    settings: root.settings
    hiddenStore: openRow.hiddenStore
    apps: openRow.apps
    manualHidden: Array.isArray(root.setting("hiddenApps", [])) ? root.setting("hiddenApps", []) : []
  }
}
