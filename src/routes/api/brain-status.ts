import { createFileRoute } from "@tanstack/react-router";

/** Pings the Colab GPU brain. Returns only online/offline + latency (no private data). */
export const Route = createFileRoute("/api/brain-status")({
  server: {
    handlers: {
      GET: async () => {
        const base = (process.env.AURA_BRAIN_URL || "https://introductory-automobiles-usage-council.trycloudflare.com")
          .replace(/\/+$/, "")
          .replace(/\/v1\/chat\/completions$/, "");
        const t0 = Date.now();
        let online = false;
        try {
          const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
          online = res.ok;
        } catch {
          online = false;
        }
        return Response.json(
          { online, latencyMs: online ? Date.now() - t0 : null },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
