import { createFileRoute } from "@tanstack/react-router";

/** Returns the first YouTube video id for a search so AURA can play it directly. */
export const Route = createFileRoute("/api/yt-first")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q")?.slice(0, 200) ?? "";
        const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } });
        if (!q.trim()) return json({});
        try {
          const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=en`, {
            headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en" },
          });
          const html = await r.text();
          const m = html.match(/"videoRenderer":\{"videoId":"([\w-]{11})"/) ?? html.match(/"videoId":"([\w-]{11})"/);
          return json({ id: m?.[1] });
        } catch {
          return json({});
        }
      },
    },
  },
});
