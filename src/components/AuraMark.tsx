/**
 * AURA brand mark — exact glyph cut from the reference screenshots.
 * "login" = metallic mark, "home" = blue/purple header mark.
 */
export function AuraLogo({
  size = 64,
  className = "",
  variant = "login",
}: {
  size?: number;
  className?: string;
  variant?: "login" | "home";
}) {
  const src = variant === "home" ? "/aura-mark-home.png" : "/aura-mark.png";
  const ratio = variant === "home" ? 66 / 78 : 167 / 196;
  return (
    <img
      src={src}
      alt="AURA"
      width={size}
      height={Math.round(size * ratio)}
      style={{ width: size, height: Math.round(size * ratio) }}
      className={`select-none object-contain ${className}`}
    />
  );
}

export function AuraWordmark({
  className = "",
  size = "text-2xl",
}: {
  className?: string;
  size?: string;
}) {
  return (
    <span
      className={`font-aura ${size} bg-gradient-to-b from-[oklch(1_0_0)] to-[oklch(0.72_0.02_285)] bg-clip-text text-transparent ${className}`}
      style={{ paddingRight: "0.42em" }}
    >
      Aura
    </span>
  );
}
