// AURA Desktop — opens AURA in its own window and runs the local companion silently.
const { app, BrowserWindow, shell } = require("electron");
const { fork } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const SITE = "https://aura-artifical.lovable.app";
let companion;

function startCompanion() {
  const script = path.join(__dirname, "aura-companion.mjs").replace("app.asar", "app.asar.unpacked");
  companion = fork(script, [], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, stdio: "ignore", windowsHide: true });
}

function pairCode() {
  try { return JSON.parse(fs.readFileSync(path.join(os.homedir(), ".aura-companion", "config.json"), "utf8")).pairCode || ""; } catch { return ""; }
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 380, minHeight: 600,
    backgroundColor: "#0b0d12", title: "AURA", autoHideMenuBar: true,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  await new Promise((r) => setTimeout(r, 1200));
  const code = pairCode();
  win.loadURL(code ? `${SITE}/?auraPair=${code}` : SITE);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.whenReady().then(() => { startCompanion(); createWindow(); });
  app.on("window-all-closed", () => { companion?.kill(); app.quit(); });
}
