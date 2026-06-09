"use client";

import { useGSAP } from "@gsap/react";
import { useRef } from "react";

import { popIn } from "@/lib/animate";

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      popIn("[data-pop]", { stagger: 0.12 });
    },
    { scope: ref },
  );

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div ref={ref} className="w-full max-w-sm">
        <div data-pop className="mb-8 text-center">
          <span className="comic-border shine inline-block -rotate-2 rounded-2xl bg-zap px-6 py-2 font-display text-5xl tracking-wider shadow-comic-lg">
            BOOKLY
          </span>
          <p className="mt-4 font-bold text-muted">{title}</p>
        </div>
        <div data-pop className="comic-border rounded-card bg-panel p-6 shadow-comic-xl">
          {children}
        </div>
      </div>
    </div>
  );
}
