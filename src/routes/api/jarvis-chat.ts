import { createFileRoute } from "@tanstack/react-router";
import type { ChatMessage, ContentBlock } from "@/lib/omniroute/router.server";
import { resolvePersona } from "@/lib/jarvisPersonas";

const BASE_PROMPT = `You are AURA, an advanced, intelligent and elegant AI assistant created by Deepak. Your name is strictly AURA. Never call yourself JARVIS or mention Tony Stark or Iron Man. If asked who you are, your name, or who made you, answer that you are AURA, created by Deepak.

ABOUT YOURSELF (explain confidently when users ask what you can do):
AURA has two parts:
1) AURA Website (this web app, works on phone and laptop browsers): voice and text chat, live voice conversation, reading uploaded PDFs, documents, images and code, coding and debugging, study help (notes, summaries, step-by-step answers), long-term memory of the user's details and past chats, and a Lovable-style App & Website Builder that writes complete websites/apps and shows them in a live preview with mobile/tablet/desktop views, download and open-in-new-tab.
2) AURA Desktop (a free Windows companion downloaded from the /desktop page): one file to open; it installs anything it needs with the user's permission and connects to the website automatically, no pairing code. When connected, AURA can look at the laptop screen, move and click the mouse, type and press shortcut keys, open apps and websites, and manage files in Downloads, Documents and Desktop (list, create folders, move, rename, read and write text files).
Safety: AURA Desktop never touches passwords, .env, keys, credentials or wallets, stays inside allowed folders, and stops immediately when the user presses Pause or closes it.
If a user asks for a laptop action and the desktop is not connected, tell them to download AURA Desktop from the /desktop page. Without it, you can still chat, build apps, analyse files and help with study.
MOBILE USERS: If the user asks (from a phone) for any laptop/computer task (control screen, open apps, manage files, type, click, run code on PC), reply politely and respectfully, e.g. "క్షమించండి, ఈ పని మీ ల్యాప్‌టాప్‌లోనే చేయగలను. దయచేసి మీ ల్యాప్‌టాప్‌లో https://aura-si.lovable.app/download లింక్ ఓపెన్ చేసి AURA Desktop డౌన్‌లోడ్ చేసుకోండి — అది ఆటోమేటిక్‌గా కనెక్ట్ అవుతుంది, తర్వాత మీరు చెప్పిన పని నేను పూర్తి చేస్తాను." (in English if the user writes English). Always include that exact link.

CRITICAL LANGUAGE RULE:
- Detect the language of the user's message.
- If the user speaks or writes in Telugu (even in Roman script / Tenglish), reply in NATURAL TELUGU using Telugu script (తెలుగు).
- If the user speaks English, reply in English.
- If the user mixes them, reply in the dominant language.

When the user attaches an image, analyze it carefully and answer questions about it. Describe what you see, identify objects, read any text, and respond to the user's request about the image.

ADAPTIVE ANSWER LENGTH (typed chat, like ChatGPT):
- Answer the actual question in the first sentence. No greetings, no "Sure!", no restating the question.
- Simple/factual question → a direct answer in one to three sentences.
- Explanation or how-to → clear steps or paragraphs with a practical example.
- Complex technical question → structured, thorough answer: headings, lists, tables when comparing, fenced code blocks with a language tag.
- If the user asks for "short", "one line", "brief" or "detailed", follow that exactly; it overrides the rules above.
- No filler, no repetition, no unrelated background, no generic closing paragraph or offers to help further.
Use clean Markdown. Put prompts the user should copy in a fenced block.

APP & WEBSITE BUILDER (like Lovable):
When the user asks to build/make/create a website, web app, landing page, store, dashboard, game or tool:
- Reply with ONE short line describing what you built, then ONE complete \`\`\`html fenced block containing the whole working app in a single file.
- Load Tailwind via <script src="https://cdn.tailwindcss.com"></script>; icons via https://unpkg.com/lucide@latest (call lucide.createIcons()). Use real photos from https://images.unsplash.com/ or https://picsum.photos/.
- Big sites: multiple pages/sections switched with JS (hash router), working nav, search/filters, cart, modals, forms with validation, localStorage persistence, responsive mobile layout, polished modern design, smooth animations, realistic content (no lorem ipsum).
- Never leave TODOs or placeholder functions; every button must work.
- When the user asks for changes to a previous app, return the FULL updated html file (not a diff), keeping everything else intact.`;

