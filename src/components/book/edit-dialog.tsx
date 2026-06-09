"use client";

import { useEffect, useState } from "react";

import { useUpdateBook } from "@/lib/queries";
import type { Book } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

export function EditBookDialog({
  book,
  open,
  onClose,
}: {
  book: Book;
  open: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author ?? "");
  const [description, setDescription] = useState(book.description ?? "");
  const updateBook = useUpdateBook();

  useEffect(() => {
    if (open) {
      setTitle(book.title);
      setAuthor(book.author ?? "");
      setDescription(book.description ?? "");
    }
  }, [open, book]);

  const save = () => {
    updateBook.mutate(
      {
        id: book.id,
        changes: {
          title: title.trim() || book.title,
          author: author.trim() || null,
          description: description.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast("Saved!", "success");
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title="Edit details">
      <div className="space-y-4">
        <Input label="Title" value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} />
        <Input label="Author" value={author} maxLength={200} onChange={(event) => setAuthor(event.target.value)} />
        <div className="space-y-1.5">
          <label htmlFor="book-description" className="block text-sm font-bold text-muted">
            Notes
          </label>
          <textarea
            id="book-description"
            value={description}
            maxLength={5000}
            rows={4}
            onChange={(event) => setDescription(event.target.value)}
            className="comic-border w-full resize-none rounded-xl bg-panel px-4 py-3 font-medium shadow-comic-sm outline-none placeholder:text-faint focus:border-boom"
            placeholder="Why this book, favorite quotes, anything"
          />
        </div>
        <Button onClick={save} loading={updateBook.isPending} className="w-full">
          Save changes
        </Button>
      </div>
    </Dialog>
  );
}
