export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div
      className={`font-mono text-[11px] tracking-[0.28em] uppercase text-ink/70 ${className}`}
    >
      Bandmate
    </div>
  );
}