const VOICE_PROMPT = `VOICE MODE: reply will be spoken aloud. Answer in ONE crisp spoken sentence (10-15 words max), plain prose — no markdown, emojis, lists or code. Only go longer if the user explicitly asks for detail.`;

const MODE_PROMPTS: Record<string, string> = {
  general: "MODE: GENERAL. Be a helpful, polite, and efficient AI voice assistant with a balanced tone across everyday topics.",
  developer:
    "MODE: DEVELOPER. Focus on software engineering, debugging, and technical problem solving. Provide direct, correct code snippets when useful.",
  creative:
    "MODE: CREATIVE. Be highly imaginative, conversational, and offer unique perspectives, metaphors, and ideas for brainstorming.",
};

function lastUserText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    return (m.content as ContentBlock[])
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join(" ");
  }
  return "";
}

export const Route = createFileRoute("/api/jarvis-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          messages?: ChatMessage[];
          mode?: string;
          persona?: string;
          memories?: string[];
          grounding?: boolean;
          voice?: boolean;
          stream?: boolean;
          auraModel?: string;
          knowledge?: Array<{ source?: string; content?: string }>;
        };
        const history = Array.isArray(body.messages) ? body.messages : [];
        const persona = resolvePersona(body.persona);
        const mode = MODE_PROMPTS[body.mode ?? "general"] ?? MODE_PROMPTS.general;

        const sections = [BASE_PROMPT, persona.personality, mode];
        if (body.voice) sections.push(VOICE_PROMPT);

        const memories = (body.memories ?? []).filter((m) => typeof m === "string" && m.trim());
        if (memories.length) {
          sections.push(
            `LONG-TERM MEMORY about this user (remember and use naturally, never recite the whole list):\n- ${memories
              .slice(0, 40)
              .join("\n- ")}`,
          );
        }

        // Retrieved knowledge (RAG). Provided by the client after an
        // authenticated, user-scoped vector search. Never fabricate beyond it.
        const knowledge = (body.knowledge ?? [])
          .filter((k) => typeof k?.content === "string" && k.content!.trim())
          .slice(0, 6);
        if (knowledge.length) {
          sections.push(
            `RETRIEVED KNOWLEDGE from the user's own documents. Use it when it answers the question, and mention the source name naturally if helpful. If it does not contain the answer, say you don't have it in their documents and answer from general knowledge instead — never invent document contents.\n\n${knowledge
              .map(
                (k, i) =>
                  `[${i + 1}] ${k.source ?? "document"}:\n${k.content!.slice(0, 1500)}`,
              )
              .join("\n\n")}`,
          );
        }


        // If any message carries an image, route to a vision-capable model tier.
        const hasImage = history.some(
          (m) =>
            Array.isArray(m.content) &&
            (m.content as ContentBlock[]).some((c) => c.type === "image_url"),
        );

        // ── Web-search grounding ──────────────────────────────────────────
        const query = lastUserText(history).trim();

        // AURA Local Brain: instant private answers, no provider call.
        if (!hasImage && !body.auraModel?.includes("Ultra")) {
          const { localAnswer } = await import("@/lib/auraBrain");
          const local = localAnswer(query);
          if (local) {
            if (body.stream && !body.voice) {
              const out = JSON.stringify({ type: "delta", text: local }) + "\n" + JSON.stringify({ type: "done" }) + "\n";
              return new Response(out, { headers: { "Content-Type": "application/x-ndjson" } });
            }
            return Response.json({ reply: local, provider: "aura-local", model: "aura-brain" });
          }
        }
        let sources: Array<{ title: string; snippet: string; url: string }> = [];
        if (!hasImage && query && body.grounding !== false) {
          const { needsGrounding, webSearch, formatGrounding } = await import(
            "@/lib/websearch.server"
          );
          if (body.grounding === true || needsGrounding(query)) {
            const results = await Promise.race([
              webSearch(query),
              new Promise<Awaited<ReturnType<typeof webSearch>>>((r) => setTimeout(() => r([]), 700)),
            ]);
            sources = results;
            const block = formatGrounding(query, results);
            if (block) sections.push(block + "\nCite facts inline with bracket numbers like [1], [2] matching the results.");
          }
        }

        const fullMessages: ChatMessage[] = [
          { role: "system", content: sections.join("\n\n") },
          ...history,
        ];

        // Paid plans: verify an active subscription server-side before any upstream call.
        const paidPlan = body.auraModel === "AURA Ultra" ? "ultra" : body.auraModel === "AURA Flash" ? "flash" : null;
        if (paidPlan) {
          const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
          if (!token) return Response.json({ error: "Sign in and subscribe to use this model." }, { status: 403 });
          const { createClient } = await import("@supabase/supabase-js");
          const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false },
          });
          const { data } = await sb
            .from("aura_subscriptions")
            .select("current_period_end")
            .eq("plan", paidPlan)
            .eq("status", "active")
            .gt("current_period_end", new Date().toISOString())
            .maybeSingle();
          if (!data) return Response.json({ error: "Subscription required." }, { status: 403 });
        }

        // AURA Ultra & AURA Flash → Deepak's own GPU brain only.
        if (paidPlan) {
          const { auraGpuBrainChat } = await import("@/lib/auraGpuBrain.server");
          try {
            const reply = await auraGpuBrainChat(fullMessages, request.signal);
            if (body.stream && !body.voice) {
              const out = JSON.stringify({ type: "delta", text: reply }) + "\n" + JSON.stringify({ type: "done" }) + "\n";
              return new Response(out, { headers: { "Content-Type": "application/x-ndjson" } });
            }
            return Response.json({ reply, provider: "aura-gpu-brain", model: "qwen2.5-3b-instruct-aura" });
          } catch (err) {
            const message = err instanceof Error ? err.message : "AURA Brain unavailable";
            return Response.json({ error: `${message}. Please try again shortly.` }, { status: 503 });
          }
        }

        if (body.auraModel === "AURA Ultra") {
          const { auraGatewayChat, AuraGatewayError } = await import("@/lib/auraGateway.server");
          try {
            const result = await auraGatewayChat(fullMessages);
            return new Response(
              JSON.stringify({ reply: result.content, provider: result.provider, model: result.model }),
              { headers: { "Content-Type": "application/json" } },
            );
          } catch (err) {
            const status = err instanceof AuraGatewayError ? err.status : 500;
            const message = err instanceof AuraGatewayError ? err.message : "AI request failed";
            return new Response(JSON.stringify({ error: message }), {
              status,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        // AURA Lite / AURA Flash → OmniRoute (unchanged).
        const { routeChatCompletion, OmniRouteError } = await import(
          "@/lib/omniroute/router.server"
        );
        if (body.stream && !body.voice && !hasImage) {
          const { streamChatResponse } = await import("@/lib/chatStream.server");
          return streamChatResponse({
            messages: fullMessages,
            sources,
            maxTokens: 4096,
            signal: request.signal,
            fallback: async () =>
              (await routeChatCompletion({ messages: fullMessages, tier: "text", routeKey: "chat", maxTokens: 4096, continueOnTruncation: true })).content,
          });
        }
        try {
          const result = await routeChatCompletion({
            messages: fullMessages,
            tier: hasImage ? "vision" : "text",
            routeKey: hasImage ? "chat:vision" : "chat",
            maxTokens: body.voice ? 120 : 4096,
            continueOnTruncation: !body.voice,
          });
          return new Response(
            JSON.stringify({
              reply: result.truncated ? `${result.content}\n\n_(Reply was cut off — ask me to continue.)_` : result.content,
              provider: result.provider,
              model: result.model,
              truncated: !!result.truncated,
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          const status = err instanceof OmniRouteError ? err.status : 500;
          const message = err instanceof Error ? err.message : "AI routing failed";
          return new Response(JSON.stringify({ error: message }), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
