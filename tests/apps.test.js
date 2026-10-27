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

test("generic Electron ids match only by title, never by a flatpak Chrome desktop id", () => {
  const CHROME = [{ name: "Google Chrome", icon: "google-chrome", wmClass: "", desktopId: "com.google.Chrome" }]
  assert.strictEqual(A.matchApp({ id: "chrome_status_icon_1", title: "Discord", tooltipTitle: "" }, CHROME), "")
  assert.strictEqual(A.matchApp({ id: "chrome_status_icon_1", title: "", tooltipTitle: "" }, CHROME), "")
  const WITH_DISCORD = CHROME.concat([{ name: "Discord", icon: "discord", wmClass: "", desktopId: "discord" }])
  assert.strictEqual(A.matchApp({ id: "chrome_status_icon_1", title: "Discord", tooltipTitle: "" }, WITH_DISCORD), "discord")
})

test("a desktop id of status-icon does not match any *_status_icon_* tray id", () => {
  const APP = [{ name: "Status Icon", icon: "status-icon", wmClass: "", desktopId: "status-icon" }]
  assert.strictEqual(A.matchApp({ id: "Claude_status_icon_1", title: "", tooltipTitle: "" }, APP), "")
})

test("a desktop id's last segment matches a whole title word, not a longer word", () => {
  const APP = [{ name: "Example Updater", icon: "example-icon", wmClass: "", desktopId: "org.example.update" }]
  assert.strictEqual(A.matchApp({ id: "tray", title: "Updates available", tooltipTitle: "" }, APP), "")
  assert.strictEqual(A.matchApp({ id: "tray", title: "Check for update", tooltipTitle: "" }, APP), "example-icon")
})

test("window class matches inside a longer id, with the short-string guard", () => {
  const STEAM = [{ name: "Steam", icon: "steam", wmClass: "steam", desktopId: "steam" }]
  assert.strictEqual(A.matchApp({ id: "steam_tray", title: "", tooltipTitle: "" }, STEAM), "steam")
  const SHORT = [{ name: "Other", icon: "other", wmClass: "app", desktopId: "other" }]
  assert.strictEqual(A.matchApp({ id: "myappindicator", title: "", tooltipTitle: "" }, SHORT), "")
})

test("within a rule the longest matching key wins, regardless of list order", () => {
  const D1 = { name: "Discord", icon: "d1", wmClass: "", desktopId: "discord" }
  const D2 = { name: "Discord Canary", icon: "d2", wmClass: "", desktopId: "discordcanary" }
  const tray = { id: "discordcanary_tray", title: "", tooltipTitle: "" }
  assert.strictEqual(A.matchApp(tray, [D1, D2]), "d2")
  assert.strictEqual(A.matchApp(tray, [D2, D1]), "d2")
})

test("short desktop ids never match a title word or whole title", () => {
  const APPS = [
    { name: "X", icon: "x-web", wmClass: "", desktopId: "x" },
    { name: "HEY", icon: "hey-web", wmClass: "", desktopId: "com.example.hey" }
  ]
  assert.strictEqual(A.matchApp({ id: "generic_tray", title: "Say hey to x", tooltipTitle: "" }, APPS), "")
})

test("Apps.js avoids Array.from and codePointAt", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "Apps.js"), "utf8").replace(/\/\/.*$/gm, "")
  assert.ok(!/\b(Array\.from|codePointAt)\b/.test(src))
})
