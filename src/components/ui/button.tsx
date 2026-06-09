"use client";

import { gsap } from "gsap";
import { useRef, type ButtonHTMLAttributes } from "react";

import { prefersReducedMotion } from "@/lib/animate";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/ui/spinner";

const variants = {
  primary: "bg-zap text-ink",
  blue: "bg-boom text-white",
  ghost: "bg-panel text-ink",
  danger: "bg-pow text-white",
} as const;

const sizes = {
  sm: "h-9 gap-1.5 rounded-xl px-3 text-sm",
  md: "h-11 gap-2 rounded-xl px-5",
  lg: "h-[52px] gap-2 rounded-2xl px-6 text-lg",
} as const;

const RAISED_SHADOW = "4px 4px 0 0 #221a10";
const PRESSED_SHADOW = "1px 1px 0 0 #221a10";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const inactive = disabled || loading;

  const animate = (vars: gsap.TweenVars) => {
    if (inactive || prefersReducedMotion() || ref.current === null) return;
    gsap.to(ref.current, { overwrite: "auto", ...vars });
  };

  return (
    <button
      ref={ref}
      onMouseEnter={() => animate({ scale: 1.04, rotation: -1, duration: 0.3, ease: "back.out(3)" })}
      onMouseLeave={() =>
        animate({ scale: 1, rotation: 0, x: 0, y: 0, boxShadow: RAISED_SHADOW, duration: 0.3, ease: "back.out(2)" })
      }
      onPointerDown={() =>
        animate({ x: 3, y: 3, scale: 0.97, boxShadow: PRESSED_SHADOW, duration: 0.08, ease: "power2.out" })
      }
      onPointerUp={() =>
        animate({ x: 0, y: 0, scale: 1, boxShadow: RAISED_SHADOW, duration: 0.5, ease: "elastic.out(1, 0.5)" })
      }
      className={cn(
        "comic-border shine inline-flex select-none items-center justify-center font-bold shadow-comic",
        "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-boom",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={inactive}
      {...props}
    >
      {loading ? <Spinner className="text-current" /> : null}
      {children}
    </button>
  );
}
