# BandMate

A two-player web app where each player photographs an object, AI generates a band member from each photo, and the two members fuse into a band with an album cover and fake Pitchfork-style review. The output is a single shareable image.

## Build philosophy

Ship the smallest thing that produces a screenshot worth texting to a third person. Resist scope creep. Every feature below is in v1; everything in "Out of scope" stays out until v1 is in someone's hands.

## Tech stack

- **Framework:** Next.js 14+ App Router, TypeScript, deployed to Vercel
- **Styling:** Tailwind CSS
- **AI:**
  - Anthropic API for vision and text generation. Use `claude-opus-4-7` for the creative writing (member generation, band fusion, review). The Pitchfork voice quality matters more than latency on these calls.
  - Replicate for image generation. Use Flux with a stylized prompt; if a risograph/indie-sleeve LoRA is available and cheap, prefer that. Otherwise rely on prompt engineering for the locked aesthetic.
- **Storage:** Vercel Blob for generated images
- **Session state:** Vercel KV (Redis) keyed by room code. No database, no auth.
- **Share image composition:** `@vercel/og` for server-side image composition of the final shareable card.
- **Camera:** `<input type="file" accept="image/*" capture="environment">` — no native camera APIs in v1.

## Environment variables

```
ANTHROPIC_API_KEY=
REPLICATE_API_TOKEN=
BLOB_READ_WRITE_TOKEN=
KV_URL=
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=
```

## User flow

### Player 1 (band starter)
1. Lands on `/`, taps **Start a band**.
2. Photo input opens. Player picks/snaps photo.
3. Loading state: "Auditioning your bandmate..." (~10s).
4. Member card reveals with portrait, name, instrument, genre lean, four stats, one-line bio.
5. Taps **Invite bandmate** → app creates a room code, shows a shareable URL like `bandmate.app/join/AB12CD`.
6. Player 1 sees a "Waiting for bandmate..." screen that polls every 3s.

### Player 2 (joiner)
1. Opens `/join/[code]`, sees Player 1's card with copy: "[Name] is looking for a bandmate."
2. Taps **Join the band**.
3. Same photo → loading → reveal as Player 1.
4. Auto-advances to fusion.

### Fusion (both players, simultaneously)
1. Brief animated transition combining the two member cards.
2. Album cover renders.
3. Below the cover: band name, single title, runtime (e.g., "3:47"), Pitchfork-style review (~80 words), score (X.X / 10), one pull quote.
4. **Share** button exports a single composed PNG (album cover stacked over review block).

That's the entire MVP. No accounts. No discography. No third player. No audio.

## Data model

### Session (stored in KV, keyed by room code)

```typescript
type Session = {
  code: string;                    // 6-char alphanumeric room code
  createdAt: number;
  player1: Member | null;
  player2: Member | null;
  band: Band | null;
  status: 'waiting_p1' | 'waiting_p2' | 'fusing' | 'complete';
};

type Member = {
  name: string;                    // e.g., "Mira Voss"
  instrument: string;              // e.g., "Bass guitar"
  genreLean: string;               // e.g., "post-punk"
  bio: string;                     // one sentence, deadpan
  stats: {
    stagePresence: number;         // 1-10
    songwriting: number;           // 1-10
    chaos: number;                 // 1-10
    vibe: number;                  // 1-10
  };
  portraitUrl: string;             // Vercel Blob URL
  visualDescriptor: string;        // short text for album cover prompt continuity
};

type Band = {
  name: string;                    // e.g., "Velvet Antenna"
  genre: string;                   // mashup, e.g., "ambient post-punk with shoegaze influences"
  singleTitle: string;             // e.g., "Halflight Cassette"
  runtime: string;                 // e.g., "3:47"
  review: string;                  // ~80 words, Pitchfork voice
  score: number;                   // X.X, e.g., 7.3
  pullQuote: string;               // single quotable line
  albumCoverUrl: string;           // Vercel Blob URL
};
```

Session TTL: 24 hours. Generated images persist beyond that.

## API routes

```
POST /api/session/create
  → creates a new session, returns { code }

GET /api/session/[code]
  → returns full session state (used for polling)

POST /api/member/generate
  body: { code: string, slot: 'player1' | 'player2', image: base64 }
  → generates Member, writes to session, returns Member
  → if both slots filled after this write, also triggers band generation

POST /api/band/generate
  body: { code: string }
  → idempotent; generates Band if both members present and band is null
  → returns Band

GET /api/share/[code]
  → server-side composes final share image via @vercel/og, returns PNG
```

## AI pipeline

### Call 1: Object → Member

**Vision + text in a single Claude call.** Pass the image and ask Claude to return structured JSON.

System prompt sketch:

> You are a music critic and A&R scout for an independent record label. You receive photos of ordinary objects and translate them into fictional band members. The object inspires the member's vibe, instrument, and genre — but never appears literally in the name or bio. Names should sound like real indie musicians: two words, slightly off-kilter, never punny. Bios are one deadpan sentence in the voice of a music magazine profile. Genre leans are specific subgenres, not broad categories.

Return schema:

