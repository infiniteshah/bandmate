"use client";
import { useEffect, useState } from "react";

export function LoadingState({ messages }: { messages: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % messages.length), 2400);
    return () => clearInterval(t);
  }, [messages.length]);

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-ink/30" />
        <span className="absolute inset-2 rounded-full border border-ink/40 drift" />
        <span className="absolute inset-4 rounded-full bg-ink pulse-soft" />
      </div>
      <div className="min-h-[1.5rem] text-center text-sm tracking-wide text-ink/70">
        {messages[i]}
      </div>
    </div>
  );
}
