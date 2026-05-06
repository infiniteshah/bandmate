import { notFound } from "next/navigation";
import { BandView } from "@/components/BandView";
import { isRoomCode } from "@/lib/code";
import { getSession } from "@/lib/kv";

export const dynamic = "force-dynamic";

export default async function BandPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  if (!isRoomCode(code)) notFound();
  const session = await getSession(code);
  if (!session) notFound();

  return <BandView code={code} initialSession={session} />;
}
