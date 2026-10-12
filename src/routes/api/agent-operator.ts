import { createFileRoute } from "@tanstack/react-router";

const SYSTEM = `You are AURA Operator, an autonomous mobile GUI agent controlling an Android phone like a human.
Each turn you get: the GOAL, the HISTORY of actions you already did, and the CURRENT SCREEN as a list of elements:
{i:index, t:text, d:description, h:hint, c:class, click, edit, scroll, pwd, b:[left,top,right,bottom]}.
Pick exactly ONE next action. Return ONLY JSON:
{"thought":"short reasoning","action":"tap|type|enter|scroll|swipe|long_press|back|home|open_app|wait|done|handoff","index":0,"text":"","direction":"down","x":0,"y":0,"app":"","status":"2-4 word status for the user"}
Rules:
- Prefer "tap" with an element index. Use x,y only when no element fits.
- "type" puts text into element index (an editable field); follow with "enter" or tapping the search/send button.
- Dismiss popups, ads, cookie banners, "Skip", "Not now", "Allow" (only harmless ones) automatically.
- If the screen did not change after your last action, try a different approach (scroll, back, another element). Never repeat the same failing action 3 times.
- SAFETY: if the screen asks for a password, OTP, UPI PIN, card number/CVV, bank login, or a final irreversible "Pay"/"Place order"/"Confirm payment"/"Delete account" — return {"action":"handoff","text":"what the user must do"}. Never type secrets.
- When the goal is fully achieved return {"action":"done","text":"short result summary in the user's language"}.
- STRICT STOP: check HISTORY first. If the message was already typed and Send/Enter was pressed, or the search/result/screen the goal asked for is visible, return "done" IMMEDIATELY. Never send a message twice, never type the same text again, never do extra taps after the goal is met.
- Understand the goal by meaning, not exact words: tolerate spelling mistakes, Tenglish, Telugu, slang (e.g. "watsap", "yt", "msg chey").
- Read the screen carefully: match elements by text (t), description (d), hint (h) and class; prefer clickable/editable ones; use bounds to pick the right row.
- If the goal is impossible return {"action":"done","text":"why"}.
- You can operate ANY app. To switch apps use {"action":"open_app","app":"label","package":"pkg"} choosing from INSTALLED APPS. Search bars are usually at the top (magnifier icon, "Search" hint); toggles are Switch class; use scroll to find items not visible.`;

export const Route = createFileRoute("/api/agent-operator")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } });
        try {
          const { goal, history, screen, apps } = (await request.json()) as {
            goal?: string; history?: string[]; apps?: string; screen?: { package?: string; width?: number; height?: number; nodes?: unknown[] };
          };
          const nodes = JSON.stringify((screen?.nodes ?? []).slice(0, 180)).slice(0, 14000);
          const user = `GOAL: ${String(goal ?? "").slice(0, 600)}
INSTALLED APPS: ${String(apps ?? "").slice(0, 3000)}
HISTORY:\n${(history ?? []).slice(-12).map((h, k) => `${k + 1}. ${h}`).join("\n") || "(none)"}
CURRENT APP: ${screen?.package ?? "?"}  SCREEN: ${screen?.width}x${screen?.height}
ELEMENTS: ${nodes}`;
          const { routeChatCompletion } = await import("@/lib/omniroute/router.server");
          const r = await routeChatCompletion({
            tier: "utility",
            routeKey: "agent-operator",
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: user },
            ],
          });
          const m = r.content.match(/\{[\s\S]*\}/);
          return json(m ? JSON.parse(m[0]) : { action: "wait" });
        } catch {
          return json({ action: "wait", thought: "planner unavailable" });
        }
      },
    },
  },
});
