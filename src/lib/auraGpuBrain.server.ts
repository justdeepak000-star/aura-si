/**
 * AURA GPU Brain — Deepak's fine-tuned Qwen2.5-3B running on a Colab Tesla T4,
 * exposed through a Cloudflare tunnel (OpenAI-compatible /v1/chat/completions).
 * Used exclusively by the AURA Ultra and AURA Flash models.
 * The tunnel URL changes on every Colab run: set AURA_BRAIN_URL to override.
 */
import type { ChatMessage } from "@/lib/omniroute/router.server";

const DEFAULT_URL = "https://introductory-automobiles-usage-council.trycloudflare.com";

function textOf(c: unknown): string {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((b: { text?: string }) => b?.text ?? "").join("");
  return "";
}

export async function auraGpuBrainChat(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const base = (process.env.AURA_BRAIN_URL || DEFAULT_URL).replace(/\/+$/, "").replace(/\/v1\/chat\/completions$/, "");
  const { shield } = await import("@/lib/auraShield.server");
  // Small model: keep the system prompt short and recent history only.
  const system = "You are AURA, a helpful AI assistant created by Deepak. Reply in the user's language. Be clear and concise.";
  const history = messages
    .filter((m) => m.role !== "system")
    .slice(-8)
    .map((m) => ({ role: m.role, content: shield(textOf(m.content)) || " " }));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  signal?.addEventListener("abort", () => ctrl.abort());
  try {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "system", content: system }, ...history], max_tokens: 1024 }),
    });
    if (!res.ok) throw new Error(`AURA Brain offline (${res.status})`);
    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const out = j.choices?.[0]?.message?.content?.trim();
    if (!out) throw new Error("AURA Brain returned an empty reply");
    return out;
  } finally {
    clearTimeout(timer);
  }
}
