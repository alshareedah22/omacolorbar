.pragma library

// Finds one OmaColorBar copy's layout entry in shell.json and changes only that entry.
// The shell's own inline save rewrites every OmaColorBar entry at once, so the settings
// card writes the file itself through these helpers.

var PLUGIN_ID = "blackcode.omacolorbar"
var DEFAULT_ICON = "omarchy.network"
var SECTIONS = ["left", "center", "right"]

function layoutOf(config) {
  var layout = config && config.bar ? config.bar.layout : null
  return layout && typeof layout === "object" ? layout : null
}

function iconOf(entry) {
  return entry.icon === undefined || entry.icon === null ? DEFAULT_ICON : String(entry.icon)
}

function eachCopy(config, fn) {
  var layout = layoutOf(config)
  if (!layout) return false
  for (var s = 0; s < SECTIONS.length; s++) {
    var list = layout[SECTIONS[s]]
    if (!Array.isArray(list)) continue
    for (var i = 0; i < list.length; i++) {
      var entry = list[i]
      if (entry && entry.id === PLUGIN_ID) fn(entry, SECTIONS[s], i)
    }
  }
  return true
}

function findEntry(config, icon) {
  var found = []
  var ok = eachCopy(config, function(entry, section, index) {
    if (iconOf(entry) === icon) found.push({ section: section, index: index })
  })
  if (!ok) return { error: "invalid" }
  if (found.length === 0) return { error: "none" }
  if (found.length > 1) return { error: "many" }
  return found[0]
}

function usedIcons(config) {
  var icons = []
  eachCopy(config, function(entry) { icons.push(iconOf(entry)) })
  return icons
}

function withEntryKeys(config, section, index, changes) {
  var copy = JSON.parse(JSON.stringify(config))
  var entry = copy.bar.layout[section][index]
  for (var key in changes) {
    if (key === "id") continue
    if (changes[key] === null) delete entry[key]
    else entry[key] = changes[key]
  }
  return copy
}

function serialize(config) {
  return JSON.stringify(config, null, 2) + "\n"
}
