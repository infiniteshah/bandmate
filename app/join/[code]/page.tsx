import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { MemberCard } from "@/components/MemberCard";
import { Wordmark } from "@/components/Wordmark";
import { isRoomCode } from "@/lib/code";
import { getSession } from "@/lib/kv";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  if (!isRoomCode(code)) notFound();

  const session = await getSession(code);
  if (!session) notFound();
  if (session.band) redirect(`/band/${code}`);
  if (session.player2) redirect(`/play/${code}/player2`);

  if (!session.player1) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <header className="flex items-center justify-between">
          <Wordmark />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/55">
            Room {code}
          </span>
        </header>
        <p className="text-[15px] text-ink/70">
          This room exists, but the band starter hasn't picked their member yet.
          Check back in a moment.
        </p>
        <Link href="/" className="btn btn-ghost">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex items-center justify-between">
        <Wordmark />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/55">
          Room {code}
        </span>
      </header>
      <div>
        <h1 className="headline text-3xl font-semibold leading-tight">
          {session.player1.name} is looking for a bandmate.
        </h1>
        <p className="mt-2 text-[15px] text-ink/70">
          Photograph any object to join the band.
        </p>
      </div>
      <MemberCard member={session.player1} label="Player 1" />
      <Link href={`/play/${code}/player2`} className="btn btn-primary">
        Join the band
      </Link>
    </div>
  );
}
