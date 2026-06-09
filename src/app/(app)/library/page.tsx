"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useGSAP } from "@gsap/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { popIn } from "@/lib/animate";
import { cn } from "@/lib/cn";
import { useBooks, useReorderBooks } from "@/lib/queries";
import type { Book, BookFilters, BookPriority } from "@/lib/types";
import { BookCard } from "@/components/library/book-card";
import { UploadDialog } from "@/components/library/upload-dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

const SHELVES = [
  { id: "all", label: "All" },
  { id: "reading", label: "Reading" },
  { id: "to_read", label: "To read" },
  { id: "finished", label: "Finished" },
] as const;

const SORTS = [
  { id: "position", label: "My order" },
  { id: "last_read_at", label: "Recently read" },
  { id: "created_at", label: "Recently added" },
  { id: "title", label: "Title" },
  { id: "priority", label: "Priority" },
] as const;

type ShelfId = (typeof SHELVES)[number]["id"];
type SortId = (typeof SORTS)[number]["id"];

const SORT_ORDERS: Record<SortId, "asc" | "desc"> = {
  position: "asc",
  title: "asc",
  created_at: "desc",
  last_read_at: "desc",
  priority: "desc",
};

function SortableCard({ book }: { book: Book }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: book.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("touch-none", isDragging && "z-20 rotate-2 opacity-80")}
      {...attributes}
      {...listeners}
    >
      <BookCard book={book} arranging />
    </div>
  );
}

const GRID = "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

export default function LibraryPage() {
  const [shelf, setShelf] = useState<ShelfId>("all");
  const [sort, setSort] = useState<SortId>("position");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [priority, setPriority] = useState<BookPriority | "all">("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [localOrder, setLocalOrder] = useState<Book[] | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const reorder = useReorderBooks();

  useEffect(() => {
    const handle = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(handle);
  }, [search]);

  const filters = useMemo<BookFilters>(
    () => ({
      status: shelf === "all" ? undefined : shelf,
      favorite: favoritesOnly || undefined,
      priority: priority === "all" ? undefined : priority,
      q: query || undefined,
      sort,
      order: SORT_ORDERS[sort],
    }),
    [shelf, favoritesOnly, priority, query, sort],
  );

  const { data: books, isPending } = useBooks(filters);
  const filtered = query || favoritesOnly || shelf !== "all" || priority !== "all";
  const canArrange =
    sort === "position" && !filtered && (books?.length ?? 0) > 1;
  const visible = (arranging ? localOrder : null) ?? books ?? [];
  const serializedFilters = JSON.stringify(filters);

  useGSAP(
    () => {
      if (isPending || arranging) return;
      popIn("[data-card]", { stagger: visible.length > 24 ? 0.015 : 0.04, y: 18 });
    },
    { scope: gridRef, dependencies: [serializedFilters, isPending] },
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const current = localOrder ?? books ?? [];
    const oldIndex = current.findIndex((book) => book.id === active.id);
    const newIndex = current.findIndex((book) => book.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(current, oldIndex, newIndex);
    setLocalOrder(next);
    reorder.mutate(next.map((book) => book.id));
  };

  const toggleArranging = () => {
    setLocalOrder(arranging ? null : (books ?? []));
    setArranging(!arranging);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl tracking-wide">MY LIBRARY</h1>
        <div className="flex gap-2">
          {canArrange ? (
            <Button variant={arranging ? "blue" : "ghost"} onClick={toggleArranging}>
              {arranging ? "Done" : "Arrange"}
            </Button>
          ) : null}
          <Button onClick={() => setUploadOpen(true)}>+ Add book</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SHELVES.map((entry) => (
          <button
            key={entry.id}
            onClick={() => setShelf(entry.id)}
            className={cn(
              "comic-press rounded-xl px-3 py-1 font-bold transition-colors",
              shelf === entry.id
                ? "comic-border -rotate-1 bg-zap shadow-comic-sm"
                : "text-muted hover:bg-soft hover:text-ink",
            )}
          >
            {entry.label}
          </button>
        ))}
        <button
          onClick={() => setFavoritesOnly(!favoritesOnly)}
          className={cn(
            "comic-press rounded-xl px-3 py-1 font-bold transition-colors",
            favoritesOnly
              ? "comic-border rotate-1 bg-zap shadow-comic-sm"
              : "text-muted hover:bg-soft hover:text-ink",
          )}
        >
          ★ Favorites
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title or author"
          className="comic-border h-11 w-full max-w-xs rounded-xl bg-panel px-4 font-medium shadow-comic-sm outline-none placeholder:text-faint focus:border-boom"
        />
        <Select
          ariaLabel="Sort books"
          className="w-44"
          value={sort}
          options={SORTS.map((entry) => ({ value: entry.id, label: entry.label }))}
          onChange={(next) => {
            setSort(next as SortId);
            setArranging(false);
            setLocalOrder(null);
          }}
        />
        <Select
          ariaLabel="Filter by priority"
          className="w-40"
          value={priority}
          options={[
            { value: "all", label: "Any priority" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]}
          onChange={(next) => setPriority(next as BookPriority | "all")}
        />
      </div>

      <div ref={gridRef}>
        {isPending ? (
          <div className={GRID}>
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="comic-border animate-pulse rounded-card bg-soft"
                style={{ aspectRatio: "2 / 3.4" }}
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="grid place-items-center py-20">
            <div className="text-center">
              <span className="comic-border shine inline-block -rotate-2 rounded-2xl bg-pow px-5 py-2 font-display text-3xl tracking-wider text-white shadow-comic-lg">
                EMPTY SHELF!
              </span>
              <p className="mt-4 font-bold text-muted">
                {filtered
                  ? "Nothing matches these filters."
                  : "Upload your first PDF to start your collection."}
              </p>
            </div>
          </div>
        ) : arranging ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visible.map((book) => book.id)} strategy={rectSortingStrategy}>
              <div className={GRID}>
                {visible.map((book) => (
                  <SortableCard key={book.id} book={book} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className={GRID}>
            {visible.map((book) => (
              <div data-card key={book.id}>
                <BookCard book={book} />
              </div>
            ))}
          </div>
        )}
      </div>

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
