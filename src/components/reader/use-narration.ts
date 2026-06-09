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

export interface NarrationSentence {
  text: string;
  offset: number;
  words: WordTiming[];
}

interface NarrationOptions {
  bookId: string;
  page: number;
  setPage: (page: number) => void;
  voice: string;
  rate: number;
  enabled: boolean;
}

interface ServerMessage {
  type: string;
  id?: string;
  page?: number;
  blocks?: number[];
  speech?: string;
  sample_rate?: number;
  text?: string;
  offset?: number;
  words?: WordTiming[];
  message?: string;
}

const MAX_BUFFER_AHEAD_SECONDS = 25;

export function useNarration({ bookId, page, setPage, voice, rate, enabled }: NarrationOptions) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentChunk, setCurrentChunk] = useState<NarrationChunk | null>(null);
  const [sentences, setSentences] = useState<NarrationSentence[]>([]);
  const [activeSentence, setActiveSentence] = useState(-1);
  const [wordIndex, setWordIndex] = useState(-1);

  const socketRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextTimeRef = useRef(0);
  const chunkStartRef = useRef(0);
  const chunkStartPendingRef = useRef(false);
  const sampleRateRef = useRef(24000);
  const pendingAckRef = useRef<string | null>(null);
  const endedRef = useRef(false);
  const wantsPlayRef = useRef(false);
  const closingRef = useRef(false);
  const pageRef = useRef(page);
  const voiceRef = useRef(voice);
  const rateRef = useRef(rate);
  const setPageRef = useRef(setPage);
  const currentChunkRef = useRef<NarrationChunk | null>(null);
  const sentencesRef = useRef<NarrationSentence[]>([]);

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
    const ctx = ctxRef.current;
    nextTimeRef.current = ctx ? ctx.currentTime : 0;
    chunkStartPendingRef.current = true;
    pendingAckRef.current = null;
    endedRef.current = false;
    sentencesRef.current = [];
    setSentences([]);
    setActiveSentence(-1);
    setWordIndex(-1);
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
    setPlaying(false);
    setLoading(false);
    setCurrentChunk(null);
    currentChunkRef.current = null;
    closingRef.current = false;
  }, [flushAudio]);

  const schedulePcm = useCallback((buffer: ArrayBuffer) => {
    const ctx = ctxRef.current;
    if (!ctx || buffer.byteLength < 2) return;
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
    if (chunkStartPendingRef.current) {
      chunkStartRef.current = startAt;
      chunkStartPendingRef.current = false;
    }
    source.start(startAt);
    nextTimeRef.current = startAt + audioBuffer.duration;
    sourcesRef.current.push(source);
    if (sourcesRef.current.length > 64) {
      sourcesRef.current.splice(0, sourcesRef.current.length - 64);
    }
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
        const chunk: NarrationChunk = {
          id: message.id,
          page: message.page,
          blocks: message.blocks ?? [],
          speech: message.speech ?? "",
        };
        currentChunkRef.current = chunk;
        setCurrentChunk(chunk);
        sampleRateRef.current = message.sample_rate || 24000;
        chunkStartPendingRef.current = true;
        sentencesRef.current = [];
        setSentences([]);
        setActiveSentence(-1);
        setWordIndex(-1);
        if (message.page !== pageRef.current) {
          setPageRef.current(message.page);
        }
      } else if (message.type === "sentence") {
        sentencesRef.current = [
          ...sentencesRef.current,
          { text: message.text ?? "", offset: message.offset ?? 0, words: message.words ?? [] },
        ];
        setSentences(sentencesRef.current);
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
      socket.send(
        JSON.stringify({
          type: "start",
          chunk: currentChunkRef.current?.id,
          page: currentChunkRef.current ? undefined : pageRef.current,
          voice: voiceRef.current,
          speed: rateRef.current,
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
    }
  }, [connect]);

  const pause = useCallback(() => {
    wantsPlayRef.current = false;
    setPlaying(false);
    ctxRef.current?.suspend().catch(() => {});
  }, []);

  const skip = useCallback(
    (direction: number) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      flushAudio();
      setLoading(true);
      socket.send(JSON.stringify({ type: "seek", direction }));
    },
    [flushAudio],
  );

  useEffect(() => {
    if (!enabled) return;
    const ticker = setInterval(() => {
      const ctx = ctxRef.current;
      const socket = socketRef.current;
      if (!ctx) return;
      const ahead = nextTimeRef.current - ctx.currentTime;
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
      }
      if (chunkStartPendingRef.current) return;
      const elapsed = ctx.currentTime - chunkStartRef.current;
      if (elapsed < 0) return;
      const list = sentencesRef.current;
      let active = -1;
      for (let index = 0; index < list.length; index++) {
        if (list[index].offset <= elapsed) active = index;
        else break;
      }
      setActiveSentence(active);
      if (active >= 0) {
        const words = list[active].words;
        let current = -1;
        for (let index = 0; index < words.length; index++) {
          if (words[index].start <= elapsed) current = index;
          else break;
        }
        setWordIndex(current);
      } else {
        setWordIndex(-1);
      }
    }, 150);
    return () => clearInterval(ticker);
  }, [enabled]);

  useEffect(() => {
    const voiceChanged = voiceRef.current !== voice;
    const rateChanged = rateRef.current !== rate;
    voiceRef.current = voice;
    rateRef.current = rate;
    const socket = socketRef.current;
    if (!enabled || (!voiceChanged && !rateChanged)) return;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "voice", voice }));
    socket.send(JSON.stringify({ type: "speed", speed: rate }));
    const chunk = currentChunkRef.current;
    if (chunk) {
      flushAudio();
      setLoading(true);
      socket.send(JSON.stringify({ type: "seek", chunk: chunk.id }));
    }
  }, [voice, rate, enabled, flushAudio]);

  useEffect(() => {
    if (!enabled) teardown();
  }, [enabled, teardown]);

  useEffect(() => teardown, [teardown]);

  return { playing, loading, currentChunk, sentences, activeSentence, wordIndex, play, pause, skip };
}

export type Narration = ReturnType<typeof useNarration>;
