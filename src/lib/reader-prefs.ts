"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ReaderPrefs {
  voice: string;
  rate: number;
  setVoice: (voice: string) => void;
  setRate: (rate: number) => void;
}

export const useReaderPrefs = create<ReaderPrefs>()(
  persist(
    (set) => ({
      voice: "af_heart",
      rate: 1,
      setVoice: (voice) => set({ voice }),
      setRate: (rate) => set({ rate }),
    }),
    { name: "bookly-reader-prefs" },
  ),
);
