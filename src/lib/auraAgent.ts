import { hasNativeJarvis, Jarvis } from "@/lib/jarvisNative";

type Step = Record<string, unknown> & { type: string };

const INTENT =
  /\b(call|dial|whats\s?app|sms|text|message|open|launch|start|play|navigate|directions?|route|maps?|near\s?me|nearby|search|google|email|mail|alarm|ala?ra?m|alaram|alram|timer|write|draft|remind|scroll|tap|click|send|go\s+back|go\s+home|book|order|buy|find|check|reply|post|upload|subscribe|like|follow|add)\b|చేయి|చెయ్|కాల్|ఫోన్|పంపు|పంపించు|ఓపెన్|తెరువు|ప్లే|మెసేజ్|అలారం|అలారమ్|రాయి|టైమర్|వెతుకు|రూట్|దారి|చూపించు|మ్యాప్|దగ్గర|సమీప|cheyi|chey|pampu|chupinchu|open\s?chey|play\s?chey/i;

const QUESTION = /^(what|why|how|who|when|where|explain|tell me about|define|ఏమిటి|ఎందుకు|ఎలా|ఎవరు)\b/i;
export function looksLikeTask(text: string) {
  if (INTENT.test(text)) return true;
  // On the phone app, any imperative-sounding request goes to the planner (it returns no steps for chat)
  return hasNativeJarvis() && !QUESTION.test(text.trim()) && text.trim().split(/\s+/).length <= 40;
}

let appCache: { name: string; package: string }[] | null = null;
/** Installed launchable apps on this phone (cached per session). */
export async function installedApps() {
  if (appCache) return appCache;
  if (!hasNativeJarvis()) return [];
  try { appCache = (await Jarvis.listApps()).apps ?? []; } catch { appCache = []; }
  return appCache;
}

const s = (v: unknown) => String(v ?? "").trim();

/** Fail-safe watchdog: no single phone action may hang longer than 4.5s. */
function guard<T>(p: Promise<T>, ms = 4500): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}
const POPUP_RE = /^(not now|no thanks|no, thanks|maybe later|later|skip|dismiss|close|got it|ok, got it|remind me later|ఇప్పుడు కాదు|తర్వాత)$/i;
/** Taps an annoying popup button if one is visible. Returns true when something was dismissed. */
async function dismissPopup(screen: import("@/lib/jarvisNative").ScreenState): Promise<boolean> {
  const n = screen.nodes.find((x) => x.click && POPUP_RE.test(s(x.t || x.d)));
  if (!n) return false;
  await guard(Jarvis.gesture({ action: "tap_node", index: n.i })).catch(() => {});
  await sleep(500);
  return true;
}
class Cancelled extends Error {}

const PROFILE_KEY = "aura_form_profile";
const PENDING_KEY = "aura_form_pending";
const loadProfile = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}"); } catch { return {}; } };
const saveProfile = (p: Record<string, string>) => localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
/** Cross-app memory bridge: values captured from one app, used in the next ({{clip}}). */
const vars: Record<string, string> = {};
const fillVars = (v: unknown) => s(v).replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function number(target: string): Promise<string | null> {
  const d = target.replace(/[^\d+]/g, "");
  if (d.replace(/\D/g, "").length >= 4) return d;
  if (!hasNativeJarvis()) return null;
  try {
    return (await Jarvis.findContact({ name: target })).number || null;
  } catch {
    return null;
  }
}

function go(url: string) {
  if (url.startsWith("http")) window.open(url, "_blank", "noopener");
  else window.location.href = url;
}

const isAndroid = () => typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

