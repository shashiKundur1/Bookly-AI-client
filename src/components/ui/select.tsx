"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { useEffect, useRef, useState } from "react";

import { prefersReducedMotion } from "@/lib/animate";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  direction?: "down" | "up";
  className?: string;
}

export function Select({
  value,
  options,
  onChange,
  ariaLabel,
  direction = "down",
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointer);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useGSAP(
    () => {
      if (!open || prefersReducedMotion() || panelRef.current === null) return;
      gsap.from(panelRef.current, {
        y: direction === "down" ? -8 : 8,
        scale: 0.92,
        opacity: 0,
        duration: 0.22,
        ease: "back.out(2)",
      });
    },
    { dependencies: [open] },
  );

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="comic-border comic-press flex h-11 w-full items-center justify-between gap-2 rounded-xl bg-panel px-3 font-bold shadow-comic-sm"
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <svg
          viewBox="0 0 24 24"
          className={cn("size-4 shrink-0 transition-transform duration-200", open && "rotate-180")}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            "comic-border absolute left-0 z-50 max-h-64 w-full min-w-36 space-y-0.5 overflow-y-auto overscroll-contain rounded-xl bg-panel p-1 shadow-comic-lg",
            direction === "down" ? "top-[calc(100%+6px)]" : "bottom-[calc(100%+6px)]",
          )}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "block w-full rounded-lg px-3 py-1.5 text-left text-sm font-bold transition-colors",
                option.value === value ? "comic-border bg-zap shadow-comic-sm" : "hover:bg-soft",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
