import { randomUUID } from "node:crypto";
import {
  CHALLENGE_GOAL, CHALLENGE_MAX_ITEMS, COSMETICS, DAILY_GREET_REWARD_CAP, DISCOVER_RANGE, EMOTES,
  INTERACT_RANGE, LECTURE_RADIUS, LECTURE_SECONDS, LECTURE_VENUES, PICKUP_RANGE, REPORT_REASONS, REWARDS,
  RUN_SPEED, SPEED_TOLERANCE, cleanChat, collides, clampToWorld, getMap, resolveMove,
  type Anim, type CampusEvent, type ChallengeItem, type ClientMessage, type Emote, type HallStanding, type MapDef,
  type MapId, type PublicPlayer, type Reward, type ServerMessage,
} from "@ozu/shared";
import { TokenBucket } from "./rateLimit";
import type { PlayerRecord, Store } from "./store";
import { log } from "./log";

export interface Conn {
  send(msg: ServerMessage): void;
  close(code: number, reason: string): void;
}

const ANIMS: Anim[] = ["idle", "walk", "run", "wave", "dance", "clap", "sit"];
const DAY_MS = 24 * 60 * 60 * 1000;

export class Session {
  x = 0;
  z = 0;
  ry = 0;
  anim: Anim = "idle";
  lastMoveAt = Date.now();
  joinedAt = Date.now();
  contributed = 0;
  recentChat: { text: string; ts: number }[] = [];
  chatStrikes = 0;
  mutedUntil = 0;
  limits = {
    move: new TokenBucket(30, 25),
    chat: new TokenBucket(5, 0.5),
    action: new TokenBucket(10, 2),
    report: new TokenBucket(3, 1 / 60),
    travel: new TokenBucket(2, 1 / 10),
  };
  constructor(public conn: Conn, public record: PlayerRecord, public account: "guest" | "member") {}

  /** Place the player near (x, z), spreading players out so they don't stack. */
  placeNear(map: MapDef, x: number, z: number) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, r = i === 0 ? 0 : 1 + Math.random() * 2.5;
      const [px, pz] = clampToWorld(x + Math.cos(a) * r, z + Math.sin(a) * r);
      if (!collides(map, px, pz)) {
        this.x = px;
        this.z = pz;
        this.lastMoveAt = Date.now();
        return;
      }
    }
    this.x = x;
    this.z = z;
    this.lastMoveAt = Date.now();
  }
  get id() {
    return this.record.id;
  }
  public(): PublicPlayer {
    const r = this.record;
    return {
      id: r.id, name: r.name, avatar: r.avatar, equipped: r.progress.equipped, rep: r.progress.rep,
      hall: r.hall, student: r.student, x: this.x, z: this.z, ry: this.ry, anim: this.anim,
    };
  }
}

interface ActiveLecture {
  event: CampusEvent;
  endsAt: number;
}

export class District {
  sessions = new Map<string, Session>();
  items: ChallengeItem[] = [];
  challengeProgress = 0;
  map: MapDef;
  lecture: ActiveLecture | null = null;
  halls: HallStanding[] = [];
  private timers: NodeJS.Timeout[] = [];
  private moved = false;

  constructor(public id: string, mapId: MapId, private store: Store, private opts: { guestChat: boolean; max: number }) {
    this.map = getMap(mapId);
    for (let i = 0; i < CHALLENGE_MAX_ITEMS; i++) this.items.push(this.spawnItem());
  }

  start(hz: number, lectureIntervalS?: number) {
    this.timers.push(setInterval(() => this.broadcastSnapshot(), 1000 / hz));
    if (this.map.id === "unilag" && lectureIntervalS) {
      // First lecture shortly after start, then on a steady rhythm.
      this.timers.push(setTimeout(() => this.startLecture(), Math.min(45, lectureIntervalS) * 1000));
      this.timers.push(setInterval(() => this.startLecture(), lectureIntervalS * 1000));
    }
  }
  stop() {
    for (const t of this.timers) clearInterval(t);
  }
  get full() {
    return this.sessions.size >= this.opts.max;
  }

  private spawnItem(): ChallengeItem {
    const zone = this.map.challenge;
    for (let tries = 0; tries < 60; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.min(4, zone.r * 0.3) + Math.random() * zone.r * 0.7;
      const x = zone.x + Math.cos(a) * r;
      const z = zone.z + Math.sin(a) * r;
      if (!collides(this.map, x, z, 0.6)) return { id: randomUUID().slice(0, 8), x: +x.toFixed(2), z: +z.toFixed(2) };
    }
    return { id: randomUUID().slice(0, 8), x: this.map.spawn.x + 3, z: this.map.spawn.z };
  }

