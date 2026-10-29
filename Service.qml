import QtQuick
import Quickshell
import Quickshell.Hyprland
import Quickshell.Io

// The shell injects its bar widget registry only into a plugin's service entry point,
// never into a bar widget. Panel.qml reads it back with bar.shell.serviceFor(), which a
// plugin may call for its own id.
//
// The service also outlives the bar: Omarchy rebuilds every bar widget after a settings
// save, so the copies register here, and the settings panel asks to be reopened on the
// same tab (`pendingTab`) by the copy that replaces it.
QtObject {
  id: service

  property var barWidgetRegistry: null
  property var pluginRegistry: null
  property var shell: null
  property var manifest: ({})
  property string omarchyPath: ""

  // Live copies (Panel.qml items), one per widget per monitor.
  property var copies: []
  // Tab to reopen after a save rebuilds the bar ("" = none), on which copy and screen: the
  // panel comes back exactly where it was.
  property string pendingTab: ""
  property string pendingScreen: ""
  property string pendingHost: ""

  function register(copy) {
    if (copies.indexOf(copy) === -1) copies = copies.concat([copy])
  }

  function unregister(copy) {
    copies = copies.filter(function(c) { return c !== copy })
  }

  // The copy hosting `hostId`, on `screenName` when there is one there, else the first.
  function copyFor(hostId, screenName) {
    var match = copies.filter(function(c) { return c && c.hostId === hostId })
    var here = match.filter(function(c) { return c.screenName === screenName })
    return here.length > 0 ? here[0] : (match.length > 0 ? match[0] : null)
  }

  function focusedScreen() {
    var monitor = Hyprland.focusedMonitor
    return monitor ? String(monitor.name) : ""
  }

  // The copy whose panel the keyboard opens: the logo on the focused monitor, else any copy.
  function panelCopy() {
    var copy = copyFor("omarchy.menu", focusedScreen())
    return copy || (copies.length > 0 ? copies[0] : null)
  }

  function reopenLater(tab, screenName, hostId) {
    pendingTab = tab
    pendingScreen = screenName || ""
    pendingHost = hostId || ""
  }

  // Called by each new copy once it knows its screen. Only the copy that hosts the same
  // widget on the same screen takes the request: copies register in no fixed order, so
  // "the first menu copy" could be the one on another monitor.
  function takePending(copy) {
    if (pendingTab === "" || !copy || copy.screenName === "") return ""
    if (copy.hostId !== pendingHost || copy.screenName !== pendingScreen) return ""
    var tab = pendingTab
    pendingTab = ""
    return tab
  }

  // No setup step for the user: `omarchy plugin add ... --enable` puts one bare entry on the
  // bar, which starts this service, and `colorbar setup` turns every supported built-in into
  // a color copy and adds SUPER+CTRL+ALT+C when that key is free. It changes nothing once a
  // copy has an icon, so it is safe on every start.
  property Process setup: Process {
    command: ["python3", "-I", decodeURIComponent(String(Qt.resolvedUrl("colorbar")).replace(/^file:\/\//, "")), "setup"]
    stdout: StdioCollector { onStreamFinished: if (text.trim() !== "already set up") console.info("OmaColorBar: " + text.trim()) }
    stderr: StdioCollector { onStreamFinished: if (text.trim() !== "") console.warn("OmaColorBar: " + text.trim()) }
  }

  Component.onCompleted: setup.running = true

  // SUPER+CTRL+ALT+C (colorbar bind) runs:
  //   qs -p /usr/share/omarchy/shell ipc call omacolorbar toggleSettings
  property IpcHandler ipc: IpcHandler {
    target: "omacolorbar"

    function toggleSettings(): string {
      var copy = service.panelCopy()
      if (!copy) return "no OmaColorBar copy on the bar"
      copy.toggleSettings("")
      return "ok"
    }

    // Opens the panel on one tab: Widgets, Appearance or Open apps.
    function openTab(tab: string): string {
      var copy = service.panelCopy()
      if (!copy) return "no OmaColorBar copy on the bar"
      copy.openSettings(tab)
      return "ok"
    }
  }
}
