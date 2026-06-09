"use client";

import { gsap } from "gsap";
import Link from "next/link";
import { useRef } from "react";

import { burst, prefersReducedMotion } from "@/lib/animate";
import { bookApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useUpdateBook } from "@/lib/queries";
import type { Book } from "@/lib/types";

const STATUS_LABELS: Record<Book["status"], string> = {
  to_read: "To read",
  reading: "Reading",
  finished: "Finished",
};

const STATUS_STYLES: Record<Book["status"], string> = {
  to_read: "bg-soft text-ink",
  reading: "bg-boom text-white",
  finished: "bg-grass text-white",
};

export function BookCard({ book, arranging = false }: { book: Book; arranging?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const starRef = useRef<HTMLButtonElement>(null);
  const updateBook = useUpdateBook();
  const processing = book.extraction_status === "pending" || book.extraction_status === "processing";
  const percent = book.progress?.percent ?? 0;

  const hover = (scale: number, rotation: number) => {
    if (arranging || prefersReducedMotion() || ref.current === null) return;
    gsap.to(ref.current, { scale, rotation, duration: 0.3, ease: "back.out(2.5)", overwrite: "auto" });
  };

  return (
    <div
      ref={ref}
      onMouseEnter={() => hover(1.03, gsap.utils.random(-1.5, 1.5))}
      onMouseLeave={() => hover(1, 0)}
      className="relative"
    >
      <Link
        href={arranging ? "#" : `/books/${book.id}`}
        draggable={false}
        onClick={(event) => {
          if (arranging) event.preventDefault();
        }}
        className="comic-border comic-press block overflow-hidden rounded-card bg-panel shadow-comic"
      >
        <div className="halftone relative aspect-[2/3] overflow-hidden border-b-[3px] border-ink bg-soft">
          {book.has_cover ? (
            <img
              src={bookApi.coverUrl(book)}
              alt=""
              draggable={false}
              loading="lazy"
              className="h-full w-full object-cover opacity-0 transition-opacity duration-300"
              onLoad={(event) => event.currentTarget.classList.add("opacity-100")}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-center font-display text-2xl tracking-wide text-muted">
              {book.title}
            </div>
          )}
          <div className="shine pointer-events-none absolute inset-0" />
          {processing ? (
            <div className="absolute inset-0 grid place-items-center bg-paper/85">
              <span className="comic-border animate-pulse -rotate-3 rounded-xl bg-zap px-3 py-1 font-display tracking-wider shadow-comic-sm">
                COOKING…
              </span>
            </div>
          ) : null}
          {book.color ? (
            <span
              className="comic-border absolute left-2 top-2 size-4 rounded-full"
              style={{ backgroundColor: book.color }}
            />
          ) : null}
          <span
            className={cn(
              "comic-border absolute right-2 top-2 rotate-2 rounded-lg px-2 py-0.5 text-xs font-bold shadow-comic-sm",
              STATUS_STYLES[book.status],
            )}
          >
            {STATUS_LABELS[book.status]}
          </span>
        </div>
        <div className="space-y-1.5 p-3">
          <p className="truncate font-bold leading-tight">{book.title}</p>
          <p className="truncate text-sm font-medium text-muted">{book.author ?? "Unknown author"}</p>
          <div className="comic-border h-3.5 overflow-hidden rounded-full bg-soft">
            <div
              className="h-full rounded-full bg-grass transition-[width] duration-500"
              style={{ width: `${percent > 0 ? Math.max(percent, 6) : 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs font-bold text-muted">
            <span>{percent.toFixed(0)}% read</span>
            {book.priority === "high" ? (
              <span className="text-pow">High priority</span>
            ) : book.priority === "low" ? (
              <span>Low priority</span>
            ) : null}
          </div>
        </div>
      </Link>
      <button
        ref={starRef}
        aria-label={book.is_favorite ? "Remove from favorites" : "Mark as favorite"}
        onClick={() => {
          burst(starRef.current);
          updateBook.mutate({ id: book.id, changes: { is_favorite: !book.is_favorite } });
        }}
        className={cn(
          "comic-border comic-press absolute -left-2 -top-2 z-10 grid size-9 place-items-center rounded-full shadow-comic-sm",
          book.is_favorite ? "bg-zap text-ink" : "bg-panel text-faint hover:text-ink",
        )}
      >
        <svg viewBox="0 0 24 24" className="size-5">
          <path
            d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8L12 3z"
            fill={book.is_favorite ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
