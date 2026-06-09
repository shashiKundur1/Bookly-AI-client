"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";
import { useUploadBook } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

export function UploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadBook();

  const reset = () => {
    setFile(null);
    setTitle("");
    setAuthor("");
    setProgress(0);
  };

  const pick = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".pdf") && candidate.type !== "application/pdf") {
      toast("Only PDF files are supported");
      return;
    }
    setFile(candidate);
  };

  const submit = () => {
    if (!file) return;
    setProgress(0);
    upload.mutate(
      {
        file,
        fields: { title: title.trim() || undefined, author: author.trim() || undefined },
        onProgress: setProgress,
      },
      {
        onSuccess: () => {
          toast("Book added to your shelf!", "success");
          reset();
          onClose();
        },
        onError: (error) => toast(error.message),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!upload.isPending) onClose();
      }}
      title="Add a book"
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            pick(event.dataTransfer.files[0]);
          }}
          className={cn(
            "halftone w-full rounded-card border-[3px] border-dashed border-ink p-6 text-center transition-colors",
            dragOver ? "bg-zap/40" : "bg-soft hover:bg-zap/20",
          )}
        >
          {file ? (
            <span className="font-bold">
              {file.name}
              <span className="block text-sm font-medium text-muted">{formatBytes(file.size)}</span>
            </span>
          ) : (
            <span className="font-bold text-muted">
              Drop a PDF here
              <span className="block text-sm font-medium">or tap to browse</span>
            </span>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(event) => pick(event.target.files?.[0])}
        />
        <Input
          label="Title (optional, taken from the PDF if empty)"
          value={title}
          maxLength={300}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Input
          label="Author (optional)"
          value={author}
          maxLength={200}
          onChange={(event) => setAuthor(event.target.value)}
        />
        {upload.isPending ? (
          <div className="space-y-1">
            <div className="comic-border h-5 overflow-hidden rounded-full bg-soft">
              <div
                className="h-full rounded-full bg-boom transition-[width] duration-200"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="text-center text-sm font-bold text-muted">
              {progress < 1 ? `Uploading ${Math.round(progress * 100)}%` : "Processing…"}
            </p>
          </div>
        ) : null}
        <Button onClick={submit} size="lg" loading={upload.isPending} disabled={!file} className="w-full">
          Add to shelf
        </Button>
      </div>
    </Dialog>
  );
}
