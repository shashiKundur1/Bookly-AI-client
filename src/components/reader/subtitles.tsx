"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { useRef } from "react";

import { prefersReducedMotion } from "@/lib/animate";
import { cn } from "@/lib/cn";
import { useReaderPrefs } from "@/lib/reader-prefs";
import { Spinner } from "@/components/ui/spinner";
import type { Narration } from "@/components/reader/use-narration";

const CUE_LABELS: Record<string, string> = {
  laugh: "laughs",
  chuckle: "chuckles",
  sigh: "sighs",
  exhale: "breathes",
  gasp: "gasps",
  groan: "groans",
  yawn: "yawns",
  sniffle: "sniffles",
  cry: "sobs",
  cough: "coughs",
};

function CueChip({ cue }: { cue: string }) {
  const label = CUE_LABELS[cue];
  if (!label) return null;
  return (
    <span className="mx-1 inline-block -rotate-2 rounded-md bg-zap/20 px-1.5 font-display text-xs tracking-wide text-zap sm:text-sm">
      ✦ {label}
    </span>
  );
}

export function NarrationSubtitles({ narration, raised }: { narration: Narration; raised: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const showCues = useReaderPrefs((prefs) => prefs.showCues);
  const sentence = narration.activeSentence >= 0 ? narration.sentences[narration.activeSentence] : null;
  const preparing = narration.loading && !sentence;

  useGSAP(
    () => {
      if (!sentence || prefersReducedMotion() || boxRef.current === null) return;
      gsap.fromTo(
        boxRef.current,
        { y: 10, scale: 0.97, opacity: 0.6 },
        { y: 0, scale: 1, opacity: 1, duration: 0.25, ease: "back.out(1.7)", clearProps: "all" },
      );
    },
    { dependencies: [narration.activeSentence, narration.currentChunk?.id] },
  );

  if (!sentence && !preparing) return null;

  // A trail cue is the narrator catching a breath between sentences: clear
  // the line and show only the breathing beat, like a real reading pause.
  const breakCue = narration.cuePhase === "break" ? sentence?.cues.trail : "";
  if (breakCue && !showCues) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10 flex justify-center px-4 transition-all duration-300",
        raised
          ? "bottom-[10.5rem] sm:bottom-[7.5rem]"
          : "bottom-[max(1.5rem,env(safe-area-inset-bottom))]",
      )}
    >
      <div
        ref={boxRef}
        className="comic-border max-w-2xl rounded-2xl bg-ink/90 px-4 py-2.5 text-center shadow-comic-lg backdrop-blur-sm sm:px-6"
      >
        {preparing ? (
          <span className="inline-flex items-center gap-2 text-sm font-bold text-paper/80 sm:text-base">
            <Spinner className="text-zap" /> Preparing narration…
          </span>
        ) : breakCue ? (
          <span className="inline-block animate-pulse px-2 py-0.5">
            <CueChip cue={breakCue} />
          </span>
        ) : sentence!.words.length > 0 ? (
          <p className="text-balance text-sm font-semibold leading-relaxed text-paper sm:text-lg">
            {showCues && sentence!.cues.lead ? <CueChip cue={sentence!.cues.lead} /> : null}
            {sentence!.words.map((word, index) => (
              <span
                key={`${index}-${word.start}`}
                className={cn(
                  "rounded px-0.5 transition-colors duration-75",
                  index === narration.wordIndex && "bg-zap font-bold text-ink",
                  index > narration.wordIndex && "text-paper/55",
                )}
              >
                {word.word}{" "}
              </span>
            ))}
          </p>
        ) : (
          <p className="text-balance text-sm font-semibold leading-relaxed text-paper sm:text-lg">
            {showCues && sentence!.cues.lead ? <CueChip cue={sentence!.cues.lead} /> : null}
            {sentence!.text}
          </p>
        )}
      </div>
    </div>
  );
}
