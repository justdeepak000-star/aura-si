#!/usr/bin/env node
// AURA Desktop Companion — Windows-first local agent. Zero dependencies (Node 18+).
// Runs only on 127.0.0.1, requires a pairing token, logs every action locally.
import http from "node:http";
import { execFile } from "node:child_process";
import { promises as fs, existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const PORT = 47821;
const HOME = path.join(os.homedir(), ".aura-companion");
const CFG = path.join(HOME, "config.json");
const LOG = path.join(HOME, "activity.log");
const ORIGINS = [/^https:\/\/aura-artifical\.lovable\.app$/, /^https:\/\/[a-z0-9-]+\.lovable\.app$/, /^http:\/\/localhost(:\d+)?$/];
if (!existsSync(HOME)) mkdirSync(HOME, { recursive: true });

let cfg = { token: "", pairCode: "", allowedFolders: [path.join(os.homedir(), "Downloads"), path.join(os.homedir(), "Documents"), path.join(os.homedir(), "Desktop")], allowedApps: [], paused: false };
try { cfg = { ...cfg, ...JSON.parse(readFileSync(CFG, "utf8")) }; } catch {}
const save = () => writeFileSync(CFG, JSON.stringify(cfg, null, 2));
if (!cfg.token) { cfg.pairCode = String(crypto.randomInt(100000, 999999)); save(); }
const log = (msg) => { const line = `${new Date().toISOString()}  ${msg}`; appendFileSync(LOG, line + "\n"); console.log(line); };

const isWin = process.platform === "win32";
const ps = (script) => new Promise((res, rej) => {
  if (!isWin) return rej(new Error("Screen control currently supports Windows only"));
  execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], { maxBuffer: 64 << 20, windowsHide: true }, (e, out, err) => e ? rej(new Error(err || e.message)) : res(out.trim()));
});
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const WIN32 = `Add-Type -AssemblyName System.Windows.Forms,System.Drawing;
if(-not ('W' -as [type])){Add-Type @"
using System;using System.Runtime.InteropServices;public class W{[DllImport("user32.dll")]public static extern bool SetProcessDPIAware();[DllImport("user32.dll")]public static extern bool SetCursorPos(int x,int y);[DllImport("user32.dll")]public static extern void mouse_event(int f,int x,int y,int d,int e);}
"@};[W]::SetProcessDPIAware()|Out-Null;`;

let scale = 1;
async function screenshot() {
  const out = await ps(`${WIN32}
$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;$bmp=New-Object Drawing.Bitmap $b.Width,$b.Height;$g=[Drawing.Graphics]::FromImage($bmp);$g.CopyFromScreen($b.Location,[Drawing.Point]::Empty,$b.Size);
$s=[Math]::Min(1,1280/$b.Width);$w=[int]($b.Width*$s);$h=[int]($b.Height*$s);$r=New-Object Drawing.Bitmap $bmp,$w,$h;
$ms=New-Object IO.MemoryStream;$enc=[Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()|?{$_.MimeType -eq 'image/jpeg'};$p=New-Object Drawing.Imaging.EncoderParameters 1;$p.Param[0]=New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality),[long]60;$r.Save($ms,$enc,$p);
"$($b.Width)|$w|$h|"+[Convert]::ToBase64String($ms.ToArray())`);
  const [full, w, h, b64] = out.split("|");
  scale = Number(full) / Number(w);
  return { image: b64, width: Number(w), height: Number(h) };
}

function inside(p) {
  const abs = path.resolve(String(p || ""));
  if (!cfg.allowedFolders.some((f) => abs.toLowerCase().startsWith(path.resolve(f).toLowerCase() + path.sep) || abs.toLowerCase() === path.resolve(f).toLowerCase()))
    throw new Error(`Folder not allowed: ${abs}. Allowed: ${cfg.allowedFolders.join(", ")}`);
  if (/(password|\.ssh|wallet|\.aws|credential|\.env)/i.test(abs)) throw new Error("Sensitive path blocked");
  return abs;
}

