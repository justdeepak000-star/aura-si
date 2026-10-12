import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Code2, Copy, Download, Eye, ExternalLink, PanelRightOpen } from "lucide-react";
import { toast } from "sonner";

export type Artifact = { lang: string; code: string };
export type Source = { title: string; url: string; snippet?: string };

const PREVIEWABLE = new Set(["html", "svg", "xml"]);
const EXT: Record<string, string> = {
  html: "html", svg: "svg", js: "js", javascript: "js", ts: "ts", typescript: "ts", tsx: "tsx",
  jsx: "jsx", python: "py", py: "py", css: "css", json: "json", md: "md", markdown: "md", sql: "sql",
};

/** Extracts fenced code blocks (≥ 6 lines or previewable) as artifacts. */
export function extractArtifacts(text: string): Artifact[] {
  const out: Artifact[] = [];
  const re = /```([\w+-]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const lang = (m[1] || "text").toLowerCase();
    const code = m[2];
    if (PREVIEWABLE.has(lang) || code.split("\n").length >= 6) out.push({ lang, code });
  }
  return out;
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/** Perplexity-style horizontal source cards. */
export function SourceCards({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      {sources.map((s, i) => (
        <a
          key={s.url + i}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          className="flex w-44 shrink-0 flex-col gap-1 rounded-xl border border-border bg-secondary/60 p-2.5 text-left transition-colors hover:bg-secondary"
        >
          <span className="line-clamp-2 text-xs font-medium leading-snug text-foreground">{s.title}</span>
          <span className="mt-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <img src={`https://www.google.com/s2/favicons?sz=32&domain=${hostOf(s.url)}`} alt="" className="h-3.5 w-3.5 rounded-sm" />
            <span className="truncate">{hostOf(s.url)}</span>
            <span className="ml-auto">{i + 1}</span>
          </span>
        </a>
      ))}
    </div>
  );
}

/** Buttons under a reply + the Canvas side sheet. */
export function ArtifactButtons({ artifacts }: { artifacts: Artifact[] }) {
  const [open, setOpen] = useState<Artifact | null>(null);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  if (!artifacts.length) return null;
  const canPreview = open ? PREVIEWABLE.has(open.lang) : false;

  const download = (a: Artifact) => {
    const blob = new Blob([a.code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aura-artifact.${EXT[a.lang] ?? "txt"}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {artifacts.map((a, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { setOpen(a); setTab(PREVIEWABLE.has(a.lang) ? "preview" : "code"); }}
            className="flex items-center gap-2 rounded-xl border border-border bg-secondary/60 px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary"
          >
            <PanelRightOpen className="h-4 w-4" />
            Open in Canvas · {a.lang}
          </button>
        ))}
      </div>
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-3 p-4 sm:max-w-2xl">
          <SheetHeader className="p-0">
            <SheetTitle className="flex items-center gap-2"><Code2 className="h-4 w-4" />AURA Canvas</SheetTitle>
          </SheetHeader>
          {open && (
            <>
              <div className="flex items-center gap-2">
                {canPreview && (
                  <button type="button" onClick={() => setTab("preview")} className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs ${tab === "preview" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>
                    <Eye className="h-3.5 w-3.5" />Preview
                  </button>
                )}
                <button type="button" onClick={() => setTab("code")} className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs ${tab === "code" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>
                  <Code2 className="h-3.5 w-3.5" />Code
                </button>
                <div className="ml-auto flex gap-1">
                  <button type="button" aria-label="Copy" onClick={() => { void navigator.clipboard.writeText(open.code); toast("Copied"); }} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><Copy className="h-4 w-4" /></button>
                  <button type="button" aria-label="Download" onClick={() => download(open)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><Download className="h-4 w-4" /></button>
                  {canPreview && (
                    <button type="button" aria-label="Open in new tab" onClick={() => { const w = window.open(); w?.document.write(open.code); }} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><ExternalLink className="h-4 w-4" /></button>
                  )}
                </div>
              </div>
              {tab === "preview" && canPreview ? (
                <iframe title="Artifact preview" sandbox="allow-scripts" srcDoc={open.code} className="min-h-0 flex-1 rounded-xl border border-border bg-background" />
              ) : (
                <pre className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-secondary/40 p-3 text-xs leading-5">
                  {open.code.split("\n").map((l, i) => (
                    <div key={i} className="flex"><span className="w-8 shrink-0 select-none pr-3 text-right text-muted-foreground">{i + 1}</span><code className="whitespace-pre">{l}</code></div>
                  ))}
                </pre>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
