export const MEMBER_SYSTEM_PROMPT = `You are a music critic and A&R scout for an independent record label. You receive photos of ordinary objects and translate them into fictional band members.

Read the object closely before you write a single word. What is its texture, weight, era, color palette? Is it sharp or soft, loud or quiet, mechanical or handmade, mass-produced or one-of-a-kind, indoor or outdoor, childlike or austere? Who tends to own one? Those qualities — not generic "indie vibe" — drive the member.

Genre translation guide (use the row that fits the object's actual energy; do NOT default to ambient):
- Soft, childlike, handmade, naive: twee, indie pop, freak folk, anti-folk, songwriter
- Sharp, mechanical, industrial, metallic: industrial, no wave, math rock, krautrock, post-hardcore
- Weathered, vintage, domestic, well-loved: country gothic, americana, slowcore, lo-fi, alt-country
- Bright, clean, geometric, plastic: minimal techno, IDM, dance-punk, electroclash, hyperpop
- Bulky, loud, aggressive, weighty: noise rock, sludge, hardcore, garage punk, doom
- Delicate, atmospheric, distant, blurred: ambient, dream pop, shoegaze, drone, fourth-world
- Exotic, culturally specific, traveled: dub, Ethiojazz, cumbia digital, world fusion, tropicália
- Glossy, performative, theatrical: glam, baroque pop, art rock, chamber pop
- Cold, clinical, sterile: cold wave, minimal synth, EBM, witch house

Rules:
- The object inspires the member's vibe, instrument, and genre — but never appears literally in the name or bio.
- Names: two words, slightly off-kilter, never punny. Vary the cultural register and rhythm — do NOT default to soft "Mira Voss"-shaped names. Mix in syllabic variety: short and long, hard consonants and soft, different roots. Examples of the range you should pull from: "Cal Hartigan", "Iona Pell", "Reggie Tau", "Suki Hellman", "Bartolomeu Reis", "June Mok", "Wren Achebe", "Theo Lindqvist", "Marisol Bey".
- Instruments should match the genre. Industrial members don't play "dreamy synths"; folk members don't play "modular synth racks". Be specific: "fretless bass", "MS-20 synth", "drum machine and feedback", "open-tuned acoustic guitar", "shruti box", "808 and SP-303".
- Bios are a single deadpan sentence in the voice of a music magazine profile. No exclamation points. No emoji.
- Genre leans are specific subgenres. Never "rock" or "indie".
- Stats are integers from 1 to 10. Match each stat to the member's actual essence — a serene contemplative member shouldn't have chaos: 8; a chaotic one shouldn't have stagePresence: 2. Don't force a spread, and don't hand out matched 7s and 8s out of caution. Pick numbers that feel honest to who this member is.
- visualDescriptor: an 8–14 word phrase describing a PERSON (not the object) suitable for an image-gen prompt. Include hair, posture, era of styling, mood. Should also evoke the genre.`;

const statSchema = { type: "integer", minimum: 1, maximum: 10 } as const;

export const MEMBER_SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: "string" },
    instrument: { type: "string" },
    genreLean: { type: "string" },
    bio: { type: "string" },
    stats: {
      type: "object",
      properties: {
        stagePresence: statSchema,
        songwriting: statSchema,
        chaos: statSchema,
        vibe: statSchema,
      },
      required: ["stagePresence", "songwriting", "chaos", "vibe"],
    },
    visualDescriptor: { type: "string" },
  },
  required: [
    "name",
    "instrument",
    "genreLean",
    "bio",
    "stats",
    "visualDescriptor",
  ],
};

export const BAND_SYSTEM_PROMPT = `You are writing for a music publication that takes itself too seriously. Given two band members, generate the band they'd form together.

Rules:
- Band name: two words, evocative, never references the source objects. (e.g., "Velvet Antenna", "Slow Tundra", "Halflight Cassette")
- Genre is a confident, specific mashup of both members' leans (e.g., "ambient post-punk with shoegaze influences"). Never just "rock".
- Single title sounds like a real indie track.
- Runtime in M:SS format, between 2:30 and 5:30.
- Review: roughly 80 words, pretentious music-critic voice, at least one specific reference to a real-sounding subgenre or scene, exactly one mild backhanded compliment.
- Score: X.X to one decimal, reflecting how genuinely good the band is. A truly remarkable pairing might land on 8.6 or 8.8; a record that mostly works but has real flaws lands on 6.7 or 7.2; a forgettable or actively bad one lands on 4.9 or 3.6. Don't anchor everything around the safe 7-range. Avoid round numbers like 7.0 or 8.0 — odd-feeling numbers like 6.8 or 7.3 read more like a real Pitchfork score.
- Pull quote: a single sentence lifted (or lightly adapted) from the review that works as a standalone caption.
- coverMotif: a single concrete, symbolic scene or object for the album cover — NEVER a person, NEVER the band members. 6–14 words. It should evoke the genre and the band's emotional center, not depict any human. Think: "a single moth circling a porch lamp", "stacked teacups in cracked afternoon light", "a half-drawn parlor curtain", "an empty folding chair in a snowfield", "a transistor radio on a kitchen table", "a frayed cassette ribbon coiled on linoleum". Specific, lonely, ordinary objects beat abstract concepts. No people. No band members. No instruments either — those go in the portraits, not the cover.
- No emoji. No exclamation points.`;

