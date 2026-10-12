import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — AURA" },
      { name: "description", content: "How AURA collects, uses and protects your data." },
      { property: "og:title", content: "Privacy Policy — AURA" },
      { property: "og:description", content: "How AURA collects, uses and protects your data." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-foreground space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold">AURA Privacy Policy</h1>
      <p>Last updated: October 2026. AURA is created by Deepak.</p>
      <h2 className="font-semibold text-base">What we collect</h2>
      <p>Your email address for sign-in, the messages you send, files and images you attach, and memories you ask AURA to keep. Microphone and camera are used only while Live Voice or Live Vision is on.</p>
      <h2 className="font-semibold text-base">How we use it</h2>
      <p>Only to answer you, keep your chat history, and remember preferences. We do not sell your data or use it for advertising.</p>
      <h2 className="font-semibold text-base">Mobile app</h2>
      <p>The mobile app does not use Accessibility services and never reads or controls other apps on your phone.</p>
      <h2 className="font-semibold text-base">Payments</h2>
      <p>Paid plans are verified manually. We never store card numbers, UPI PINs or OTPs.</p>
      <h2 className="font-semibold text-base">Your controls</h2>
      <p>You can delete chats, memories or your whole account from settings at any time.</p>
      <h2 className="font-semibold text-base">Contact</h2>
      <p>For privacy questions, contact the AURA team through the app.</p>
    </main>
  );
}
