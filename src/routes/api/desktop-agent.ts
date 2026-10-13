import { createFileRoute } from "@tanstack/react-router";

const SYSTEM = `You are AURA Desktop Operator controlling a Windows laptop like a careful human.
Each turn: GOAL, HISTORY of actions done, ALLOWED FOLDERS, and a SCREENSHOT (coordinates in screenshot pixels).
Return ONLY JSON for ONE next action:
{"thought":"short","action":"click|double_click|right_click|type|key|scroll|open_url|open_app|list_files|make_folder|move_file|read_text|write_text|wait|confirm|done|handoff","x":0,"y":0,"text":"","keys":"","amount":3,"url":"","app":"","path":"","to":"","status":"2-4 word status"}
- key uses SendKeys syntax: {ENTER} {TAB} ^l ^t %{F4} {ESC}. To search the web prefer open_url with a full search URL.
- File actions only inside ALLOWED FOLDERS, with absolute Windows paths. Use list_files before moving.
- SAFETY: never type or read passwords, OTP, PIN, CVV, card numbers or bank logins → "handoff" with what the user must do.
- Before any irreversible step (Pay, Place order, Send email/message, Submit form, Delete, overwriting files) return {"action":"confirm","text":"exact question for the user"} first; after HISTORY shows "USER APPROVED", do it.
- Check HISTORY; never repeat a finished step. If the screen didn't change, try another approach. When done return {"action":"done","text":"short result in the user's language (Telugu/English mix ok)"}.
- Understand Tenglish/Telugu/typos by meaning.
INTELLIGENCE LAYER (think like a smart human assistant, not a literal command runner):
1. INTENT: work out the user's real end result, including implied needs (e.g. "notes ready chey" = research, write a clean well-structured file, save it in Documents, open it).
2. PLAN: keep a short step plan in "thought"; choose the fastest reliable path (keyboard shortcuts, direct URLs, Win search) over slow clicking.
3. VERIFY: before each action, compare the screenshot with your last action in HISTORY. Did it work? If not, diagnose why and switch strategy; never repeat the same failing action twice.
4. QUALITY: do the task well, not just minimally — sensible file names, tidy folders, complete content, correct results. Handle popups, logins prompts (handoff) and loading (wait) on your own.
5. FINISH: return "done" only after visually confirming the goal is achieved; the done text says what you did and the result.`;

export const Route = createFileRoute("/api/desktop-agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } });
        try {
          const { goal, history, image, width, height, folders } = (await request.json()) as {
            goal?: string; history?: string[]; image?: string; width?: number; height?: number; folders?: string[];
          };
          const text = `GOAL: ${String(goal ?? "").slice(0, 800)}
ALLOWED FOLDERS: ${(folders ?? []).join("; ")}
HISTORY:\n${(history ?? []).slice(-15).map((h, k) => `${k + 1}. ${String(h).slice(0, 600)}`).join("\n") || "(none)"}
SCREENSHOT: ${width}x${height}`;
          const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
            method: "POST",
            headers: { "Lovable-API-Key": String(process.env.LOVABLE_API_KEY), "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
            body: JSON.stringify({
              model: "openai/gpt-6-astra",
              stream: true,
              store: false,
              reasoning: { effort: "medium" },
              instructions: SYSTEM,
              input: [{ role: "user", content: [{ type: "input_text", text }, ...(image ? [{ type: "input_image", image_url: `data:image/jpeg;base64,${image}` }] : [])] }],
            }),
          });
          if (!r.ok || !r.body) return json({ action: "done", text: r.status === 429 ? "AI busy, కొంచెం సేపు తర్వాత try చేయండి." : r.status === 402 ? "AI credits అయిపోయాయి." : "Planner error" });
          let out = "", buf = "";
          const reader = r.body.getReader(); const dec = new TextDecoder();
          for (;;) {
            const { done, value } = await reader.read(); if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n"); buf = lines.pop() ?? "";
            for (const l of lines) {
              if (!l.startsWith("data:")) continue;
              try { const e = JSON.parse(l.slice(5)); if (e.type === "response.output_text.delta") out += e.delta; } catch {}
            }
          }
          const m = out.match(/\{[\s\S]*\}/);
          return json(m ? JSON.parse(m[0]) : { action: "wait" });
        } catch {
          return json({ action: "wait", thought: "planner unavailable" });
        }
      },
    },
  },
});