/** Open an https URL directly in its Android app (falls back to the web page). */
function goApp(url: string, pkg: string) {
  if (hasNativeJarvis()) { void Jarvis.openUrl({ url, package: pkg }).catch(() => go(url)); return; }
  if (!isAndroid()) return go(url);
  const u = new URL(url);
  window.location.href = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=${pkg};S.browser_fallback_url=${encodeURIComponent(url)};end`;
}

const APPS: Record<string, [string, string]> = {
  youtube: ["https://www.youtube.com/", "com.google.android.youtube"],
  whatsapp: ["https://wa.me/", "com.whatsapp"],
  instagram: ["https://www.instagram.com/", "com.instagram.android"],
  spotify: ["https://open.spotify.com/", "com.spotify.music"],
  maps: ["https://www.google.com/maps", "com.google.android.apps.maps"],
  "google maps": ["https://www.google.com/maps", "com.google.android.apps.maps"],
  gmail: ["https://mail.google.com/", "com.google.android.gm"],
  facebook: ["https://www.facebook.com/", "com.facebook.katana"],
  telegram: ["https://t.me/", "org.telegram.messenger"],
  twitter: ["https://x.com/", "com.twitter.android"],
  x: ["https://x.com/", "com.twitter.android"],
  chrome: ["https://www.google.com/", "com.android.chrome"],
  "play store": ["https://play.google.com/store", "com.android.vending"],
  claude: ["https://claude.ai/", "com.anthropic.claude"],
  chatgpt: ["https://chatgpt.com/", "com.openai.chatgpt"],
  gemini: ["https://gemini.google.com/", "com.google.android.apps.bard"],
  perplexity: ["https://www.perplexity.ai/", "ai.perplexity.app.android"],
  phonepe: ["https://www.phonepe.com/", "com.phonepe.app"],
  "google pay": ["https://pay.google.com/", "com.google.android.apps.nbu.paisa.user"],
  gpay: ["https://pay.google.com/", "com.google.android.apps.nbu.paisa.user"],
  paytm: ["https://paytm.com/", "net.one97.paytm"],
  swiggy: ["https://www.swiggy.com/", "in.swiggy.android"],
  zomato: ["https://www.zomato.com/", "com.application.zomato"],
  amazon: ["https://www.amazon.in/", "in.amazon.mShop.android.shopping"],
  flipkart: ["https://www.flipkart.com/", "com.flipkart.android"],
  uber: ["https://m.uber.com/", "com.ubercab"],
  rapido: ["https://www.rapido.bike/", "com.rapido.passenger"],
  netflix: ["https://www.netflix.com/", "com.netflix.mediaclient"],
  hotstar: ["https://www.hotstar.com/", "in.startv.hotstar"],
  linkedin: ["https://www.linkedin.com/", "com.linkedin.android"],
  snapchat: ["https://www.snapchat.com/", "com.snapchat.android"],
  "google drive": ["https://drive.google.com/", "com.google.android.apps.docs"],
  drive: ["https://drive.google.com/", "com.google.android.apps.docs"],
  "google photos": ["https://photos.google.com/", "com.google.android.apps.photos"],
  photos: ["https://photos.google.com/", "com.google.android.apps.photos"],
  calendar: ["https://calendar.google.com/", "com.google.android.calendar"],
};

const SYSTEM_APPS: Record<string, string> = {
  settings: "settings", "phone settings": "settings", "system settings": "settings",
  camera: "camera", wifi: "wifi", "wi-fi": "wifi", bluetooth: "bluetooth",
  home: "home", homescreen: "home", "home screen": "home", launcher: "home", "హోమ్ స్క్రీన్": "home",
  notifications: "notifications", recents: "recents",
};
const HOME_RE = /home\s?screen|హోమ్|\bgo\s+(to\s+)?home\b|^home$/i;

/** Unknown app: try "<name>.com" in its app (by guessed web host) else open the website. */
function guessSite(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `https://www.${slug}.com/`;
}

/** Fire a native Android intent (works from Chrome on Android). */
function intent(body: string) {
  window.location.href = `intent:#Intent;${body};end`;
}

