"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { narrationSocketUrl } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import type { WordTiming } from "@/lib/types";

export interface NarrationChunk {
  id: string;
  page: number;
  blocks: number[];
  speech: string;
}

export interface NarrationCues {
  lead: string;
  trail: string;
}

export interface NarrationSentence {
  text: string;
  offset: number;
  words: WordTiming[];
  cues: NarrationCues;
}

interface AudioSegment {
  ctxStart: number;
  audioStart: number;
  duration: number;
}

interface QueuedChunk {
  chunk: NarrationChunk;
  sentences: NarrationSentence[];
  segments: AudioSegment[];
  audioLength: number;
}

interface NarrationOptions {
  bookId: string;
  page: number;
  setPage: (page: number) => void;
  voice: string;
  rate: number;
  emotion: string;
  enabled: boolean;
}

interface ServerMessage {
  type: string;
  id?: string;
  page?: number;
  blocks?: number[];
  speech?: string;
  sample_rate?: number;
  chunk_id?: string;
  text?: string;
  offset?: number;
  words?: WordTiming[];
  cues?: NarrationCues;
  message?: string;
}

const MAX_BUFFER_AHEAD_SECONDS = 25;

export function useNarration({
  bookId,
  page,
  setPage,
  voice,
  rate,
  emotion,
  enabled,
}: NarrationOptions) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentChunk, setCurrentChunk] = useState<NarrationChunk | null>(null);
  const [sentences, setSentences] = useState<NarrationSentence[]>([]);
  const [activeSentence, setActiveSentence] = useState(-1);
  const [wordIndex, setWordIndex] = useState(-1);
  const [cuePhase, setCuePhase] = useState<"lead" | "break" | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const queueRef = useRef<QueuedChunk[]>([]);
  const nextTimeRef = useRef(0);
  const sampleRateRef = useRef(24000);
  const pendingAckRef = useRef<string | null>(null);
  const pendingSeekRef = useRef<{ chunk?: string; page?: number } | null>(null);
  const endedRef = useRef(false);
  const wantsPlayRef = useRef(false);
  const closingRef = useRef(false);
  const pageRef = useRef(page);
  const voiceRef = useRef(voice);
  const rateRef = useRef(rate);
  const emotionRef = useRef(emotion);
  const setPageRef = useRef(setPage);
  const heardChunkRef = useRef<NarrationChunk | null>(null);
  const sentenceCountRef = useRef(-1);

  pageRef.current = page;
  setPageRef.current = setPage;

  const flushAudio = useCallback(() => {
    sourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        return;
      }
    });
    sourcesRef.current = [];
    queueRef.current = [];
    const ctx = ctxRef.current;
    nextTimeRef.current = ctx ? ctx.currentTime : 0;
    pendingAckRef.current = null;
    endedRef.current = false;
    sentenceCountRef.current = -1;
    setSentences([]);
    setActiveSentence(-1);
    setWordIndex(-1);
    setCuePhase(null);
  }, []);

  const teardown = useCallback(() => {
    closingRef.current = true;
    wantsPlayRef.current = false;
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState <= WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ type: "stop" }));
      } catch {
        socketRef.current = null;
      }
      socket.close();
    }
    flushAudio();
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx && ctx.state !== "closed") {
      ctx.close().catch(() => {});
    }
    heardChunkRef.current = null;
    setPlaying(false);
    setLoading(false);
    setCurrentChunk(null);
    closingRef.current = false;
  }, [flushAudio]);

  const schedulePcm = useCallback((buffer: ArrayBuffer) => {
    const ctx = ctxRef.current;
    const target = queueRef.current[queueRef.current.length - 1];
    if (!ctx || !target || buffer.byteLength < 2) return;
    const ints = new Int16Array(buffer);
    const floats = new Float32Array(ints.length);
    for (let index = 0; index < ints.length; index++) {
      floats[index] = ints[index] / 32768;
    }
    const audioBuffer = ctx.createBuffer(1, floats.length, sampleRateRef.current);
    audioBuffer.copyToChannel(floats, 0);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    const startAt = Math.max(nextTimeRef.current, ctx.currentTime + 0.05);
    source.start(startAt);
    nextTimeRef.current = startAt + audioBuffer.duration;
    sourcesRef.current.push(source);
    if (sourcesRef.current.length > 96) {
      sourcesRef.current.splice(0, sourcesRef.current.length - 96);
    }
    target.segments.push({
      ctxStart: startAt,
      audioStart: target.audioLength,
      duration: audioBuffer.duration,
    });
    target.audioLength += audioBuffer.duration;
    setLoading(false);
  }, []);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        schedulePcm(event.data);
        return;
      }
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }
      if (message.type === "chunk" && message.id && message.page) {
        sampleRateRef.current = message.sample_rate || 24000;
        queueRef.current.push({
          chunk: {
            id: message.id,
            page: message.page,
            blocks: message.blocks ?? [],
            speech: message.speech ?? "",
          },
          sentences: [],
          segments: [],
          audioLength: 0,
        });
      } else if (message.type === "sentence" && message.chunk_id) {
        for (let index = queueRef.current.length - 1; index >= 0; index--) {
          const entry = queueRef.current[index];
          if (entry.chunk.id === message.chunk_id) {
            entry.sentences.push({
              text: message.text ?? "",
              offset: message.offset ?? 0,
              words: message.words ?? [],
              cues: message.cues ?? { lead: "", trail: "" },
            });
            break;
          }
        }
      } else if (message.type === "sentence_update" && message.chunk_id) {
        for (let index = queueRef.current.length - 1; index >= 0; index--) {
          const entry = queueRef.current[index];
          if (entry.chunk.id === message.chunk_id) {
            const sentence = entry.sentences.find(
              (candidate) => Math.abs(candidate.offset - (message.offset ?? 0)) < 0.01,
            );
            if (sentence) {
              sentence.words = message.words ?? sentence.words;
              sentenceCountRef.current = -1; // force the ticker to re-sync state
            }
            break;
          }
        }
      } else if (message.type === "chunk_end" && message.id) {
        pendingAckRef.current = message.id;
      } else if (message.type === "end") {
        endedRef.current = true;
      } else if (message.type === "error") {
        toast(message.message ?? "Narration error");
      }
    },
    [schedulePcm],
  );

  const connect = useCallback(() => {
    const existing = socketRef.current;
    if (existing && existing.readyState <= WebSocket.OPEN) return;
    const socket = new WebSocket(narrationSocketUrl(bookId));
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;
    setLoading(true);
    socket.onopen = () => {
      const pending = pendingSeekRef.current;
      pendingSeekRef.current = null;
      const anchor = heardChunkRef.current;
      // Resume from the heard chunk only when the listener is still on its
      // page; after a manual page flip, narration restarts from the visible page.
      const useAnchor = !pending && anchor !== null && anchor.page === pageRef.current;
      socket.send(
        JSON.stringify({
          type: "start",
          chunk: pending?.chunk ?? (useAnchor ? anchor.id : undefined),
          page: pending?.page ?? (useAnchor ? undefined : pageRef.current),
          voice: voiceRef.current,
          speed: rateRef.current,
          emotion: emotionRef.current,
        }),
      );
    };
    socket.onmessage = handleMessage;
    socket.onclose = () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      if (!closingRef.current && wantsPlayRef.current) {
        wantsPlayRef.current = false;
        setPlaying(false);
        setLoading(false);
        toast("Narration disconnected — press play to resume");
      }
    };
  }, [bookId, handleMessage]);

  const play = useCallback(() => {
    wantsPlayRef.current = true;
    let ctx = ctxRef.current;
    if (!ctx || ctx.state === "closed") {
      ctx = new AudioContext();
      ctxRef.current = ctx;
      nextTimeRef.current = ctx.currentTime;
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    connect();
    setPlaying(true);
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setLoading(true);
      return;
    }
    // Resuming after the listener flipped to another page: restart there
    // instead of dragging them back to the previously heard chunk.
    const anchor = heardChunkRef.current;
    if (anchor && anchor.page !== pageRef.current) {
      flushAudio();
      heardChunkRef.current = null;
      setLoading(true);
      socket.send(JSON.stringify({ type: "seek", page: pageRef.current }));
    }
  }, [connect, flushAudio]);

  const pause = useCallback(() => {
    wantsPlayRef.current = false;
    setPlaying(false);
    ctxRef.current?.suspend().catch(() => {});
  }, []);

  const skip = useCallback(
    (direction: number) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const anchor = heardChunkRef.current?.id;
      flushAudio();
      setLoading(true);
      socket.send(JSON.stringify({ type: "seek", chunk: anchor, direction }));
    },
    [flushAudio],
  );

  const seekTo = useCallback(
    (target: { chunk?: string; page?: number }) => {
      pendingSeekRef.current = target;
      play();
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        pendingSeekRef.current = null;
        flushAudio();
        heardChunkRef.current = null;
        setLoading(true);
        socket.send(JSON.stringify({ type: "seek", ...target }));
      }
    },
    [play, flushAudio],
  );

  useEffect(() => {
    if (!enabled) return;
    const ticker = setInterval(() => {
      const ctx = ctxRef.current;
      const socket = socketRef.current;
      if (!ctx) return;
      const now = ctx.currentTime;
      const ahead = nextTimeRef.current - now;
      if (
        pendingAckRef.current !== null &&
        socket !== null &&
        socket.readyState === WebSocket.OPEN &&
        wantsPlayRef.current &&
        ahead < MAX_BUFFER_AHEAD_SECONDS
      ) {
        socket.send(JSON.stringify({ type: "ack", id: pendingAckRef.current }));
        pendingAckRef.current = null;
      }
      if (endedRef.current && ahead <= 0.05 && wantsPlayRef.current) {
        wantsPlayRef.current = false;
        setPlaying(false);
        ctx.suspend().catch(() => {});
      }

      const queue = queueRef.current;
      let activeIndex = -1;
      for (let index = 0; index < queue.length; index++) {
        const first = queue[index].segments[0];
        if (!first || first.ctxStart > now) break;
        activeIndex = index;
      }
      if (activeIndex < 0) return;
      if (activeIndex > 0) {
        queue.splice(0, activeIndex);
      }
      const active = queue[0];

      if (heardChunkRef.current?.id !== active.chunk.id) {
        heardChunkRef.current = active.chunk;
        sentenceCountRef.current = -1;
        setCurrentChunk(active.chunk);
        setActiveSentence(-1);
        setWordIndex(-1);
        if (active.chunk.page !== pageRef.current) {
          setPageRef.current(active.chunk.page);
        }
      }
      if (sentenceCountRef.current !== active.sentences.length) {
        sentenceCountRef.current = active.sentences.length;
        setSentences([...active.sentences]);
      }

      let elapsed = active.audioLength;
      for (const segment of active.segments) {
        if (now < segment.ctxStart) {
          elapsed = segment.audioStart;
          break;
        }
        if (now < segment.ctxStart + segment.duration) {
          elapsed = segment.audioStart + (now - segment.ctxStart);
          break;
        }
      }

      const list = active.sentences;
      let activeIdx = -1;
      for (let index = 0; index < list.length; index++) {
        if (list[index].offset <= elapsed) activeIdx = index;
        else break;
      }
      setActiveSentence(activeIdx);
      if (activeIdx >= 0) {
        const sentence = list[activeIdx];
        const words = sentence.words;
        let current = -1;
        for (let index = 0; index < words.length; index++) {
          if (words[index].start <= elapsed) current = index;
          else break;
        }
        setWordIndex(current);
        // Acting phases: the lead cue plays before the first word; the trail
        // cue is the narrator's breath after the last word — a real break.
        if (sentence.cues.lead && words.length > 0 && elapsed < words[0].start - 0.05) {
          setCuePhase("lead");
        } else if (
          sentence.cues.trail &&
          words.length > 0 &&
          elapsed > words[words.length - 1].end + 0.05
        ) {
          setCuePhase("break");
        } else {
          setCuePhase(null);
        }
      } else {
        setWordIndex(-1);
        setCuePhase(null);
      }
    }, 100);
    return () => clearInterval(ticker);
  }, [enabled]);

  useEffect(() => {
    const voiceChanged = voiceRef.current !== voice;
    const rateChanged = rateRef.current !== rate;
    const emotionChanged = emotionRef.current !== emotion;
    voiceRef.current = voice;
    rateRef.current = rate;
    emotionRef.current = emotion;
    const socket = socketRef.current;
    if (!enabled || (!voiceChanged && !rateChanged && !emotionChanged)) return;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "voice", voice }));
    socket.send(JSON.stringify({ type: "speed", speed: rate }));
    socket.send(JSON.stringify({ type: "emotion", emotion }));
    const anchor = heardChunkRef.current;
    if (anchor) {
      flushAudio();
      setLoading(true);
      socket.send(JSON.stringify({ type: "seek", chunk: anchor.id }));
    }
  }, [voice, rate, emotion, enabled, flushAudio]);

  useEffect(() => {
    if (!enabled) teardown();
  }, [enabled, teardown]);

  useEffect(() => teardown, [teardown]);

  return {
    playing,
    loading,
    currentChunk,
    sentences,
    activeSentence,
    wordIndex,
    cuePhase,
    play,
    pause,
    skip,
    seekTo,
  };
}

export type Narration = ReturnType<typeof useNarration>;
