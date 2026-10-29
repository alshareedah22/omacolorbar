.pragma library

// Finds one OmaColorBar copy's layout entry in shell.json and changes only that entry.
// The shell's own inline save rewrites every OmaColorBar entry at once, so the settings
// card writes the file itself through these helpers.

var PLUGIN_ID = "blackcode.omacolorbar"
var DEFAULT_ICON = "omarchy.network"
var SECTIONS = ["left", "center", "right"]
// The logo copy is always the menu: it can't become another widget, and no other copy can
// become the menu (1.3: a switch from the menu to the microphone left no plain way back).
var LOCKED_ICON = "omarchy.menu"

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

function copies(config) {
  var out = []
  eachCopy(config, function(entry, section, index) { out.push({ section: section, index: index, icon: iconOf(entry) }) })
  return out
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

// Plans one save from the raw shell.json text: {next} (the text to write), {unchanged: true},
// or {error: "invalid" | "none" | "many" | "used" | "locked"}. Pure: no file access.
function planSave(raw, icon, changes) {
  var config
  try { config = JSON.parse(raw) } catch (e) { return { error: "invalid" } }
  if (!config || typeof config !== "object") return { error: "invalid" }
  var at = findEntry(config, icon)
  if (at.error) return { error: at.error }
  var target = changes ? changes.icon : undefined
  if (target !== undefined && target !== null && String(target) !== icon && (icon === LOCKED_ICON || String(target) === LOCKED_ICON))
    return { error: "locked" }
  if (target !== undefined && target !== null && String(target) !== icon && usedIcons(config).indexOf(String(target)) !== -1)
    return { error: "used" }
  var next
  try { next = serialize(withEntryKeys(config, at.section, at.index, changes || {})) } catch (e) { return { error: "invalid" } }
  return next === raw ? { unchanged: true } : { next: next }
}

// The layout with every OmaColorBar copy reduced to its id: what Undo must find unchanged.
function layoutShape(config) {
  var layout = layoutOf(config)
  var out = {}
  for (var s = 0; s < SECTIONS.length; s++) {
    var list = layout && Array.isArray(layout[SECTIONS[s]]) ? layout[SECTIONS[s]] : []
    out[SECTIONS[s]] = list.map(function(entry) {
      return entry && entry.id === PLUGIN_ID ? { id: PLUGIN_ID } : entry
    })
  }
  return JSON.stringify(out)
}

// Undo: puts the settings backup's bar layout back into the current file, keeping every
// change outside the layout. Refused ({error}) when the backup is missing ("nobackup") or
// unreadable ("invalid"), when the layout changed outside OmaColorBar copies since
// ("changed"), or when it would take the menu away ("nomenu").
function planRestore(raw, backupRaw) {
  if (backupRaw === null || backupRaw === undefined || backupRaw === "") return { error: "nobackup" }
  var config, backup
  try { config = JSON.parse(raw); backup = JSON.parse(backupRaw) } catch (e) { return { error: "invalid" } }
  if (!layoutOf(config) || !layoutOf(backup)) return { error: "invalid" }
  if (layoutShape(config) !== layoutShape(backup)) return { error: "changed" }
  if (usedIcons(config).indexOf(LOCKED_ICON) !== -1 && usedIcons(backup).indexOf(LOCKED_ICON) === -1)
    return { error: "nomenu" }
  var copy = JSON.parse(JSON.stringify(config))
  copy.bar.layout = JSON.parse(JSON.stringify(backup.bar.layout))
  var next = serialize(copy)
  return next === raw ? { unchanged: true } : { next: next }
}

// One write that sets `changes` on every OmaColorBar copy (settings that apply to all of
// them, like iconScale). `icon` is never changed here.
function planSaveAll(raw, changes) {
  var config
  try { config = JSON.parse(raw) } catch (e) { return { error: "invalid" } }
  if (!layoutOf(config)) return { error: "invalid" }
  var safe = {}
  for (var key in changes) if (key !== "icon") safe[key] = changes[key]
  var next = config
  copies(config).forEach(function(c) { next = withEntryKeys(next, c.section, c.index, safe) })
  var text = serialize(next)
  return text === raw ? { unchanged: true } : { next: text }
}
