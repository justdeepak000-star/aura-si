import { createFileRoute } from "@tanstack/react-router";

/**
 * Forgot-password via 6-digit code e-mailed through EmailJS.
 * Stateless: the code is bound to an HMAC-signed ticket (server secret), so
 * nothing is stored and the code never reaches the browser.
 */
const SERVICE_ID = "service_kqacpqb";
const TEMPLATE_ID = "template_lgh64qd";
const PUBLIC_KEY = "lUednuFloEpfYtPz7";
const TTL = 10 * 60 * 1000;

const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/=+$/, "");

async function sign(payload: string) {
  const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function findUserId(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

export const Route = createFileRoute("/api/auth-otp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { action?: string; email?: string; code?: string; ticket?: string; password?: string };
        try { body = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }
        const email = (body.email ?? "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email ID." }, 400);

        if (body.action === "signup") {
          if ((body.password ?? "").length < 6) return json({ error: "Password must be at least 6 characters." }, 400);
          if (await findUserId(email)) return json({ error: "Account already exists. Please sign in." }, 409);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.auth.admin.createUser({ email, password: body.password, email_confirm: true });
          if (error) return json({ error: error.message }, 400);
          return json({ ok: true });
        }

        if (body.action === "send") {
          const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
          const exp = Date.now() + TTL;
          const ticket = `${exp}.${await sign(`otp|${email}|${code}|${exp}`)}`;
          const userId = await findUserId(email);
          if (userId) {
            const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
              method: "POST",
              headers: { "Content-Type": "application/json", Origin: "https://aura-artifical.lovable.app" },
              body: JSON.stringify({
                service_id: SERVICE_ID, template_id: TEMPLATE_ID, user_id: PUBLIC_KEY,
                template_params: { email, to_email: email, passcode: code, otp: code },
              }),
            });
            if (!res.ok) {
              console.warn("[aura] emailjs failed", res.status, await res.text());
              return json({ error: "Could not send the code email. Try again." }, 502);
            }
          }
          return json({ ticket });
        }

        if (body.action === "verify") {
          const code = (body.code ?? "").replace(/\D/g, "");
          const [expS, sig] = (body.ticket ?? "").split(".");
          const exp = Number(expS);
          if (code.length !== 6 || !exp || Date.now() > exp) return json({ error: "Code expired. Request a new one." }, 400);
          if (sig !== (await sign(`otp|${email}|${code}|${exp}`))) return json({ error: "Invalid code." }, 400);
          const rexp = Date.now() + TTL;
          return json({ resetTicket: `${rexp}.${await sign(`reset|${email}|${rexp}`)}` });
        }

        if (body.action === "reset") {
          const [expS, sig] = (body.ticket ?? "").split(".");
          const exp = Number(expS);
          if (!exp || Date.now() > exp || sig !== (await sign(`reset|${email}|${exp}`))) {
            return json({ error: "Session expired. Request a new code." }, 400);
          }
          if ((body.password ?? "").length < 6) return json({ error: "Password must be at least 6 characters." }, 400);
          const userId = await findUserId(email);
          if (!userId) return json({ error: "Account not found." }, 404);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: body.password });
          if (error) return json({ error: "Could not update password." }, 500);
          return json({ ok: true });
        }
        return json({ error: "Unknown action" }, 400);
      },
    },
  },
});
