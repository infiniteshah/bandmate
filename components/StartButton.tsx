"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function StartButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/session/create", { method: "POST" });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = (await res.json()) as { code: string };
      router.push(`/play/${data.code}/player1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={start}
        disabled={loading}
        className="btn btn-primary w-full disabled:opacity-60"
      >
        {loading ? "Starting..." : "Start a band"}
      </button>
      {error ? <p className="text-center text-sm text-accent">{error}</p> : null}
    </div>
  );
}
