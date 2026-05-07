"use client";
import { useState } from "react";

// Prefer the canonical product domain so deployment URLs
// (bandmate-xxx-...-projects.vercel.app) don't leak into share links.
function shareOrigin(): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL;
  if (env && !env.includes("localhost")) return env.replace(/\/+$/, "");
  if (typeof window === "undefined") return "";
  const origin = window.location.origin;
  if (/\.vercel\.app$/.test(new URL(origin).hostname)) {
    return "https://bandmate.tech";
  }
  return origin;
}

export function RoomCodeShare({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${shareOrigin()}/join/${code}`;
  const shortUrl = url.replace(/^https?:\/\//, "");

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
          text: "join my band — photograph an object",
          url,
        });
        return;
      } catch {}
    }
    copy();
  }

  return (
    <div className="frame rounded-md p-5">
      <div className="flex items-center justify-between">
        <span className="tag">Invite a bandmate</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
          They snap, you fuse
        </span>
      </div>
      <p className="headline mt-3 text-[15px] leading-snug text-ink/85">
        Send the link. They open it on their phone, photograph an object, and
        you'll fuse into a band.
      </p>
      <div className="mt-4 flex gap-2">
        <button onClick={share} className="btn btn-primary flex-1">
          Share invite link
        </button>
        <button onClick={copy} className="btn btn-ghost">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="mt-3 break-all font-mono text-[11px] text-ink/55">
        {shortUrl}
      </div>
    </div>
  );
}
