"use client";

import { useMemo } from "react";

import { cn } from "@/lib/cn";
import { useUpdateProgress } from "@/lib/queries";
import type { Book } from "@/lib/types";

export function ProgressMap({ book }: { book: Book }) {
  const updateProgress = useUpdateProgress(book.id);
  const read = useMemo(() => new Set(book.progress?.pages_read ?? []), [book.progress]);
  const currentPage = book.progress?.current_page ?? 1;
  const percent = book.progress?.percent ?? 0;

  if (!book.page_count) return null;

  const toggle = (page: number) => {
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
      <div className="flex max-h-56 flex-wrap gap-[3px] overflow-y-auto overscroll-contain pr-1">
        {Array.from({ length: book.page_count }, (_, index) => index + 1).map((page) => (
          <button
            key={page}
            title={`Page ${page}`}
            onClick={() => toggle(page)}
            className={cn(
              "size-[11px] rounded-[3px] border border-ink/50 transition-colors",
              page === currentPage
                ? "scale-125 border-ink bg-pow"
                : read.has(page)
                  ? "bg-grass"
                  : "bg-soft hover:bg-zap",
            )}
          />
        ))}
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
