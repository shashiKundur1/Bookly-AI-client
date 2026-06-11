"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import { prefersReducedMotion } from "@/lib/animate";
import { bookApi, readingApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useBook, useContentOverview, usePageContent, useUpdateProgress } from "@/lib/queries";
import { useReaderPrefs } from "@/lib/reader-prefs";
import { FullScreenSpinner, Spinner } from "@/components/ui/spinner";
import { ListenBar } from "@/components/reader/listen-bar";
import { NarrationSubtitles } from "@/components/reader/subtitles";
import { useNarration } from "@/components/reader/use-narration";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const PDF_OPTIONS = { cMapUrl: "/cmaps/", standardFontDataUrl: "/standard_fonts/" };

function TopBarButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={cn(
        "comic-border comic-press grid size-10 place-items-center rounded-xl shadow-comic-sm",
        active ? "bg-zap" : "bg-panel",
      )}
    >
      {children}
    </button>
  );
}

export function Reader({ bookId, startListening }: { bookId: string; startListening: boolean }) {
  const { data: book, isPending, isError } = useBook(bookId);
  const { data: overview } = useContentOverview(bookId);
  const updateProgress = useUpdateProgress(bookId);
  const prefs = useReaderPrefs();

  const [page, setPageState] = useState<number | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [aspect, setAspect] = useState(0.72);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [chrome, setChrome] = useState(true);
  const [tocOpen, setTocOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [stageNode, setStageNode] = useState<HTMLDivElement | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const tocRef = useRef<HTMLDivElement>(null);
  const directionRef = useRef(1);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const sessionRef = useRef<string | null>(null);
  const pageValueRef = useRef(1);
  const totalRef = useRef(1);
  const progressMutateRef = useRef(updateProgress.mutate);
  const autoStartedRef = useRef(false);

  progressMutateRef.current = updateProgress.mutate;

  const total = numPages || book?.page_count || 1;
  totalRef.current = total;
  if (page !== null) pageValueRef.current = page;

  const ready = book?.extraction_status === "ready";
  const fileUrl = useMemo(() => bookApi.fileUrl(bookId), [bookId]);

  const setPage = useCallback((next: number) => {
    setPageState((current) => {
      const clamped = Math.min(Math.max(next, 1), totalRef.current);
      if (current !== null) directionRef.current = clamped >= current ? 1 : -1;
      return clamped;
    });
  }, []);

  const pageStep = useCallback(
    (offset: number) => setPage(pageValueRef.current + offset),
    [setPage],
  );

  const narration = useNarration({
    bookId,
    page: page ?? 1,
    setPage,
    voice: prefs.voice,
    rate: prefs.rate,
    emotion: prefs.emotion,
    enabled: listening,
  });
  const narrationRef = useRef(narration);
  narrationRef.current = narration;

  const { data: pageContent } = usePageContent(bookId, page ?? 0, listening && page !== null);

  useEffect(() => {
    if (book && page === null) {
      const start = Math.min(Math.max(book.progress?.current_page ?? 1, 1), book.page_count || 1);
      setPageState(start);
    }
  }, [book, page]);

  useEffect(() => {
    if (startListening && ready && page !== null && !autoStartedRef.current) {
      autoStartedRef.current = true;
      setListening(true);
      narrationRef.current.play();
    }
  }, [startListening, ready, page]);

  useEffect(() => {
    if (stageNode === null) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setBox({ width: rect.width, height: rect.height });
    });
    observer.observe(stageNode);
    return () => observer.disconnect();
  }, [stageNode]);

  useEffect(() => {
    let mounted = true;
    readingApi
      .startSession(bookId, pageValueRef.current)
      .then((session) => {
        if (mounted) sessionRef.current = session.id;
      })
      .catch(() => {});
    const heartbeat = setInterval(() => {
      if (sessionRef.current) {
        readingApi.updateSession(sessionRef.current, pageValueRef.current).catch(() => {});
      }
    }, 60_000);
    return () => {
      mounted = false;
      clearInterval(heartbeat);
      if (sessionRef.current) {
        fetch(`/api/v1/sessions/${sessionRef.current}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ end_page: pageValueRef.current }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [bookId]);

  useEffect(() => {
    if (page === null) return;
    const handle = setTimeout(() => {
      progressMutateRef.current({ current_page: page, mark_read: [page] });
    }, 1200);
    return () => clearTimeout(handle);
  }, [page]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        pageStep(1);
      } else if (event.key === "ArrowLeft") {
        pageStep(-1);
      } else if (event.key === "+" || event.key === "=") {
        setZoom((value) => Math.min(3, value + 0.25));
      } else if (event.key === "-") {
        setZoom((value) => Math.max(0.5, value - 0.25));
      } else if (event.key === "0") {
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pageStep]);

  useGSAP(
    () => {
      if (page === null || prefersReducedMotion() || sheetRef.current === null) return;
      gsap.fromTo(
        sheetRef.current,
        {
          x: directionRef.current * 70,
          rotationY: directionRef.current * -10,
          opacity: 0.2,
          scale: 0.985,
          transformPerspective: 1200,
        },
        {
          x: 0,
          rotationY: 0,
          opacity: 1,
          scale: 1,
          duration: 0.38,
          ease: "back.out(1.4)",
          clearProps: "transform,opacity",
        },
      );
    },
    { dependencies: [page] },
  );

  useGSAP(
    () => {
      if (!tocOpen || prefersReducedMotion() || tocRef.current === null) return;
      gsap.from(tocRef.current, { x: 80, opacity: 0, duration: 0.3, ease: "back.out(1.6)" });
    },
    { dependencies: [tocOpen] },
  );

  const highlightRects = useMemo(() => {
    if (!listening || !narration.currentChunk || !pageContent) return [];
    if (narration.currentChunk.page !== page) return [];
    const blockIds = new Set(narration.currentChunk.blocks);
    return pageContent.blocks.filter((block) => blockIds.has(block.i)).map((block) => block.bbox);
  }, [listening, narration.currentChunk, pageContent, page]);

  const seekToRef = useRef(narration.seekTo);
  seekToRef.current = narration.seekTo;

  // Manual page flips while narration plays re-anchor it to the visible page
  // instead of letting the old chunk drag the reader back.
  const heardPage = narration.currentChunk?.page;
  const followPage = listening && (narration.playing || narration.loading);
  useEffect(() => {
    if (!followPage || page === null || heardPage == null || heardPage === page) return;
    const handle = setTimeout(() => seekToRef.current({ page }), 500);
    return () => clearTimeout(handle);
  }, [followPage, heardPage, page]);

  const startFromBlock = useCallback(
    (blockIndex: number) => {
      const chunk = pageContent?.chunks.find((candidate) => candidate.blocks.includes(blockIndex));
      if (chunk) seekToRef.current({ chunk: chunk.id });
    },
    [pageContent],
  );

  if (isPending || page === null) {
    return <FullScreenSpinner />;
  }

  if (isError || !book) {
    return (
      <div className="grid min-h-dvh place-items-center px-4 text-center">
        <div>
          <span className="comic-border inline-block -rotate-2 rounded-2xl bg-pow px-5 py-2 font-display text-3xl tracking-wider text-white shadow-comic-lg">
            CAN'T OPEN THIS BOOK
          </span>
          <p className="mt-4">
            <Link href="/library" className="font-bold text-boom hover:underline">
              Back to the library
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const fitWidth = Math.min(box.width - 16, (box.height - 24) * aspect);
  const pageWidth = Math.max(120, Math.floor((fitWidth > 0 ? fitWidth : 480) * zoom));

  const handlePointerDown = (event: React.PointerEvent) => {
    pointerRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    const start = pointerRef.current;
    pointerRef.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (zoom > 1.01) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) setChrome((visible) => !visible);
      return;
    }
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      pageStep(dx < 0 ? 1 : -1);
      return;
    }
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      const stage = containerRef.current;
      if (!stage) return;
      const ratio = (event.clientX - stage.getBoundingClientRect().left) / stage.clientWidth;
      if (ratio < 0.28) pageStep(-1);
      else if (ratio > 0.72) pageStep(1);
      else setChrome((visible) => !visible);
    }
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        <div
          ref={(node) => {
            setStageNode(node);
          }}
          className={cn(
            "absolute inset-0 select-none",
            zoom > 1.01 ? "overflow-auto" : "touch-none overflow-hidden",
          )}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <div className="flex min-h-full min-w-full items-center justify-center py-2">
            <Document
            file={fileUrl}
            options={PDF_OPTIONS}
            onLoadSuccess={(document) => setNumPages(document.numPages)}
            loading={<Spinner className="text-ink" />}
            error={
              <span className="comic-border rounded-xl bg-pow px-4 py-2 font-bold text-white shadow-comic">
                Failed to load the PDF
              </span>
            }
          >
            <div
              ref={sheetRef}
              className="comic-border relative overflow-hidden rounded-lg bg-white shadow-comic-lg"
              style={{ width: pageWidth }}
            >
              <Page
                pageNumber={page}
                width={pageWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                onLoadSuccess={(loaded) => setAspect(loaded.originalWidth / loaded.originalHeight)}
                loading={
                  <div
                    style={{ width: pageWidth, height: pageWidth / aspect }}
                    className="grid place-items-center bg-white"
                  >
                    <Spinner className="text-faint" />
                  </div>
                }
              />
              <div className="pointer-events-none absolute inset-0">
                {highlightRects.map((bbox, index) => (
                  <div
                    key={`${narration.currentChunk?.id}-${index}`}
                    className="absolute rounded-md border-2 border-ink/30 bg-zap/30"
                    style={{
                      left: `${bbox[0] * 100}%`,
                      top: `${bbox[1] * 100}%`,
                      width: `${(bbox[2] - bbox[0]) * 100}%`,
                      height: `${(bbox[3] - bbox[1]) * 100}%`,
                    }}
                  />
                ))}
                {listening
                  ? pageContent?.blocks.map((block) => (
                      <button
                        key={`tap-${block.i}`}
                        aria-label="Start narration here"
                        onClick={(event) => {
                          event.stopPropagation();
                          startFromBlock(block.i);
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onPointerUp={(event) => event.stopPropagation()}
                        className="pointer-events-auto absolute cursor-pointer rounded-md hover:bg-boom/15"
                        style={{
                          left: `${block.bbox[0] * 100}%`,
                          top: `${block.bbox[1] * 100}%`,
                          width: `${(block.bbox[2] - block.bbox[0]) * 100}%`,
                          height: `${(block.bbox[3] - block.bbox[1]) * 100}%`,
                        }}
                      />
                    ))
                  : null}
              </div>
            </div>
            <div className="hidden">
              {page < total ? (
                <Page pageNumber={page + 1} width={pageWidth} renderTextLayer={false} renderAnnotationLayer={false} />
              ) : null}
              {page > 1 ? (
                <Page pageNumber={page - 1} width={pageWidth} renderTextLayer={false} renderAnnotationLayer={false} />
              ) : null}
            </div>
          </Document>
          </div>
        </div>

        <div
          className={cn(
            "absolute inset-x-0 top-0 z-20 transition-transform duration-300",
            chrome ? "translate-y-0" : "-translate-y-full",
          )}
        >
          <div
            className="flex items-center gap-2 border-b-[3px] border-ink bg-paper/95 px-3 py-2 backdrop-blur"
            style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
          >
            <Link
              href={`/books/${bookId}`}
              aria-label="Back to book"
              className="comic-border comic-press grid size-10 shrink-0 place-items-center rounded-xl bg-panel shadow-comic-sm"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <p className="min-w-0 flex-1 truncate font-bold">{book.title}</p>
            <span className="comic-border hidden shrink-0 rounded-lg bg-panel px-2 py-1 text-xs font-bold shadow-comic-sm sm:block">
              {page} / {total}
            </span>
            {(overview?.toc.length ?? 0) > 0 ? (
              <TopBarButton label="Table of contents" active={tocOpen} onClick={() => setTocOpen(!tocOpen)}>
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M4 6h16M4 12h10M4 18h14" strokeLinecap="round" />
                </svg>
              </TopBarButton>
            ) : null}
            <TopBarButton
              label={listening ? "Stop listening" : "Listen"}
              active={listening}
              onClick={() => {
                if (!ready) return;
                setListening(!listening);
              }}
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path
                  d="M4 10v4h3l4 4V6L7 10H4zM15 9a4 4 0 010 6M17.5 6.5a8 8 0 010 11"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </TopBarButton>
          </div>
        </div>

        {tocOpen ? (
          <div className="absolute inset-0 z-30" onClick={() => setTocOpen(false)}>
            <div
              ref={tocRef}
              onClick={(event) => event.stopPropagation()}
              className="comic-border absolute bottom-3 right-3 top-3 w-72 max-w-[85vw] overflow-y-auto overscroll-contain rounded-card bg-panel p-3 shadow-comic-xl"
            >
              <h2 className="mb-2 font-display text-2xl tracking-wide">CONTENTS</h2>
              {overview?.toc.map((entry, index) => (
                <button
                  key={`${entry.page}-${index}`}
                  onClick={() => {
                    setPage(entry.page);
                    setTocOpen(false);
                  }}
                  className="comic-press block w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium hover:bg-soft"
                  style={{ paddingLeft: `${8 + (entry.level - 1) * 14}px` }}
                >
                  <span className="line-clamp-1">{entry.title}</span>
                  <span className="text-xs font-bold text-faint">p. {entry.page}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2 sm:right-3">
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
            className="comic-border comic-press grid size-10 place-items-center rounded-xl bg-panel font-display text-2xl shadow-comic-sm"
          >
            +
          </button>
          <button
            aria-label="Reset zoom"
            onClick={() => setZoom(1)}
            className="comic-border comic-press grid size-10 place-items-center rounded-xl bg-panel text-[11px] font-bold shadow-comic-sm"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
            className="comic-border comic-press grid size-10 place-items-center rounded-xl bg-panel font-display text-2xl shadow-comic-sm"
          >
            −
          </button>
        </div>

        {listening ? <NarrationSubtitles narration={narration} raised={chrome} /> : null}

        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-20 px-3 transition-transform duration-300",
            chrome ? "translate-y-0" : "translate-y-[120%]",
          )}
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {listening ? (
            <ListenBar narration={narration} />
          ) : (
            <div className="comic-border mx-auto flex w-full max-w-3xl items-center gap-3 rounded-card bg-panel px-4 py-3 shadow-comic-lg">
              <button
                aria-label="Previous page"
                onClick={() => pageStep(-1)}
                className="comic-border comic-press grid size-9 shrink-0 place-items-center rounded-xl bg-panel shadow-comic-sm"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <input
                type="range"
                min={1}
                max={total}
                value={scrub ?? page}
                onChange={(event) => setScrub(Number(event.target.value))}
                onPointerUp={() => {
                  if (scrub !== null) {
                    setPage(scrub);
                    setScrub(null);
                  }
                }}
                onKeyUp={() => {
                  if (scrub !== null) {
                    setPage(scrub);
                    setScrub(null);
                  }
                }}
                className="w-full accent-boom"
                aria-label="Page slider"
              />
              <span className="shrink-0 text-sm font-bold text-muted">
                {scrub ?? page} / {total}
              </span>
              <button
                aria-label="Next page"
                onClick={() => pageStep(1)}
                className="comic-border comic-press grid size-9 shrink-0 place-items-center rounded-xl bg-panel shadow-comic-sm"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