```json
{
  "name": "string",
  "instrument": "string",
  "genreLean": "string",
  "bio": "string",
  "stats": { "stagePresence": 0, "songwriting": 0, "chaos": 0, "vibe": 0 },
  "visualDescriptor": "short phrase capturing the member's visual essence for downstream image gen"
}
```

Then a separate Replicate call generates the portrait using a prompt template:

```
risograph print illustration, 1970s indie record sleeve aesthetic, limited palette,
halftone texture, slight off-register printing, hand-drawn feel,
portrait of {visualDescriptor}, holding {instrument},
flat colors, no photorealism, square crop
```

### Call 2: Two members → Band

Pure text Claude call. Pass both Member JSONs.

System prompt sketch:

> You are writing for a music publication that takes itself too seriously. Given two band members, generate the band they'd form together. The band name should be two words, evocative, never reference the source objects. The genre is a confident, specific mashup of both members' leans (e.g., "ambient post-punk with shoegaze influences" — never just "rock"). The single title should sound like a real indie track. The review is roughly 80 words, written in pretentious music-critic voice with at least one specific reference to a real-sounding subgenre or scene. Include one mild backhanded compliment. Score is X.X to one decimal, weighted toward odd numbers like 7.3 or 6.8 rather than round ones — range 6.0 to 8.9. The pull quote is a single sentence from the review that works as a standalone caption.

Return schema:

```json
{
  "name": "string",
  "genre": "string",
  "singleTitle": "string",
  "runtime": "M:SS",
  "review": "string",
  "score": 0.0,
  "pullQuote": "string"
}
```

### Call 3: Band → Album cover

Replicate image gen. Prompt template:

```
album cover artwork, 1970s indie record sleeve aesthetic, risograph print,
limited palette appropriate to {genre}, halftone texture, slight off-register,
composition evoking {genre}, abstract or symbolic imagery referencing
{member1.visualDescriptor} and {member2.visualDescriptor},
no text, no typography, square format
```

Band name and title are overlaid in the UI as actual text — don't try to render them in the image.

## UI components

- `<MemberCard member={...} />` — portrait, name, instrument, genre, stats as small bars, bio
- `<AlbumCard band={...} />` — square cover, name and title overlaid in a consistent typeface (suggest a slightly distressed sans-serif like "Space Grotesk" or a free condensed serif)
- `<ReviewBlock band={...} />` — score in large display type, review prose, pull quote in italic
- `<LoadingState message="..." />` — looped subtle animation, rotating copy
- `<RoomCodeShare code="..." />` — big code, copy-link button, native share sheet

## Visual system rules

- One aesthetic across all generated imagery: 70s/80s indie record sleeve, risograph, limited palette, halftone, slight off-register.
- Member cards have a consistent frame across all generations.
- Album covers vary in composition and palette by genre but stay within the aesthetic.
- App chrome (buttons, backgrounds, type) should feel like the same world: muted background, one accent color, generous whitespace, restrained type. Not skeuomorphic. Not maximalist.
- No emoji in product copy.

## Loading copy rotation

Cycle these during generation:

- "Auditioning your bandmate..."
- "Tuning instruments..."
- "Booking the rehearsal space..."
- "Fighting about the band name..."
- "Mixing the demo..."
- "Pitchfork is sharpening their pencils..."

## Latency budget

- Member generation (vision + text + portrait): target 12s, hard ceiling 20s
- Band generation (text + cover): target 15s, hard ceiling 25s
- Total worst case: ~45s for the slower player

Stream the text portions. Show the portrait as soon as it lands; don't wait for stats to animate.

## Share image composition

The `/api/share/[code]` route uses `@vercel/og` to render a 1080×1920 vertical image:

- Top: album cover (1080×1080)
- Middle: band name (large), single title (smaller)
- Bottom: review excerpt + score + pull quote
- Footer: "made with bandmate" wordmark, small

This is the artifact people screenshot and text. It must look intentional, not auto-generated.

## Build order

1. **Skeleton:** Next.js app, routes scaffolded, KV + Blob wired, env vars working.
2. **Single-player member generation end to end:** snap → Claude vision call → portrait via Replicate → render card. No session, no rooms yet. Get the card looking great.
3. **Room codes + two-player flow:** session creation, join URL, polling.
4. **Band fusion:** second Claude call, album cover gen, fusion screen.
5. **Share image:** `@vercel/og` composition route, share button hooked up.
6. **Polish pass:** loading copy, animations, type, spacing.

Don't move to step N+1 until N looks shippable.

## Out of scope (do not build)

- Audio generation
- Discography or persistence across sessions
- 3+ player supergroups
- User accounts, login, profiles
- In-app feed, gallery, or social features
- Push notifications
- Native iOS/Android apps
- Any actual battle/scoring mechanic — the four stats are flavor only

## Success criteria

One person plays with one friend, screenshots the share image, and at least one of them texts it to a third person unprompted. If that's not happening after 10 real playtests, no amount of feature layering will save it.

## Open questions to resolve during build

- Confirm Flux + prompt-only is sufficient for the aesthetic, or whether a LoRA is needed. Test in step 2.
- Confirm Claude Opus 4.7 latency on the vision call is acceptable; fall back to Sonnet 4.6 if not and quality holds.
- Decide on the exact accent color and type pairing during the polish pass — keep placeholder until then.
