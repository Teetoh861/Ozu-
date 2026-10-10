import type { Avatar } from "./avatar";
import type { MapId } from "./world";

export type Anim = "idle" | "walk" | "run" | "wave" | "dance" | "clap" | "sit";
export const EMOTES = ["wave", "dance", "clap"] as const;
export type Emote = (typeof EMOTES)[number];

export interface PublicPlayer {
  id: string;
  name: string;
  avatar: Avatar;
  equipped: string | null;
  rep: number;
  /** Unilag hall affiliation, if any. */
  hall: string | null;
  /** Verified student (signed in with a Unilag email). */
  student: boolean;
  x: number;
  z: number;
  ry: number;
  anim: Anim;
}

export interface Progress {
  coins: number;
  rep: number;
  discovered: string[];
  greetings: number;
  cleanups: number;
  challengesCompleted: number;
  unlocked: string[];
  equipped: string | null;
  /** Points earned for your hall on campus. */
  hallPoints: number;
  lecturesAttended: number;
}

export type AgeGroup = "16-17" | "18+";

export interface CampusEvent {
  id: string;
  kind: "lecture";
  title: string;
  venue: string;
  x: number;
  z: number;
  /** Seconds remaining when the message was sent (avoids client clock skew). */
  secondsLeft: number;
}

export interface HallStanding {
  id: string;
  points: number;
}

export interface ChallengeItem {
  id: string;
  x: number;
  z: number;
}

export interface Reward {
  coins: number;
  rep: number;
  reason: string;
}

export const REPORT_REASONS = ["harassment", "hate", "sexual", "spam", "cheating", "impersonation", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export type ClientMessage =
  | { t: "hello"; guestToken?: string; accessToken?: string; name: string; avatar: Avatar; ageGroup: AgeGroup; hall: string | null }
  | { t: "travel"; to: MapId }
  | { t: "move"; x: number; z: number; ry: number; anim: Anim }
  | { t: "chat"; text: string }
  | { t: "emote"; emote: Emote }
  | { t: "greet"; targetId: string }
  | { t: "discover"; locationId: string }
  | { t: "pickup"; itemId: string }
  | { t: "report"; targetId: string; reason: ReportReason; details?: string }
  | { t: "block"; targetId: string; blocked: boolean }
  | { t: "equip"; cosmeticId: string | null }
  | { t: "ping"; n: number };

export type ServerMessage =
  | {
      t: "welcome";
      you: PublicPlayer;
      progress: Progress;
      guestToken: string | null;
      players: PublicPlayer[];
      items: ChallengeItem[];
      challenge: { progress: number; goal: number };
      blocked: string[];
      account: "guest" | "member";
      map: MapId;
      hall: string | null;
      student: boolean;
      event: CampusEvent | null;
      halls: HallStanding[];
    }
  | { t: "event"; event: CampusEvent | null; result?: { venue: string; attended: number; you: boolean } }
  | { t: "halls"; halls: HallStanding[] }
  | { t: "snap"; p: [string, number, number, number, Anim][] }
  | { t: "join"; player: PublicPlayer }
  | { t: "leave"; id: string }
  | { t: "player"; player: PublicPlayer }
  | { t: "chat"; from: string; name: string; text: string; ts: number }
  | { t: "emote"; id: string; emote: Emote }
  | { t: "greeted"; fromId: string; name: string }
  | { t: "progress"; progress: Progress; reward?: Reward }
  | { t: "items"; items: ChallengeItem[] }
  | { t: "challenge"; progress: number; goal: number; completed?: boolean }
  | { t: "correct"; x: number; z: number }
  | { t: "notice"; level: "info" | "warn" | "error"; text: string }
  | { t: "kicked"; reason: string }
  | { t: "pong"; n: number };

export const REWARDS = {
  greet: { coins: 5, rep: 3 },
  discover: { coins: 10, rep: 5 },
  pickup: { coins: 2, rep: 1 },
  challenge: { coins: 25, rep: 10 },
  lecture: { coins: 15, rep: 8 },
} as const;

export const DAILY_GREET_REWARD_CAP = 20;
export const SNAPSHOT_HZ = 10;
