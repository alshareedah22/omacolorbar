.pragma library

// Which installed app a tray item belongs to, so its own color icon can stand in for the
// tray image. Pure: the tray adapter hands in the tray item and the desktop entries.

// Lowercase letters and digits only: "com.anthropic.Claude" -> "comanthropicclaude".
function normalize(s) {
  return String(s === undefined || s === null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, "")
}

// "Claude_status_icon_1" -> "claude", "nm-applet" -> "nm".
function leadingWord(id) {
  var m = String(id || "").toLowerCase().match(/^[a-z0-9]+/)
  return m ? m[0] : ""
}

// Containment only for strings long enough to mean something ("app" is in everything).
function contains(haystack, needle) {
  return needle.length >= 4 && haystack.indexOf(needle) !== -1
}

function lastSegment(desktopId) {
  var parts = String(desktopId || "").split(".")
  return parts[parts.length - 1]
}

// First match wins, rule by rule over every app: window class, desktop id, name.
function matchApp(tray, apps) {
  var t = tray || {}
  var id = normalize(t.id)
  var title = normalize(t.title)
  var tip = normalize(t.tooltipTitle)
  var word = leadingWord(t.id)
  var list = (apps || []).filter(function(a) { return a && String(a.icon || "") !== "" })
  var rules = [
    function(a) { var w = normalize(a.wmClass); return w !== "" && (w === id || contains(id, w)) },
    function(a) {
      var full = normalize(a.desktopId), last = normalize(lastSegment(a.desktopId))
      return [full, last].some(function(d) { return d !== "" && (contains(id, d) || contains(title, d)) })
    },
    function(a) { var n = normalize(a.name); return n !== "" && (n === title || n === tip || n === word) }
  ]
  for (var r = 0; r < rules.length; r++)
    for (var i = 0; i < list.length; i++)
      if (rules[r](list[i])) return String(list[i].icon)
  return ""
}
