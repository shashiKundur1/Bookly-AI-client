"use client";

import { useEffect } from "react";

import { cn } from "@/lib/cn";
import { useReaderPrefs } from "@/lib/reader-prefs";
import { useEmotions, useVoices } from "@/lib/queries";
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
  const { voice, rate, emotion, showCues, setVoice, setRate, setEmotion, setShowCues } =
    useReaderPrefs();
  const { data: voices } = useVoices();
  const { data: emotions } = useEmotions();

  useEffect(() => {
    if (voices && voices.length > 0 && !voices.some((option) => option.id === voice)) {
      setVoice(voices[0].id);
    }
  }, [voices, voice, setVoice]);

  return (
    <div className="comic-border mx-auto w-full max-w-3xl rounded-card bg-panel p-3 shadow-comic-lg">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-center gap-2 sm:justify-start">
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
          <button
            aria-label={showCues ? "Hide emotion cues" : "Show emotion cues"}
            aria-pressed={showCues}
            onClick={() => setShowCues(!showCues)}
            className={cn(
              "comic-border comic-press ml-1 grid size-10 place-items-center rounded-full shadow-comic-sm",
              showCues ? "bg-zap" : "bg-panel",
            )}
          >
            <span className="font-display text-xl leading-none">✦</span>
          </button>
        </div>
        <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_4.5rem] gap-2 sm:flex sm:items-center">
          <Select
            ariaLabel="Narration voice"
            direction="up"
            className="w-full sm:w-40"
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
            ariaLabel="Narration emotion"
            direction="up"
            className="w-full sm:w-40"
            value={emotion}
            options={(emotions ?? [{ id: emotion, name: "Emotion", tagline: "" }]).map(
              (option) => ({ value: option.id, label: option.name }),
            )}
            onChange={setEmotion}
          />
          <Select
            ariaLabel="Narration speed"
            direction="up"
            className="w-full sm:w-24"
            value={String(rate)}
            options={RATES.map((option) => ({ value: String(option), label: `${option}x` }))}
            onChange={(next) => setRate(Number(next))}
          />
        </div>
      </div>
    </div>
  );
}
