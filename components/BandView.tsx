"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlbumCard } from "./AlbumCard";
import { LoadingState } from "./LoadingState";
import { ReviewBlock } from "./ReviewBlock";
import { Wordmark } from "./Wordmark";
import { bandLoadingCopy } from "@/lib/copy";
import type { Band, Member, Session } from "@/lib/types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Cadence (in 2s polling ticks):
//   tick 3  (~6s): first server-trigger fallback if band still missing
//   tick 6  (~12s): "Replicate is busy, still trying" status hint
//   tick 12 (~24s): give up auto-retrying; surface manual retry UI
const POLL_INTERVAL_MS = 2000;
const FIRST_FALLBACK_TICK = 3;
const SLOW_HINT_TICK = 6;
const GIVE_UP_TICK = 12;
const RETRY_INTERVAL_TICKS = 3; // fire fallback every ~6s after the first

export function BandView({ code, initialSession }: { code: string; initialSession: Session }) {
  const router = useRouter();
  const [session, setSession] = useState<Session>(initialSession);
  const [shareError, setShareError] = useState<string | null>(null);
  const [bandError, setBandError] = useState<string | null>(null);
  const [slowHint, setSlowHint] = useState(false);
  const pollsRef = useRef(0);
  const lastFallbackTickRef = useRef(-Infinity);
  const giveUpRef = useRef(false);
  // Bumping this resets the polling/retry state — used by the "Try again" button.
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (session.band) return;
    let cancelled = false;
    pollsRef.current = 0;
    lastFallbackTickRef.current = -Infinity;
    giveUpRef.current = false;
    setSlowHint(false);
    setBandError(null);

    const fireFallback = async () => {
      try {
        const res = await fetch("/api/band/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (res.ok) {
          // Use the response directly so the user sees the band immediately
          // instead of waiting up to one polling interval for KV to be re-read.
          const body = (await res.json().catch(() => null)) as
            | { band?: Session["band"]; status?: Session["status"] }
            | null;
          if (body?.band && !cancelled) {
            setSession((prev) => ({ ...prev, band: body.band ?? prev.band }));
          }
          return;
        }
        // 503/429 → Replicate is throttled. Will try again on next interval.
      } catch {
        // Network error — same handling, just keep polling.
      }
    };

    const tick = async () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      pollsRef.current += 1;
      const polls = pollsRef.current;

      try {
        const res = await fetch(`/api/session/${code}`, { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as Session;
        if (cancelled) return;
        setSession((prev) => ({
          ...next,
          player1: next.player1 ?? prev.player1,
          player2: next.player2 ?? prev.player2,
          band: next.band ?? prev.band,
        }));

        if (next.band) return;

        if (polls >= SLOW_HINT_TICK && !slowHint) setSlowHint(true);

        if (polls >= GIVE_UP_TICK && !giveUpRef.current) {
          giveUpRef.current = true;
          setBandError(
            "Replicate is throttling album cover generation. The text is ready — try again to fetch the cover.",
          );
          return;
        }

        if (giveUpRef.current) return;

        // Initial fallback at FIRST_FALLBACK_TICK, then every RETRY_INTERVAL_TICKS.
        if (
          polls >= FIRST_FALLBACK_TICK &&
          polls - lastFallbackTickRef.current >= RETRY_INTERVAL_TICKS
        ) {
          lastFallbackTickRef.current = polls;
          fireFallback();
        }
      } catch {}
    };
    const id = setInterval(tick, POLL_INTERVAL_MS);
    tick();
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [code, session.band, retryNonce, slowHint]);

  const retryBand = useCallback(() => {
    setBandError(null);
    setSlowHint(false);
    pollsRef.current = 0;
    lastFallbackTickRef.current = -Infinity;
    giveUpRef.current = false;
    setRetryNonce((n) => n + 1);
  }, []);

  async function shareImage() {
    setShareError(null);
    const url = `/api/share/${code}`;
    let blob: Blob;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("share image not ready");
      blob = await res.blob();
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "share failed");
      return;
    }

    const file = new File([blob], `bandmate-${code}.png`, { type: "image/png" });
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
    };

    if (nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: session.band?.name ?? "Bandmate",
          text: `${session.band?.name} — ${session.band?.singleTitle}`,
        });
        return;
      } catch (e) {
        // User dismissed the share sheet — respect that, do nothing.
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Any other failure (no target apps, permission, etc.) — fall through
        // to the plain download below so the user still gets the file.
      }
    }

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `bandmate-${code}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }

  const header = (
    <header className="flex items-center justify-between">
      <Wordmark />
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/55">
        Room {code}
      </span>
    </header>
  );

  if (!session.band) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        {header}
        <FusionStage player1={session.player1} player2={session.player2} />
        {bandError ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="rounded-sm border border-accent/40 bg-accent/10 p-3 text-sm text-accent">
              {bandError}
            </div>
            <button onClick={retryBand} className="btn btn-primary">
              Try again
            </button>
          </div>
        ) : (
          <>
            <LoadingState messages={bandLoadingCopy} />
            {slowHint ? (
              <p className="text-center text-[12px] text-ink/55">
                Image gen is slow today — still trying.
              </p>
            ) : null}
          </>
        )}
      </div>
    );
  }

  const band = session.band;

  return (
    <div className="flex flex-1 flex-col gap-6">
      {header}

      <AlbumCard band={band} />
      <ReviewBlock band={band} />

      <SingleSection
        code={code}
        band={band}
        onAudio={(url) =>
          setSession((prev) =>
            prev.band
              ? { ...prev, band: { ...prev.band, singleAudioUrl: url } }
              : prev,
          )
        }
      />

      {session.player1 && session.player2 ? (
        <MemberThumbs player1={session.player1} player2={session.player2} />
      ) : null}

      <div className="flex flex-col gap-2">
        <button onClick={shareImage} className="btn btn-primary">
          Share band card
        </button>
        <button
          onClick={() => router.push("/")}
          className="btn btn-ghost"
        >
          Start a new band
        </button>
        {shareError ? (
          <p className="text-center text-[13px] text-accent">{shareError}</p>
        ) : null}
      </div>
    </div>
  );
}

function SingleSection({
  code,
  band,
  onAudio,
}: {
  code: string;
  band: Band;
  onAudio: (url: string) => void;
}) {
  const [cutting, setCutting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const cut = useCallback(async () => {
    setError(null);
    setCutting(true);
    // 409 means the other player's request holds the generation lock —
    // keep asking until their result lands in the session.
    for (let attempt = 0; attempt < 30; attempt++) {
      if (cancelledRef.current) return;
      try {
        const res = await fetch("/api/single/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const body = (await res.json().catch(() => null)) as
          | { singleAudioUrl?: string; error?: string }
          | null;
        if (cancelledRef.current) return;
        if (res.ok && body?.singleAudioUrl) {
          onAudio(body.singleAudioUrl);
          setCutting(false);
          return;
        }
        if (res.status !== 409) {
          setError(body?.error ?? "Couldn't cut the single. Try once more.");
          setCutting(false);
          return;
        }
      } catch {
        // Network hiccup — fall through to the wait and retry.
      }
      await sleep(5000);
    }
    if (!cancelledRef.current) {
      setError("That took too long. Try again.");
      setCutting(false);
    }
  }, [code, onAudio]);

  return (
    <section className="frame rounded-md p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="tag">Single</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          {band.runtime}
        </span>
      </div>
      <div className="headline text-[16px] font-semibold leading-tight">
        &ldquo;{band.singleTitle}&rdquo;
      </div>
      {band.singleAudioUrl ? (
        <audio
          controls
          preload="none"
          src={band.singleAudioUrl}
          className="mt-3 w-full"
        />
      ) : cutting ? (
        <p className="mt-3 animate-pulse text-[13px] text-ink/65">
          Cutting the single — this can take a minute...
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-1">
          <button onClick={cut} className="btn btn-ghost self-start">
            Cut the single
          </button>
          <p className="text-[11px] text-ink/45">
            A 15-second demo of the track. Takes about a minute.
          </p>
          {error ? <p className="text-[13px] text-accent">{error}</p> : null}
        </div>
      )}
    </section>
  );
}

function FusionStage({
  player1,
  player2,
}: {
  player1: Member | null;
  player2: Member | null;
}) {
  return (
    <section className="frame rounded-md p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="tag">Fusing</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Side AB
        </span>
      </div>
      <div className="relative mx-auto flex w-full max-w-[360px] items-center justify-center gap-3">
        <FusionPortrait member={player1} side="left" />
        <FusionPortrait member={player2} side="right" />
      </div>
      <div className="mt-4 text-center">
        <div className="headline text-[18px] font-semibold leading-tight">
          {player1?.name ?? "Member 1"} <span className="text-ink/40">×</span>{" "}
          {player2?.name ?? "Member 2"}
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          forming the band
        </div>
      </div>
    </section>
  );
}

function FusionPortrait({
  member,
  side,
}: {
  member: Member | null;
  side: "left" | "right";
}) {
  return (
    <div
      className={`origin-center ${side === "left" ? "fuse-left" : "fuse-right"}`}
    >
      <div className="overflow-hidden rounded-sm border border-ink/15 bg-paper shadow-sm">
        {member?.portraitUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.portraitUrl}
            alt={member.name}
            className="block h-32 w-32 object-cover sm:h-40 sm:w-40"
          />
        ) : (
          <div className="block h-32 w-32 animate-pulse bg-ink/10 sm:h-40 sm:w-40" />
        )}
      </div>
    </div>
  );
}

function MemberThumbs({
  player1,
  player2,
}: {
  player1: Member;
  player2: Member;
}) {
  return (
    <section className="frame rounded-md p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="tag">Lineup</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Members
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MemberThumb member={player1} />
        <MemberThumb member={player2} />
      </div>
    </section>
  );
}

function MemberThumb({ member }: { member: Member }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-sm border border-ink/15 bg-paper">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={member.portraitUrl}
          alt={member.name}
          className="block aspect-square w-full object-cover"
        />
      </div>
      <div>
        <div className="headline text-[15px] font-semibold leading-tight">
          {member.name}
        </div>
        <div className="text-[12px] text-ink/65">{member.instrument}</div>
        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/55">
          {member.genreLean}
        </div>
      </div>
    </div>
  );
}
