// AURA Desktop Companion bridge (browser side). Talks to the local companion on 127.0.0.1.
import { toast } from "sonner";

const BASE = "http://127.0.0.1:47821";
const KEY = "aura_desktop_token";
let stopFlag = false;

export const desktopToken = () => (typeof localStorage === "undefined" ? null : localStorage.getItem(KEY));
export const stopDesktopTask = () => { stopFlag = true; };

async function call<T = any>(p: string, body?: unknown): Promise<T> {
  const r = await fetch(BASE + p, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", "X-Aura-Token": desktopToken() ?? "" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Companion error ${r.status}`);
  return d;
}

export async function pairDesktop(code: string) {
  const d = await call<{ token: string; host: string }>("/pair", { code: code.trim() });
  localStorage.setItem(KEY, d.token);
  return d;
}
/** Connects to the local companion without any code. */
export async function autoPairDesktop() {
  const d = await call<{ token: string; host: string }>("/auto-pair", { token: desktopToken() ?? "" });
  localStorage.setItem(KEY, d.token);
  return d;
}
export const desktopStatus = () => call<{ ok: boolean; host: string; paused: boolean; allowedFolders: string[] }>("/status");
export const setDesktopPermissions = (p: { allowedFolders?: string[]; paused?: boolean }) => call("/permissions", p);
export const desktopLog = () => call<{ log: string }>("/log");
export async function unpairDesktop() { await call("/unpair", {}).catch(() => {}); localStorage.removeItem(KEY); }

const DESKTOP_RE = /(open|search|click|type|file|folder|download|excel|word|pdf|vs ?code|notepad|desktop|laptop|browser|chrome|edge|tab|website|site|form|fill|book|order|compare|rename|move|organi[sz]e|chey|cheyi|chesi|pettu|teruvu|vetuku)/i;

/** Runs a goal on the paired laptop. Returns null when no companion is reachable. */
export async function runDesktopTask(goal: string): Promise<string | null> {
  if (!desktopToken() || !DESKTOP_RE.test(goal)) return null;
  let status;
  try { status = await desktopStatus(); } catch { return null; }
  if (status.paused) return "**🖥 AURA Desktop** — Companion pause లో ఉంది. Desktop page లో Resume నొక్కండి.";
  stopFlag = false;
  const id = toast.loading("🖥 AURA working on your laptop…", { action: { label: "Stop", onClick: stopDesktopTask }, duration: Infinity });
  const history: string[] = [];
  try {
    for (let i = 0; i < 30; i++) {
      if (stopFlag) return "**🖥 AURA Desktop** — ⏹ మీరు task ఆపేశారు.";
      const shot = await call<{ image: string; width: number; height: number }>("/screenshot", {});
      const a = await fetch("/api/desktop-agent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, history, folders: status.allowedFolders, ...shot }),
      }).then((r) => r.json());
      if (stopFlag) return "**🖥 AURA Desktop** — ⏹ మీరు task ఆపేశారు.";
      toast.loading(`🖥 ${a.status || a.action}…`, { id, action: { label: "Stop", onClick: stopDesktopTask }, duration: Infinity });
      if (a.action === "done") return `**🖥 AURA Desktop** — ✅ ${a.text || "Done"}`;
      if (a.action === "handoff") return `**🖥 AURA Desktop** — ✋ ${a.text || "ఇక్కడ మీరు చేయాలి."}`;
      if (a.action === "confirm") {
        if (!window.confirm(`AURA approval needed:\n\n${a.text}`)) return `**🖥 AURA Desktop** — ⏹ Approval ఇవ్వలేదు, ఆపేశాను: ${a.text}`;
        history.push(`USER APPROVED: ${a.text}`);
        continue;
      }
      if (a.action === "wait") { await new Promise((r) => setTimeout(r, 1200)); history.push("waited"); continue; }
      try {
        const { result } = await call<{ result: string }>("/action", { ...a, type: a.action });
        history.push(`${a.action} ${a.thought ?? ""} → ${String(result).slice(0, 800)}`);
      } catch (e) {
        history.push(`${a.action} FAILED: ${(e as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, 700));
    }
    return "**🖥 AURA Desktop** — 30 steps అయ్యాయి, task పూర్తి కాలేదు. ఇంకా clear గా చెప్పండి.";
  } catch (e) {
    return `**🖥 AURA Desktop** — Error: ${(e as Error).message}`;
  } finally {
    toast.dismiss(id);
  }
}
