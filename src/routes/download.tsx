import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { Monitor, Apple, Terminal, Download, Mic, Search, Code2, FileText, MousePointerClick, FolderOpen, Globe, ShieldCheck } from "lucide-react";

const DownloadScene = lazy(() => import("@/components/DownloadScene"));

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Download AURA Desktop — Windows, macOS, Linux" },
      { name: "description", content: "AURA Desktop: an AI assistant that chats and performs tasks on your laptop. Download for Windows, macOS and Linux." },
      { property: "og:title", content: "Download AURA Desktop" },
      { property: "og:description", content: "Chat + autonomous laptop tasks. Windows, macOS, Linux." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DownloadPage,
});

type OS = "windows" | "mac" | "linux";

// Set to "owner/repo" of your GitHub repository; installers come from its "desktop-latest" release.
const GITHUB_REPO = "";
const rel = (f: string, fallback: string) => (GITHUB_REPO ? `https://github.com/${GITHUB_REPO}/releases/download/desktop-latest/${f}` : fallback);

const platforms: { id: OS; name: string; icon: typeof Monitor; file: string; href: string; note: string }[] = [
  { id: "windows", name: "Windows", icon: Monitor, file: "Aura-Setup.exe", href: rel("Aura-Setup.exe", "/companion/Start-AURA.bat"), note: "Windows 10 / 11 · one-click install" },
  { id: "mac", name: "macOS", icon: Apple, file: "Aura.dmg", href: rel("Aura.dmg", "/companion/aura-companion.mjs"), note: "Apple Silicon & Intel" },
  { id: "linux", name: "Linux", icon: Terminal, file: "Aura.AppImage", href: rel("Aura.AppImage", "/companion/aura-companion.mjs"), note: "Ubuntu, Fedora, Arch" },
];

const chat = [
  { icon: Mic, t: "Live Voice", d: "Talk naturally, interrupt anytime." },
  { icon: Search, t: "Deep Research", d: "Web-grounded answers with sources." },
  { icon: Code2, t: "Coding", d: "Write, explain and fix code." },
  { icon: FileText, t: "Documents", d: "Summarise and analyse files." },
];
const tasks = [
  { icon: MousePointerClick, t: "Screen Control", d: "Sees your screen, clicks and types for you." },
  { icon: FolderOpen, t: "File Organiser", d: "Sorts files inside folders you allow." },
  { icon: Globe, t: "Browser Tasks", d: "Opens sites, searches, fills safe forms." },
  { icon: ShieldCheck, t: "Safety First", d: "Never touches passwords, OTP or payments. Stop anytime." },
];

function DownloadPage() {
  const [os, setOs] = useState<OS>("windows");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const ua = navigator.userAgent;
    if (/Mac/i.test(ua)) setOs("mac");
    else if (/Linux/i.test(ua) && !/Android/i.test(ua)) setOs("linux");
  }, []);
  const main = platforms.find((p) => p.id === os)!;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <header className="relative z-20 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-wide">
          <img src="/aura-mark.png" alt="" className="h-7 w-7" /> AURA
        </Link>
        <nav className="flex gap-5 text-sm text-muted-foreground">
          <a href="#platforms" className="hover:text-foreground">Download</a>
          <Link to="/desktop" className="hover:text-foreground">Pair</Link>
        </nav>
      </header>

      <section className="relative h-[88vh] min-h-[560px] flex items-center justify-center">
        <div className="absolute inset-0">{mounted && <Suspense fallback={null}><DownloadScene /></Suspense>}</div>
        <div className="relative z-10 text-center px-6 pointer-events-none">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4">AURA Desktop</p>
          <h1 className="text-4xl md:text-7xl font-semibold leading-tight">Your AI that<br />actually does the work.</h1>
          <p className="mt-5 text-muted-foreground max-w-xl mx-auto">Chat, research and code — then let AURA operate your laptop for you.</p>
          <div className="mt-8 flex flex-col items-center gap-3 pointer-events-auto">
            <a href={main.href} download className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-7 py-3.5 font-medium shadow-lg hover:opacity-90 transition">
              <Download className="h-4 w-4" /> Download for {main.name}
            </a>
            <span className="text-xs text-muted-foreground">{main.note}</span>
          </div>
        </div>
      </section>

      <section id="platforms" className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-semibold text-center mb-10">Available everywhere</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {platforms.map((p) => (
            <div key={p.id} className={`rounded-2xl border p-6 bg-card transition ${p.id === os ? "border-primary" : "border-border"}`}>
              <p.icon className="h-8 w-8 mb-4" />
              <h3 className="text-xl font-semibold">{p.name}</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-5">{p.note}</p>
              <a href={p.href} download className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2 text-sm hover:bg-accent">
                <Download className="h-4 w-4" /> {p.file}
              </a>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">Download, double-click, done — AURA installs everything and opens the login screen automatically.</p>
      </section>

      {[{ title: "Everything a chatbot does", items: chat }, { title: "Plus real tasks on your laptop", items: tasks }].map((s) => (
        <section key={s.title} className="max-w-6xl mx-auto px-6 py-14">
          <h2 className="text-3xl font-semibold mb-8">{s.title}</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {s.items.map((f) => (
              <div key={f.t} className="rounded-2xl border border-border bg-card p-5 hover:-translate-y-1 transition">
                <f.icon className="h-6 w-6 mb-3 text-primary" />
                <h3 className="font-semibold">{f.t}</h3>
                <p className="text-sm text-muted-foreground mt-1">{f.d}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      <footer className="text-center text-xs text-muted-foreground py-10">AURA · created by Deepak</footer>
    </div>
  );
}
