"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useMe } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { FullScreenSpinner } from "@/components/ui/spinner";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cn(
        "comic-press rounded-xl px-3 py-1 font-bold transition-colors",
        active
          ? "comic-border -rotate-1 bg-boom text-white shadow-comic-sm"
          : "text-muted hover:bg-soft hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isPending, isError } = useMe();

  useEffect(() => {
    if (isError) router.replace("/login");
  }, [isError, router]);

  if (isPending || !user) {
    return <FullScreenSpinner />;
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b-[3px] border-ink bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link
            href="/library"
            className="comic-border shine comic-press -rotate-1 rounded-xl bg-zap px-3 py-0.5 font-display text-2xl tracking-wider shadow-comic-sm"
          >
            BOOKLY
          </Link>
          <nav className="flex items-center gap-2">
            <NavLink href="/library">Library</NavLink>
            <NavLink href="/profile">Profile</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
