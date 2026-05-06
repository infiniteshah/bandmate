import Link from "next/link";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`font-mono text-[11px] tracking-[0.28em] uppercase text-ink/70 transition hover:text-ink ${className}`}
    >
      Bandmate
    </Link>
  );
}
