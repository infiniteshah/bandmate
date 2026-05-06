import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between">
        <Wordmark />
      </header>
      <section className="mt-24 flex flex-col gap-4">
        <h1 className="headline text-4xl font-semibold leading-tight">
          Couldn't find that room.
        </h1>
        <p className="text-[15px] text-ink/70">
          Sessions expire after 24 hours. Start a new band or paste a fresh code.
        </p>
        <Link href="/" className="btn btn-primary mt-4 self-start">
          Start a band
        </Link>
      </section>
    </div>
  );
}
