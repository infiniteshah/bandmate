"use client";

import { useState } from "react";
import { MemberCard } from "./MemberCard";
import { PlayFlow } from "./PlayFlow";
import { Wordmark } from "./Wordmark";
import type { Member, Session } from "@/lib/types";

type Props = {
  code: string;
  session: Session;
  player1: Member;
};

export function JoinFlow({ code, session, player1 }: Props) {
  const [joined, setJoined] = useState(false);

  if (joined) {
    return <PlayFlow code={code} slot="player2" initialSession={session} />;
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex items-center justify-between">
        <Wordmark />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/55">
          Room {code}
        </span>
      </header>
      <div>
        <h1 className="headline text-3xl font-semibold leading-tight">
          {player1.name} is looking for a bandmate.
        </h1>
        <p className="mt-2 text-[15px] text-ink/70">
          Photograph any object to join the band.
        </p>
      </div>
      <MemberCard member={player1} label="Player 1" />
      <button onClick={() => setJoined(true)} className="btn btn-primary">
        Join the band
      </button>
    </div>
  );
}
