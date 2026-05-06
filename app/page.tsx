import { JoinForm } from "@/components/JoinForm";
import { LibraryStrip } from "@/components/LibraryStrip";
import { StartButton } from "@/components/StartButton";
import { Wordmark } from "@/components/Wordmark";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between">
        <Wordmark />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/55">
          v1
        </span>
      </header>

      <section className="mt-16 flex flex-col gap-5">
        <h1 className="headline text-[44px] font-semibold leading-[1.02] tracking-[-0.01em]">
          Photograph an object.
          <br />
          <span className="text-accent">Form a band.</span>
        </h1>
        <p className="max-w-[36ch] text-[15px] leading-relaxed text-ink/70">
          Two players, two photos. Claude turns each object into a band member.
          You get an album, a Pitchfork-style review, and a screenshot worth
          texting to a third person.
        </p>
      </section>

      <section className="mt-12 flex flex-col gap-6">
        <StartButton />
        <LibraryStrip />
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-ink/40">
          <span className="h-px flex-1 bg-ink/15" />
          <span>or</span>
          <span className="h-px flex-1 bg-ink/15" />
        </div>
        <JoinForm />
      </section>

      <footer className="mt-auto pt-12 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
        No accounts. No login. Sessions last 24 hours.
      </footer>
    </div>
  );
}
