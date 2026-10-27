import QtQuick

// The shell injects its bar widget registry only into a plugin's service entry point,
// never into a bar widget. Panel.qml reads it back with bar.shell.serviceFor(), which a
// plugin may call for its own id. The other properties are the rest of what a service
// is handed; nothing here does any work.
QtObject {
  property var barWidgetRegistry: null
  property var pluginRegistry: null
  property var shell: null
  property var manifest: ({})
  property string omarchyPath: ""
}
