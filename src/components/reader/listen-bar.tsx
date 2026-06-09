"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";
import { useReaderPrefs } from "@/lib/reader-prefs";
import { useVoices } from "@/lib/queries";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { Narration } from "@/components/reader/use-narration";

const RATES = [0.8, 1, 1.25, 1.5, 2];

function ControlButton({
  label,
  onClick,
  children,
  primary = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={cn(
        "comic-border comic-press grid place-items-center rounded-full shadow-comic-sm",
        primary ? "size-12 bg-zap" : "size-10 bg-panel",
      )}
    >
      {children}
    </button>
  );
}

export function ListenBar({ narration }: { narration: Narration }) {
  const { voice, rate, setVoice, setRate } = useReaderPrefs();
  const { data: voices } = useVoices();
  const wordContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = wordContainerRef.current;
    const active = container?.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [narration.wordIndex]);

  return (
    <div className="comic-border mx-auto w-full max-w-3xl rounded-card bg-panel p-3 shadow-comic-lg">
      <div
        ref={wordContainerRef}
        className="no-scrollbar mb-3 max-h-16 overflow-y-auto overscroll-contain rounded-xl bg-soft px-3 py-2 text-sm font-medium leading-relaxed"
      >
        {narration.loading ? (
          <span className="inline-flex items-center gap-2 font-bold text-muted">
            <Spinner className="text-muted" /> Preparing narration…
          </span>
        ) : narration.words.length > 0 ? (
          narration.words.map((word, index) => (
            <span
              key={`${index}-${word.start}`}
              data-active={index === narration.wordIndex}
              className={cn(
                "rounded px-0.5 transition-colors duration-75",
                index === narration.wordIndex && "bg-zap font-bold",
                index < narration.wordIndex && "text-muted",
              )}
            >
              {word.word}{" "}
            </span>
          ))
        ) : (
          <span className="font-bold text-muted">Press play to start listening</span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ControlButton label="Previous chunk" onClick={() => narration.skip(-1)}>
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
              <path d="M6 6h2v12H6zM20 6v12l-9-6z" />
            </svg>
          </ControlButton>
          <ControlButton
            label={narration.playing ? "Pause" : "Play"}
            primary
            onClick={() => (narration.playing ? narration.pause() : narration.play())}
          >
            {narration.loading ? (
              <Spinner className="text-ink" />
            ) : narration.playing ? (
              <svg viewBox="0 0 24 24" className="size-6" fill="currentColor">
                <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="size-6" fill="currentColor">
                <path d="M8 5l11 7-11 7z" />
              </svg>
            )}
          </ControlButton>
          <ControlButton label="Next chunk" onClick={() => narration.skip(1)}>
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
              <path d="M16 6h2v12h-2zM4 6v12l9-6z" />
            </svg>
          </ControlButton>
        </div>
        <div className="flex items-center gap-2">
          <Select
            ariaLabel="Narration voice"
            direction="up"
            className="w-40"
            value={voice}
            options={(voices ?? [{ id: voice, name: "Voice", gender: "", accent: "" }]).map(
              (option) => ({
                value: option.id,
                label: option.accent ? `${option.name} (${option.accent})` : option.name,
              }),
            )}
            onChange={setVoice}
          />
          <Select
            ariaLabel="Narration speed"
            direction="up"
            className="w-24"
            value={String(rate)}
            options={RATES.map((option) => ({ value: String(option), label: `${option}x` }))}
            onChange={(next) => setRate(Number(next))}
          />
        </div>
      </div>
    </div>
  );
}
