"use client";

import { useGSAP } from "@gsap/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { popIn } from "@/lib/animate";
import { userApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDate, formatDuration, timeAgo } from "@/lib/format";
import { useMe } from "@/lib/hooks";
import {
  useChangePassword,
  useLogout,
  useStats,
  useUpdateMe,
  useUploadAvatar,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export default function ProfilePage() {
  const router = useRouter();
  const { data: user } = useMe();
  const { data: stats } = useStats();
  const updateMe = useUpdateMe();
  const changePassword = useChangePassword();
  const uploadAvatar = useUploadAvatar();
  const logout = useLogout();

  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  useGSAP(
    () => {
      if (user && stats) popIn("[data-pop]", { stagger: 0.07, y: 20 });
    },
    { scope: pageRef, dependencies: [Boolean(user && stats)] },
  );

  if (!user || !stats) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="text-ink" />
      </div>
    );
  }

  const cards = [
    { label: "Books", value: String(stats.total_books), tone: "bg-zap text-ink", tilt: "-rotate-1" },
    { label: "Pages read", value: String(stats.pages_read), tone: "bg-boom text-white", tilt: "rotate-1" },
    {
      label: "Time reading",
      value: formatDuration(stats.reading_seconds),
      tone: "bg-grass text-white",
      tilt: "-rotate-1",
    },
    {
      label: "Finished",
      value: String(stats.by_status.finished ?? 0),
      tone: "bg-grape text-white",
      tilt: "rotate-1",
    },
  ];

  return (
    <div ref={pageRef} className="mx-auto max-w-3xl space-y-6">
      <div data-pop className="flex flex-wrap items-center gap-4">
        <button
          onClick={() => avatarInputRef.current?.click()}
          aria-label="Change avatar"
          className="comic-border comic-press shine relative size-20 overflow-hidden rounded-2xl bg-zap shadow-comic"
        >
          {user.has_avatar ? (
            <img src={userApi.avatarUrl()} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center font-display text-4xl">
              {user.name.charAt(0).toUpperCase()}
            </span>
          )}
          {uploadAvatar.isPending ? (
            <span className="absolute inset-0 grid place-items-center bg-paper/70">
              <Spinner className="text-ink" />
            </span>
          ) : null}
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) uploadAvatar.mutate(file);
            event.target.value = "";
          }}
        />
        <div className="min-w-0">
          <h1 className="truncate font-display text-4xl tracking-wide">{user.name}</h1>
          <p className="truncate font-bold text-muted">{user.email}</p>
          <p className="text-sm font-medium text-faint">Reader since {formatDate(user.created_at)}</p>
        </div>
      </div>

      <div data-pop className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={cn("comic-border shine rounded-card p-4 shadow-comic", card.tone, card.tilt)}
          >
            <p className="font-display text-4xl tracking-wide">{card.value}</p>
            <p className="text-sm font-bold opacity-80">{card.label}</p>
          </div>
        ))}
      </div>

      <section data-pop className="comic-border rounded-card bg-panel p-5 shadow-comic">
        <h2 className="mb-3 font-display text-2xl tracking-wide">RECENT SESSIONS</h2>
        {stats.recent_sessions.length === 0 ? (
          <p className="font-medium text-muted">No reading sessions yet. Open a book!</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto overscroll-contain pr-1">
            {stats.recent_sessions.map((session) => {
              const seconds = session.ended_at
                ? (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) /
                  1000
                : null;
              return (
                <li
                  key={session.id}
                  className="comic-border flex flex-wrap items-center justify-between gap-2 rounded-xl bg-soft px-3 py-2 shadow-comic-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold">{session.book_title}</p>
                    <p className="text-xs font-medium text-muted">{timeAgo(session.started_at)}</p>
                  </div>
                  <div className="text-right text-sm font-bold text-muted">
                    <p>
                      p. {session.start_page}
                      {session.end_page ? ` → ${session.end_page}` : ""}
                    </p>
                    {seconds !== null && seconds > 0 ? <p>{formatDuration(seconds)}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section data-pop className="comic-border rounded-card bg-panel p-5 shadow-comic">
        <h2 className="mb-3 font-display text-2xl tracking-wide">ACCOUNT</h2>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) updateMe.mutate({ name: name.trim() });
          }}
        >
          <div className="min-w-0 flex-1">
            <Input label="Display name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </div>
          <Button type="submit" loading={updateMe.isPending} disabled={!name.trim() || name === user.name}>
            Save
          </Button>
        </form>
        <form
          className="mt-5 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            changePassword.mutate(
              { current_password: currentPassword, new_password: newPassword },
              {
                onSuccess: () => {
                  setCurrentPassword("");
                  setNewPassword("");
                },
              },
            );
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <Button type="submit" variant="ghost" loading={changePassword.isPending}>
            Change password
          </Button>
        </form>
      </section>

      <div data-pop className="flex justify-end">
        <Button
          variant="danger"
          loading={logout.isPending}
          onClick={() => logout.mutate(undefined, { onSuccess: () => router.replace("/login") })}
        >
          Log out
        </Button>
      </div>
    </div>
  );
}
