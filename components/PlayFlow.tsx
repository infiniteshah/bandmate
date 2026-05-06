"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "./LoadingState";
import { MemberCard } from "./MemberCard";
import { PhotoCapture } from "./PhotoCapture";
import { RoomCodeShare } from "./RoomCodeShare";
import { Wordmark } from "./Wordmark";
import { memberLoadingCopy } from "@/lib/copy";
import { recordRoom } from "@/lib/library";
import type { Member, Session, Slot } from "@/lib/types";

function sessionShallowEqual(a: Session, b: Session): boolean {
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

type Stage = "capture" | "generating" | "reveal" | "waiting";

type Props = {
  code: string;
  slot: Slot;
  initialSession: Session;
};

export function PlayFlow({ code, slot, initialSession }: Props) {
  const router = useRouter();
  const [session, setSession] = useState<Session>(initialSession);
  const [stage, setStage] = useState<Stage>(() =>
    initialSession[slot] ? (slot === "player1" ? "waiting" : "reveal") : "capture",
  );
  const [error, setError] = useState<string | null>(null);
  const [bandError, setBandError] = useState<string | null>(null);
  const startedBandRef = useRef(false);

  const myMember = session[slot];
  const otherSlot: Slot = slot === "player1" ? "player2" : "player1";
  const otherMember = session[otherSlot];

  useEffect(() => {
    recordRoom(code, slot);
  }, [code, slot]);

  useEffect(() => {
    if (stage !== "waiting" && stage !== "reveal") return;
    if (session.band) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/session/${code}`, { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as Session;
        if (cancelled) return;
        setSession((prev) => (sessionShallowEqual(prev, next) ? prev : next));

        if (
          next.player1 &&
          next.player2 &&
          !next.band &&
          !startedBandRef.current &&
          !bandError
        ) {
          startedBandRef.current = true;
          fetch("/api/band/generate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code }),
          })
            .then(async (res) => {
              if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error ?? friendlyForStatus(res.status));
              }
            })
            .catch((err) => {
              if (cancelled) return;
              setBandError(err instanceof Error ? err.message : "Couldn't form the band.");
              startedBandRef.current = false;
            });
        }

        if (next.band) {
          router.push(`/band/${code}`);
        }
      } catch {}
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [code, router, session.band, stage, bandError]);

  function retryBand() {
    setBandError(null);
    startedBandRef.current = false;
  }

  async function handlePicked(dataUrl: string, mediaType: "image/jpeg") {
    setStage("generating");
    setError(null);
    try {
      const res = await fetch("/api/member/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, slot, image: dataUrl, mediaType }),
      });

      if (!res.ok) {
        // 409 means the server already completed generation on a previous attempt
        // but the network response was lost before the client received it.
        // Recover by using the member the server already stored.
        if (res.status === 409) {
          const body = await res.json().catch(() => null);
          if (body?.member) {
            const updated: Session = { ...session, [slot]: body.member } as Session;
            setSession(updated);
            setStage("reveal");
            return;
          }
        }
        const body = await res.json().catch(() => null);
        const fallback = friendlyForStatus(res.status);
        throw new Error(body?.error ?? fallback);
      }

      const data = (await res.json()) as { member: Member };
      const updated: Session = { ...session, [slot]: data.member } as Session;
      setSession(updated);
      setStage("reveal");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something glitched. Try once more.");
      setStage("capture");
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex items-center justify-between">
        <Wordmark />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/55">
          Room {code}
        </span>
      </header>

      {stage === "capture" ? (
        <section className="flex flex-1 flex-col gap-6">
          <div>
            <h1 className="headline text-3xl font-semibold leading-tight">
              {slot === "player1"
                ? "Photograph any object."
                : `Join ${otherMember?.name ?? "the band"}.`}
            </h1>
            <p className="mt-2 text-[15px] text-ink/70">
              Pick something around you. The weirder the better — a mug, a plant,
              a stranger's umbrella. Claude will turn it into your bandmate.
            </p>
          </div>
          {otherMember && slot === "player2" ? (
            <div className="opacity-90">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink/55">
                {otherMember.name} is looking for a bandmate
              </div>
              <MemberCard member={otherMember} />
            </div>
          ) : null}
          <PhotoCapture
            onPicked={handlePicked}
            onError={(m) => setError(m)}
            hint="Use your camera or pick from photos."
          />
          {error ? (
            <div className="rounded-sm border border-accent/40 bg-accent/10 p-3 text-sm text-accent">
              {error}
            </div>
          ) : null}
        </section>
      ) : null}

      {stage === "generating" ? (
        <section className="flex flex-1 flex-col">
          <LoadingState messages={memberLoadingCopy} />
        </section>
      ) : null}

      {stage === "reveal" && myMember ? (
        <section className="flex flex-col gap-5">
          <div className="text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/55">
              Meet your member
            </div>
          </div>
          <MemberCard member={myMember} />
          {!otherMember ? (
            <div className="flex flex-col gap-3">
              <RoomCodeShare code={code} />
              <p className="text-center text-[13px] text-ink/60">
                Waiting for your bandmate to join...
              </p>
            </div>
          ) : bandError ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="rounded-sm border border-accent/40 bg-accent/10 p-3 text-sm text-accent">
                {bandError}
              </div>
              <button onClick={retryBand} className="btn btn-primary">
                Try again
              </button>
            </div>
          ) : (
            <div className="text-center text-[13px] text-ink/60">
              Both members in. Forming the band...
            </div>
          )}
        </section>
      ) : null}

      {stage === "waiting" && myMember ? (
        <section className="flex flex-col gap-5">
          <MemberCard member={myMember} />
          {!otherMember ? (
            <RoomCodeShare code={code} />
          ) : bandError ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="rounded-sm border border-accent/40 bg-accent/10 p-3 text-sm text-accent">
                {bandError}
              </div>
              <button onClick={retryBand} className="btn btn-primary">
                Try again
              </button>
            </div>
          ) : (
            <div className="text-center text-[13px] text-ink/60">
              Both members in. Forming the band...
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function friendlyForStatus(status: number): string {
  if (status === 413) return "Photo is too large. Try again with a smaller one.";
  if (status === 422) return "Couldn't generate from that photo. Try a different object — not a person.";
  if (status === 503) return "The model is busy right now. Try once more.";
  if (status >= 500) return "Something glitched on our end. Try once more.";
  return "Couldn't make a member from that. Try again.";
}
