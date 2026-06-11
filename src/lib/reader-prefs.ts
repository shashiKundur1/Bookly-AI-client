"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ReaderPrefs {
  voice: string;
  rate: number;
  emotion: string;
  showCues: boolean;
  setVoice: (voice: string) => void;
  setRate: (rate: number) => void;
  setEmotion: (emotion: string) => void;
  setShowCues: (showCues: boolean) => void;
}

export const useReaderPrefs = create<ReaderPrefs>()(
  persist(
    (set) => ({
      voice: "af_heart",
      rate: 1,
      emotion: "narrator",
      showCues: true,
      setVoice: (voice) => set({ voice }),
      setRate: (rate) => set({ rate }),
      setEmotion: (emotion) => set({ emotion }),
      setShowCues: (showCues) => set({ showCues }),
    }),
    { name: "bookly-reader-prefs" },
  ),
);
