"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { narrationApi } from "@/lib/api";
import { usePageContent } from "@/lib/queries";
import { toast } from "@/components/ui/toast";
import type { Chunk, WordTiming } from "@/lib/types";

interface NarrationOptions {
  bookId: string;
  pageCount: number;
  page: number;
  setPage: (page: number) => void;
  voice: string;
  rate: number;
  enabled: boolean;
}

export function useNarration({
  bookId,
  pageCount,
  page,
  setPage,
  voice,
  rate,
  enabled,
}: NarrationOptions) {
  const [chunkIndex, setChunkIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [words, setWords] = useState<WordTiming[]>([]);
  const [wordIndex, setWordIndex] = useState(-1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tokenRef = useRef(0);
  const wantsPlaybackRef = useRef(false);
  const chunksRef = useRef<Chunk[]>([]);
  const chunkIndexRef = useRef(0);
  const pageRef = useRef(page);
  const pageCountRef = useRef(pageCount);
  const wordsRef = useRef<WordTiming[]>([]);
  const rateRef = useRef(rate);
  const voiceRef = useRef(voice);
  const setPageRef = useRef(setPage);

  pageRef.current = page;
  pageCountRef.current = pageCount;
  chunkIndexRef.current = chunkIndex;
  rateRef.current = rate;
  voiceRef.current = voice;
  setPageRef.current = setPage;

  const { data: content } = usePageContent(bookId, page, enabled);
  const chunks = content?.chunks ?? [];
  chunksRef.current = chunks;
  const currentChunk: Chunk | null = chunks[chunkIndex] ?? null;

  const getAudio = useCallback(() => {
    if (audioRef.current === null) {
      const element = new Audio();
      element.preload = "auto";
      element.addEventListener("ended", () => {
        if (!wantsPlaybackRef.current) return;
        if (chunkIndexRef.current + 1 < chunksRef.current.length) {
          setChunkIndex(chunkIndexRef.current + 1);
        } else if (pageRef.current < pageCountRef.current) {
          setChunkIndex(0);
          setPageRef.current(pageRef.current + 1);
        } else {
          wantsPlaybackRef.current = false;
          setPlaying(false);
        }
      });
      element.addEventListener("timeupdate", () => {
        const time = element.currentTime;
        const timings = wordsRef.current;
        let index = -1;
        for (let i = 0; i < timings.length; i++) {
          if (time >= timings[i].start) index = i;
          else break;
        }
        setWordIndex(index);
      });
      audioRef.current = element;
    }
    return audioRef.current;
  }, []);

  const halt = useCallback(() => {
    tokenRef.current++;
    const element = audioRef.current;
    if (element) {
      element.pause();
      element.removeAttribute("src");
    }
    setPlaying(false);
    setLoading(false);
    setWordIndex(-1);
  }, []);

  const playChunk = useCallback(
    async (target: Chunk) => {
      const token = ++tokenRef.current;
      setLoading(true);
      setWordIndex(-1);
      try {
        const timing = await narrationApi.timing(bookId, target.id, voiceRef.current);
        if (token !== tokenRef.current) return;
        wordsRef.current = timing.words;
        setWords(timing.words);
        const element = getAudio();
        element.src = narrationApi.audioUrl(bookId, target.id, voiceRef.current);
        element.playbackRate = rateRef.current;
        await element.play();
        if (token !== tokenRef.current) {
          element.pause();
          return;
        }
        setLoading(false);
        setPlaying(true);
        const next = chunksRef.current[chunkIndexRef.current + 1];
        if (next) {
          fetch(narrationApi.audioUrl(bookId, next.id, voiceRef.current)).catch(() => {});
        }
      } catch (error) {
        if (token !== tokenRef.current) return;
        setLoading(false);
        setPlaying(false);
        wantsPlaybackRef.current = false;
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          toast("Tap the play button to start listening", "success");
        } else {
          toast(error instanceof Error ? error.message : "Narration failed");
        }
      }
    },
    [bookId, getAudio],
  );

  useEffect(() => {
    if (!enabled || !wantsPlaybackRef.current || content === undefined) return;
    const available = content.chunks;
    if (available.length === 0) {
      if (pageRef.current < pageCountRef.current) {
        setChunkIndex(0);
        setPageRef.current(pageRef.current + 1);
      } else {
        wantsPlaybackRef.current = false;
        setPlaying(false);
        setLoading(false);
      }
      return;
    }
    const target = available[Math.min(chunkIndex, available.length - 1)];
    playChunk(target);
  }, [enabled, content, chunkIndex, voice, playChunk]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, [rate]);

  useEffect(() => {
    if (!enabled) {
      wantsPlaybackRef.current = false;
      halt();
    }
  }, [enabled, halt]);

  useEffect(() => {
    return () => {
      wantsPlaybackRef.current = false;
      halt();
    };
  }, [halt]);

  const play = useCallback(() => {
    wantsPlaybackRef.current = true;
    const element = audioRef.current;
    if (element && element.src && element.paused && !element.ended && words.length > 0) {
      element.play().then(() => setPlaying(true)).catch(() => {});
      return;
    }
    const target = chunksRef.current[chunkIndexRef.current];
    if (target) {
      playChunk(target);
    } else {
      setChunkIndex(0);
    }
  }, [playChunk, words.length]);

  const pause = useCallback(() => {
    wantsPlaybackRef.current = false;
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const skip = useCallback(
    (offset: number) => {
      const nextIndex = chunkIndexRef.current + offset;
      if (nextIndex >= 0 && nextIndex < chunksRef.current.length) {
        wantsPlaybackRef.current = true;
        setChunkIndex(nextIndex);
      } else if (nextIndex < 0 && pageRef.current > 1) {
        wantsPlaybackRef.current = true;
        setChunkIndex(0);
        setPageRef.current(pageRef.current - 1);
      } else if (nextIndex >= chunksRef.current.length && pageRef.current < pageCountRef.current) {
        wantsPlaybackRef.current = true;
        setChunkIndex(0);
        setPageRef.current(pageRef.current + 1);
      }
    },
    [],
  );

  const restartFromPageStart = useCallback(() => {
    setChunkIndex(0);
  }, []);

  return {
    playing,
    loading,
    words,
    wordIndex,
    currentChunk,
    chunkIndex,
    chunkCount: chunks.length,
    play,
    pause,
    skip,
    restartFromPageStart,
  };
}

export type Narration = ReturnType<typeof useNarration>;