async function exec(raw: Step): Promise<string> {
  const st = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, typeof v === "string" ? fillVars(v) : v])) as Step;
  const native = hasNativeJarvis();
  switch (st.type) {
    case "call": {
      const n = await number(s(st.target));
      if (!n) return `✗ Contact "${s(st.target)}" not found`;
      if (native) await Jarvis.makeCall({ number: n });
      else go(`tel:${n}`);
      return `✓ Calling ${s(st.target)}`;
    }
    case "whatsapp": {
      const n = await number(s(st.target));
      const msg = s(st.message);
      if (native && n) await Jarvis.sendWhatsApp({ number: n, message: msg });
      else go(n ? `https://wa.me/${n.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`);
      return `✓ WhatsApp message sent to ${s(st.target)}: "${msg}"`;
    }
    case "sms": {
      const n = await number(s(st.target));
      const msg = s(st.message);
      if (native && n) await Jarvis.sendSMS({ number: n, message: msg });
      else go(`sms:${n ?? ""}?body=${encodeURIComponent(msg)}`);
      return `✓ SMS sent to ${s(st.target)}: "${msg}"`;
    }
    case "system": {
      if (!native) return "⚠ System controls need the AURA Android app";
      await Jarvis.systemAction({ action: s(st.action) });
      return `✓ ${s(st.action)}`;
    }
    case "open_app": {
      const name = s(st.name);
      const sys = SYSTEM_APPS[name.toLowerCase()] ?? (HOME_RE.test(name) ? "home" : undefined);
      if (sys === "home" && !native) return "⚠ Home screen needs the AURA Android app";
      if (native && sys) { await Jarvis.systemAction({ action: sys }); return `✓ Opened ${name}`; }
      const app = APPS[name.toLowerCase()];
      const site = app ? app[0] : guessSite(name);
      if (native) {
        try { await Jarvis.openAppByName({ name, url: site, package: s(st.package) || app?.[1] }); } catch { go(site); }
      } else if (app) goApp(app[0], app[1]);
      else go(site);
      return `✓ Opened ${name}`;
    }
    case "youtube": {
      let url = `https://www.youtube.com/results?search_query=${encodeURIComponent(s(st.query))}`;
      try {
        const r = await guard(fetch(`/api/yt-first?q=${encodeURIComponent(s(st.query))}`).then((x) => x.json() as Promise<{ id?: string }>));
        if (r.id) url = `https://www.youtube.com/watch?v=${r.id}`;
      } catch { /* search page fallback */ }
      goApp(url, "com.google.android.youtube");
      return `✓ YouTube playing: ${s(st.query)}`;
    }
    case "voice_note": {
      const n = await number(s(st.target));
      if (!native) return "⚠ Voice notes need the AURA Android app";
      if (!n) return `✗ Contact "${s(st.target)}" not found`;
      const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: s(st.message) }) });
      if (!r.ok) return "✗ Voice could not be generated right now";
      const buf = new Uint8Array(await r.arrayBuffer());
      let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      await Jarvis.sendVoiceNote({ base64: btoa(bin), number: n });
      return `✓ Voice note sent to ${s(st.target)}: "${s(st.message)}"`;
    }
    case "capture": {
      if (!native) return "⚠ Screen reading needs the AURA Android app";
      await sleep(1500);
      const screen = await guard(Jarvis.readScreen());
      const text = screen.nodes.map((n) => s(n.t || n.d)).filter(Boolean).join(" | ").slice(0, 4000);
      const r = await fetch("/api/agent-form", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "extract", what: s(st.what), text }) });
      const j = (await r.json()) as { value?: string };
      vars[s(st.as) || "clip"] = s(j.value);
      return j.value ? `✓ Found ${s(st.what)}: "${s(j.value)}"` : `⚠ Could not find ${s(st.what)} on screen`;
    }
    case "fill_form":
      return await fillForm(s(st.package));
    case "spotify":
      goApp(`https://open.spotify.com/search/${encodeURIComponent(s(st.query))}`, "com.spotify.music");
      return `✓ Spotify: ${s(st.query)}`;
    case "navigate":
      goApp(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s(st.destination))}&travelmode=driving`, "com.google.android.apps.maps");
      return `✓ Navigating to ${s(st.destination)}`;
    case "nearby":
      goApp(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s(st.query)} near me`)}`, "com.google.android.apps.maps");
      return `✓ Nearby: ${s(st.query)}`;
    case "search":
      go(`https://www.google.com/search?q=${encodeURIComponent(s(st.query))}`);
      return `✓ Searched ${s(st.query)}`;
    case "email": {
      const to = s(st.to), subject = s(st.subject), body = s(st.body);
      if (native) {
        try {
          const r = await Jarvis.sendEmail({ to, subject, body });
          if (r?.autoSent) return `✓ Email sent to ${to || "Gmail"}: "${subject}"`;
          return `✓ Email ready in Gmail → ${to} (turn on AURA Operator in Accessibility for auto-send)`;
        } catch { /* fall back to mailto */ }
      }
      // encodeURIComponent keeps spaces as %20 (URLSearchParams used "+", which Gmail showed literally)
      const q = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      go(`mailto:${encodeURIComponent(to).replace(/%40/g, "@")}?${q}`);
      return `✓ Email draft → ${to || "Gmail"}`;
    }
    case "alarm": {
      let h = Number(st.hour) || 0, m = Number(st.minute) || 0;
      const rel = Number(st.minutes_from_now);
      if (rel > 0) {
        const d = new Date(Date.now() + rel * 60000);
        h = d.getHours(); m = d.getMinutes();
      }
      const label = s(st.label) || "AURA";
      const t = `${h}:${String(m).padStart(2, "0")}`;
      if (native) {
        try {
          await Jarvis.setAlarm({ hour: h, minute: m, label });
          return `✓ Alarm set in Clock for ${t}`;
        } catch { /* fall through */ }
      }
      if (!isAndroid()) return `⚠ Alarm needs an Android phone`;
      intent(`action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=${h};i.android.intent.extra.alarm.MINUTES=${m};S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(label)};B.android.intent.extra.alarm.SKIP_UI=true`);
      return `✓ Alarm ${t} (browser లో Chrome అనుమతి ఇవ్వదు — AURA Android app లో direct గా Clock లో సెట్ అవుతుంది)`;
    }
    case "timer": {
      const sec = Number(st.seconds) || 60;
      if (isAndroid() || native) {
        intent(`action=android.intent.action.SET_TIMER;i.android.intent.extra.alarm.LENGTH=${Math.round(sec)};S.android.intent.extra.alarm.MESSAGE=AURA;B.android.intent.extra.alarm.SKIP_UI=true`);
        return `✓ Timer set in Clock for ${sec >= 60 ? Math.round(sec / 60) + " min" : sec + "s"}`;
      }
      setTimeout(() => {
        try { new Notification("AURA timer done ⏰"); } catch { /* noop */ }
        alert("AURA: Timer finished ⏰");
      }, sec * 1000);
      return `✓ Timer set for ${Math.round(sec / 60) || sec + "s"}${sec >= 60 ? " min" : ""}`;
    }
    case "ui": {
      if (!native) return "⚠ Screen control needs the Android app";
      const a = s(st.action);
      if (a === "home" || a === "back") { await Jarvis.systemAction({ action: a }); return `✓ ${a}`; }
      if (a === "scroll") await Jarvis.automateUI({ action: "scroll", direction: (s(st.direction) || "down") as "down" });
      else if (a === "click") await Jarvis.automateUI({ action: "click", text: s(st.text) });
      else if (a === "back") await Jarvis.automateUI({ action: "back" });
      else await Jarvis.automateUI({ action: "home" });
      return `✓ Screen: ${a} ${s(st.text || st.direction)}`;
    }
    case "operate":
      return await operate(s(st.goal));
    case "wait":
      await sleep(Math.min(Number(st.ms) || 1000, 8000));
      return "";
    default:
      return "";
  }
}