export const BAND_SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: "string" },
    genre: { type: "string" },
    singleTitle: { type: "string" },
    runtime: { type: "string", description: "M:SS" },
    review: { type: "string" },
    score: { type: "number" },
    pullQuote: { type: "string" },
    coverMotif: { type: "string" },
  },
  required: [
    "name",
    "genre",
    "singleTitle",
    "runtime",
    "review",
    "score",
    "pullQuote",
    "coverMotif",
  ],
};

// Style anchor used by both prompts. We reference specific real-world print
// traditions Flux recognizes by name (risograph zines, ECM Records sleeves,
// Reid Miles' Blue Note covers), then pile on technical markers of the
// printmaking process (halftone dots, registration offset, ink saturation).
// The negatives are aggressive on purpose — Flux defaults to glossy,
// photorealistic, ligne-claire output otherwise.
const STYLE = [
  "two-color risograph print",
  "halftone dot screen, visible CMYK registration offset",
  "limited duotone palette of ink on warm cream paper",
  "hand-pulled silkscreen texture, paper grain, slightly off-register",
  "1970s independent record sleeve illustration",
  "flat ink shapes, no shading gradients, no airbrush, no glow",
].join(", ");

// One design tradition per genre family. The old anchor invoked ECM, Blue
// Note, Hipgnosis, and Factory simultaneously — four very different schools
// that averaged out to mush. Hit-count keyword match, same approach as the
// riso palette picker.
const STYLE_ANCHORS: Array<{ keywords: string[]; anchor: string }> = [
  {
    keywords: ["jazz", "dub", "soul", "funk", "ethio", "tropic", "cumbia", "world", "afro", "reggae"],
    anchor: "in the visual tradition of Reid Miles' Blue Note album covers",
  },
  {
    keywords: ["ambient", "drone", "minimal", "kraut", "fourth-world", "slowcore"],
    anchor: "in the visual tradition of ECM Records sleeve design",
  },
  {
    keywords: ["shoegaze", "dream pop", "dream", "ethereal"],
    anchor: "in the visual tradition of Vaughan Oliver's 4AD sleeve design",
  },
  {
    keywords: ["post-punk", "cold", "industrial", "synth", "techno", "idm", "electro", "ebm", "wave", "hyperpop", "dance"],
    anchor: "in the visual tradition of Peter Saville's Factory Records sleeve design",
  },
  {
    keywords: ["punk", "noise", "hardcore", "garage", "sludge", "doom", "lo-fi", "no wave"],
    anchor: "in the visual tradition of xeroxed DIY punk 7-inch sleeves",
  },
  {
    keywords: ["folk", "country", "americana", "twee", "songwriter", "gothic", "psych", "freak"],
    anchor: "in the visual tradition of vintage Folkways Records sleeve design",
  },
];

function styleAnchor(genre: string): string {
  const g = genre.toLowerCase();
  let best = "in the visual tradition of 1970s independent record sleeves";
  let bestHits = 0;
  for (const { keywords, anchor } of STYLE_ANCHORS) {
    const hits = keywords.filter((k) => g.includes(k)).length;
    if (hits > bestHits) {
      best = anchor;
      bestHits = hits;
    }
  }
  return best;
}

const STYLE_NEGATIVES = [
  "no photorealism",
  "no 3D rendering",
  "no glossy textures or polished surfaces",
  "no realistic skin or hair detail",
  "no modern digital illustration",
  "no caricature, no comic book style, no manga",
  "no art deco, no ligne claire",
].join(", ");

export function portraitPrompt(
  visualDescriptor: string,
  instrument: string,
  genreLean: string,
): string {
  return [
    `printed portrait illustration of ${visualDescriptor}, holding ${instrument}`,
    "subject roughly centered, head and shoulders, looking slightly off-camera",
    STYLE,
    styleAnchor(genreLean),
    STYLE_NEGATIVES,
    "no text, no typography, no logos",
    "square format",
  ].join(", ");
}

export function albumCoverPrompt(
  genre: string,
  coverMotif: string,
): string {
  return [
    `album cover illustration: ${coverMotif}`,
    `mood and palette evoke ${genre}`,
    "composition is graphic, deliberate, sleeve-like — not a busy scene",
    "one or two clear visual ideas, plenty of negative space",
    STYLE,
    styleAnchor(genre),
    STYLE_NEGATIVES,
    "no people, no faces, no figures, no portraits",
    "no text, no typography, no band name, no logos",
    "square format",
  ].join(", ");
}
