"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { getEntries, removeRoom, type LibraryEntry } from "@/lib/library";
import type { Session } from "@/lib/types";

function sessionEqual(a: Session | null | undefined, b: Session | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.code === b.code &&
    a.status === b.status &&
    a.player1?.name === b.player1?.name &&
    a.player1?.portraitUrl === b.player1?.portraitUrl &&
    a.player2?.name === b.player2?.name &&
    a.player2?.portraitUrl === b.player2?.portraitUrl &&
    a.band?.name === b.band?.name &&
    a.band?.albumCoverUrl === b.band?.albumCoverUrl
  );
}

type Resolved = {
  entry: LibraryEntry;
  session: Session | null;
  notFound: boolean;
};

export function LibraryStrip() {
  const [mounted, setMounted] = useState(false);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [sessions, setSessions] = useState<Record<string, Session | null>>({});
  const [missing, setMissing] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    setEntries(getEntries());
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    const loadAll = async () => {
      await Promise.all(
        entries.map(async (e) => {
          try {
            const res = await fetch(`/api/session/${e.code}`, { cache: "no-store" });
            if (res.status === 404) {
              if (!cancelled) {
                setMissing((m) => {
                  if (m.has(e.code)) return m;
                  const next = new Set(m);
                  next.add(e.code);
                  return next;
                });
              }
              return;
            }
            if (!res.ok) return;
            const s = (await res.json()) as Session;
            if (!cancelled) {
              setSessions((prev) => {
                if (sessionEqual(prev[e.code], s)) return prev;
                return { ...prev, [e.code]: s };
              });
            }
          } catch {}
        }),
      );
    };
    loadAll();
    const id = setInterval(loadAll, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [entries, mounted]);

  const resolved = useMemo<Resolved[]>(() => {
    return entries
      .filter((e) => !missing.has(e.code))
      .map((entry) => ({
        entry,
        session: sessions[entry.code] ?? null,
        notFound: false,
      }));
  }, [entries, sessions, missing]);

  const forget = useCallback((code: string) => {
    removeRoom(code);
    setEntries((prev) => prev.filter((e) => e.code !== code));
  }, []);

  useEffect(() => {
    if (missing.size === 0) return;
    missing.forEach((code) => removeRoom(code));
    setEntries((prev) => prev.filter((e) => !missing.has(e.code)));
  }, [missing]);

  if (!mounted || resolved.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/55">
          Your bands
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/40">
          {resolved.length}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {resolved.map(({ entry, session }) => (
          <li key={entry.code}>
            <LibraryRow entry={entry} session={session} onForget={forget} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const LibraryRow = memo(LibraryRowImpl, (a, b) => {
  return (
    a.entry.code === b.entry.code &&
    a.entry.role === b.entry.role &&
    sessionEqual(a.session, b.session) &&
    a.onForget === b.onForget
  );
});

function LibraryRowImpl({
  entry,
  session,
  onForget,
}: {
  entry: LibraryEntry;
  session: Session | null;
  onForget: (code: string) => void;
}) {
  const { href, status, thumbUrl, title, sub } = describe(entry, session);

  return (
    <div className="frame flex items-center gap-3 rounded-md p-2.5">
      <Link href={href} className="flex flex-1 items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-sm border border-ink/15 bg-paper/80">
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink/40">
              {entry.code.slice(0, 2)}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            {status}
          </div>
          <div className="headline truncate text-[17px] font-semibold leading-tight">
            {title}
          </div>
          {sub ? (
            <div className="truncate text-[12px] text-ink/60">{sub}</div>
          ) : null}
        </div>
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          onForget(entry.code);
        }}
        className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/40 hover:text-accent"
        aria-label="Remove from library"
        title="Remove"
      >
        ×
      </button>
    </div>
  );
}

function describe(entry: LibraryEntry, session: Session | null) {
  const myMember = session?.[entry.role] ?? null;
  const other =
    entry.role === "player1" ? session?.player2 : session?.player1;

  if (session?.band) {
    return {
      href: `/band/${entry.code}`,
      status: "Band ready",
      thumbUrl: session.band.albumCoverUrl,
      title: session.band.name,
      sub: `"${session.band.singleTitle}" · ${session.band.runtime}`,
    };
  }

  if (myMember && !other) {
    return {
      href: `/play/${entry.code}/${entry.role}`,
      status: "Waiting for bandmate",
      thumbUrl: myMember.portraitUrl,
      title: myMember.name,
      sub: `${myMember.instrument} · ${myMember.genreLean}`,
    };
  }

  if (myMember && other) {
    return {
      href: `/band/${entry.code}`,
      status: "Forming band…",
      thumbUrl: myMember.portraitUrl,
      title: `${myMember.name} + ${other.name}`,
      sub: "Pitchfork is sharpening their pencils",
    };
  }

  return {
    href: `/play/${entry.code}/${entry.role}`,
    status: entry.role === "player1" ? "Tap to start" : "Tap to join",
    thumbUrl: null as string | null,
    title: `Room ${entry.code}`,
    sub: null,
  };
}
