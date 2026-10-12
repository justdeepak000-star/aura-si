import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuraLogo, AuraWordmark } from "@/components/AuraMark";
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, User, UserPlus } from "lucide-react";

type Mode = "signin" | "signup" | "forgot-email" | "otp" | "new-key" | "confirm";

async function otpApi(body: Record<string, string>) {
  const res = await fetch("/api/auth-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export function JarvisLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [booted, setBooted] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const emailRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // A reload always drops out of an in-flight recovery.
    try {
      if (sessionStorage.getItem("jarvis.recovery") === "1") {
        sessionStorage.removeItem("jarvis.recovery");
        void supabase.auth.signOut();
      }
    } catch { /* noop */ }
    const t = window.setTimeout(() => setBooted(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  const resetTransientState = () => {
    setError(null);
    setInfo(null);
  };

  const abortRecovery = () => {
    try { sessionStorage.removeItem("jarvis.recovery"); } catch { /* noop */ }
    void supabase.auth.signOut();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetTransientState();
    setLoading(true);
    try {
      if (mode === "forgot-email") {
        if (!email.trim()) throw new Error("Enter your email ID.");
        const r = await otpApi({ action: "send", email: email.trim() });
        try { sessionStorage.setItem("aura.otpTicket", r.ticket); } catch { /* noop */ }
        setOtp("");
        setMode("otp");
        setInfo("A 6-DIGIT CODE WAS SENT TO YOUR E-MAIL.");
      } else if (mode === "otp") {
        const code = otp.replace(/\D/g, "");
        if (code.length !== 6) throw new Error("Enter the 6-digit code.");
        const r = await otpApi({ action: "verify", email: email.trim(), code, ticket: sessionStorage.getItem("aura.otpTicket") ?? "" });
        try { sessionStorage.setItem("aura.resetTicket", r.resetTicket); } catch { /* noop */ }
        setPassword("");
        setConfirmPassword("");
        setMode("new-key");
        setInfo("CODE VERIFIED. SET A NEW PASSWORD.");
      } else if (mode === "new-key") {
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        await otpApi({ action: "reset", email: email.trim(), password, ticket: sessionStorage.getItem("aura.resetTicket") ?? "" });
        try { sessionStorage.removeItem("aura.otpTicket"); sessionStorage.removeItem("aura.resetTicket"); } catch { /* noop */ }
        setInfo("PASSWORD UPDATED. WELCOME BACK.");
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;


      } else if (mode === "confirm") {
        const code = otp.replace(/\D/g, "");
        if (code.length < 6) throw new Error("Enter the access code from your e-mail.");
        const { data, error: err } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: code,
          type: "signup",
        });
        if (err) throw err;
        if (!data.session) throw new Error("Verification failed. Request a new code.");
        setInfo("OPERATOR VERIFIED. WELCOME.");
      } else if (mode === "signup") {
        if (!email.trim() || !password.trim()) throw new Error("Credentials required.");
        await otpApi({ action: "signup", email: email.trim(), password });
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
        setInfo("ACCOUNT CREATED. WELCOME.");

      } else {
        if (!email.trim() || !password.trim()) throw new Error("Credentials required.");
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      setError(msg);
    }
    setLoading(false);
  };

  const submitLabel = loading
    ? "TRANSMITTING…"
    : mode === "signup"
      ? "CREATE AN ACCOUNT"
      : mode === "forgot-email"
        ? "SEND ACCESS CODE"
        : mode === "otp"
          ? "VERIFY CODE"
          : mode === "confirm"
            ? "ACTIVATE OPERATOR"
            : mode === "new-key"
              ? "SET NEW PASSWORD"
              : "SIGN IN";

  const heading =
    mode === "signup"
      ? "Create a New Account"
      : mode === "forgot-email"
        ? "Password Recovery"
        : mode === "otp"
          ? "Verify Code"
          : mode === "new-key"
            ? "New Password"
            : mode === "confirm"
              ? "Activate Operator"
              : "Welcome Back";

  const subheading =
    mode === "signup"
      ? "Register a new secure identity"
      : mode === "forgot-email"
        ? "We'll transmit an 8-digit access code"
        : mode === "otp"
          ? "Enter the 8-digit access code"
          : mode === "new-key"
            ? "Set and confirm your new password"
            : mode === "confirm"
              ? "Enter the code sent to your e-mail"
              : "Secure login to continue";

  const fieldWrap =
    "flex items-center gap-4 rounded-2xl border border-[oklch(0.4_0.05_270/0.4)] bg-[oklch(0.1_0.02_265/0.7)] px-5 py-4 transition focus-within:border-[color:var(--aura-lav)]/70 focus-within:shadow-[0_0_22px_oklch(0.85_0.01_260/0.28)]";
  const fieldInput =
    "w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-50";

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background px-5 py-10 text-foreground">
      {/* Ambient violet horizon */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[6%] h-[70vmin] w-[130vmin] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,oklch(0.4_0.15_270/0.12),transparent_65%)] blur-2xl" />
        <div className="absolute -left-[40vmin] -top-[50vmin] h-[90vmin] w-[90vmin] rounded-full border-r-2 border-b border-[oklch(0.6_0.2_265/0.7)] shadow-[20px_20px_60px_oklch(0.5_0.22_265/0.35)]" />
        <div className="absolute -right-[45vmin] -bottom-[55vmin] h-[90vmin] w-[90vmin] rounded-full border-l-2 border-t border-[oklch(0.62_0.22_295/0.7)] shadow-[-20px_-20px_60px_oklch(0.55_0.22_295/0.35)]" />
      </div>

      <div
        className={`relative z-10 w-full max-w-md transition-all duration-700 ${
          booted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {/* Brand */}
        <div className="flex flex-col items-center">
          <AuraLogo size={62} />
          <AuraWordmark size="text-[34px]" className="mt-4" />
          <p className="mt-3 text-center font-hud text-[11px] tracking-[0.55em] text-muted-foreground">
            AI ASSISTANT
          </p>
        </div>

        {/* Card */}
        <div className="relative mt-8 px-1">
          <h1 className="text-4xl font-light tracking-tight">
            {mode === "signin" ? (
              <>Welcome <span className="bg-gradient-to-r from-[oklch(0.62_0.18_262)] to-[oklch(0.66_0.2_295)] bg-clip-text text-transparent">back</span></>
            ) : heading}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            {mode === "signin" ? "Sign in to continue to your AURA." : subheading}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode !== "new-key" && (
              <div>
                <label className="sr-only">
                  Email ID
                </label>
                <div className={fieldWrap}>
                  <Mail className="h-5 w-5 shrink-0 text-foreground/80" />
                  <input
                    ref={emailRef}
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className={fieldInput}
                    disabled={loading || mode === "otp" || mode === "confirm"}
                  />
                </div>
              </div>
            )}

            {(mode === "signin" || mode === "signup" || mode === "new-key") && (
              <div>
                <label className="sr-only">
                  {mode === "new-key" ? "New Password" : "Password"}
                </label>
                <div className={fieldWrap}>
                  <Lock className="h-5 w-5 shrink-0 text-foreground/80" />
                  <input
                    type={showKey ? "text" : "password"}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "new-key" ? "New password" : "Password"}
                    className={fieldInput}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    aria-label={showKey ? "Hide password" : "Show password"}
                    className="shrink-0 text-muted-foreground transition hover:text-[color:var(--aura-lav)]"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === "signin" && (
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => { resetTransientState(); setMode("forgot-email"); }}
                      className="text-sm text-[oklch(0.72_0.14_255)] transition hover:brightness-125"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
            )}

            {mode === "new-key" && (
              <div>
                <label className="sr-only">
                  Confirm New Password
                </label>
                <div className={fieldWrap}>
                  <Lock className="h-5 w-5 shrink-0 text-foreground/80" />
                  <input
                    type={showKey ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={fieldInput}
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {(mode === "otp" || mode === "confirm") && (
              <div>
                <label className="sr-only">
                  Access Code
                </label>
                <div className={fieldWrap}>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className={`${fieldInput} text-center text-lg tracking-[0.5em]`}
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-[color:var(--jarvis-red)]/50 bg-[color:var(--jarvis-red)]/10 px-3 py-2 text-center text-xs text-[color:var(--jarvis-red)]">
                {error}
              </div>
            )}
            {info && !error && (
              <div className="rounded-xl border border-[color:var(--aura-lav)]/40 bg-[color:var(--aura-lav)]/10 px-3 py-2 text-center text-xs text-[color:var(--aura-lav)]">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="font-hud group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[oklch(0.55_0.2_258)] via-[oklch(0.48_0.24_275)] to-[oklch(0.65_0.2_300)] py-4 text-[13px] tracking-[0.35em] text-white shadow-[0_0_28px_oklch(0.5_0.22_292/0.5)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
            >
              <span className="relative z-10">{submitLabel}</span>
              <ArrowRight className="relative z-10 h-4 w-4" />
              {loading && (
                <span
                  className="absolute inset-y-0 left-0 w-1/2 animate-jarvis-search-bar"
                  style={{ background: "linear-gradient(90deg, transparent, oklch(1 0 0 / 0.25), transparent)" }}
                />
              )}
            </button>

            {mode === "confirm" ? (
              <button
                type="button"
                onClick={() => { resetTransientState(); setOtp(""); setMode("signin"); }}
                className="font-hud w-full rounded-xl border border-[color:var(--aura-lav)]/40 py-3 text-[12px] tracking-[0.18em] text-foreground transition hover:bg-[color:var(--aura-lav)]/10"
              >
                Return to <span className="text-[color:var(--aura-lav)]">Sign In</span>
              </button>
            ) : mode === "forgot-email" || mode === "otp" || mode === "new-key" ? (
              <button
                type="button"
                onClick={() => { resetTransientState(); abortRecovery(); setOtp(""); setPassword(""); setConfirmPassword(""); setMode("signin"); }}
                className="font-hud w-full rounded-xl border border-[color:var(--aura-lav)]/40 py-3 text-[12px] tracking-[0.18em] text-foreground transition hover:bg-[color:var(--aura-lav)]/10"
              >
                Return to <span className="text-[color:var(--aura-lav)]">Sign In</span>
              </button>
            ) : (
              <>
              <div className="flex items-center gap-3 font-hud text-[10px] tracking-[0.3em] text-muted-foreground"><div className="h-px flex-1 bg-border" />OR<div className="h-px flex-1 bg-border" /></div>
              <button
                type="button"
                onClick={() => { resetTransientState(); setMode((m) => (m === "signin" ? "signup" : "signin")); }}
                className="font-hud flex w-full items-center justify-center gap-2 rounded-full border border-[oklch(0.55_0.12_280/0.5)] py-4 text-[12px] tracking-[0.35em] text-foreground transition hover:bg-[color:var(--aura-lav)]/10"
              >
                {mode === "signin" ? (
                  <><UserPlus className="h-5 w-5" /><span className="ml-3">CREATE AN ACCOUNT</span></>
                ) : (
                  <>Have an account? <span className="text-[color:var(--aura-lav)]">Sign In</span></>
                )}
              </button>
              </>
            )}
          </form>

          <div className="mt-10 flex items-center justify-center gap-3 font-hud text-[9px] tracking-[0.3em] text-muted-foreground">
            <ShieldCheck className="h-5 w-5" />
            <span>ENCRYPTED CHANNEL</span><span>•</span><span>AES-256</span>
          </div>
        </div>
      </div>
    </div>
  );
}
