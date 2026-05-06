"use client";

import { useEffect, useState } from "react";
import { JoinFlow } from "./JoinFlow";
import { LoadingState } from "./LoadingState";
import { Wordmark } from "./Wordmark";
import type { Member, Session } from "@/lib/types";

const copy = [
  "Waiting for the band starter to snap their photo...",
  "They're finding the perfect object...",
  "Almost there...",
];

type Props = {
  code: string;
  initialSession: Session;
};

export function WaitingForPlayer1({ code, initialSession }: Props) {
  const [player1, setPlayer1] = useState<Member | null>(initialSession.player1);
  const [session, setSession] = useState<Session>(initialSession);

  useEffect(() => {
    if (player1) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/session/${code}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const next = (await res.json()) as Session;
        if (cancelled) return;
        if (next.player1) {
          setSession(next);
          setPlayer1(next.player1);
        }
      } catch {}
    };

    tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [code, player1]);

  if (player1) {
    return <JoinFlow code={code} session={session} player1={player1} />;
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex items-center justify-between">
        <Wordmark />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/55">
          Room {code}
        </span>
      </header>
      <LoadingState messages={copy} />
    </div>
  );
}
