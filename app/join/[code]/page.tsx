import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { JoinFlow } from "@/components/JoinFlow";
import { WaitingForPlayer1 } from "@/components/WaitingForPlayer1";
import { isRoomCode } from "@/lib/code";
import { getSession } from "@/lib/kv";

export const dynamic = "force-dynamic";

// The join link is the app's top of funnel — it arrives as a text message.
// Unfurl it with player 1's card instead of a generic site preview.
export async function generateMetadata({
  params,
}: {
  params: { code: string };
}): Promise<Metadata> {
  const code = params.code.toUpperCase();
  if (!isRoomCode(code)) return {};
  const session = await getSession(code);
  const p1 = session?.player1;
  if (!p1) return { title: "Join the band — BandMate" };

  const title = `${p1.name} is looking for a bandmate`;
  const description = `${p1.name} (${p1.instrument}, ${p1.genreLean}) needs a second member. Snap a photo of an object to join.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: p1.portraitUrl, width: 1024, height: 1024 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [p1.portraitUrl],
    },
  };
}

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
