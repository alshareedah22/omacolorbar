const test = require("node:test")
const assert = require("node:assert")
const fs = require("fs")
const path = require("path")
const load = require("./load")

const A = load("Apps.js")

const APPS = [
  { name: "Claude Code URL Handler", icon: "", wmClass: "", desktopId: "claude-code-url-handler" },
  { name: "Claude", icon: "claude-desktop", wmClass: "com.anthropic.Claude", desktopId: "com.anthropic.Claude" },
  { name: "ChatGPT", icon: "chatgpt", wmClass: "", desktopId: "chatgpt" },
  { name: "Steam", icon: "steam", wmClass: "steam", desktopId: "steam" },
  { name: "Files", icon: "org.gnome.Nautilus", wmClass: "org.gnome.Nautilus", desktopId: "org.gnome.Nautilus" },
  { name: "App", icon: "/opt/app/icon.png", wmClass: "", desktopId: "app" }
]

test("normalize and leadingWord", () => {
  assert.strictEqual(A.normalize("Com.Anthropic-Claude_1"), "comanthropicclaude1")
  assert.strictEqual(A.normalize(undefined), "")
  assert.strictEqual(A.leadingWord("Claude_status_icon_1"), "claude")
  assert.strictEqual(A.leadingWord("nm-applet"), "nm")
  assert.strictEqual(A.leadingWord(""), "")
})

test("Claude's tray item finds the Claude desktop icon", () => {
  assert.strictEqual(A.matchApp({ id: "Claude_status_icon_1", title: "", tooltipTitle: "" }, APPS), "claude-desktop")
})

test("ChatGPT by title, Steam by window class, case does not matter", () => {
  assert.strictEqual(A.matchApp({ id: "chrome_status_icon_1", title: "ChatGPT", tooltipTitle: "" }, APPS), "chatgpt")
  assert.strictEqual(A.matchApp({ id: "steam", title: "Steam", tooltipTitle: "" }, APPS), "steam")
  assert.strictEqual(A.matchApp({ id: "x_status_icon", title: "", tooltipTitle: "chatgpt" }, APPS), "chatgpt")
})

test("absolute icon paths come back as they are", () => {
  assert.strictEqual(A.matchApp({ id: "x", title: "App", tooltipTitle: "" }, APPS), "/opt/app/icon.png")
})

test("short ids do not match by containment, apps without an icon are skipped, no match is empty", () => {
  assert.strictEqual(A.matchApp({ id: "myappindicator", title: "", tooltipTitle: "" }, APPS), "")
  assert.strictEqual(A.matchApp({ id: "nm-applet", title: "Network", tooltipTitle: "" }, APPS), "")
  assert.strictEqual(A.matchApp({ id: "", title: "", tooltipTitle: "" }, APPS), "")
  assert.strictEqual(A.matchApp({ id: "Claude_status_icon_1" }, []), "")
})

test("Apps.js avoids Array.from and codePointAt", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "Apps.js"), "utf8").replace(/\/\/.*$/gm, "")
  assert.ok(!/\b(Array\.from|codePointAt)\b/.test(src))
})
