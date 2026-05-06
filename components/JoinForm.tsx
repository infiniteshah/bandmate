"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(c)) {
      setError("Codes are 6 characters.");
      return;
    }
    router.push(`/join/${c}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/55">
        Have a code?
      </label>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => {
            setError(null);
            setCode(e.target.value.toUpperCase());
          }}
          placeholder="AB12CD"
          maxLength={6}
          inputMode="text"
          autoCapitalize="characters"
          spellCheck={false}
          className="flex-1 rounded-full border border-ink/25 bg-paper px-5 py-3 font-mono uppercase tracking-[0.22em] outline-none focus:border-ink"
        />
        <button type="submit" className="btn btn-ghost">
          Join
        </button>
      </div>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
    </form>
  );
}