const SECRET = /(upi\s*pin|enter\s*pin|\bm?pin\b|otp|one[-\s]?time|password|passcode|cvv|card\s*number)/i;
const SEND_RE = /^(send|పంపు|post|reply|share)\b|\bsend\b/i;
const MSG_GOAL = /message|msg|send|reply|whats\s?app|sms|text|chat|post|comment|పంపు|మెసేజ్|pampu/i;

/** Autonomous GUI loop: read screen → AI picks next action → perform with Ghost Touch. */
async function operate(goal: string): Promise<string> {
  if (!goal) return "";
  if (!hasNativeJarvis()) return "⚠ GUI Operator needs the AURA Android app";
  const on = await Jarvis.checkAccessibilityService().then((r) => r.enabled).catch(() => false);
  if (!on) {
    await Jarvis.openAccessibilitySettings().catch(() => {});
    return "⚠ Settings → Accessibility → **AURA Operator** ON చేసి మళ్ళీ చెప్పండి";
  }
  const history: string[] = [];
  let last = "", same = 0;
  const typed = new Set<string>();
  let sent = false;
  try {
    const apps = (await installedApps()).map((x) => `${x.name}=${x.package}`).join(", ").slice(0, 3000);
    for (let step = 0; step < 40; step++) {
      await sleep(step === 0 ? 900 : 350);
      const screen = await guard(Jarvis.readScreen());
      if (screen.cancelled) throw new Cancelled();
      if (await dismissPopup(screen)) { history.push("dismissed popup"); continue; }
      const sig = screen.package + screen.nodes.map((n) => n.t ?? n.d ?? "").join("|").slice(0, 600);
      same = sig === last ? same + 1 : 0;
      last = sig;
      // Human Safety Gate — never operate on secret screens
      const secretField = screen.secure || screen.nodes.some((n) => n.pwd || (n.edit && SECRET.test(`${n.t ?? ""} ${n.h ?? ""} ${n.d ?? ""}`)));
      if (secretField) {
        await Jarvis.operatorStatus({ text: "మీ వంతు — PIN/OTP ఎంటర్ చేయండి" }).catch(() => {});
        return `🔐 Safety gate: ${history.length} steps చేశాను. ఇప్పుడు PIN / OTP / password మీరే ఎంటర్ చేయండి.`;
      }
      const r = await guard(fetch("/api/agent-operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, apps, history: same >= 2 ? [...history, "(screen unchanged — try something else)"] : history, screen }),
      }), 15000);
      const a = (await r.json()) as Record<string, unknown>;
      const act = s(a.action);
      if (a.status) Jarvis.operatorStatus({ text: s(a.status) }).catch(() => {});
      if (act === "done" || act === "handoff") {
        await Jarvis.operatorStatus({ text: "" }).catch(() => {});
        return `${act === "handoff" ? "🔐 " : "✓ "}${s(a.text) || "Done"} (${history.length} steps)`;
      }
      const idx = Number(a.index);
      const node = Number.isFinite(idx) ? screen.nodes.find((n) => n.i === idx) : undefined;
      const label = `${node?.t ?? ""} ${node?.d ?? ""}`.trim();
      // Duplicate guard: never type the same text twice once it was sent
      if (act === "type" && typed.has(s(a.text).toLowerCase()) && sent) {
        await Jarvis.operatorStatus({ text: "" }).catch(() => {});
        return `✓ పని పూర్తయింది (${history.length} steps)`;
      }
      let res: { ok: boolean } = { ok: true };
      switch (act) {
        case "tap":
          res = Number.isFinite(idx) && a.index !== undefined && a.index !== null
            ? await guard(Jarvis.gesture({ action: "tap_node", index: idx })).catch(() => ({ ok: false }))
            : await guard(Jarvis.gesture({ action: "tap", x: Number(a.x), y: Number(a.y) })).catch(() => ({ ok: false }));
          break;
        case "type": res = await Jarvis.gesture({ action: "type", index: Number.isFinite(idx) ? idx : -1, text: s(a.text) }); typed.add(s(a.text).toLowerCase()); break;
        case "enter": res = await Jarvis.gesture({ action: "enter" }); break;
        case "scroll": res = await Jarvis.gesture({ action: "scroll", direction: s(a.direction) || "down" }); break;
        case "long_press": res = await Jarvis.gesture({ action: "long_press", x: Number(a.x), y: Number(a.y) }); break;
        case "back": case "home": res = await Jarvis.gesture({ action: act }); break;
        case "open_app": await Jarvis.openAppByName({ name: s(a.app || a.text), package: s(a.package) || undefined }); await sleep(1200); break;
        default: await sleep(500);
      }
      history.push(`${act} ${a.index ?? ""} [${label.slice(0, 40)}] ${s(a.text)} ${s(a.direction)} → ${res.ok ? "ok" : "failed"} (${s(a.thought).slice(0, 80)})`);
      // Strict stop lock: a send/post action that succeeded finishes message goals
      const isSend = (act === "tap" && SEND_RE.test(label)) || (act === "enter" && typed.size > 0);
      if (isSend && res.ok) {
        sent = true;
        if (MSG_GOAL.test(goal)) {
          await Jarvis.operatorStatus({ text: "" }).catch(() => {});
          return `✓ పంపించాను — పని పూర్తయింది (${history.length} steps)`;
        }
      }
    }
    await Jarvis.operatorStatus({ text: "" }).catch(() => {});
    return `⚠ 40 steps లో పూర్తి కాలేదు — చివరి స్క్రీన్ దగ్గర ఆపాను`;
  } catch (e) {
    await Jarvis.operatorStatus({ text: "" }).catch(() => {});
    if (e instanceof Cancelled) throw e;
    return `✗ Operator stopped: ${e instanceof Error ? e.message : e}`;
  }
}

