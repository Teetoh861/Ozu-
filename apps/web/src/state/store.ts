import { create } from "zustand";
import {
  DEFAULT_AVATAR, sanitizeAvatar,
  type Anim, type Avatar, type ChallengeItem, type Progress, type PublicPlayer, type Reward,
} from "@ozu/shared";

export type Phase = "landing" | "create" | "playing";
export type Conn = "offline" | "connecting" | "online" | "reconnecting" | "failed";
export type Quality = "high" | "low";
export type Panel = null | "activities" | "profile" | "settings" | "help" | "guidelines" | "player";

export interface Remote extends PublicPlayer {
  /** Interpolation target from the latest snapshot. */
  tx: number;
  tz: number;
  tr: number;
  bubble?: { text: string; until: number };
  emoteUntil?: number;
}

export interface ChatLine {
  id: number;
  from: string;
  name: string;
  text: string;
  ts: number;
  system?: boolean;
}

export interface Toast {
  id: number;
  text: string;
  level: "info" | "warn" | "error" | "reward";
}

export interface Settings {
  quality: Quality;
  sensitivity: number;
  invertY: boolean;
  showNames: boolean;
  sound: boolean;
  captions: boolean;
}

const LS = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

function defaultQuality(): Quality {
  const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  return coarse || cores <= 4 ? "low" : "high";
}

/** Local player transform is mutated every frame; kept outside React state for performance. */
export const local = { x: 0, z: -10, ry: 0, anim: "idle" as Anim, speed: 0 };
export const camState = { yaw: Math.PI, pitch: 0.38, dist: 7 };
export const input = { joyX: 0, joyY: 0, run: false, keys: new Set<string>() };

let seq = 1;

interface State {
  phase: Phase;
  conn: Conn;
  connError: string | null;
  name: string;
  avatar: Avatar;
  acceptedGuidelines: boolean;
  account: "guest" | "member";
  meId: string | null;
  progress: Progress | null;
  players: Record<string, Remote>;
  items: ChallengeItem[];
  challenge: { progress: number; goal: number };
  chat: ChatLine[];
  toasts: Toast[];
  blocked: string[];
  muted: string[];
  panel: Panel;
  selectedPlayer: string | null;
  reportTarget: string | null;
  chatOpen: boolean;
  settings: Settings;
  prompt: { label: string; action: () => void } | null;
  ping: number | null;

  set: (p: Partial<State>) => void;
  setProfile: (name: string, avatar: Avatar) => void;
  updateSettings: (s: Partial<Settings>) => void;
  toast: (text: string, level?: Toast["level"]) => void;
  addChat: (line: Omit<ChatLine, "id">) => void;
  reward: (r: Reward) => void;
}

export const useGame = create<State>((set, get) => ({
  phase: "landing",
  conn: "offline",
  connError: null,
  name: LS.get("ozu.name", ""),
  avatar: sanitizeAvatar(LS.get("ozu.avatar", DEFAULT_AVATAR)),
  acceptedGuidelines: LS.get("ozu.guidelines", false),
  account: "guest",
  meId: null,
  progress: null,
  players: {},
  items: [],
  challenge: { progress: 0, goal: 20 },
  chat: [],
  toasts: [],
  blocked: [],
  muted: LS.get("ozu.muted", [] as string[]),
  panel: null,
  selectedPlayer: null,
  reportTarget: null,
  chatOpen: false,
  settings: { quality: defaultQuality(), sensitivity: 1, invertY: false, showNames: true, sound: false, captions: true, ...LS.get("ozu.settings", {}) },
  prompt: null,
  ping: null,

  set: (p) => set(p),
  setProfile: (name, avatar) => {
    LS.set("ozu.name", name);
    LS.set("ozu.avatar", avatar);
    set({ name, avatar });
  },
  updateSettings: (s) => {
    const settings = { ...get().settings, ...s };
    LS.set("ozu.settings", settings);
    set({ settings });
  },
  toast: (text, level = "info") => {
    const id = seq++;
    set({ toasts: [...get().toasts.slice(-3), { id, text, level }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), level === "reward" ? 3200 : 4500);
  },
  addChat: (line) => set({ chat: [...get().chat.slice(-79), { ...line, id: seq++ }] }),
  reward: (r) => get().toast(`+${r.coins} coins · +${r.rep} rep — ${r.reason}`, "reward"),
}));

export const persist = LS;
