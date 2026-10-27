.pragma library

// Open apps next to the tray, as pure functions: the row hands in its windows (already
// matched to apps) and gets back what to draw. One entry per app, in first-seen order.

function isTerminal(categories) {
  if (!categories) return false
  for (var i = 0; i < categories.length; i++) if (String(categories[i]) === "TerminalEmulator") return true
  return false
}

function clampLimit(value) {
  var n = Math.floor(Number(value))
  if (isNaN(n)) return 6
  return Math.min(20, Math.max(1, n))
}

function group(windows, opts) {
  var o = opts || {}
  var hidden = o.hidden || [], tray = o.trayKeys || []
  var byKey = {}, out = []
  for (var i = 0; i < (windows || []).length; i++) {
    var win = windows[i]
    if (!win || win.key === "" || hidden.indexOf(win.key) !== -1 || tray.indexOf(win.key) !== -1) continue
    if (win.terminal && !o.showTerminals) continue
    var g = byKey[win.key]
    if (!g) {
      g = byKey[win.key] = { key: win.key, name: win.name, icon: win.icon, seen: win.seen, windows: [] }
      out.push(g)
    }
    g.windows.push(i)
  }
  out.sort(function(a, b) { return a.seen - b.seen || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) })
  return out.map(function(g) { return { key: g.key, name: g.name, icon: g.icon, windows: g.windows } })
}

function split(groups, limit) {
  var n = clampLimit(limit)
  return { shown: groups.slice(0, n), overflow: groups.slice(n) }
}

// The window a click on this app focuses: the next one when the app is already focused,
// otherwise the one used most recently.
function nextWindow(group, windows, activeIndex) {
  var list = group.windows
  var at = list.indexOf(activeIndex)
  if (at !== -1) return list[(at + 1) % list.length]
  var best = list[0]
  for (var i = 1; i < list.length; i++) if (windows[list[i]].used > windows[best].used) best = list[i]
  return best
}

function parseHidden(text) {
  var value
  try { value = JSON.parse(String(text)) } catch (e) { return [] }
  if (!(value instanceof Array)) return []
  return value.filter(function(k) { return typeof k === "string" && k !== "" })
}

function unique(list) {
  var out = []
  for (var i = 0; i < list.length; i++) if (out.indexOf(list[i]) === -1) out.push(list[i])
  return out.sort()
}

function withKey(list, key) { return unique((list || []).concat([key])) }

function withoutKey(list, key) { return unique((list || []).filter(function(k) { return k !== key })) }
