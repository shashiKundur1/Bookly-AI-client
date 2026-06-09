"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { useRef } from "react";
import { create } from "zustand";

import { prefersReducedMotion } from "@/lib/animate";
import { cn } from "@/lib/cn";

type Tone = "error" | "success";

interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (message: string, tone: Tone) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, tone) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, message, tone }] }));
    setTimeout(() => {
      useToastStore.getState().dismiss(id);
    }, 4000);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export function toast(message: string, tone: Tone = "error") {
  useToastStore.getState().push(message, tone);
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.from(ref.current, {
      y: -48,
      opacity: 0,
      scale: 0.8,
      rotation: 3,
      duration: 0.45,
      ease: "back.out(2.2)",
    });
  }, []);

  return (
    <button
      ref={ref}
      onClick={onDismiss}
      className={cn(
        "comic-border shine pointer-events-auto max-w-sm rounded-xl px-4 py-2.5 text-left text-sm font-bold shadow-comic",
        item.tone === "error" ? "bg-pow text-white" : "bg-grass text-white",
      )}
    >
      {item.message}
    </button>
  );
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4">
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
      ))}
    </div>
  );
}
