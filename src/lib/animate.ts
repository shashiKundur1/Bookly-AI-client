"use client";

import { gsap } from "gsap";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function popIn(
  targets: gsap.TweenTarget,
  options: { delay?: number; stagger?: number; y?: number; wiggle?: boolean } = {},
) {
  if (prefersReducedMotion()) return;
  const { delay = 0, stagger = 0.05, y = 16, wiggle = true } = options;
  gsap.from(targets, {
    opacity: 0,
    y,
    scale: 0.85,
    rotation: wiggle ? () => gsap.utils.random(-3, 3) : 0,
    duration: 0.45,
    ease: "back.out(2)",
    stagger,
    delay,
    clearProps: "all",
  });
}

export function burst(target: gsap.TweenTarget) {
  if (prefersReducedMotion()) return;
  gsap.fromTo(
    target,
    { scale: 1 },
    {
      keyframes: [
        { scale: 1.45, rotation: -12, duration: 0.12 },
        { scale: 1, rotation: 0, duration: 0.5, ease: "elastic.out(1.2, 0.4)" },
      ],
    },
  );
}

export function shake(target: gsap.TweenTarget) {
  if (prefersReducedMotion()) return;
  gsap.fromTo(
    target,
    { x: 0 },
    { x: -6, duration: 0.05, repeat: 5, yoyo: true, clearProps: "x" },
  );
}
