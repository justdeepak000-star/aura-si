// AURA Desktop — opens AURA in its own window, runs the bundled companion silently,
// and pairs it automatically (no pairing code for the user to type).
const { app, BrowserWindow, shell } = require("electron");
const { fork } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const SITE = process.env.AURA_SITE_URL || "https://aura-si.lovable.app";
const CFG = path.join(os.homedir(), ".aura-companion", "config.json");
let companion;

function startCompanion() {
  const script = path.join(__dirname, "aura-companion.mjs").replace("app.asar", "app.asar.unpacked");
  companion = fork(script, [], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, stdio: "ignore", windowsHide: true });
}

const readCfg = () => { try { return JSON.parse(fs.readFileSync(CFG, "utf8")); } catch { return {}; } };

// Wait (up to ~10s) for the companion to publish a fresh one-time pair code.
async function waitForPairCode() {
  for (let i = 0; i < 50; i++) {
    const c = readCfg();
    if (c.pairCode) return c.pairCode;
    if (c.token && i > 5) return ""; // already paired earlier — window storage keeps the token
    await new Promise((r) => setTimeout(r, 200));
  }
  return "";
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 380, minHeight: 600,
    backgroundColor: "#0b0d12", title: "AURA", autoHideMenuBar: true,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  const code = await waitForPairCode();
  win.loadURL(code ? `${SITE}/?auraPair=${code}` : SITE);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.whenReady().then(() => { startCompanion(); createWindow(); });
  app.on("window-all-closed", () => { companion?.kill(); app.quit(); });
}