const SECRET_FIELD = /(password|passcode|pin|otp|cvv|cvc|card|expiry|security code)/i;

/** Smart form filler: fills known fields from the profile and asks the user for unknown ones. */
async function fillForm(pkg = ""): Promise<string> {
  if (!hasNativeJarvis()) return "⚠ Form fill needs the AURA Android app";
  await sleep(1200);
  const screen = await guard(Jarvis.readScreen());
  const fields = screen.nodes
    .filter((n) => n.edit && !n.pwd && !SECRET_FIELD.test(`${s(n.h)} ${s(n.d)} ${s(n.t)}`))
    .map((n) => ({ i: n.i, label: s(n.h || n.d || n.t), value: s(n.t) }));
  if (!fields.length) return "⚠ No form fields on this screen";
  const profile = loadProfile();
  const r = await fetch("/api/agent-form", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "map", fields, profile }) });
  const j = (await r.json()) as { fill?: { i: number; value: string }[]; missing?: string[] };
  let filled = 0;
  for (const f of j.fill ?? []) {
    if (screen.cancelled) break;
    const ok = await guard(Jarvis.gesture({ action: "type", index: Number(f.i), text: s(f.value) })).then((x) => x.ok).catch(() => false);
    if (ok) filled++;
  }
  const missing = (j.missing ?? []).filter(Boolean);
  if (missing.length) {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ missing, pkg: pkg || screen.package }));
    Jarvis.operatorStatus({ text: "" }).catch(() => {});
    return `✓ ${filled} fields filled. ❓ ఈ వివరాలు నాకు తెలియవు — చెప్పండి:\n${missing.map((m) => `  • **${m}**`).join("\n")}\n(ఉదా: "${missing[0]}: ...")`;
  }
  return `✓ Form filled (${filled} fields). Passwords/OTP/PIN మీరే ఎంటర్ చేయండి.`;
}

