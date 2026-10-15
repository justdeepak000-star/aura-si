import { useEffect, useState } from "react";
import { Cpu } from "lucide-react";

export function BrainStatus() {
  const [s, setS] = useState<{ online: boolean; latencyMs: number | null } | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch("/api/brain-status")
        .then((r) => r.json())
        .then((d) => alive && setS(d))
        .catch(() => alive && setS({ online: false, latencyMs: null }));
    check();
    const id = setInterval(check, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  const label = !s ? "Checking…" : s.online ? "Online" : "Offline";
  const dot = !s ? "bg-muted-foreground" : s.online ? "bg-[color:var(--aura-lav)]" : "bg-[color:var(--jarvis-red)]";
  return (
    <div className="mb-2 flex items-center gap-3.5 rounded-2xl border border-[color:var(--aura-lav)]/20 bg-background/50 px-4 py-3.5 text-sm">
      <Cpu className="h-[18px] w-[18px] text-[color:var(--aura-lav)]" />
      <div className="flex-1">
        <div className="text-foreground">AURA GPU Brain</div>
        <div className="text-[11px] text-muted-foreground">
          English · Maths · Code — Telugu/Tanglish goes to Gemini
        </div>
      </div>
      <span className="flex items-center gap-1.5 font-hud text-[10px] tracking-widest text-foreground">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
        {s?.online && s.latencyMs != null ? ` · ${(s.latencyMs / 1000).toFixed(1)}s` : ""}
      </span>
    </div>
  );
}
