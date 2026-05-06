"use client";
import { useState } from "react";

export function RoomCodeShare({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${code}`
      : `/join/${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "BandMate",
          text: "join my band",
          url,
        });
        return;
      } catch {}
    }
    copy();
  }

  return (
    <div className="frame rounded-md p-5">
      <div className="tag">Invite bandmate</div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="headline text-5xl font-semibold tracking-[0.04em]">{code}</div>
      </div>
      <div className="mt-1 break-all font-mono text-[12px] text-ink/60">{url}</div>
      <div className="mt-4 flex gap-2">
        <button onClick={share} className="btn btn-primary flex-1">
          Share link
        </button>
        <button onClick={copy} className="btn btn-ghost">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
