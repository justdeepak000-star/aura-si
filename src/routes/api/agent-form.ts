import { createFileRoute } from "@tanstack/react-router";

const MAP = `You fill phone forms for the user. Given FIELDS (index, label, current value) and the user's PROFILE (key: value), return ONLY JSON {"fill":[{"i":index,"value":"text"}],"missing":["label"]}.
Rules: match fields to profile keys by meaning (e.g. "Mobile" = phone, "Full name" = name, "Pincode" = postcode). Never invent or guess values. If a required-looking field has no profile match, put its human label in "missing". Skip fields that already contain a correct value. NEVER fill passwords, OTP, PIN, CVV or card numbers.`;
const EXTRACT = `Extract the requested item from the visible screen text. Return ONLY JSON {"value":"..."} with the exact short value (e.g. song name with artist, address, phone, ingredient list comma separated). Empty string if not present. Never invent.`;

export const Route = createFileRoute("/api/agent-form")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const b = (await request.json()) as { mode?: string; fields?: unknown; profile?: unknown; what?: string; text?: string };
        const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } });
        const extract = b.mode === "extract";
        const user = extract
          ? `WANT: ${String(b.what ?? "").slice(0, 200)}\nSCREEN: ${String(b.text ?? "").slice(0, 4000)}`
          : `FIELDS: ${JSON.stringify(b.fields ?? []).slice(0, 4000)}\nPROFILE: ${JSON.stringify(b.profile ?? {}).slice(0, 3000)}`;
        try {
          const { routeChatCompletion } = await import("@/lib/omniroute/router.server");
          const r = await routeChatCompletion({
            tier: "utility",
            routeKey: extract ? "agent-extract" : "agent-form",
            messages: [{ role: "system", content: extract ? EXTRACT : MAP }, { role: "user", content: user }],
          });
          const m = r.content.match(/\{[\s\S]*\}/);
          return json(m ? JSON.parse(m[0]) : {});
        } catch {
          return json(extract ? { value: "" } : { fill: [], missing: [] });
        }
      },
    },
  },
});
