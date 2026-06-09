"use client";

import { useId, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ label, error, id, className, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-bold text-muted">
        {label}
      </label>
      <input
        id={inputId}
        className={cn(
          "comic-border h-12 w-full rounded-xl bg-panel px-4 font-medium shadow-comic-sm",
          "outline-none transition-colors placeholder:text-faint",
          error ? "border-pow" : "focus:border-boom",
          className,
        )}
        {...props}
      />
      {error ? <p className="text-sm font-bold text-pow">{error}</p> : null}
    </div>
  );
}
