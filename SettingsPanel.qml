import QtQuick
import QtQuick.Effects
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "Icons.js" as Icons
import "Levels.js" as Levels
import "OpenApps.js" as OpenApps
import "ShellEntry.js" as ShellEntry

// The plugin's settings panel: every OmaColorBar copy on one card, in three tabs. Opened by
// right-click on the logo, middle-click on any copy, or SUPER+CTRL+ALT+C (Service.qml).
// Writes shell.json itself (never the shell's inline save, which rewrites every copy):
// fresh read, rolling backup, atomic write. Omarchy rebuilds the bar after each save, so
// the panel asks the service to reopen it on the same tab.
PopupCard {
  id: panel

  // The Panel.qml copy this panel belongs to.
  property var copy: null
  property string tab: "Widgets"
  property var config: null
  property var entries: []
  property string message: ""
  property var pendingSwitch: null      // {icon, value} waiting for the Shift note to be confirmed
  property string search: ""
  property string logoSearch: ""
  property bool backupFailed: false
  property bool writeFailed: false

  readonly property var tabs: ["Widgets", "Appearance", "Open apps"]
  readonly property string shellPath: Quickshell.env("HOME") + "/.config/omarchy/shell.json"
  readonly property string backupPath: Quickshell.env("HOME") + "/.config/omarchy/shell.json.omacolorbar-settings-backup"
  readonly property var service: copy ? copy.service : null
  readonly property string screenName: copy ? copy.screenName : ""
  readonly property bool hasMenu: entries.some(function(e) { return e.icon === "omarchy.menu" })
  readonly property bool hasTray: entries.some(function(e) { return e.icon === "omarchy.tray" })
  readonly property var trayCopy: service ? service.copyFor("omarchy.tray", screenName) : null
  readonly property var trayApps: trayCopy && trayCopy.openApps ? trayCopy.openApps : []
  readonly property var hiddenStore: trayCopy ? trayCopy.hiddenStore : null
  readonly property color foreground: bar ? bar.foreground : Commons.Color.popups.text
  readonly property color muted: Qt.darker(foreground, 1.4)
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family

  onOpenChanged: if (open) refresh()

  function show(name) {
    tab = tabs.indexOf(name) !== -1 ? name : tab
    open = true
  }

  function refresh() {
    message = ""
    pendingSwitch = null
    var raw = readRaw(reader)
    try { config = raw === null ? null : JSON.parse(raw) } catch (e) { config = null }
    entries = config ? ShellEntry.copies(config) : []
  }

  // One copy's saved value for `key`.
  function setting(icon, key, fallback) {
    var at = entries.filter(function(e) { return e.icon === icon })[0]
    var entry = at && config ? config.bar.layout[at.section][at.index] : null
    var value = entry ? entry[key] : undefined
    return value === undefined || value === null ? fallback : value
  }

  function widgetName(id) {
    var names = {
      "omarchy.menu": "Menu", "omarchy.network": "Network", "omarchy.bluetooth": "Bluetooth",
      "omarchy.audio": "Audio", "omarchy.microphone": "Microphone", "omarchy.power": "Battery",
      "omarchy.monitor": "Monitor", "omarchy.system-update": "Updates", "omarchy.agents": "Agents",
      "omarchy.tailscale": "Tailscale", "omarchy.tray": "Tray", "omarchy.weather": "Weather"
    }
    return names[id] || id
  }

  function widgetId(name) {
    for (var i = 0; i < Icons.SUPPORTED.length; i++) if (widgetName(Icons.SUPPORTED[i]) === name) return Icons.SUPPORTED[i]
    return name
  }

  // What one copy may switch to: itself, plus widgets no other copy uses. Never the menu.
  function choicesFor(icon) {
    var used = entries.map(function(e) { return e.icon })
    return Icons.SUPPORTED.filter(function(id) {
      return id === icon || (id !== "omarchy.menu" && used.indexOf(id) === -1)
    }).map(widgetName)
  }

  // The copy's icon as the bar shows it now; widgets with nothing drawn yet (tray, weather
  // before its first fetch, battery on a desktop) get a stand-in.
  function liveSource(icon) {
    var live = service ? service.copyFor(icon, screenName) : null
    if (live && live.drawingSource) return live.drawingSource
    var standIn = { "omarchy.weather": "icons/weather-partly-day.svg", "omarchy.tray": "icons/app.svg",
                    "omarchy.power": Levels.dataUri({ kind: "battery", level: 7, charging: false, full: false }),
                    "omarchy.microphone": "icons/mic-on.svg", "omarchy.agents": "icons/agents.svg" }[icon]
    return standIn ? (standIn.indexOf("data:") === 0 ? standIn : Qt.resolvedUrl(standIn)) : ""
  }

  function readRaw(view) {
    try {
      view.reload()
      return String(view.text())
    } catch (e) { return null }
  }

  function errorText(code) {
    return code === "used" ? "That widget is already on the bar"
      : code === "locked" ? "The logo is always the menu"
      : code === "invalid" ? "shell.json can't be read"
      : code === "nobackup" ? "Nothing to undo yet"
      : code === "changed" ? "The bar changed outside OmaColorBar since the last change; open shell.json to undo by hand"
      : code === "nomenu" ? "Undo would remove the menu logo; open shell.json to undo by hand"
      : "Edit shell.json: this copy can't be found uniquely"
  }

  // Runs one plan (raw text -> {next} | {unchanged} | {error}) and writes the result.
  function write(planner) {
    try {
      var raw = readRaw(reader)
      if (raw === null || raw === "") { message = "shell.json can't be read"; return false }
      var plan = planner(raw)
      if (plan.error) { message = errorText(plan.error); return false }
      if (plan.unchanged) { message = ""; return true }
      // A FileView skips a write whose text equals what it holds, so the backup is only skipped
      // when it already holds exactly `raw`.
      if (readRaw(backup) !== raw) {
        backupFailed = false
        backup.setText(raw)
        if (!backup.waitForJob() || backupFailed) { message = "Could not back up shell.json"; return false }
      }
      if (service) service.reopenLater(tab, screenName, copy ? copy.hostId : "")
      writeFailed = false
      message = ""
      reader.setText(plan.next)
      if (!reader.waitForJob() || writeFailed) {
        if (service) service.reopenLater("", "", "")
        if (message === "") message = "Could not write shell.json"
        return false
      }
      forgetReopen.restart()
      refresh()
      return true
    } catch (e) {
      message = "Could not save: " + e
      return false
    }
  }

  function save(icon, changes) { return write(function(raw) { return ShellEntry.planSave(raw, icon, changes) }) }
  function saveAll(changes) { return write(function(raw) { return ShellEntry.planSaveAll(raw, changes) }) }
  function undo() {
    var backupRaw = readRaw(backup)
    write(function(raw) { return ShellEntry.planRestore(raw, backupRaw) })
  }

  function choose(icon, name) {
    var value = widgetId(name)
    if (value === icon) return
    if (value === "omarchy.microphone" || value === "omarchy.agents") { pendingSwitch = { icon: icon, value: value }; return }
    save(icon, { icon: value })
  }

  // The bar was not rebuilt (nothing changed on screen): drop the reopen request.
  property Timer forgetReopen: Timer {
    interval: 1500
    onTriggered: if (panel.service && panel.service.pendingTab !== "") panel.service.reopenLater("", "", "")
  }

  // PopupCard's default property only takes visual items, so the file views are properties.
  property FileView reader: FileView {
    path: panel.shellPath
    blockAllReads: true
    preload: false
    atomicWrites: true
    printErrors: false
    onSaveFailed: function(error) { panel.writeFailed = true; panel.message = "Could not write shell.json: " + FileViewError.toString(error) }
  }
  property FileView backup: FileView { path: panel.backupPath; blockAllReads: true; atomicWrites: true; preload: false; printErrors: false; onSaveFailed: function(error) { panel.backupFailed = true } }

  contentWidth: panel.fittedContentWidth(Style.space(400))
  contentHeight: panel.fittedContentHeight(column.implicitHeight)

  component Caption: Text {
    color: panel.muted
    font.family: panel.fontFamily
    font.pixelSize: Style.font.caption
    font.bold: true
  }

  component Body: Text {
    color: panel.foreground
    font.family: panel.fontFamily
    font.pixelSize: Style.font.body
    wrapMode: Text.Wrap
  }

  component Logo: Image {
    property bool themed: false
    sourceSize.width: width * Math.max(2, Screen.devicePixelRatio)
    sourceSize.height: height * Math.max(2, Screen.devicePixelRatio)
    fillMode: Image.PreserveAspectFit
    smooth: true
    // Black brand logos: drawn in the text color so they show on a dark card.
    layer.enabled: themed
    layer.effect: MultiEffect { brightness: 1.0; colorization: 1.0; colorizationColor: panel.foreground }
  }

  Column {
    id: column
    width: parent.width
    spacing: Style.space(10)

    Row {
      spacing: Style.space(8)
      Logo {
        width: Style.space(22)
        height: width
        anchors.verticalCenter: parent.verticalCenter
        source: Qt.resolvedUrl("icons/menu-omarchy.svg")
      }
      Text {
        anchors.verticalCenter: parent.verticalCenter
        text: "OmaColorBar"
        color: panel.foreground
        font.family: panel.fontFamily
        font.pixelSize: Style.font.title
        font.bold: true
      }
    }

    ButtonGroup {
      width: parent.width
      options: panel.tabs
      value: panel.tab
      onChanged: function(value) { panel.tab = value; panel.message = ""; panel.pendingSwitch = null }
    }

    // ---- Widgets -------------------------------------------------------------------------
    Column {
      visible: panel.tab === "Widgets"
      width: parent.width
      spacing: Style.space(8)

      Repeater {
        model: ["left", "center", "right"]
        delegate: Column {
          required property var modelData
          readonly property var here: panel.entries.filter(function(e) { return e.section === modelData })
          visible: here.length > 0
          width: parent.width
          spacing: Style.space(6)

          Caption { text: parent.modelData.charAt(0).toUpperCase() + parent.modelData.slice(1) }

          Repeater {
            model: parent.here
            delegate: Item {
              required property var modelData
              width: column.width
              height: Math.max(Style.spacing.controlHeight, rowIcon.height)

              Logo {
                id: rowIcon
                width: Style.space(22)
                height: width
                anchors.verticalCenter: parent.verticalCenter
                source: panel.liveSource(parent.modelData.icon)
                themed: parent.modelData.icon === "omarchy.menu" && Icons.logoFor(panel.setting("omarchy.menu", "menuLogo", "Omarchy")).themed === true
              }

              Body {
                visible: parent.modelData.icon === "omarchy.menu"
                anchors.left: rowIcon.right
                anchors.leftMargin: Style.space(10)
                anchors.verticalCenter: parent.verticalCenter
                text: "Menu  ·  locked"
              }

              Dropdown {
                visible: parent.modelData.icon !== "omarchy.menu"
                anchors.left: rowIcon.right
                anchors.leftMargin: Style.space(10)
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter
                showLabel: false
                value: panel.widgetName(parent.modelData.icon)
                options: panel.choicesFor(parent.modelData.icon)
                onChanged: function(value) { panel.choose(parent.modelData.icon, value) }
              }
            }
          }
        }
      }

      // Switching to a widget that uses middle-click itself: say how to get back first.
      Column {
        visible: panel.pendingSwitch !== null
        width: parent.width
        spacing: Style.space(6)
        Body {
          width: parent.width
          text: panel.pendingSwitch ? panel.widgetName(panel.pendingSwitch.value)
            + " uses middle-click itself. Settings on that icon open with Shift+middle-click, right-click on the logo, or SUPER+CTRL+ALT+C." : ""
        }
        Row {
          spacing: Style.space(8)
          Button {
            text: "Switch"
            onClicked: { var p = panel.pendingSwitch; panel.pendingSwitch = null; panel.save(p.icon, { icon: p.value }) }
          }
          Button { text: "Cancel"; onClicked: panel.pendingSwitch = null }
        }
      }

      Body {
        visible: panel.entries.length === 0
        width: parent.width
        text: "No OmaColorBar copies on the bar. Add them in Omarchy's bar settings, or run colorbar swap."
      }

      Button {
        text: "Undo last change"
        onClicked: panel.undo()
      }
    }

    // ---- Appearance ----------------------------------------------------------------------
    Column {
      visible: panel.tab === "Appearance"
      width: parent.width
      spacing: Style.space(8)

      Caption { visible: panel.hasMenu; text: "Logo" }

      TextField {
        visible: panel.hasMenu
        width: parent.width
        placeholderText: "Search " + Icons.LOGOS.length + " logos"
        onTextChanged: panel.logoSearch = text.toLowerCase()
      }

      Grid {
        id: logoGrid
        visible: panel.hasMenu
        columns: 7
        spacing: Style.space(6)
        readonly property real tile: (column.width - spacing * (columns - 1)) / columns
        readonly property string current: Icons.logoFor(panel.setting("omarchy.menu", "menuLogo", "Omarchy")).name

        Repeater {
          model: Icons.LOGOS
          delegate: Rectangle {
            required property var modelData
            readonly property bool chosen: modelData.name === logoGrid.current
            visible: panel.logoSearch === "" || modelData.name.toLowerCase().indexOf(panel.logoSearch) !== -1
            width: logoGrid.tile
            height: logoGrid.tile
            radius: Style.space(6)
            color: tileHover.hovered || chosen ? Qt.rgba(panel.foreground.r, panel.foreground.g, panel.foreground.b, 0.10) : "transparent"
            border.width: chosen ? Math.max(1, Style.space(2)) : 0
            border.color: Commons.Color.accent

            Logo {
              anchors.horizontalCenter: parent.horizontalCenter
              y: parent.height * 0.14
              width: parent.width * 0.46
              height: width
              source: Qt.resolvedUrl("icons/" + parent.modelData.file + ".svg")
              themed: parent.modelData.themed === true
            }
            Text {
              anchors.horizontalCenter: parent.horizontalCenter
              anchors.bottom: parent.bottom
              anchors.bottomMargin: parent.height * 0.08
              width: parent.width - Style.space(4)
              horizontalAlignment: Text.AlignHCenter
              elide: Text.ElideRight
              text: parent.modelData.name
              color: panel.foreground
              font.family: panel.fontFamily
              font.pixelSize: Style.font.caption
            }
            HoverHandler { id: tileHover; cursorShape: Qt.PointingHandCursor }
            TapHandler { onTapped: if (!parent.chosen) panel.save("omarchy.menu", { menuLogo: parent.modelData.name }) }
          }
        }
      }

      NumberField {
        label: "Icon size %"
        from: 80
        to: 130
        stepSize: 5
        value: Math.max(80, Math.min(130, Number(panel.setting(panel.entries.length > 0 ? panel.entries[0].icon : "", "iconScale", 100)) || 100))
        onModified: function(value) { panel.saveAll({ iconScale: Math.max(80, Math.min(130, value)) }) }
      }
    }

    // ---- Open apps -----------------------------------------------------------------------
    Column {
      visible: panel.tab === "Open apps"
      width: parent.width
      spacing: Style.space(8)

      Body {
        visible: !panel.hasTray
        width: parent.width
        text: "Open apps live in the tray. Switch a copy to Tray on the Widgets tab to use them."
      }

      Row {
        visible: panel.hasTray
        spacing: Style.space(8)
        ToggleSwitch {
          checked: panel.setting("omarchy.tray", "openApps", true) === true
          onToggled: panel.save("omarchy.tray", { openApps: !checked })
        }
        Body { text: "Open apps"; anchors.verticalCenter: parent.verticalCenter }
      }

      NumberField {
        visible: panel.hasTray
        label: "Apps shown"
        from: 1
        to: 20
        value: OpenApps.clampLimit(panel.setting("omarchy.tray", "openAppsLimit", 6))
        onModified: function(value) { panel.save("omarchy.tray", { openAppsLimit: OpenApps.clampLimit(value) }) }
      }

      Row {
        visible: panel.hasTray
        spacing: Style.space(8)
        ToggleSwitch {
          checked: panel.setting("omarchy.tray", "showTerminals", false) === true
          onToggled: panel.save("omarchy.tray", { showTerminals: !checked })
        }
        Body { text: "Show terminals"; anchors.verticalCenter: parent.verticalCenter }
      }

      Caption { visible: panel.hasTray; text: "Hidden apps" }

      TextField {
        id: searchField
        visible: panel.hasTray && hiddenList.count > 4
        width: parent.width
        placeholderText: "Search hidden apps"
        onTextChanged: panel.search = text.toLowerCase()
      }

      Body {
        visible: panel.hasTray && hiddenList.count === 0
        text: "None. Right-click an open app to hide it."
        color: panel.muted
      }

      Repeater {
        id: hiddenList
        readonly property var manual: {
          var m = panel.setting("omarchy.tray", "hiddenApps", [])
          return Array.isArray(m) ? m : []
        }
        model: panel.hasTray && panel.hiddenStore ? OpenApps.withoutKey(panel.hiddenStore.keys.concat(manual), "") : []
        delegate: Item {
          required property var modelData
          readonly property bool manual: hiddenList.manual.indexOf(modelData) !== -1
          readonly property var app: panel.trayApps.filter(function(a) { return String(a.desktopId) === modelData })[0]
          readonly property string label: app ? String(app.name) : String(modelData)
          visible: panel.search === "" || label.toLowerCase().indexOf(panel.search) !== -1
          width: column.width
          height: visible ? Math.max(appName.implicitHeight, showButton.implicitHeight, Style.space(22)) : 0

          Image {
            id: appIcon
            width: Style.space(20)
            height: width
            anchors.verticalCenter: parent.verticalCenter
            source: parent.app && parent.app.icon ? (String(parent.app.icon).charAt(0) === "/" ? "file://" + parent.app.icon : Quickshell.iconPath(String(parent.app.icon), true)) : Qt.resolvedUrl("icons/app.svg")
            sourceSize.width: width * Math.max(2, Screen.devicePixelRatio)
            sourceSize.height: height * Math.max(2, Screen.devicePixelRatio)
            fillMode: Image.PreserveAspectFit
            smooth: true
          }
          Text {
            id: appName
            anchors.left: appIcon.right
            anchors.leftMargin: Style.space(8)
            anchors.right: showButton.left
            anchors.verticalCenter: parent.verticalCenter
            elide: Text.ElideRight
            text: parent.label + (parent.manual ? "  (set in shell.json)" : "")
            color: panel.foreground
            font.family: panel.fontFamily
            font.pixelSize: Style.font.bodySmall
          }
          Button {
            id: showButton
            visible: !parent.manual
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            text: "Show"
            onClicked: panel.hiddenStore.show(parent.modelData)
          }
        }
      }
    }

    Text {
      visible: panel.message !== ""
      width: parent.width
      wrapMode: Text.Wrap
      text: panel.message
      color: Commons.Color.urgent
      font.family: panel.fontFamily
      font.pixelSize: Style.font.bodySmall
    }

    Row {
      spacing: Style.space(8)
      Button {
        text: "Open shell.json"
        onClicked: { Quickshell.execDetached(["omarchy-launch-editor", panel.shellPath]); panel.close() }
      }
      Text {
        anchors.verticalCenter: parent.verticalCenter
        text: "SUPER+CTRL+ALT+C"
        color: panel.muted
        font.family: panel.fontFamily
        font.pixelSize: Style.font.caption
      }
    }
  }
}
