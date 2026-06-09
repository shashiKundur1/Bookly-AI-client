"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useUpdateProgress } from "@/lib/queries";
import type { Book } from "@/lib/types";

const CELL = 12;
const GAP = 3;
const STEP = CELL + GAP;

const FILL_READ = "#36a85f";
const FILL_UNREAD = "#f6e8cb";
const FILL_CURRENT = "#ff5148";
const STROKE = "rgba(34, 26, 16, 0.45)";

export function ProgressMap({ book }: { book: Book }) {
  const updateProgress = useUpdateProgress(book.id);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  const read = useMemo(() => new Set(book.progress?.pages_read ?? []), [book.progress]);
  const currentPage = book.progress?.current_page ?? 1;
  const percent = book.progress?.percent ?? 0;
  const pages = book.page_count;

  const cols = Math.max(1, Math.floor((width + GAP) / STEP));
  const rows = Math.ceil(pages / cols);
  const height = Math.max(CELL, rows * STEP - GAP);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.floor(entries[0].contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0 || !pages) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);
    context.strokeStyle = STROKE;
    context.lineWidth = 1;
    for (let page = 1; page <= pages; page++) {
      const index = page - 1;
      const x = (index % cols) * STEP;
      const y = Math.floor(index / cols) * STEP;
      context.fillStyle =
        page === currentPage ? FILL_CURRENT : read.has(page) ? FILL_READ : FILL_UNREAD;
      context.beginPath();
      context.roundRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1, 3);
      context.fill();
      context.stroke();
    }
  }, [width, height, cols, pages, read, currentPage]);

  if (!pages) return null;

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const col = Math.floor((event.clientX - rect.left) / STEP);
    const row = Math.floor((event.clientY - rect.top) / STEP);
    if (col < 0 || col >= cols) return;
    const page = row * cols + col + 1;
    if (page < 1 || page > pages) return;
    updateProgress.mutate(read.has(page) ? { unmark_read: [page] } : { mark_read: [page] });
  };

  return (
    <section className="comic-border rounded-card bg-panel p-4 shadow-comic">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-2xl tracking-wide">PROGRESS MAP</h2>
        <span className="comic-border -rotate-2 rounded-lg bg-grass px-2 py-0.5 font-bold text-white shadow-comic-sm">
          {percent.toFixed(0)}%
        </span>
      </div>
      <div ref={frameRef} className="max-h-56 overflow-y-auto overscroll-contain pr-1">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Reading progress map: ${read.size} of ${pages} pages read`}
          onClick={handleClick}
          className="block w-full cursor-pointer"
          style={{ height }}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-bold text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-[3px] border border-ink/50 bg-grass" /> Read
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-[3px] border border-ink bg-pow" /> Current page {currentPage}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-[3px] border border-ink/50 bg-soft" /> Unread
        </span>
        <span className="text-faint">Tap a square to mark it read</span>
      </div>
    </section>
  );
}
