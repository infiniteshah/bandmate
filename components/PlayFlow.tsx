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
        setSession(next);

        if (next.player1 && next.player2 && !next.band && !startedBandRef.current) {
          startedBandRef.current = true;
          fetch("/api/band/generate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code }),
          }).catch(() => {
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
  }, [code, router, session.band, stage]);

  async function handlePicked(file: File, dataUrl: string) {
    setStage("generating");
    setError(null);
    try {
      const mediaType = inferMediaType(file.type);
      const res = await fetch("/api/member/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, slot, image: dataUrl, mediaType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Generation failed (${res.status})`);
      }
      const data = (await res.json()) as { member: Member };
      const updated: Session = { ...session, [slot]: data.member } as Session;
      setSession(updated);
      setStage("reveal");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
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

function inferMediaType(mime: string): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "image/png";
  if (m.includes("webp")) return "image/webp";
  if (m.includes("gif")) return "image/gif";
  return "image/jpeg";
}
