import type { Member } from "@/lib/types";

const STAT_LABEL: Record<keyof Member["stats"], string> = {
  stagePresence: "Stage presence",
  songwriting: "Songwriting",
  chaos: "Chaos",
  vibe: "Vibe",
};

export function MemberCard({ member, label }: { member: Member; label?: string }) {
  return (
    <div className="frame rounded-md p-5">
      {label ? (
        <div className="mb-3 flex items-center justify-between">
          <span className="tag">{label}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
            Side A
          </span>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-sm border border-ink/15 bg-paper">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={member.portraitUrl}
          alt={member.name}
          className="block aspect-square w-full object-cover"
        />
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <h2 className="headline text-2xl font-semibold leading-tight">{member.name}</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">
          {member.genreLean}
        </span>
      </div>
      <div className="mt-1 text-sm text-ink/70">{member.instrument}</div>
      <p className="headline mt-3 text-[15px] leading-snug text-ink/85">{member.bio}</p>
      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3">
        {(Object.keys(STAT_LABEL) as (keyof Member["stats"])[]).map((k) => (
          <div key={k}>
            <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-ink/60">
              <span>{STAT_LABEL[k]}</span>
              <span className="font-mono text-ink/80">{member.stats[k]}</span>
            </div>
            <div className="bar">
              <span style={{ width: `${(member.stats[k] / 10) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
