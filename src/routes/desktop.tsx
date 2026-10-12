import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { autoPairDesktop, desktopLog, desktopStatus, desktopToken, setDesktopPermissions, unpairDesktop } from "@/lib/auraDesktop";

export const Route = createFileRoute("/desktop")({
  head: () => ({
    meta: [
      { title: "AURA Desktop Companion — Laptop Tasks" },
      { name: "description", content: "Pair the AURA Desktop Companion so AURA can do tasks on your Windows laptop safely." },
      { property: "og:title", content: "AURA Desktop Companion" },
      { property: "og:description", content: "Let AURA browse, fill forms and organize files on your laptop with your approval." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DesktopPage,
});

function DesktopPage() {
  const [st, setSt] = useState<{ host: string; paused: boolean; allowedFolders: string[] } | null>(null);
  const [folders, setFolders] = useState("");
  const [log, setLog] = useState("");
  const [msg, setMsg] = useState("");

  const refresh = async () => {
    try {
      await autoPairDesktop();
      const s = await desktopStatus();
      setSt(s); setFolders(s.allowedFolders.join("\n"));
      setLog((await desktopLog()).log);
      setMsg("");
    } catch (e) {
      setSt(null);
      const m = (e as Error).message;
      setMsg(m === "Failed to fetch" || /fetch/i.test(m) ? "Laptop లో AURA ఇంకా run అవ్వట్లేదు. క్రింద Download నొక్కి file open చేయండి." : m);
    }
  };
  useEffect(() => {
    refresh();
    const t = setInterval(() => { if (!desktopToken()) refresh(); }, 3000);
    return () => clearInterval(t);
  }, []);

  const btn = "rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50";
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-foreground space-y-6 text-sm">
      <Link to="/" className="text-muted-foreground">← Back to AURA</Link>
      <h1 className="text-2xl font-semibold">AURA Desktop Companion</h1>
      <p className="text-muted-foreground">Windows laptop లో AURA browser, files, apps పై పనులు చేస్తుంది. Password, OTP, PIN, card details ఎప్పుడూ touch చేయదు; payment, send, delete, submit ముందు మీ approval అడుగుతుంది.</p>

      {!st ? (
        <section className="space-y-3 rounded-xl border border-border p-4">
          <h2 className="font-semibold">Install (one click)</h2>
          <a className={btn + " inline-block"} href="/companion/Start-AURA.bat" download>Download AURA for Windows</a>
          <p className="text-muted-foreground">Download అయిన file open చేయండి. కావాల్సినవి లేకపోతే Windows permission అడిగి ఆటోమేటిక్‌గా install చేస్తుంది. తర్వాత ఈ page ఆటోమేటిక్‌గా connect అవుతుంది — code అవసరం లేదు.</p>
        </section>
      ) : (
        <section className="space-y-3 rounded-xl border border-border p-4">
          <h2 className="font-semibold">Connected: {st.host} {st.paused ? "(Paused)" : "✅"}</h2>
          <p className="text-muted-foreground">ఇప్పుడు AURA chat లో laptop task అడగండి, ఉదా: "Downloads folder లో PDFs అన్నీ PDFs folder కి move chey" లేదా "Chrome lo Amazon lo best wireless mouse under 1000 vetuku".</p>
          <label className="block font-medium">Allowed folders (ఒక్కో line కి ఒకటి)</label>
          <textarea value={folders} onChange={(e) => setFolders(e.target.value)} rows={4} className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs" />
          <div className="flex flex-wrap gap-2">
            <button className={btn} onClick={async () => { await setDesktopPermissions({ allowedFolders: folders.split("\n").map((f) => f.trim()).filter(Boolean) }); setMsg("Saved ✅"); refresh(); }}>Save permissions</button>
            <button className={btn} onClick={async () => { await setDesktopPermissions({ paused: !st.paused }); refresh(); }}>{st.paused ? "Resume" : "Pause AURA"}</button>
            <button className="rounded-lg border border-border px-4 py-2 text-sm" onClick={async () => { await unpairDesktop(); setSt(null); }}>Unpair</button>
          </div>
          <h3 className="font-medium pt-2">Activity log</h3>
          <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">{log || "No actions yet."}</pre>
        </section>
      )}
      {msg && <p className="text-muted-foreground">{msg}</p>}
      <p className="text-muted-foreground">Emergency stop: chat లో Stop నొక్కండి లేదా companion window close చేయండి.</p>
    </main>
  );
}
