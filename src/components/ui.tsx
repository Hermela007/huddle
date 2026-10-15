import type { ReactNode } from "react";
import { Link } from "react-router";

// Page wrapper: phone-width column, centred on bigger screens
export function PageShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-5 px-5 pb-10 pt-6">{children}</main>;
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="-ml-1 inline-flex min-h-8 items-center gap-0.5 self-start rounded-full pr-2 text-[15px] font-semibold text-muted outline-none focus-visible:outline-2 focus-visible:outline-coral"
    >
      <ChevronLeft />
      {children}
    </Link>
  );
}

export function ChevronLeft() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function ChevronRight() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

const AVATAR_COLOURS = ["#FFD9CF", "#CFE0FF", "#FBE7B5", "#D6F0DC", "#E6DAFB", "#D5EEF0", "#FFDDEB"];

// The same name always gets the same colour
function colourFor(seed: string): string {
  let total = 0;
  for (const char of seed) total += char.charCodeAt(0);
  return AVATAR_COLOURS[total % AVATAR_COLOURS.length];
}

export function Avatar({ name, seed, size = 28, ring = false }: { name: string; seed: string; size?: number; ring?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-ink ${ring ? "border-2 border-surface" : ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: colourFor(seed) }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

// Trip cover. No photo uploads yet (v1.1), so every trip uses the fallback:
// a soft coral block with the trip's first letter.
export function TripCover({ name, height }: { name: string; height: number }) {
  return (
    <div aria-hidden="true" className="flex w-full items-center justify-center bg-coral-soft" style={{ height }}>
      <span className="font-extrabold text-coral" style={{ fontSize: Math.round(height * 0.46) }}>
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-owes-soft px-3.5 py-2.5 text-sm font-medium text-owes">
      {children}
    </p>
  );
}

// Grey placeholder blocks shown while data loads, in the shape of the real content
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-card bg-surface motion-reduce:animate-none ${className}`} />;
}

export function LoadingRows({ count = 3, height = "h-16" }: { count?: number; height?: string }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={height} />
      ))}
    </div>
  );
}
