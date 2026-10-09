import { describe, expect, it, beforeEach } from "vitest";
import { CHALLENGE_GOAL, LOCATIONS, containsProfanity, validateDisplayName, cleanChat, collides, BUILDINGS, type ServerMessage } from "@ozu/shared";
import { District, Session, type Conn } from "../src/game";
import { MemoryStore, emptyProgress, type PlayerRecord } from "../src/store";
import { issueGuestToken, verifyGuestToken } from "../src/auth";

function fakeConn() {
  const sent: ServerMessage[] = [];
  const conn: Conn & { sent: ServerMessage[]; closed?: string } = {
    sent,
    send: (m) => sent.push(m),
    close: (_c, r) => (conn.closed = r),
  };
  return conn;
}

function record(id: string, name = id): PlayerRecord {
  return { id, name, avatar: { body: "masc", skin: 0, hair: "afro", outfit: "ankara", palette: 0 }, progress: emptyProgress(), greetPairs: {}, greetDay: { day: "", count: 0 }, blocked: [], banned: null, createdAt: 0, updatedAt: 0 };
}

let store: MemoryStore;
let d: District;
beforeEach(() => {
  store = new MemoryStore();
  d = new District("t", store, { guestChat: true, max: 10 });
});

function join(id: string, x = 0, z = -10) {
  const c = fakeConn();
  const s = new Session(c, record(id), "guest");
  d.join(s, null);
  s.x = x;
  s.z = z;
  return { s, c };
}

describe("moderation", () => {
  it("blocks profanity including leetspeak and spacing", () => {
    expect(containsProfanity("you are a b1tch")).toBe(true);
    expect(containsProfanity("f u c k off")).toBe(true);
    expect(containsProfanity("werey")).toBe(true);
    expect(containsProfanity("Scunthorpe is a town")).toBe(false);
    expect(containsProfanity("I love code and Lagos")).toBe(false);
  });
  it("validates display names", () => {
    expect(validateDisplayName("Tobi").ok).toBe(true);
    expect(validateDisplayName("ab").ok).toBe(false);
    expect(validateDisplayName("OzuAdmin").ok).toBe(false);
    expect(validateDisplayName("<script>").ok).toBe(false);
  });
  it("cleans chat", () => {
    expect(cleanChat("  hello\u0000  world ")).toBe("hello world");
    expect(cleanChat("x".repeat(200))).toBeNull();
    expect(cleanChat("shit happens")).toBe("**** happens");
  });
});

describe("world", () => {
  it("collides with buildings", () => {
    const b = BUILDINGS[0];
    expect(collides(b.x, b.z)).toBe(true);
    expect(collides(0, -10)).toBe(false);
  });
});

describe("auth", () => {
  it("round-trips guest tokens and rejects forgeries", () => {
    const g = issueGuestToken();
    expect(verifyGuestToken(g.token)).toBe(g.id);
    expect(verifyGuestToken(g.token.slice(0, -2) + "xx")).toBeNull();
    expect(verifyGuestToken("g_00000000-0000-0000-0000-000000000000.abc")).toBeNull();
  });
});

describe("district", () => {
  it("rejects teleport movement and sends a correction", async () => {
    const { s, c } = join("a");
    s.lastMoveAt = Date.now() - 100;
    await d.handle(s, { t: "move", x: 40, z: 40, ry: 0, anim: "run" });
    expect(c.sent.some((m) => m.t === "correct")).toBe(true);
    expect(Math.hypot(s.x - 0, s.z + 10)).toBeLessThan(2);
  });

  it("rewards greetings once per pair per day and requires proximity", async () => {
    const a = join("a", 0, -10);
    const b = join("b", 20, -10);
    await d.handle(a.s, { t: "greet", targetId: "b" });
    expect(a.s.record.progress.coins).toBe(0);
    b.s.x = 1;
    await d.handle(a.s, { t: "greet", targetId: "b" });
    expect(a.s.record.progress.coins).toBe(5);
    expect(b.s.record.progress.coins).toBe(5);
    await d.handle(a.s, { t: "greet", targetId: "b" });
    expect(a.s.record.progress.coins).toBe(5);
  });

  it("only rewards discovery when the server-side position is near", async () => {
    const loc = LOCATIONS.find((l) => l.id === "lounge")!;
    const a = join("a", 0, -10);
    await d.handle(a.s, { t: "discover", locationId: loc.id });
    expect(a.s.record.progress.discovered).toHaveLength(0);
    a.s.x = loc.x;
    a.s.z = loc.z - 3;
    await d.handle(a.s, { t: "discover", locationId: loc.id });
    await d.handle(a.s, { t: "discover", locationId: loc.id });
    expect(a.s.record.progress.discovered).toEqual(["lounge"]);
    expect(a.s.record.progress.coins).toBe(10);
  });

  it("completes the community challenge and rewards contributors", async () => {
    const a = join("a");
    for (let i = 0; i < CHALLENGE_GOAL; i++) {
      const item = d.items[0];
      a.s.x = item.x;
      a.s.z = item.z;
      a.s.limits.action = { take: () => true } as any;
      await d.handle(a.s, { t: "pickup", itemId: item.id });
    }
    expect(a.s.record.progress.challengesCompleted).toBe(1);
    expect(a.s.record.progress.coins).toBe(CHALLENGE_GOAL * 2 + 25);
    expect(d.challengeProgress).toBe(0);
  });

  it("does not deliver chat between blocked players", async () => {
    const a = join("a");
    const b = join("b");
    await d.handle(b.s, { t: "block", targetId: "a", blocked: true });
    await d.handle(a.s, { t: "chat", text: "hello" });
    expect(a.c.sent.some((m) => m.t === "chat")).toBe(true);
    expect(b.c.sent.some((m) => m.t === "chat")).toBe(false);
  });

  it("rate-limits chat", async () => {
    const a = join("a");
    for (let i = 0; i < 10; i++) await d.handle(a.s, { t: "chat", text: `msg ${i}` });
    expect(a.c.sent.filter((m) => m.t === "chat")).toHaveLength(5);
  });

  it("stores reports with recent chat as evidence", async () => {
    const a = join("a");
    const b = join("b");
    await d.handle(b.s, { t: "chat", text: "spam spam" });
    await d.handle(a.s, { t: "report", targetId: "b", reason: "spam" });
    const reports = await store.listReports();
    expect(reports).toHaveLength(1);
    expect(reports[0].evidence[0].text).toBe("spam spam");
  });

  it("prevents equipping locked cosmetics", async () => {
    const a = join("a");
    await d.handle(a.s, { t: "equip", cosmeticId: "gold-chain" });
    expect(a.s.record.progress.equipped).toBeNull();
  });
});