  broadcast(msg: ServerMessage, except?: string, filter?: (s: Session) => boolean) {
    for (const s of this.sessions.values()) if (s.id !== except && (!filter || filter(s))) s.conn.send(msg);
  }

  broadcastSnapshot() {
    if (!this.moved || this.sessions.size === 0) return;
    this.moved = false;
    const p = [...this.sessions.values()].map((s) => [s.id, +s.x.toFixed(2), +s.z.toFixed(2), +s.ry.toFixed(2), s.anim] as [string, number, number, number, Anim]);
    this.broadcast({ t: "snap", p });
  }

  currentEvent(): CampusEvent | null {
    if (!this.lecture) return null;
    return { ...this.lecture.event, secondsLeft: Math.max(0, Math.round((this.lecture.endsAt - Date.now()) / 1000)) };
  }

  setHalls(halls: HallStanding[]) {
    this.halls = halls;
    if (this.map.id === "unilag") this.broadcast({ t: "halls", halls });
  }

  /** Add a player. `arrival` overrides the default spawn (used when travelling in). */
  join(session: Session, guestToken: string | null, arrival?: { x: number; z: number }) {
    const existing = this.sessions.get(session.id);
    if (existing && existing !== session) {
      existing.conn.close(4001, "Signed in elsewhere");
      this.sessions.delete(session.id);
      this.broadcast({ t: "leave", id: session.id });
    }
    const at = arrival ?? this.map.spawn;
    session.placeNear(this.map, at.x, at.z);
    session.contributed = 0;
    this.sessions.set(session.id, session);
    const r = session.record;
    session.conn.send({
      t: "welcome",
      you: session.public(),
      progress: r.progress,
      guestToken,
      players: [...this.sessions.values()].filter((s) => s.id !== session.id).map((s) => s.public()),
      items: this.items,
      challenge: { progress: this.challengeProgress, goal: CHALLENGE_GOAL },
      blocked: r.blocked,
      account: session.account,
      map: this.map.id,
      hall: r.hall,
      student: r.student,
      event: this.currentEvent(),
      halls: this.halls,
    });
    this.broadcast({ t: "join", player: session.public() }, session.id);
    this.moved = true;
    log("info", "player_join", { district: this.id, player: session.id, account: session.account, online: this.sessions.size });
  }

  async leave(session: Session) {
    if (this.sessions.get(session.id) !== session) return;
    this.sessions.delete(session.id);
    this.broadcast({ t: "leave", id: session.id });
    await this.persist(session);
    log("info", "player_leave", { district: this.id, player: session.id, online: this.sessions.size });
  }

  async persist(s: Session) {
    s.record.updatedAt = Date.now();
    try {
      await this.store.savePlayer(s.record);
    } catch (e) {
      log("error", "persist_failed", { player: s.id, error: String(e) });
    }
  }

  private notice(s: Session, text: string, level: "info" | "warn" | "error" = "warn") {
    s.conn.send({ t: "notice", level, text });
  }

  private async grant(s: Session, base: { coins: number; rep: number }, reason: string) {
    const p = s.record.progress;
    p.coins += base.coins;
    p.rep += base.rep;
    // Everything earned on campus also counts for your hall.
    if (this.map.id === "unilag" && s.record.hall) p.hallPoints += base.rep;
    const newly = COSMETICS.filter((c) => p.rep >= c.repRequired && !p.unlocked.includes(c.id));
    for (const c of newly) p.unlocked.push(c.id);
    const reward: Reward = { coins: base.coins, rep: base.rep, reason };
    s.conn.send({ t: "progress", progress: p, reward });
    for (const c of newly) this.notice(s, `Unlocked: ${c.name}! Equip it from your profile.`, "info");
    await this.persist(s);
  }

  private blockedBetween(a: Session, b: Session) {
    return a.record.blocked.includes(b.id) || b.record.blocked.includes(a.id);
  }

  // ---------------- Campus "lecture rush" events ----------------

  startLecture(venueId?: string) {
    if (this.lecture || this.sessions.size === 0) return;
    const venue = LECTURE_VENUES.find((v) => v.id === venueId) ?? LECTURE_VENUES[Math.floor(Math.random() * LECTURE_VENUES.length)];
    const event: CampusEvent = {
      id: randomUUID().slice(0, 8), kind: "lecture", title: `Lecture starting at the ${venue.name}!`,
      venue: venue.name, x: venue.x, z: venue.z, secondsLeft: LECTURE_SECONDS,
    };
    this.lecture = { event, endsAt: Date.now() + LECTURE_SECONDS * 1000 };
    this.broadcast({ t: "event", event });
    this.timers.push(setTimeout(() => void this.endLecture(), LECTURE_SECONDS * 1000));
  }

