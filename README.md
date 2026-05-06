# BandMate

Two players photograph an object each. Claude turns each photo into a fictional band member; the two members fuse into a band with an album cover and a Pitchfork-style review. The output is a single shareable PNG.

See `CLAUDE.md` for the full product spec.

## Stack

- Next.js 14 App Router + TypeScript + Tailwind
- Anthropic SDK (`claude-opus-4-7` for vision + creative writing)
- Replicate (`flux-schnell` for portraits and album covers)
- Vercel KV (session state, 24h TTL)
- Vercel Blob (generated image storage)
- `@vercel/og` (final share PNG composition)

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev
```

Required env vars (all needed for a real end-to-end run):

```
ANTHROPIC_API_KEY=
REPLICATE_API_TOKEN=
BLOB_READ_WRITE_TOKEN=
KV_URL=
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=
```

`KV_*` come from a Vercel KV / Upstash Redis integration. `BLOB_READ_WRITE_TOKEN` from Vercel Blob.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Home — start a band or join via code |
| `/play/[code]/player1` · `/player2` | Photo capture + member reveal |
| `/join/[code]` | Player 2 entry: shows P1's card, button to join |
| `/band/[code]` | Final fusion screen with album, review, share |
| `POST /api/session/create` | Allocate a room code |
| `GET /api/session/[code]` | Poll session state |
| `POST /api/member/generate` | Vision call → portrait → write to slot |
| `POST /api/band/generate` | Idempotent fusion: text + album cover |
| `GET /api/share/[code]` | 1080×1920 PNG via `@vercel/og` |

## Build / typecheck

```bash
npm run typecheck
npm run build
```

## Out of scope (per spec)

Audio, persistence beyond a session, accounts, feeds, 3+ player groups, push, native apps. Don't build them.
