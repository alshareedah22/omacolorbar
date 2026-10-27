import QtQuick
import QtQuick.Window
import Quickshell
import Quickshell.Wayland
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "Apps.js" as Apps
import "OpenApps.js" as OpenApps

// Open apps next to the hosted tray (in its drawer on a horizontal bar): one color icon per app, a count at 2+ windows,
// click focuses (and cycles), extra apps behind +N, right-click hides. Sizes come from
// Omarchy's Style tokens so the row scales with the theme and the monitor.
Item {
  id: row

  property var bar: null
  property int limit: 6
  property bool showTerminals: false
  property var manualHidden: []
  property var trayKeys: []

  readonly property bool vertical: bar ? bar.vertical === true : false
  readonly property int slot: Style.bar.statusSlot
  readonly property int iconSize: Style.bar.iconCanvas
  readonly property color foreground: bar ? bar.foreground : Commons.Color.popups.text
  // Commons.Color: a bare `Color` resolves to another type in this file's imports.
  readonly property color badgeColor: Commons.Color.popups.border
  readonly property color badgeText: Commons.Color.popups.background
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family

  property var apps: []           // [{name, icon, wmClass, desktopId, terminal}]
  property var windows: []        // [{key, name, icon, terminal, seen, used}], same order as tops
  property var tops: []           // the Toplevel objects behind `windows`
  property var seenSeq: ({})      // app key -> first-seen sequence
  property int seenCounter: 0
  property var usedTops: []       // Toplevel objects ...
  property var usedSeq: []        // ... and their last activation sequence
  property int usedCounter: 0
  property var groups: []
  property var shown: []
  property var overflow: []
  property var menuGroup: null    // app the right-click card is for (null = the +N card)
  property bool menuOpen: false
  property bool moreOpen: false

  // Drawer mode (horizontal tray copy): the icons are clipped to the row's own area and
  // slide in from its right edge (the tray side) by `reveal`, 0 = hidden, 1 = shown. While
  // hidden nothing in the row takes clicks or hover. Off (vertical bar): always shown.
  property bool drawer: false
  property real reveal: 1
  readonly property bool revealed: !drawer || reveal > 0

  readonly property var hiddenAll: OpenApps.withoutKey(store.keys.concat(manualHidden || []), "")

  implicitWidth: !enabled ? 0 : vertical ? slot : grid.implicitWidth
  implicitHeight: !enabled ? 0 : vertical ? grid.implicitHeight : slot
  visible: enabled && (shown.length > 0 || overflow.length > 0)

  function sourceFor(name) {
    if (!name) return ""
    if (String(name).charAt(0) === "/") return "file://" + name
    return Quickshell.iconPath(String(name), true)
  }

  function readApps() {
    if (!row.enabled) return
    var values = DesktopEntries.applications.values, out = []
    for (var i = 0; i < values.length; i++) {
      var e = values[i]
      out.push({ name: e.name, icon: e.icon, wmClass: e.startupClass, desktopId: e.id, terminal: OpenApps.isTerminal(e.categories) })
    }
    apps = out
    refresh()
  }

  function usedOf(top) {
    var at = usedTops.indexOf(top)
    return at === -1 ? 0 : usedSeq[at]
  }

  function markUsed(top) {
    if (!top || !row.enabled) return
    var t = usedTops.filter(function(x) { return x }), s = []
    for (var i = 0; i < usedTops.length; i++) if (usedTops[i]) s.push(usedSeq[i])
    var at = t.indexOf(top)
    usedCounter++
    if (at === -1) { t.push(top); s.push(usedCounter) } else s[at] = usedCounter
    usedTops = t
    usedSeq = s
    refresh()
  }

  function refresh() {
    if (!row.enabled) return
    var list = ToplevelManager.toplevels ? ToplevelManager.toplevels.values : []
    var wins = [], objs = [], seen = seenSeq, counter = seenCounter
    for (var i = 0; i < list.length; i++) {
      var app = Apps.appForWindow(list[i].appId, apps)
      var key = app ? String(app.desktopId) : ""
      if (key !== "" && seen[key] === undefined) seen[key] = ++counter
      wins.push({ key: key, name: app ? String(app.name) : "", icon: app ? String(app.icon || "") : "",
                  terminal: app ? app.terminal === true : false, seen: key !== "" ? seen[key] : 0, used: usedOf(list[i]) })
      objs.push(list[i])
    }
    seenSeq = seen
    seenCounter = counter
    tops = objs
    windows = wins
    var next = OpenApps.group(wins, { hidden: hiddenAll, trayKeys: trayKeys, showTerminals: showTerminals })
    var parts = OpenApps.split(next, limit)
    // Only replace what changed, so the icons are not rebuilt on every focus change.
    if (JSON.stringify(next) !== JSON.stringify(groups)) groups = next
    if (JSON.stringify(parts.shown) !== JSON.stringify(shown)) shown = parts.shown
    if (JSON.stringify(parts.overflow) !== JSON.stringify(overflow)) overflow = parts.overflow
  }

  function focusApp(stale) {
    var group = stale
    for (var i = 0; i < groups.length; i++) if (groups[i].key === stale.key) group = groups[i]
    var idx = OpenApps.nextWindow(group, windows, tops.indexOf(ToplevelManager.activeToplevel))
    if (tops[idx]) tops[idx].activate()
  }

  function nameOf(group) {
    return group.name + (group.windows.length > 1 ? " (" + group.windows.length + " windows)" : "")
  }

  // PopupCard closes its owner on an outside click.
  // True while any card over the row is open (its own, or the copy's settings card).
  property bool settingsOpen: false
  readonly property bool cardOpen: menuOpen || moreOpen || settingsOpen

  function close() { menuOpen = false; moreOpen = false }

  function hideIconTooltips() {
    for (var i = 0; i < iconRepeater.count; i++) bar.hideTooltip(iconRepeater.itemAt(i))
  }
  onCardOpenChanged: if (cardOpen && bar) { bar.hideTooltip(more); hideIconTooltips() }

  onEnabledChanged: if (enabled) { readApps(); refresh() }
  onHiddenAllChanged: refresh()
  onTrayKeysChanged: refresh()
  onLimitChanged: refresh()
  onShowTerminalsChanged: refresh()
  Component.onCompleted: readApps()

  readonly property alias hiddenStore: store
  HiddenStore { id: store }

  Connections {
    target: DesktopEntries.applications
    function onValuesChanged() { row.readApps() }
  }
  Connections {
    target: ToplevelManager.toplevels
    function onValuesChanged() { row.refresh() }
  }
  Connections {
    target: ToplevelManager
    function onActiveToplevelChanged() { row.markUsed(ToplevelManager.activeToplevel) }
  }

  // One app: its icon (or the neutral glyph), and a count at 2+ windows.
  component AppIcon: Item {
    id: appIcon
    required property var group
    width: row.slot
    height: row.slot
    // No tooltip while a card is open: it would sit on top of the card and take its clicks.
    readonly property bool tooltipHovered: visible && iconMouse.containsMouse && !row.cardOpen

    Image {
      id: image
      property bool failed: false
      readonly property string wanted: row.sourceFor(appIcon.group.icon)
      onWantedChanged: failed = false
      onStatusChanged: if (status === Image.Error) failed = true
      anchors.centerIn: parent
      width: row.iconSize
      height: row.iconSize
      source: failed || wanted === "" ? Qt.resolvedUrl("icons/app.svg") : wanted
      sourceSize.width: width * Math.max(2, Screen.devicePixelRatio)
      sourceSize.height: height * Math.max(2, Screen.devicePixelRatio)
      fillMode: Image.PreserveAspectFit
      smooth: true
    }

    Rectangle {
      visible: appIcon.group.windows.length > 1
      anchors.right: parent.right
      anchors.bottom: parent.bottom
      width: Math.max(height, count.implicitWidth + Style.space(4))
      height: Style.space(10)
      radius: height / 2
      color: row.badgeColor
      Text {
        id: count
        anchors.centerIn: parent
        text: String(appIcon.group.windows.length)
        color: row.badgeText
        font.family: row.fontFamily
        font.pixelSize: Style.font.caption
        font.bold: true
      }
    }

    MouseArea {
      id: iconMouse
      anchors.fill: parent
      acceptedButtons: Qt.LeftButton | Qt.RightButton
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onEntered: if (row.bar) row.bar.showTooltip(appIcon, row.nameOf(appIcon.group))
      onExited: if (row.bar) row.bar.hideTooltip(appIcon)
      onClicked: function(mouse) {
        if (mouse.button === Qt.RightButton) {
          // A second right-click on the same icon closes its menu.
          if (row.menuOpen && menuCard.anchorTarget === appIcon) { row.menuOpen = false; return }
          row.menuGroup = appIcon.group
          menuCard.anchorTarget = appIcon
          row.moreOpen = false
          row.menuOpen = true
        } else {
          row.focusApp(appIcon.group)
        }
      }
    }
  }

  Item {
    id: clipArea
    width: row.width
    height: row.height
    clip: row.drawer
    enabled: row.revealed

    Grid {
      id: grid
      x: row.drawer ? grid.implicitWidth * (1 - row.reveal) : 0
      columns: row.vertical ? 1 : row.shown.length + (row.overflow.length > 0 ? 1 : 0)
      spacing: 0

      Repeater {
        id: iconRepeater
        model: row.shown
        delegate: AppIcon { required property var modelData; group: modelData }
      }

      // +N: the apps over the limit.
      Item {
        id: more
        visible: row.overflow.length > 0
        width: visible ? row.slot : 0
        height: visible ? row.slot : 0
        readonly property bool tooltipHovered: visible && moreMouse.containsMouse && !row.cardOpen
        Text {
          anchors.centerIn: parent
          text: "+" + row.overflow.length
          color: row.foreground
          font.family: row.fontFamily
          font.pixelSize: Style.bar.iconFont
          font.bold: true
        }
        MouseArea {
          id: moreMouse
          anchors.fill: parent
          acceptedButtons: Qt.LeftButton | Qt.RightButton
          hoverEnabled: true
          cursorShape: Qt.PointingHandCursor
          onEntered: if (row.bar) row.bar.showTooltip(more, row.overflow.length + (row.overflow.length === 1 ? " more open app" : " more open apps"))
          onExited: if (row.bar) row.bar.hideTooltip(more)
          onClicked: function(mouse) {
            if (mouse.button === Qt.RightButton) {
              if (row.menuOpen && menuCard.anchorTarget === more) { row.menuOpen = false; return }
              row.menuGroup = null
              menuCard.anchorTarget = more
              row.moreOpen = false
              row.menuOpen = true
            } else {
              row.menuOpen = false
              row.moreOpen = !row.moreOpen
            }
          }
        }
      }
    }
  }

  // The +N list: click an app to focus it.
  PopupCard {
    id: moreCard
    anchorItem: more
    owner: row
    bar: row.bar
    open: row.moreOpen
    onOpenChanged: if (!open) row.moreOpen = false
    contentWidth: moreCard.fittedContentWidth(Style.space(220))
    contentHeight: moreCard.fittedContentHeight(moreColumn.implicitHeight)

    Column {
      id: moreColumn
      anchors.fill: parent
      spacing: Style.space(4)
      Repeater {
        model: row.overflow
        delegate: Item {
          required property var modelData
          width: moreColumn.width
          height: row.slot + Style.space(4)
          Row {
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.space(8)
            Image {
              id: listImage
              property bool failed: false
              readonly property string wanted: row.sourceFor(modelData.icon)
              onWantedChanged: failed = false
              onStatusChanged: if (status === Image.Error) failed = true
              width: row.iconSize
              height: row.iconSize
              source: failed || wanted === "" ? Qt.resolvedUrl("icons/app.svg") : wanted
              sourceSize.width: width * Math.max(2, Screen.devicePixelRatio)
              sourceSize.height: height * Math.max(2, Screen.devicePixelRatio)
              fillMode: Image.PreserveAspectFit
            }
            Text {
              text: row.nameOf(modelData)
              color: row.foreground
              font.family: row.fontFamily
              font.pixelSize: Style.font.body
            }
          }
          MouseArea {
            anchors.fill: parent
            cursorShape: Qt.PointingHandCursor
            onClicked: { row.moreOpen = false; row.focusApp(modelData) }
          }
        }
      }
    }
  }

  // Right-click: hide this app, and the hidden list to bring apps back.
  PopupCard {
    id: menuCard
    property Item anchorTarget: more
    anchorItem: anchorTarget
    owner: row
    bar: row.bar
    open: row.menuOpen
    onOpenChanged: if (!open) row.menuOpen = false
    contentWidth: menuCard.fittedContentWidth(Style.space(240))
    contentHeight: menuCard.fittedContentHeight(menuColumn.implicitHeight)

    Column {
      id: menuColumn
      anchors.fill: parent
      spacing: Style.space(6)

      Text {
        visible: row.menuGroup !== null
        text: row.menuGroup ? "Hide " + row.menuGroup.name + " from bar" : ""
        color: row.foreground
        font.family: row.fontFamily
        font.pixelSize: Style.font.body
        MouseArea {
          anchors.fill: parent
          cursorShape: Qt.PointingHandCursor
          onClicked: { var key = row.menuGroup.key; row.menuOpen = false; store.hide(key) }
        }
      }

      Text {
        text: "Hidden apps (" + row.hiddenAll.length + ")"
        color: Qt.darker(row.foreground, 1.4)
        font.family: row.fontFamily
        font.pixelSize: Style.font.caption
        font.bold: true
      }

      Text {
        visible: row.hiddenAll.length === 0
        text: "None"
        color: Qt.darker(row.foreground, 1.5)
        font.family: row.fontFamily
        font.pixelSize: Style.font.bodySmall
        font.italic: true
      }

      Repeater {
        model: row.hiddenAll
        delegate: Text {
          required property var modelData
          readonly property bool manual: (row.manualHidden || []).indexOf(modelData) !== -1
          readonly property var app: row.apps.filter(function(a) { return String(a.desktopId) === modelData })[0]
          text: (app ? app.name : modelData) + (manual ? "  (set in shell.json)" : "  (click to show)")
          color: manual ? Qt.darker(row.foreground, 1.5) : row.foreground
          font.family: row.fontFamily
          font.pixelSize: Style.font.bodySmall
          MouseArea {
            anchors.fill: parent
            enabled: !parent.manual
            cursorShape: Qt.PointingHandCursor
            onClicked: store.show(parent.modelData)
          }
        }
      }
    }
  }
}
