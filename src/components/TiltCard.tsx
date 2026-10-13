import { useRef, type ReactNode } from "react";

export function TiltCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateX(${-y * 14}deg) rotateY(${x * 14}deg) translateZ(10px)`;
    el.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
    el.style.setProperty("--gy", `${(y + 0.5) * 100}%`);
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ""; };
  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave}
      className={`relative overflow-hidden transition-transform duration-200 ease-out [transform-style:preserve-3d] ${className}`}>
      <div className="pointer-events-none absolute inset-0 opacity-0 hover:opacity-100 transition-opacity"
        style={{ background: "radial-gradient(circle at var(--gx,50%) var(--gy,50%), color-mix(in oklab, var(--primary) 25%, transparent), transparent 60%)" }} />
      {children}
    </div>
  );
}
