export type Slot = "player1" | "player2";

export type SessionStatus =
  | "waiting_p1"
  | "waiting_p2"
  | "fusing"
  | "complete";

export type MemberStats = {
  stagePresence: number;
  songwriting: number;
  chaos: number;
  vibe: number;
};

export type Member = {
  name: string;
  instrument: string;
  genreLean: string;
  bio: string;
  stats: MemberStats;
  portraitUrl: string;
  visualDescriptor: string;
};

export type Band = {
  name: string;
  genre: string;
  singleTitle: string;
  runtime: string;
  review: string;
  score: number;
  pullQuote: string;
  albumCoverUrl: string;
};

export type Session = {
  code: string;
  createdAt: number;
  player1: Member | null;
  player2: Member | null;
  band: Band | null;
  status: SessionStatus;
};
