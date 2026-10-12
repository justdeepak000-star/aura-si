/**
 * Token streaming for typed chat. Streams from OpenRouter (OpenAI-compatible
 * SSE) and re-emits NDJSON events to the browser:
 *   {"type":"sources","sources":[...]}  {"type":"delta","text":"..."}
 *   {"type":"done"}  {"type":"error","error":"..."}
 * If streaming is unavailable, `fallback()` produces the full reply once.
 */
import type { ChatMessage } from "@/lib/omniroute/router.server";
import type { SearchResult } from "@/lib/websearch.server";

export function streamChatResponse(opts: {
  messages: ChatMessage[];
  sources: SearchResult[];
  maxTokens: number;
  signal: AbortSignal;
  fallback: () => Promise<string>;
}): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      if (opts.sources.length) send({ type: "sources", sources: opts.sources });
      let emitted = false;
      try {
        const { getProvider } = await import("@/lib/omniroute/providers.server");
        const p = getProvider("openrouter");
        if (p) {
          const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            signal: opts.signal,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
            body: JSON.stringify({
              model: p.textModel,
              messages: opts.messages,
              stream: true,
              max_tokens: opts.maxTokens,
            }),
          });
          if (res.ok && res.body) {
            const reader = res.body.getReader();
            const dec = new TextDecoder();
            let buf = "";
            for (;;) {
              const { value, done } = await reader.read();
              if (done) break;
              buf += dec.decode(value, { stream: true });
              const lines = buf.split("\n");
              buf = lines.pop() ?? "";
              for (const line of lines) {
                const t = line.trim();
                if (!t.startsWith("data:")) continue;
                const data = t.slice(5).trim();
                if (data === "[DONE]") continue;
                try {
                  const j = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
                  const text = j.choices?.[0]?.delta?.content;
                  if (text) {
                    emitted = true;
                    send({ type: "delta", text });
                  }
                } catch {
                  /* partial keep-alive line */
                }
              }
            }
          }
        }
        if (!emitted) {
          const full = await opts.fallback();
          send({ type: "delta", text: full });
        }
        send({ type: "done" });
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          send({ type: "error", error: err instanceof Error ? err.message : "AI request failed" });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