  async endLecture() {
    const l = this.lecture;
    if (!l) return;
    this.lecture = null;
    const present = [...this.sessions.values()].filter((s) => Math.hypot(s.x - l.event.x, s.z - l.event.z) <= LECTURE_RADIUS + 0.75);
    for (const s of this.sessions.values()) {
      const you = present.includes(s);
      s.conn.send({ t: "event", event: null, result: { venue: l.event.venue, attended: present.length, you } });
    }
    for (const s of present) {
      s.record.progress.lecturesAttended++;
      await this.grant(s, REWARDS.lecture, `Made it to class at the ${l.event.venue}`);
    }
  }

  // ---------------- Messages ----------------

  async handle(s: Session, msg: ClientMessage) {
    switch (msg.t) {
      case "ping":
        if (Number.isFinite(msg.n)) s.conn.send({ t: "pong", n: msg.n });
        return;

      case "move": {
        if (!s.limits.move.take()) return;
        const { x, z, ry, anim } = msg;
        if (![x, z, ry].every(Number.isFinite) || !ANIMS.includes(anim)) return;
        const now = Date.now();
        const dt = Math.min((now - s.lastMoveAt) / 1000, 1);
        const maxDist = (RUN_SPEED + SPEED_TOLERANCE) * dt + 0.35;
        const dist = Math.hypot(x - s.x, z - s.z);
        if (dist > maxDist || collides(this.map, x, z)) {
          // Reject teleports/wall-clipping but keep honest players moving: advance toward the target as far as allowed.
          const k = dist > 0 ? Math.min(1, maxDist / dist) : 0;
          [s.x, s.z] = resolveMove(this.map, s.x, s.z, s.x + (x - s.x) * k, s.z + (z - s.z) * k);
          s.conn.send({ t: "correct", x: s.x, z: s.z });
          if (dist > 20) log("security", "movement_rejected", { player: s.id, dist: +dist.toFixed(1) });
        } else {
          [s.x, s.z] = clampToWorld(x, z);
        }
        s.ry = ry;
        s.anim = anim;
        s.lastMoveAt = now;
        this.moved = true;
        return;
      }

      case "chat": {
        if (s.account === "guest" && !this.opts.guestChat) return this.notice(s, "Create a free account to use chat.");
        if (Date.now() < s.mutedUntil) return this.notice(s, "You're sending messages too quickly. Please wait.");
        if (!s.limits.chat.take()) {
          s.chatStrikes++;
          if (s.chatStrikes >= 3) {
            s.mutedUntil = Date.now() + 60_000;
            log("security", "chat_auto_mute", { player: s.id });
          }
          return this.notice(s, "Slow down — you're sending messages too quickly.");
        }
        const text = cleanChat(msg.text);
        if (!text) return;
        const last = s.recentChat.at(-1);
        if (last && last.text === text && Date.now() - last.ts < 10_000) return; // drop exact repeats
        s.recentChat.push({ text, ts: Date.now() });
        if (s.recentChat.length > 20) s.recentChat.shift();
        const out: ServerMessage = { t: "chat", from: s.id, name: s.record.name, text, ts: Date.now() };
        // Blocked users never receive each other's messages.
        this.broadcast(out, undefined, (r) => !this.blockedBetween(r, s));
        return;
      }

      case "emote": {
        if (!s.limits.action.take() || !EMOTES.includes(msg.emote as Emote)) return;
        s.anim = msg.emote;
        this.moved = true;
        this.broadcast({ t: "emote", id: s.id, emote: msg.emote }, undefined, (r) => !this.blockedBetween(r, s));
        return;
      }

      case "greet": {
        if (!s.limits.action.take()) return;
        const target = this.sessions.get(msg.targetId);
        if (!target || target === s) return;
        if (this.blockedBetween(s, target)) return this.notice(s, "You can't interact with this player.");
        if (Math.hypot(target.x - s.x, target.z - s.z) > INTERACT_RANGE + 0.75) return this.notice(s, "Get a little closer first.");
        target.conn.send({ t: "greeted", fromId: s.id, name: s.record.name });
        s.anim = "wave";
        this.moved = true;
        this.broadcast({ t: "emote", id: s.id, emote: "wave" }, undefined, (r) => !this.blockedBetween(r, s));
        await this.rewardGreeting(s, target);
        await this.rewardGreeting(target, s);
        return;
      }

      case "discover": {
        if (!s.limits.action.take()) return;
        const loc = this.map.locations.find((l) => l.id === msg.locationId);
        const p = s.record.progress;
        if (!loc || p.discovered.includes(loc.id)) return;
        if (Math.hypot(loc.x - s.x, loc.z - s.z) > DISCOVER_RANGE + 1) return;
        p.discovered.push(loc.id);
        await this.grant(s, REWARDS.discover, `Discovered ${loc.name}`);
        if (this.map.locations.every((l) => p.discovered.includes(l.id)))
          await this.grant(s, { coins: 30, rep: 15 }, `Explored all of ${this.map.short}`);
        return;
      }

      case "pickup": {
        if (!s.limits.action.take()) return;
        const idx = this.items.findIndex((i) => i.id === msg.itemId);
        if (idx < 0) return;
        const item = this.items[idx];
        if (Math.hypot(item.x - s.x, item.z - s.z) > PICKUP_RANGE + 0.75) return;
        this.items[idx] = this.spawnItem();
        this.broadcast({ t: "items", items: this.items });
        s.record.progress.cleanups++;
        s.contributed++;
        this.challengeProgress++;
        await this.grant(s, REWARDS.pickup, this.map.challenge.label);
        if (this.challengeProgress >= CHALLENGE_GOAL) {
          this.challengeProgress = 0;
          this.broadcast({ t: "challenge", progress: CHALLENGE_GOAL, goal: CHALLENGE_GOAL, completed: true });
          for (const c of this.sessions.values()) {
            if (c.contributed > 0) {
              c.contributed = 0;
              c.record.progress.challengesCompleted++;
              await this.grant(c, REWARDS.challenge, "Community clean-up complete!");
            }
          }
        }
        this.broadcast({ t: "challenge", progress: this.challengeProgress, goal: CHALLENGE_GOAL });
        return;
      }

      case "report": {
        if (!s.limits.report.take()) return this.notice(s, "You've sent several reports recently. Please wait a minute.");
        const target = this.sessions.get(msg.targetId);
        if (!target || target === s || !REPORT_REASONS.includes(msg.reason)) return;
        const details = typeof msg.details === "string" ? msg.details.slice(0, 500) : "";
        const priority = s.record.minor || target.record.minor || msg.reason === "sexual" ? "high" : "normal";
        await this.store.addReport({
          id: randomUUID(),
          reporterId: s.id,
          targetId: target.id,
          targetName: target.record.name,
          reason: msg.reason,
          details,
          evidence: target.recentChat.slice(-10),
          status: "open",
          priority,
          createdAt: Date.now(),
        });
        log("security", "player_reported", { reporter: s.id, target: target.id, reason: msg.reason, priority });
        this.notice(s, "Thanks — our moderators will review this report.", "info");
        return;
      }

      case "block": {
        const b = s.record.blocked;
        if (typeof msg.targetId !== "string" || msg.targetId === s.id) return;
        if (msg.blocked && !b.includes(msg.targetId) && b.length < 500) b.push(msg.targetId);
        if (!msg.blocked) s.record.blocked = b.filter((x) => x !== msg.targetId);
        await this.persist(s);
        return;
      }

      case "equip": {
        const p = s.record.progress;
        if (msg.cosmeticId !== null && !p.unlocked.includes(msg.cosmeticId)) return;
        p.equipped = msg.cosmeticId;
        s.conn.send({ t: "progress", progress: p });
        this.broadcast({ t: "player", player: s.public() });
        await this.persist(s);
        return;
      }
    }
  }

