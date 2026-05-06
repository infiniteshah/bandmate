"use client";

import Link from "next/link";

export default function BandError() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div>
        <h1 className="headline text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-[15px] text-ink/70">
          Couldn&apos;t load the band page. Try refreshing.
        </p>
      </div>
      <Link href="/" className="btn btn-primary">
        Back home
      </Link>
    </div>
  );
}
