const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const path = require("path")
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8")

// Open apps live in the tray drawer on a horizontal bar (spec: "Change 2026-10-27").
test("Panel.qml follows the hosted tray's reveal and drawer", () => {
  const src = read("Panel.qml")
  for (const s of ["tray.revealProgress", "tray.drawerCount", "tray.allItems", "tray.expanded = true",
                   "function onExpandedChanged()"])
    assert.ok(src.indexOf(s) !== -1, s)
})

test("Panel.qml has a keepOpen HoverHandler over the whole copy", () => {
  const src = read("Panel.qml")
  assert.ok(/HoverHandler\s*\{\s*id:\s*keepOpen/.test(src))
  assert.ok(src.indexOf("keepOpen.hovered") !== -1)
})

test("Panel.qml always draws its own chevron in drawer mode", () => {
  const src = read("Panel.qml")
  assert.ok(src.indexOf('text: "\\uf053"') !== -1, "the Omarchy chevron glyph")
  assert.ok(/id:\s*ownChevronButton/.test(src))
  assert.ok(/Behavior on ownProgress\s*\{\s*NumberAnimation\s*\{\s*duration:\s*600;\s*easing\.type:\s*Easing\.OutCubic/.test(src),
            "same animation as Tray.qml")
  assert.ok(/readonly property bool ownChevron:\s*drawerActive && \(!trayChevron \|\| trayChevronItem !== null\)/.test(src),
            "own chevron whenever the tray's is hidden or absent")
  assert.ok(/chevronX:\s*ownChevron \? \(rowWidth \+ trayDrawer\) \* \(1 - reveal\)/.test(src), "x = (R + D)(1 - p)")
  assert.ok(src.indexOf("x: root.chevronX") !== -1)
})

test("Panel.qml hides the hosted tray's chevron and gives it back", () => {
  const src = read("Panel.qml")
  assert.ok(/function findChevron\(item, depth\)/.test(src))
  assert.ok(src.indexOf('item.text === "\\uf053"') !== -1, "found by its glyph")
  assert.ok(src.indexOf("found.visible = false") !== -1)
  assert.ok(src.indexOf("trayChevronItem.visible = true") !== -1, "restored when not leading")
  assert.ok(/id:\s*chevronRetry/.test(src), "retries while the tray's Loader builds")
  assert.ok(src.indexOf("tray.drawerExtent") !== -1)
})

test("right-click on our chevron toggles the tray's managePopupOpen", () => {
  const src = read("Panel.qml")
  assert.ok(/button === Qt\.RightButton && root\.tray[^\n]*\n\s*root\.tray\.managePopupOpen = !root\.tray\.managePopupOpen/.test(src))
})

test("open apps sit right of our chevron, clipped to R * p", () => {
  const src = read("Panel.qml")
  assert.ok(src.indexOf("root.ownChevron ? root.chevronX + root.chevronWidth") !== -1)
  assert.ok(src.indexOf("width: root.ownChevron ? root.rowWidth * root.reveal : implicitWidth") !== -1)
  assert.ok(src.indexOf("alignLeft: root.ownChevron") !== -1)
})

test("OpenAppsRow.qml clips and slides its icons in drawer mode", () => {
  const src = read("OpenAppsRow.qml")
  assert.ok(src.indexOf("clip: row.drawer") !== -1)
  assert.ok(src.indexOf("enabled: row.revealed") !== -1, "nothing takes input while hidden")
  assert.ok(/x:\s*row\.drawer && !row\.alignLeft \? grid\.implicitWidth \* \(1 - row\.reveal\)/.test(src))
})

test("middle-click: card over our chevron and open apps, tray otherwise", () => {
  const src = read("Panel.qml")
  assert.ok(src.indexOf("if (!shift && !root.overOwn(mouse.x))") !== -1)
  assert.ok(src.indexOf("mouse.x >= root.areaWidth") !== -1, "fallback layout kept")
  assert.ok(src.indexOf("var inArea = keepOpen.hovered && root.overOwn(keepOpen.point.position.x)") !== -1,
            "keep-open reads the hover handler directly")
})

// Geometry check (spec "Order change"): pure arithmetic of the formulas in Panel.qml.
test("drawer geometry: no gap, no overlap, collapsed shows only < + pinned", () => {
  const layout = (R, C, D, p) => {
    const chevronX = (R + D) * (1 - p)
    const clipStart = chevronX + C, clipEnd = clipStart + R * p
    const trayX = R                                // tray has its own < slot
    const trayAppsStart = trayX + C + D * (1 - p)  // trayClip at C, items at D(1 - p)
    return { chevronX, clipStart, clipEnd, trayAppsStart, hiddenTrayChevron: trayX + D * (1 - p) }
  }
  const c = layout(54, 27, 27, 0), e = layout(54, 27, 27, 1), m = layout(54, 27, 27, 0.4)
  assert.strictEqual(c.chevronX, c.hiddenTrayChevron, "collapsed on the tray's hidden <")
  assert.strictEqual(c.clipEnd - c.clipStart, 0)
  assert.strictEqual(e.chevronX, 0)
  for (const g of [c, e, m]) assert.ok(Math.abs(g.clipEnd - g.trayAppsStart) < 1e-9, "open apps end where tray apps start")
  assert.strictEqual(e.clipStart, 27)
  assert.strictEqual(e.clipEnd, 81)
})
