import type { Band } from "@/lib/types";

export function AlbumCard({ band }: { band: Band }) {
  return (
    <div className="frame overflow-hidden rounded-md">
      <div className="relative bg-paper">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={band.albumCoverUrl}
          alt=""
          className="block aspect-square w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-paper/95 via-paper/70 to-transparent px-4 pb-4 pt-16">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/70">
            {band.genre}
          </div>
          <div className="headline text-[28px] font-semibold leading-none">{band.name}</div>
          <div className="text-sm text-ink/75">
            "{band.singleTitle}" · <span className="font-mono">{band.runtime}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
