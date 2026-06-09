"use client";

import { useGSAP } from "@gsap/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useRef, useState } from "react";

import { popIn } from "@/lib/animate";
import { bookApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatBytes, formatDate, timeAgo } from "@/lib/format";
import {
  useBook,
  useDeleteBook,
  useReprocessBook,
  useResetCover,
  useUpdateBook,
  useUploadCover,
} from "@/lib/queries";
import type { BookPriority, BookStatus } from "@/lib/types";
import { EditBookDialog } from "@/components/book/edit-dialog";
import { ProgressMap } from "@/components/book/progress-map";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";

const STATUSES: Array<{ id: BookStatus; label: string; active: string }> = [
  { id: "to_read", label: "To read", active: "bg-zap text-ink" },
  { id: "reading", label: "Reading", active: "bg-boom text-white" },
  { id: "finished", label: "Finished", active: "bg-grass text-white" },
];

const PRIORITIES: Array<{ id: BookPriority; label: string }> = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

const COLORS = ["#ff5148", "#ff8a3d", "#ffc931", "#36a85f", "#2f7df6", "#9d6bff", "#f06292"];

export default function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: book, isPending, isError } = useBook(id);
  const updateBook = useUpdateBook();
  const deleteBook = useDeleteBook();
  const uploadCover = useUploadCover();
  const resetCover = useResetCover();
  const reprocess = useReprocessBook();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (book) popIn("[data-pop]", { stagger: 0.07, y: 20 });
    },
    { scope: pageRef, dependencies: [book?.id] },
  );

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="text-ink" />
      </div>
    );
  }

  if (isError || !book) {
    return (
      <div className="grid place-items-center py-24 text-center">
        <div>
          <span className="comic-border inline-block -rotate-2 rounded-2xl bg-pow px-5 py-2 font-display text-3xl tracking-wider text-white shadow-comic-lg">
            BOOK NOT FOUND
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

  const processing = book.extraction_status === "pending" || book.extraction_status === "processing";
  const ready = book.extraction_status === "ready";

  const setField = (changes: Parameters<typeof updateBook.mutate>[0]["changes"]) => {
    updateBook.mutate({ id: book.id, changes });
  };

  return (
    <div ref={pageRef} className="space-y-6">
      <Link
        href="/library"
        className="comic-press inline-block rounded-xl px-3 py-1 font-bold text-muted hover:bg-soft hover:text-ink"
      >
        ← Library
      </Link>

      <div className="grid gap-6 md:grid-cols-[270px_1fr]">
        <div data-pop className="space-y-3">
          <div className="comic-border halftone relative aspect-[2/3] overflow-hidden rounded-card bg-soft shadow-comic-lg">
            {book.has_cover ? (
              <img
                src={bookApi.coverUrl(book)}
                alt=""
                className="h-full w-full object-cover opacity-0 transition-opacity duration-300"
                onLoad={(event) => event.currentTarget.classList.add("opacity-100")}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center font-display text-3xl tracking-wide text-muted">
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
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" size="sm" onClick={() => coverInputRef.current?.click()} loading={uploadCover.isPending}>
              New cover
            </Button>
            <Button variant="ghost" size="sm" loading={resetCover.isPending} onClick={() => resetCover.mutate(book.id)}>
              Use page 1
            </Button>
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadCover.mutate({ id: book.id, file });
              event.target.value = "";
            }}
          />
          <Button size="lg" className="w-full" disabled={!ready} onClick={() => router.push(`/read/${book.id}`)}>
            READ NOW
          </Button>
          <Button
            size="lg"
            variant="blue"
            className="w-full"
            disabled={!ready}
            onClick={() => router.push(`/read/${book.id}?listen=1`)}
          >
            LISTEN
          </Button>
        </div>

        <div className="space-y-5">
          <div data-pop className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-4xl leading-tight tracking-wide">{book.title}</h1>
              <p className="mt-1 text-lg font-bold text-muted">{book.author ?? "Unknown author"}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
              Edit details
            </Button>
          </div>

          {book.description ? (
            <p data-pop className="comic-border rounded-card bg-panel p-4 font-medium shadow-comic-sm">
              {book.description}
            </p>
          ) : null}

          {book.extraction_status === "failed" ? (
            <div data-pop className="comic-border rounded-card bg-pow/15 p-4 shadow-comic-sm">
              <p className="font-bold text-pow">This book could not be processed.</p>
              <p className="mt-1 text-sm text-muted">{book.extraction_error}</p>
              <Button size="sm" className="mt-3" loading={reprocess.isPending} onClick={() => reprocess.mutate(book.id)}>
                Try again
              </Button>
            </div>
          ) : null}

          <div data-pop className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-sm font-bold text-muted">Status</span>
              {STATUSES.map((status) => (
                <button
                  key={status.id}
                  onClick={() => setField({ status: status.id })}
                  className={cn(
                    "comic-press rounded-xl px-3 py-1 font-bold transition-colors",
                    book.status === status.id
                      ? cn("comic-border -rotate-1 shadow-comic-sm", status.active)
                      : "text-muted hover:bg-soft",
                  )}
                >
                  {status.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-sm font-bold text-muted">Priority</span>
              {PRIORITIES.map((priority) => (
                <button
                  key={priority.id}
                  onClick={() => setField({ priority: priority.id })}
                  className={cn(
                    "comic-press rounded-xl px-3 py-1 font-bold transition-colors",
                    book.priority === priority.id
                      ? "comic-border rotate-1 bg-zap shadow-comic-sm"
                      : "text-muted hover:bg-soft",
                  )}
                >
                  {priority.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-sm font-bold text-muted">Color</span>
              {COLORS.map((color) => (
                <button
                  key={color}
                  aria-label={`Mark with ${color}`}
                  onClick={() => setField({ color: book.color === color ? null : color })}
                  className={cn(
                    "comic-border size-8 rounded-full shadow-comic-sm transition-transform",
                    book.color === color ? "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-paper" : "hover:scale-110",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
              <button
                aria-label="Clear color"
                onClick={() => setField({ color: null })}
                className="comic-border grid size-8 place-items-center rounded-full bg-panel text-muted shadow-comic-sm hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="size-4" stroke="currentColor" strokeWidth="2.5" fill="none">
                  <path d="M5 19L19 5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-sm font-bold text-muted">Favorite</span>
              <button
                onClick={() => setField({ is_favorite: !book.is_favorite })}
                className={cn(
                  "comic-press rounded-xl px-3 py-1 font-bold transition-colors",
                  book.is_favorite
                    ? "comic-border -rotate-1 bg-zap shadow-comic-sm"
                    : "text-muted hover:bg-soft",
                )}
              >
                {book.is_favorite ? "★ Favorited" : "☆ Add to favorites"}
              </button>
            </div>
          </div>

          <div data-pop className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-bold text-muted">
            <span>{book.page_count} pages</span>
            <span>{formatBytes(book.file_size)}</span>
            <span>Added {formatDate(book.created_at)}</span>
            <span>Last read {timeAgo(book.last_read_at)}</span>
          </div>

          <div data-pop>
            <ProgressMap book={book} />
          </div>

          <div data-pop className="flex justify-end">
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete book
            </Button>
          </div>
        </div>
      </div>

      <EditBookDialog book={book} open={editOpen} onClose={() => setEditOpen(false)} />

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this book?">
        <p className="font-medium text-muted">
          “{book.title}” and all of its progress will be gone forever.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Keep it
          </Button>
          <Button
            variant="danger"
            loading={deleteBook.isPending}
            onClick={() =>
              deleteBook.mutate(book.id, {
                onSuccess: () => {
                  toast("Book deleted", "success");
                  router.replace("/library");
                },
              })
            }
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