  /** The transit stop the player is standing at for a given destination, if any. */
  transitTo(s: Session, to: MapId) {
    return this.map.transit.find((t) => t.to === to && Math.hypot(t.x - s.x, t.z - s.z) <= 7);
  }

  private async rewardGreeting(s: Session, other: Session) {
    const now = Date.now();
    const day = new Date().toISOString().slice(0, 10);
    const r = s.record;
    if (r.greetDay.day !== day) r.greetDay = { day, count: 0 };
    const last = r.greetPairs[other.id] ?? 0;
    if (now - last < DAY_MS) return; // one rewarded greeting per pair per day
    if (r.greetDay.count >= DAILY_GREET_REWARD_CAP) return;
    // Prune old pairs to keep the record small.
    for (const [k, v] of Object.entries(r.greetPairs)) if (now - v > DAY_MS) delete r.greetPairs[k];
    r.greetPairs[other.id] = now;
    r.greetDay.count++;
    r.progress.greetings++;
    await this.grant(s, REWARDS.greet, `Met ${other.record.name}`);
  }

  kick(playerId: string, reason: string) {
    const s = this.sessions.get(playerId);
    if (!s) return false;
    s.conn.send({ t: "kicked", reason });
    s.conn.close(4003, reason);
    return true;
  }
}