async function act(a) {
  if (cfg.paused) throw new Error("Companion is paused");
  const X = Math.round((a.x ?? 0) * scale), Y = Math.round((a.y ?? 0) * scale);
  const mouse = (down, up, n = 1) => ps(`${WIN32}[W]::SetCursorPos(${X},${Y});Start-Sleep -m 60;1..${n}|%{[W]::mouse_event(${down},0,0,0,0);[W]::mouse_event(${up},0,0,0,0);Start-Sleep -m 80}`);
  switch (a.type) {
    case "click": await mouse(2, 4); return `clicked ${X},${Y}`;
    case "double_click": await mouse(2, 4, 2); return `double-clicked ${X},${Y}`;
    case "right_click": await mouse(8, 16); return `right-clicked ${X},${Y}`;
    case "type": await ps(`${WIN32}Set-Clipboard -Value ${q(a.text)};Start-Sleep -m 80;[System.Windows.Forms.SendKeys]::SendWait('^v')`); return `typed ${String(a.text).length} chars`;
    case "key": await ps(`${WIN32}[System.Windows.Forms.SendKeys]::SendWait(${q(a.keys)})`); return `pressed ${a.keys}`;
    case "scroll": await ps(`${WIN32}[W]::SetCursorPos(${X || 640},${Y || 400});[W]::mouse_event(2048,0,0,${-120 * Math.round(a.amount ?? 3)},0)`); return "scrolled";
    case "open_url": if (!/^https?:\/\//i.test(a.url)) throw new Error("Only http(s) URLs"); await ps(`Start-Process ${q(a.url)}`); return `opened ${a.url}`;
    case "open_app": await ps(`Start-Process ${q(a.app)}`); return `opened app ${a.app}`;
    case "list_files": { const d = inside(a.path); const items = await fs.readdir(d, { withFileTypes: true }); return items.slice(0, 300).map((i) => (i.isDirectory() ? "[dir] " : "") + i.name).join("\n"); }
    case "make_folder": await fs.mkdir(inside(a.path), { recursive: true }); return `created ${a.path}`;
    case "move_file": case "rename_file": { const to = inside(a.to); await fs.mkdir(path.dirname(to), { recursive: true }); await fs.rename(inside(a.path), to); return `moved → ${to}`; }
    case "read_text": return (await fs.readFile(inside(a.path), "utf8")).slice(0, 20000);
    case "write_text": await fs.writeFile(inside(a.path), String(a.text ?? "")); return `wrote ${a.path}`;
    case "wait": await new Promise((r) => setTimeout(r, Math.min(5000, a.ms ?? 1000))); return "waited";
    default: throw new Error("Unknown action " + a.type);
  }
}

const read = (req) => new Promise((r) => { let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => { try { r(JSON.parse(s || "{}")); } catch { r({}); } }); });

http.createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  if (ORIGINS.some((o) => o.test(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Aura-Token");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  } else if (origin) { res.writeHead(403).end(); return; }
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  const send = (code, o) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
  try {
    const body = req.method === "POST" ? await read(req) : {};
    if (req.url === "/pair") {
      if (!cfg.pairCode || String(body.code) !== cfg.pairCode) return send(401, { error: "Wrong pairing code" });
      cfg.token = crypto.randomBytes(24).toString("hex"); cfg.pairCode = ""; save(); log("Paired with AURA web");
      return send(200, { token: cfg.token, platform: process.platform, host: os.hostname() });
    }
    if (!cfg.token || req.headers["x-aura-token"] !== cfg.token) return send(401, { error: "Not paired" });
    if (req.url === "/status") return send(200, { ok: true, platform: process.platform, host: os.hostname(), paused: cfg.paused, allowedFolders: cfg.allowedFolders });
    if (req.url === "/screenshot") return send(200, await screenshot());
    if (req.url === "/permissions") { if (Array.isArray(body.allowedFolders)) cfg.allowedFolders = body.allowedFolders.map(String); if (typeof body.paused === "boolean") cfg.paused = body.paused; save(); log(`Permissions updated: ${cfg.allowedFolders.join("; ")} paused=${cfg.paused}`); return send(200, { ok: true }); }
    if (req.url === "/unpair") { cfg.token = ""; cfg.pairCode = String(crypto.randomInt(100000, 999999)); save(); log("Unpaired"); return send(200, { ok: true }); }
    if (req.url === "/log") return send(200, { log: existsSync(LOG) ? readFileSync(LOG, "utf8").split("\n").slice(-200).join("\n") : "" });
    if (req.url === "/action") { const r = await act(body); log(`${body.type} ${JSON.stringify({ ...body, text: body.text ? `[${String(body.text).length} chars]` : undefined })} → ok`); return send(200, { ok: true, result: r }); }
    send(404, { error: "not found" });
  } catch (e) { log(`ERROR ${e.message}`); send(500, { error: e.message }); }
}).listen(PORT, "127.0.0.1", () => {
  console.log("\n  AURA Desktop Companion is running on this laptop.");
  if (cfg.pairCode) console.log(`\n  PAIRING CODE:  ${cfg.pairCode}\n  Enter it on the AURA website → Desktop page.\n`);
  else console.log("  Already paired. Keep this window open. Close it to stop AURA instantly.\n");
  console.log(`  Activity log: ${LOG}\n`);
});