/** User answered the missing-field question → save to profile and fill again. */
async function answerPending(text: string): Promise<string | null> {
  const raw = localStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  const pend = JSON.parse(raw) as { missing: string[]; pkg: string };
  const profile = loadProfile();
  let got = 0;
  if (pend.missing.length === 1 && !text.includes(":")) { profile[pend.missing[0]] = text.trim(); got = 1; }
  else for (const line of text.split(/\n|,(?=[^,]*:)/)) {
    const m = line.match(/^\s*([^:]+):\s*(.+)$/);
    if (m) { profile[m[1].trim()] = m[2].trim(); got++; }
  }
  if (!got) return null;
  saveProfile(profile);
  localStorage.removeItem(PENDING_KEY);
  if (pend.pkg) await Jarvis.openAppByName({ name: pend.pkg, package: pend.pkg }).catch(() => {});
  return `**⚡ AURA Agent** — సేవ్ చేశాను (next time ఇదే వాడతాను)\n\n- ${await fillForm(pend.pkg)}`;
}

/** Plans + executes a device task. Returns a reply, or null when it isn't a task. */
export async function runAgentTask(text: string): Promise<string | null> {
  if (hasNativeJarvis()) {
    const ans = await answerPending(text).catch(() => null);
    if (ans) return ans;
  }
  if (!looksLikeTask(text)) return null;
  let plan: { steps: Step[]; reply?: string; ask?: boolean };
  try {
    const r = await fetch("/api/agent-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, now: new Date().toString(), apps: (await installedApps()).map((x) => `${x.name}=${x.package}`).join(", ").slice(0, 4000) }),
    });
    plan = await r.json();
  } catch {
    return null;
  }
  if (!plan.steps?.length) return plan.ask && plan.reply ? plan.reply : null;
  const log: string[] = [];
  for (const st of plan.steps) {
    try {
      if (hasNativeJarvis() && st.type !== "call") {
        Jarvis.operatorStatus({ text: s(st.query || st.goal || st.target || st.name || st.type).slice(0, 40) }).catch(() => {});
      }
      const l = await exec(st);
      if (l) log.push(l);
      if (hasNativeJarvis()) {
        const c = await guard(Jarvis.readScreen()).then((x) => x.cancelled).catch(() => false);
        if (c) throw new Cancelled();
      }
    } catch (e) {
      if (e instanceof Cancelled) { log.push("⛔ మీరు double-tap చేసి task ఆపేశారు"); break; }
      log.push(`✗ ${st.type} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (hasNativeJarvis()) Jarvis.operatorStatus({ text: "" }).catch(() => {});
  const drafts = plan.steps
    .filter((st) => ["email", "whatsapp", "sms"].includes(st.type))
    .map((st) => (st.type === "email" ? `**Subject:** ${s(st.subject)}\n\n${s(st.body)}` : s(st.message)))
    .filter(Boolean);
  const draftText = drafts.length ? `\n\n---\n${drafts.join("\n\n---\n")}` : "";
  return `**⚡ AURA Agent**${plan.reply ? ` — ${plan.reply}` : ""}\n\n${log.map((l) => `- ${l}`).join("\n")}${draftText}`;
}
