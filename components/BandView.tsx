"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlbumCard } from "./AlbumCard";
import { LoadingState } from "./LoadingState";
import { ReviewBlock } from "./ReviewBlock";
import { Wordmark } from "./Wordmark";
import { bandLoadingCopy } from "@/lib/copy";
import type { Session } from "@/lib/types";

export function BandView({ code, initialSession }: { code: string; initialSession: Session }) {
  const router = useRouter();
  const [session, setSession] = useState<Session>(initialSession);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    if (session.band) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/session/${code}`, { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as Session;
        if (!cancelled) setSession(next);
      } catch {}
    };
    const id = setInterval(tick, 3000);
    tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [code, session.band]);

  async function shareImage() {
    setShareError(null);
    const url = `/api/share/${code}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("share image not ready");
      const blob = await res.blob();
      const file = new File([blob], `bandmate-${code}.png`, { type: "image/png" });

      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: session.band?.name ?? "Bandmate",
          text: `${session.band?.name} — ${session.band?.singleTitle}`,
        });
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `bandmate-${code}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "share failed");
    }
  }

  if (!session.band) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <header className="flex items-center justify-between">
          <Wordmark />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/55">
            Room {code}
          </span>
        </header>
        <LoadingState messages={bandLoadingCopy} />
      </div>
    );
  }

  const band = session.band;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex items-center justify-between">
        <Wordmark />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/55">
          Room {code}
        </span>
      </header>

      <AlbumCard band={band} />
      <ReviewBlock band={band} />

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
