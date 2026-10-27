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

// Generic Electron/Chromium tray ids ("chrome_status_icon_1") name no app of their own.
function isGeneric(id) {
  var lead = leadingWord(id)
  return lead === "chrome" || lead === "electron"
}

// The part of the tray id that names the app: "Claude_status_icon_1" -> "claude".
// Generic Electron ids have no key and match only by title or tooltip.
function trayKey(id) {
  if (isGeneric(id)) return ""
  var raw = String(id || "").toLowerCase()
  return normalize(raw.replace(/[-_]status[-_]icon.*$/, "").replace(/_\d+$/, ""))
}

// Containment only for strings long enough to mean something ("app" is in everything).
function contains(haystack, needle) {
  return needle.length >= 4 && haystack.indexOf(needle) !== -1
}

// Whole words of a free-text title: "Check for update" -> ["check", "for", "update"].
function titleWords(title) {
  return String(title === undefined || title === null ? "" : title).toLowerCase().split(/[^a-z0-9]+/)
}

// DesktopEntries ids carry no ".desktop" suffix, so the last dot segment is the bare name.
function lastSegment(desktopId) {
  var parts = String(desktopId || "").split(".")
  return parts[parts.length - 1]
}

// Each rule scores one app: the length of the key it matched, or 0 for no match.
// The best-scoring app wins within a rule; ties keep list order.
// Rules run in order (window class, desktop id, name) and the first rule with a match wins.
function matchApp(tray, apps) {
  var t = tray || {}
  var key = trayKey(t.id)
  var title = normalize(t.title)
  var words = titleWords(t.title)
  var tip = normalize(t.tooltipTitle)
  var word = isGeneric(t.id) ? "" : leadingWord(t.id)
  var list = (apps || []).filter(function(a) { return a && String(a.icon || "") !== "" })
  var rules = [
    function(a) {
      var w = normalize(a.wmClass)
      return (w !== "" && (w === key || contains(key, w))) ? w.length : 0
    },
    function(a) {
      var cands = [normalize(a.desktopId), normalize(lastSegment(a.desktopId))]
      var best = 0
      for (var c = 0; c < cands.length; c++) {
        var d = cands[c]
        if (d === "") continue
        if (contains(key, d)) best = Math.max(best, d.length)
        if (d.length < 4) continue  // too short to trust against free-text titles ("x", "hey")
        if (d === title) best = Math.max(best, d.length)
        for (var w = 0; w < words.length; w++)
          if (words[w] !== "" && normalize(words[w]) === d) best = Math.max(best, d.length)
      }
      return best
    },
    function(a) {
      var n = normalize(a.name)
      return (n !== "" && (n === title || n === tip || n === word)) ? n.length : 0
    }
  ]
  for (var r = 0; r < rules.length; r++) {
    var best = 0, icon = ""
    for (var i = 0; i < list.length; i++) {
      var s = rules[r](list[i])
      if (s > best) { best = s; icon = String(list[i].icon) }
    }
    if (best > 0) return icon
  }
  return ""
}
