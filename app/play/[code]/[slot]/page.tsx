import { notFound, redirect } from "next/navigation";
import { PlayFlow } from "@/components/PlayFlow";
import { isRoomCode } from "@/lib/code";
import { getSession } from "@/lib/kv";
import type { Slot } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlayPage({
  params,
}: {
  params: { code: string; slot: string };
}) {
  const code = params.code.toUpperCase();
  const slot = params.slot as Slot;

  if (!isRoomCode(code)) notFound();
  if (slot !== "player1" && slot !== "player2") notFound();

  const session = await getSession(code);
  if (!session) notFound();
  if (session.band) redirect(`/band/${code}`);

  return <PlayFlow code={code} slot={slot} initialSession={session} />;
}
