import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "Icons.js" as Icons
import "OpenApps.js" as OpenApps
import "ShellEntry.js" as ShellEntry

// Middle-click card: this copy's settings, saved straight into its own shell.json entry.
// The shell's inline save would rewrite every OmaColorBar copy, so the card finds its own
// entry (ShellEntry.findEntry), backs the file up, and writes it atomically.
PopupCard {
  id: card

  property string icon: ""
  property var settings: ({})
  property var hiddenStore: null
  property var apps: []
  property var manualHidden: []
  property string message: ""

  readonly property string shellPath: Quickshell.env("HOME") + "/.config/omarchy/shell.json"
  readonly property bool isMenu: icon === "omarchy.menu"
  readonly property bool isTray: icon === "omarchy.tray"
  readonly property color foreground: bar ? bar.foreground : Commons.Color.popups.text
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family

  function setting(name, fallback) {
    var value = settings ? settings[name] : undefined
    return value === undefined || value === null ? fallback : value
  }

  // Widgets this copy may switch to: its own, plus any not already used by another copy.
  function widgetOptions() {
    var config = readConfig()
    var used = config ? ShellEntry.usedIcons(config) : []
    return Icons.SUPPORTED.filter(function(id) { return id === card.icon || used.indexOf(id) === -1 })
  }

  function readConfig() {
    try {
      reader.reload()
      return JSON.parse(reader.text())
    } catch (e) { return null }
  }

  // Writes `changes` into this copy's entry only. Returns true when the file was written.
  function save(changes) {
    try {
      var config = readConfig()
      if (!config) { message = "shell.json can't be read"; return false }
      var at = ShellEntry.findEntry(config, icon)
      if (at.error) { message = "Edit shell.json: this copy can't be found uniquely"; return false }
      var next = ShellEntry.serialize(ShellEntry.withEntryKeys(config, at.section, at.index, changes))
      backup.setText(reader.text())
      if (!backup.waitForJob()) { message = "Could not back up shell.json"; return false }
      writer.setText(next)
      if (!writer.waitForJob()) { message = "Could not write shell.json"; return false }
      message = ""
      return true
    } catch (e) {
      message = "Could not save: " + e
      return false
    }
  }

  // PopupCard's default property only takes visual items, so the file views are properties.
  property FileView reader: FileView { path: card.shellPath; blockLoading: true; printErrors: false }
  property FileView backup: FileView { path: Quickshell.env("HOME") + "/.config/omarchy/shell.json.omacolorbar-settings-backup"; atomicWrites: true; printErrors: false }
  property FileView writer: FileView {
    path: card.shellPath
    atomicWrites: true
    printErrors: false
    onSaveFailed: function(error) { card.message = "Could not write shell.json: " + FileViewError.toString(error) }
  }

  contentWidth: card.fittedContentWidth(Style.space(300))
  contentHeight: card.fittedContentHeight(column.implicitHeight)

  Column {
    id: column
    width: parent.width
    spacing: Style.space(10)

    Text {
      text: "OmaColorBar"
      color: card.foreground
      font.family: card.fontFamily
      font.pixelSize: Style.font.title
      font.bold: true
    }

    Dropdown {
      width: parent.width
      label: "Widget"
      value: card.icon
      options: card.open ? card.widgetOptions() : [card.icon]
      onChanged: function(value) { if (value !== card.icon && card.save({ icon: value })) card.close() }
    }

    ButtonGroup {
      visible: card.isMenu
      options: ["Omarchy", "Arch"]
      value: String(card.setting("menuLogo", "Omarchy"))
      onChanged: function(value) { card.save({ menuLogo: value }) }
    }

    Row {
      visible: card.isTray
      spacing: Style.space(8)
      ToggleSwitch {
        checked: card.setting("openApps", true) === true
        onToggled: card.save({ openApps: !checked })
      }
      Text { text: "Open apps"; color: card.foreground; font.family: card.fontFamily; font.pixelSize: Style.font.body; anchors.verticalCenter: parent.verticalCenter }
    }

    NumberField {
      visible: card.isTray
      label: "Apps shown"
      from: 1
      to: 20
      value: OpenApps.clampLimit(card.setting("openAppsLimit", 6))
      onModified: function(value) { card.save({ openAppsLimit: OpenApps.clampLimit(value) }) }
    }

    Row {
      visible: card.isTray
      spacing: Style.space(8)
      ToggleSwitch {
        checked: card.setting("showTerminals", false) === true
        onToggled: card.save({ showTerminals: !checked })
      }
      Text { text: "Show terminals"; color: card.foreground; font.family: card.fontFamily; font.pixelSize: Style.font.body; anchors.verticalCenter: parent.verticalCenter }
    }

    Text {
      visible: card.isTray
      text: "Hidden apps"
      color: Qt.darker(card.foreground, 1.4)
      font.family: card.fontFamily
      font.pixelSize: Style.font.caption
      font.bold: true
    }

    Repeater {
      model: card.isTray && card.hiddenStore ? OpenApps.withoutKey(card.hiddenStore.keys.concat(card.manualHidden || []), "") : []
      delegate: Item {
        required property var modelData
        readonly property bool manual: (card.manualHidden || []).indexOf(modelData) !== -1
        readonly property var app: card.apps.filter(function(a) { return String(a.desktopId) === modelData })[0]
        width: column.width
        height: Math.max(name.implicitHeight, showButton.implicitHeight)
        Text {
          id: name
          anchors.verticalCenter: parent.verticalCenter
          text: (parent.app ? parent.app.name : parent.modelData) + (parent.manual ? "  (set in shell.json)" : "")
          color: card.foreground
          font.family: card.fontFamily
          font.pixelSize: Style.font.bodySmall
        }
        Button {
          id: showButton
          visible: !parent.manual
          anchors.right: parent.right
          anchors.verticalCenter: parent.verticalCenter
          text: "Show"
          onClicked: card.hiddenStore.show(parent.modelData)
        }
      }
    }

    Text {
      visible: card.message !== ""
      width: parent.width
      wrapMode: Text.Wrap
      text: card.message
      color: Commons.Color.urgent
      font.family: card.fontFamily
      font.pixelSize: Style.font.bodySmall
    }

    Button {
      text: "Open shell.json"
      onClicked: { Quickshell.execDetached(["omarchy-launch-editor", card.shellPath]); card.close() }
    }
  }
}
