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
  readonly property var hiddenManual: Array.isArray(manualHidden) ? manualHidden : []
  readonly property color foreground: bar ? bar.foreground : Commons.Color.popups.text
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family

  function setting(name, fallback) {
    var value = settings ? settings[name] : undefined
    return value === undefined || value === null ? fallback : value
  }

  property var widgetChoices: [icon]
  property bool backupFailed: false
  property bool writeFailed: false

  onOpenChanged: if (open) widgetChoices = widgetOptions()

  // Widgets this copy may switch to: its own, plus any not already used by another copy.
  function widgetOptions() {
    var raw = readRaw()
    var config = null
    try { config = raw === null ? null : JSON.parse(raw) } catch (e) { config = null }
    var used = config ? ShellEntry.usedIcons(config) : []
    return Icons.SUPPORTED.filter(function(id) { return id === card.icon || used.indexOf(id) === -1 })
  }

  // The file's current text (a fresh read), or null when it can't be read.
  function readRaw() {
    try {
      reader.reload()
      return String(reader.text())
    } catch (e) { return null }
  }

  // True when the rolling backup file already holds exactly `raw` (a missing file holds nothing).
  function backupHolds(raw) {
    try {
      backup.reload()
      return String(backup.text()) === raw
    } catch (e) { return false }
  }

  // After a failed save the controls show the saved values again (they assign their own value).
  function resetControls() {
    widgetDropdown.value = card.icon
    limitField.value = OpenApps.clampLimit(card.setting("openAppsLimit", 6))
  }

  // Writes `changes` into this copy's entry only. Returns true when nothing is left to do.
  function save(changes) {
    try {
      var raw = readRaw()
      if (raw === null || raw === "") { message = "shell.json can't be read"; return false }
      var plan = ShellEntry.planSave(raw, icon, changes)
      if (plan.error) {
        message = plan.error === "used" ? "That widget is already on the bar"
          : plan.error === "invalid" ? "shell.json can't be read"
          : "Edit shell.json: this copy can't be found uniquely"
        return false
      }
      if (plan.unchanged) { message = ""; return true }
      // A FileView skips a write whose text equals what it holds, so the backup is only skipped
      // when the file on disk (read fresh, another copy may have rewritten it) is exactly `raw`.
      // The main file is written through the reader, which holds `raw` and so always writes `plan.next`.
      if (!backupHolds(raw)) {
        backupFailed = false
        backup.setText(raw)
        if (!backup.waitForJob() || backupFailed) { message = "Could not back up shell.json"; return false }
      }
      writeFailed = false
      message = ""
      reader.setText(plan.next)
      if (!reader.waitForJob() || writeFailed) {
        if (message === "") message = "Could not write shell.json"
        return false
      }
      message = ""
      return true
    } catch (e) {
      message = "Could not save: " + e
      return false
    }
  }

  // PopupCard's default property only takes visual items, so the file views are properties.
  property FileView reader: FileView {
    path: card.shellPath
    blockAllReads: true
    preload: false
    atomicWrites: true
    printErrors: false
    onSaveFailed: function(error) { card.writeFailed = true; card.message = "Could not write shell.json: " + FileViewError.toString(error) }
  }
  property FileView backup: FileView { path: Quickshell.env("HOME") + "/.config/omarchy/shell.json.omacolorbar-settings-backup"; blockAllReads: true; atomicWrites: true; preload: false; printErrors: false; onSaveFailed: function(error) { card.backupFailed = true } }

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
      id: widgetDropdown
      width: parent.width
      label: "Widget"
      value: card.icon
      options: card.widgetChoices
      onChanged: function(value) {
        if (value === card.icon) return
        if (card.save({ icon: value })) card.close(); else card.resetControls()
      }
    }

    Text {
      visible: card.isMenu
      text: "Menu logo"
      color: Qt.darker(card.foreground, 1.4)
      font.family: card.fontFamily
      font.pixelSize: Style.font.caption
      font.bold: true
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
      id: limitField
      visible: card.isTray
      label: "Apps shown"
      from: 1
      to: 20
      value: OpenApps.clampLimit(card.setting("openAppsLimit", 6))
      onModified: function(value) { if (!card.save({ openAppsLimit: OpenApps.clampLimit(value) })) card.resetControls() }
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
      model: card.isTray && card.hiddenStore ? OpenApps.withoutKey(card.hiddenStore.keys.concat(card.hiddenManual), "") : []
      delegate: Item {
        required property var modelData
        readonly property bool manual: card.hiddenManual.indexOf(modelData) !== -1
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
