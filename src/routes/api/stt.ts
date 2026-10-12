import { createFileRoute } from "@tanstack/react-router";

/**
 * Speech-to-text: Deepgram Nova-2 (fast, primary) → Groq Whisper (fallback).
 * Response: JSON with `text`, or `{ error }` with non-2xx status.
 */
export const Route = createFileRoute("/api/stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

        let file: unknown;
        try {
          file = (await request.formData()).get("file");
        } catch {
          return json({ error: "invalid_form_data" }, 400);
        }
        if (!(file instanceof File) || file.size < 512) return json({ error: "empty_audio" }, 400);

        const dg = process.env["DEEPGRAM_API_KEY"]?.trim();
        if (dg) {
          try {
            const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true", {
              method: "POST",
              headers: { Authorization: `Token ${dg}`, "Content-Type": file.type || "audio/webm" },
              body: await file.arrayBuffer(),
            });
            if (res.ok) {
              const d = await res.json();
              const text: string = d?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
              if (text.trim()) return json({ text, provider: "deepgram" });
            } else console.warn(`[aura] deepgram stt failed (${res.status})`);
          } catch (e) {
            console.warn("[aura] deepgram error", e);
          }
        }

        const key = process.env["GROQ_API_KEY"]?.trim();
        if (!key) return json({ text: "" });
        const upstream = new FormData();
        upstream.append("model", "whisper-large-v3-turbo");
        upstream.append("response_format", "json");
        upstream.append("file", file, file.name || "recording.wav");
        try {
          const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
            body: upstream,
          });
          const text = await res.text();
          if (!res.ok) return json({ error: "stt_failed" }, res.status);
          return new Response(text, { status: 200, headers: { "Content-Type": "application/json" } });
        } catch {
          return json({ error: "stt_unreachable" }, 502);
        }
      },
    },
  },
});
