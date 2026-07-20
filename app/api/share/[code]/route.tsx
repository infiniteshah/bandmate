import { ImageResponse } from "@vercel/og";
import { getSession } from "@/lib/kv";
import { isRoomCode } from "@/lib/code";
import { getShareFonts } from "@/lib/share-fonts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAPER = "#efe9dd";
const INK = "#1a1814";
const ACCENT = "#c8553d";
const MUTED = "#6f6a60";

export async function GET(
  _req: Request,
  { params }: { params: { code: string } },
) {
  const code = params.code?.toUpperCase();
  if (!code || !isRoomCode(code)) {
    return new Response("Invalid code", { status: 400 });
  }
  const session = await getSession(code);
  if (!session?.band) {
    return new Response("Band not ready", { status: 404 });
  }
  const band = session.band;
  const reviewExcerpt = excerpt(band.review, 320);

  try {
  const fonts = await getShareFonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: "1080px",
          height: "1920px",
          display: "flex",
          flexDirection: "column",
          background: PAPER,
          color: INK,
          fontFamily: "Newsreader, serif",
          padding: "60px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "22px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          <div style={{ display: "flex" }}>BANDMATE</div>
          <div style={{ display: "flex" }}>{code}</div>
        </div>

        <div
          style={{
            marginTop: "30px",
            width: "960px",
            height: "960px",
            display: "flex",
            border: `1px solid ${INK}33`,
            background: "#f6f1e6",
            position: "relative",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={band.albumCoverUrl}
            alt=""
            width={960}
            height={960}
            style={{ width: "960px", height: "960px", objectFit: "cover" }}
          />
        </div>

        <div style={{ marginTop: "40px", display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: "20px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            {band.genre}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Newsreader, serif",
              fontSize: "92px",
              fontWeight: 600,
              lineHeight: 1.0,
              marginTop: "10px",
              letterSpacing: "-0.01em",
            }}
          >
            {band.name}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "18px",
              marginTop: "10px",
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: "30px",
              color: INK,
            }}
          >
            <span style={{ display: "flex" }}>"{band.singleTitle}"</span>
            <span style={{ display: "flex", color: MUTED }}>·</span>
            <span style={{ display: "flex", color: MUTED }}>{band.runtime}</span>
          </div>
        </div>

        <div
          style={{
            marginTop: "40px",
            display: "flex",
            gap: "40px",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minWidth: "180px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Newsreader, serif",
                fontSize: "120px",
                fontWeight: 600,
                lineHeight: 1,
                color: ACCENT,
              }}
            >
              {band.score.toFixed(1)}
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "20px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: MUTED,
                marginTop: "6px",
              }}
            >
              / 10
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Newsreader, serif",
                fontSize: "30px",
                lineHeight: 1.35,
                color: INK,
              }}
            >
              {reviewExcerpt}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: "26px",
                fontFamily: "Newsreader, serif",
                fontStyle: "italic",
                fontSize: "26px",
                lineHeight: 1.3,
                color: ACCENT,
              }}
            >
              "{band.pullQuote}"
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flex: 1 }} />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "20px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          <div style={{ display: "flex" }}>made with bandmate</div>
          <div style={{ display: "flex" }}>two photos · one band</div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts,
      // A band is immutable once complete, so the composed card is too.
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" },
    },
  );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[share] ${code} failed: ${msg}`, stack);
    return new Response(`share render failed: ${msg}`, { status: 500 });
  }
}

function excerpt(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastDot = cut.lastIndexOf(".");
  if (lastDot > max * 0.6) return cut.slice(0, lastDot + 1);
  return cut.trimEnd() + "…";
}
