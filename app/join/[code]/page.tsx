import { notFound, redirect } from "next/navigation";
import { JoinFlow } from "@/components/JoinFlow";
import { WaitingForPlayer1 } from "@/components/WaitingForPlayer1";
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
    return <WaitingForPlayer1 code={code} initialSession={session} />;
  }

  return <JoinFlow code={code} session={session} player1={session.player1} />;
}
