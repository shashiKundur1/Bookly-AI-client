import { cn } from "@/lib/cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-label="Loading">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-2 rounded-full bg-current animate-[comic-bob_0.55s_ease-in-out_infinite]"
          style={{ animationDelay: `${index * 0.12}s` }}
        />
      ))}
    </span>
  );
}

export function FullScreenSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-4">
        <span className="comic-border shine inline-block -rotate-2 rounded-2xl bg-zap px-5 py-2 font-display text-4xl tracking-wider shadow-comic-lg">
          BOOKLY
        </span>
        <Spinner className="text-ink" />
      </div>
    </div>
  );
}
