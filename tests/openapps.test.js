const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const path = require("path")
const load = require("./load")

const O = load("OpenApps.js")
const w = (key, seen, used, extra) => Object.assign({ key, name: key, icon: key + "-icon", terminal: false, seen, used }, extra || {})
const NONE = { hidden: [], trayKeys: [], showTerminals: false }

test("isTerminal and clampLimit", () => {
  assert.strictEqual(O.isTerminal(["System", "TerminalEmulator"]), true)
  assert.strictEqual(O.isTerminal(["Network"]), false)
  assert.strictEqual(O.isTerminal(undefined), false)
  assert.strictEqual(O.clampLimit(4), 4)
  assert.strictEqual(O.clampLimit(0), 1)
  assert.strictEqual(O.clampLimit(99), 20)
  assert.strictEqual(O.clampLimit("x"), 6)
  assert.strictEqual(O.clampLimit(2.7), 2)
})

test("group: one entry per app, first-seen order, window indices kept", () => {
  const wins = [w("chromium", 2, 5), w("files", 1, 0), w("chromium", 2, 9), w("", 0, 0)]
  const groups = O.group(wins, NONE)
  assert.deepStrictEqual(groups.map(g => g.key), ["files", "chromium"])
  assert.deepStrictEqual(groups[1].windows, [0, 2])
  assert.strictEqual(groups[1].icon, "chromium-icon")
})

test("group: terminals, hidden and tray apps are left out", () => {
  const wins = [w("ghostty", 1, 0, { terminal: true }), w("claude", 2, 0), w("spotify", 3, 0), w("files", 4, 0)]
  const opts = { hidden: ["spotify"], trayKeys: ["claude"], showTerminals: false }
  assert.deepStrictEqual(O.group(wins, opts).map(g => g.key), ["files"])
  assert.deepStrictEqual(O.group(wins, Object.assign({}, opts, { showTerminals: true })).map(g => g.key), ["ghostty", "files"])
})

test("split at the limit", () => {
  const groups = ["a", "b", "c", "d"].map((k, i) => ({ key: k, windows: [i] }))
  assert.deepStrictEqual(O.split(groups, 6).overflow, [])
  assert.deepStrictEqual(O.split(groups, 4).shown.map(g => g.key), ["a", "b", "c", "d"])
  const s = O.split(groups, 2)
  assert.deepStrictEqual([s.shown.map(g => g.key), s.overflow.map(g => g.key)], [["a", "b"], ["c", "d"]])
})

test("nextWindow: latest used first, then cycles", () => {
  const wins = [w("c", 1, 5), w("x", 2, 0), w("c", 1, 9), w("c", 1, 0)]
  const g = { key: "c", windows: [0, 2, 3] }
  assert.strictEqual(O.nextWindow(g, wins, 1), 2)    // another app focused: latest used
  assert.strictEqual(O.nextWindow(g, wins, 2), 3)    // focused: next in order
  assert.strictEqual(O.nextWindow(g, wins, 3), 0)    // wraps
  assert.strictEqual(O.nextWindow({ key: "z", windows: [1] }, wins, -1), 1)
})

test("hidden list helpers", () => {
  assert.deepStrictEqual(O.parseHidden('["b","a"]'), ["b", "a"])
  assert.deepStrictEqual(O.parseHidden("nope"), [])
  assert.deepStrictEqual(O.parseHidden('{"a":1}'), [])
  assert.deepStrictEqual(O.parseHidden('["a", 3]'), ["a"])
  assert.deepStrictEqual(O.withKey(["b"], "a"), ["a", "b"])
  assert.deepStrictEqual(O.withKey(["a"], "a"), ["a"])
  assert.deepStrictEqual(O.withoutKey(["a", "b"], "a"), ["b"])
})

test("OpenApps.js avoids Array.from, codePointAt and .import", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "OpenApps.js"), "utf8").replace(/\/\/.*$/gm, "")
  assert.ok(!/\b(Array\.from|codePointAt)\b|^\.import/m.test(src))
})

test("view carries no window indices and findGroup looks up by key", () => {
  const gs = O.group([w("a", 1, 0), w("b", 2, 0), w("a", 1, 0)], NONE)
  assert.deepStrictEqual(O.view(gs), [{ key: "a", name: "a", icon: "a-icon", count: 2 }, { key: "b", name: "b", icon: "b-icon", count: 1 }])
  // Closing an earlier unrelated window shifts indices but not the view.
  const after = O.group([w("a", 1, 0), w("b", 2, 0)], NONE)
  assert.deepStrictEqual(O.view(O.group([w("x", 0, 0), w("b", 2, 0)], { hidden: ["x"] })), [{ key: "b", name: "b", icon: "b-icon", count: 1 }])
  assert.strictEqual(O.findGroup(after, "b").key, "b")
  assert.strictEqual(O.findGroup(after, "gone"), null)
})
