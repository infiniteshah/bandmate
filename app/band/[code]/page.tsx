import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BandView } from "@/components/BandView";
import { isRoomCode } from "@/lib/code";
import { getSession } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { code: string };
}): Promise<Metadata> {
  const code = params.code.toUpperCase();
  if (!isRoomCode(code)) return {};
  const band = (await getSession(code))?.band;
  if (!band) return { title: "BandMate" };

  const title = `${band.name} — "${band.singleTitle}"`;
  const description = `${band.score.toFixed(1)}/10 · ${band.pullQuote}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: band.albumCoverUrl, width: 1024, height: 1024 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [band.albumCoverUrl],
    },
  };
}

export default async function BandPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  if (!isRoomCode(code)) notFound();
  const session = await getSession(code);
  if (!session) notFound();

  return <BandView code={code} initialSession={session} />;
}
