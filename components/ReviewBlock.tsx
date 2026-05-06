import type { Band } from "@/lib/types";

export function ReviewBlock({ band }: { band: Band }) {
  return (
    <div className="frame rounded-md p-5">
      <div className="flex items-baseline justify-between">
        <span className="tag">Review</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
          Pitchfork-ish
        </span>
      </div>
      <div className="mt-4 flex items-end gap-4">
        <div className="score text-6xl leading-none text-accent">
          {band.score.toFixed(1)}
        </div>
        <div className="pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          / 10
        </div>
      </div>
      <p className="headline mt-4 text-[15px] leading-relaxed text-ink/85">{band.review}</p>
      <p className="headline mt-4 border-l-2 border-accent pl-3 text-[15px] italic text-accent">
        "{band.pullQuote}"
      </p>
    </div>
  );
}
