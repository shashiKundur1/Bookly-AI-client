"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { useEffect, useRef } from "react";

import { prefersReducedMotion } from "@/lib/animate";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const closeRef = useRef<() => void>(() => {});

  useGSAP(
    () => {
      if (!open || prefersReducedMotion()) return;
      gsap.from(backdropRef.current, { opacity: 0, duration: 0.18 });
      gsap.from(panelRef.current, {
        y: 48,
        scale: 0.85,
        rotation: -2,
        opacity: 0,
        duration: 0.4,
        ease: "back.out(1.8)",
      });
    },
    { dependencies: [open] },
  );

  const close = () => {
    if (closingRef.current) return;
    if (prefersReducedMotion() || panelRef.current === null) {
      onClose();
      return;
    }
    closingRef.current = true;
    gsap.to(backdropRef.current, { opacity: 0, duration: 0.16 });
    gsap.to(panelRef.current, {
      y: 28,
      scale: 0.9,
      opacity: 0,
      duration: 0.18,
      ease: "power2.in",
      onComplete: () => {
        closingRef.current = false;
        onClose();
      },
    });
  };
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div ref={backdropRef} className="absolute inset-0 bg-ink/50" onClick={close} />
      <div
        ref={panelRef}
        className="comic-border relative z-10 max-h-[88dvh] w-full overflow-y-auto overscroll-contain rounded-t-card bg-panel p-5 shadow-comic-xl sm:max-w-md sm:rounded-card"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl tracking-wide">{title}</h2>
          <button
            onClick={close}
            aria-label="Close"
            className="comic-border comic-press rounded-lg bg-panel p-1 shadow-comic-sm"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
