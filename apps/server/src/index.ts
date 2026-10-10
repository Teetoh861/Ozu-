import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  DEFAULT_AVATAR, HALLS, LECTURE_INTERVAL_SECONDS, MAP_IDS, SNAPSHOT_HZ, getMap, sanitizeAvatar, validateDisplayName,
  type ClientMessage, type HallStanding, type MapId, type ServerMessage,
} from "@ozu/shared";
import { assertProductionConfig, config } from "./config";
import { District, Session, type Conn } from "./game";
import { FileStore, PgStore, emptyProgress, normalizeRecord, type PlayerRecord, type Store } from "./store";
import { issueGuestToken, safeEqual, verifyGuestToken, verifyMemberToken } from "./auth";
import { log } from "./log";

assertProductionConfig();

const store: Store = config.databaseUrl ? new PgStore(config.databaseUrl) : new FileStore(config.dataDir);
const districts: District[] = [];
const startedAt = Date.now();
let connectionFailures = 0;

let hallStandings: HallStanding[] = HALLS.map((h) => ({ id: h.id, points: 0 }));

function districtFor(mapId: MapId): District {
  const open = districts.find((d) => d.map.id === mapId && !d.full);
  if (open) return open;
  const n = districts.filter((d) => d.map.id === mapId).length + 1;
  const d = new District(`${mapId}-${n}`, mapId, store, { guestChat: config.guestChat, max: config.maxPerDistrict });
  d.halls = hallStandings;
  d.start(SNAPSHOT_HZ, config.lectureIntervalS || LECTURE_INTERVAL_SECONDS);
  districts.push(d);
  return d;
}

async function refreshHalls() {
  try {
    const totals = await store.hallTotals();
    hallStandings = HALLS.map((h) => ({ id: h.id, points: totals[h.id] ?? 0 })).sort((a, b) => b.points - a.points);
    for (const d of districts) d.setHalls(hallStandings);
  } catch (e) {
    log("error", "hall_refresh_failed", { error: String(e) });
  }
}

const STUDENT_DOMAINS = ["live.unilag.edu.ng", "unilag.edu.ng"];

function findSession(id: string) {
  for (const d of districts) {
    const s = d.sessions.get(id);
    if (s) return { d, s };
  }
  return null;
}

// ---------- HTTP: health, metrics, admin ----------

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function corsHeaders(req: http.IncomingMessage, res: http.ServerResponse) {
  const origin = req.headers.origin;
  if (origin && originAllowed(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "origin");
    res.setHeader("access-control-allow-headers", "authorization, content-type");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  }
}

function originAllowed(origin: string | undefined) {
  if (config.allowedOrigins.length === 0) return true;
  return !!origin && config.allowedOrigins.some((o) => o === origin || (o.startsWith("*.") && origin.endsWith(o.slice(1))));
}

async function readBody(req: http.IncomingMessage): Promise<any> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += c.length;
    if (size > 10_000) throw new Error("too large");
    chunks.push(c);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function isAdmin(req: http.IncomingMessage) {
  const h = req.headers.authorization ?? "";
  return !!config.adminToken && h.startsWith("Bearer ") && safeEqual(h.slice(7), config.adminToken);
}

const server = http.createServer(async (req, res) => {
  corsHeaders(req, res);
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  const url = new URL(req.url ?? "/", "http://x");
  try {
    if (url.pathname === "/" || url.pathname === "/health") {
      const online = districts.reduce((n, d) => n + d.sessions.size, 0);
      return json(res, 200, { ok: true, service: "ozu-game-server", online, districts: districts.length, uptimeS: Math.round((Date.now() - startedAt) / 1000) });
    }
    if (url.pathname === "/metrics") {
      const mem = process.memoryUsage();
      return json(res, 200, {
        online: districts.reduce((n, d) => n + d.sessions.size, 0),
        districts: districts.map((d) => ({ id: d.id, map: d.map.id, players: d.sessions.size, challenge: d.challengeProgress, lecture: !!d.lecture })),
        halls: hallStandings,
        connectionFailures,
        rssMb: Math.round(mem.rss / 1e6),
      });
    }
    if (url.pathname.startsWith("/admin/")) {
      if (!isAdmin(req)) {
        log("security", "admin_auth_failed", { path: url.pathname, ip: req.socket.remoteAddress });
        return json(res, 401, { error: "unauthorized" });
      }
      if (req.method === "GET" && url.pathname === "/admin/reports") {
        const status = url.searchParams.get("status") as any;
        return json(res, 200, { reports: await store.listReports(status || undefined) });
      }
      const m = url.pathname.match(/^\/admin\/reports\/([\w-]+)\/resolve$/);
      if (req.method === "POST" && m) {
        const body = await readBody(req);
        const status = body.status === "actioned" ? "actioned" : "dismissed";
        const ok = await store.updateReport(m[1], status, String(body.resolution ?? "").slice(0, 500));
        log("security", "report_resolved", { report: m[1], status });
        return json(res, ok ? 200 : 404, { ok });
      }
      if (req.method === "POST" && (url.pathname === "/admin/ban" || url.pathname === "/admin/unban")) {
        const body = await readBody(req);
        const id = String(body.playerId ?? "");
        const live = findSession(id);
        const rec: PlayerRecord | null = live?.s.record ?? (await store.getPlayer(id));
        if (!rec) return json(res, 404, { error: "player not found" });
        const ban = url.pathname === "/admin/ban";
        rec.banned = ban ? { reason: String(body.reason ?? "Community guidelines violation").slice(0, 200), at: Date.now() } : null;
        await store.savePlayer(rec);
        if (ban && live) live.d.kick(id, "You have been removed for violating the community guidelines.");
        log("security", ban ? "player_banned" : "player_unbanned", { player: id });
        return json(res, 200, { ok: true });
      }
      if (req.method === "POST" && url.pathname === "/admin/announce") {
        const body = await readBody(req);
        const text = String(body.text ?? "").slice(0, 200);
        for (const d of districts) d.broadcast({ t: "notice", level: "info", text });
        return json(res, 200, { ok: true });
      }
      return json(res, 404, { error: "not found" });
    }
    json(res, 404, { error: "not found" });
  } catch (e) {
    log("error", "http_error", { path: url.pathname, error: String(e) });
    json(res, 400, { error: "bad request" });
  }
});

// ---------- WebSocket ----------

const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
const connectionsPerIp = new Map<string, number>();
const MAX_CONN_PER_IP = 8;

server.on("upgrade", (req, socket, head) => {
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() || req.socket.remoteAddress || "?";
  if (!originAllowed(req.headers.origin)) {
    log("security", "origin_rejected", { origin: req.headers.origin, ip });
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    return socket.destroy();
  }
  if ((connectionsPerIp.get(ip) ?? 0) >= MAX_CONN_PER_IP) {
    socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, ip));
});

function onConnection(ws: WebSocket, ip: string) {
  connectionsPerIp.set(ip, (connectionsPerIp.get(ip) ?? 0) + 1);
  const conn: Conn = {
    send: (m: ServerMessage) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(m)),
    close: (code, reason) => ws.close(code, reason),
  };
  let session: Session | null = null;
  let district: District | null = null;
  let helloPending = false;
  let alive = true;
  ws.on("pong", () => (alive = true));
  const heartbeat = setInterval(() => {
    if (!alive) return ws.terminate();
    alive = false;
    ws.ping();
  }, 15_000);
  const helloTimeout = setTimeout(() => !session && ws.close(4000, "Handshake timeout"), 10_000);

  ws.on("message", async (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
      if (!msg || typeof msg.t !== "string") return;
    } catch {
      return;
    }
    if (!session) {
      if (msg.t !== "hello" || helloPending) return;
      helloPending = true;
      try {
        const result = await handshake(msg);
        if ("error" in result) {
          conn.send({ t: "kicked", reason: result.error });
          connectionFailures++;
          return ws.close(4002, result.error.slice(0, 120));
        }
        if (ws.readyState !== ws.OPEN) return;
        district = districtFor("ozu");
        session = new Session(conn, result.record, result.account);
        district.join(session, result.guestToken);
      } catch (e) {
        connectionFailures++;
        log("error", "handshake_failed", { error: String(e) });
        ws.close(1011, "Server error");
      } finally {
        helloPending = false;
      }
      return;
    }
    if (msg.t === "travel") {
      const to = msg.to;
      if (!MAP_IDS.includes(to) || to === district!.map.id || !session.limits.travel.take()) return;
      if (!district!.transitTo(session, to)) return conn.send({ t: "notice", level: "warn", text: "Walk to the bus stop to travel." });
      const from = district!;
      await from.leave(session);
      if (ws.readyState !== ws.OPEN) return;
      district = districtFor(to);
      district.join(session, null, getMap(to).arrival[from.map.id]);
      log("info", "player_travel", { player: session.id, from: from.map.id, to });
      return;
    }
    try {
      await district!.handle(session, msg);
    } catch (e) {
      log("error", "message_failed", { player: session.id, t: msg.t, error: String(e) });
    }
  });

  ws.on("close", () => {
    clearInterval(heartbeat);
    clearTimeout(helloTimeout);
    const n = (connectionsPerIp.get(ip) ?? 1) - 1;
    if (n <= 0) connectionsPerIp.delete(ip);
    else connectionsPerIp.set(ip, n);
    if (session && district) void district.leave(session);
  });
}

async function handshake(msg: Extract<ClientMessage, { t: "hello" }>): Promise<
  { error: string } | { record: PlayerRecord; account: "guest" | "member"; guestToken: string | null }
> {
  const nameCheck = validateDisplayName(msg.name);
  if (!nameCheck.ok) return { error: nameCheck.error };
  const avatar = sanitizeAvatar(msg.avatar ?? DEFAULT_AVATAR);

  if (msg.ageGroup !== "16-17" && msg.ageGroup !== "18+") return { error: "Please confirm your age to play." };
  const hall = typeof msg.hall === "string" && HALLS.some((h) => h.id === msg.hall) ? msg.hall : null;

  let id: string;
  let student = false;
  let account: "guest" | "member" = "guest";
  let guestToken: string | null = null;
  const guestId = verifyGuestToken(msg.guestToken);

  if (msg.accessToken) {
    const member = await verifyMemberToken(msg.accessToken);
    if (!member) return { error: "Your session has expired. Please sign in again." };
    id = member.id;
    account = "member";
    const domain = member.email?.split("@")[1]?.toLowerCase() ?? "";
    student = STUDENT_DOMAINS.includes(domain);
  } else if (guestId) {
    id = guestId;
    guestToken = msg.guestToken!;
  } else {
    const g = issueGuestToken();
    id = g.id;
    guestToken = g.token;
  }

  let record = normalizeRecord(await store.getPlayer(id));
  // Guest -> member migration: first sign-in carries the device's guest progress over.
  if (!record && account === "member" && guestId) {
    const guest = await store.getPlayer(guestId);
    if (guest && !guest.banned) {
      record = normalizeRecord({ ...guest, id })!;
      await store.deletePlayer(guestId);
      log("info", "guest_migrated", { from: guestId, to: id });
    }
  }
  const now = Date.now();
  record ??= {
    id, name: nameCheck.name, avatar, progress: emptyProgress(), greetPairs: {},
    greetDay: { day: "", count: 0 }, blocked: [], banned: null, minor: false, hall: null, hallChangedAt: 0,
    student: false, createdAt: now, updatedAt: now,
  };
  if (record.banned) {
    log("security", "banned_login_attempt", { player: id });
    return { error: "This account has been suspended for violating the community guidelines." };
  }
  record.name = nameCheck.name;
  record.avatar = avatar;
  // Once someone says they're under 18 the record stays protected; only an admin can lift it.
  record.minor = record.minor || msg.ageGroup === "16-17";
  record.student = record.student || student;
  // Hall changes are limited to once every 30 days so points can't be shuffled between halls.
  if (hall !== record.hall) {
    if (!record.hall || now - record.hallChangedAt > 30 * DAY_MS) {
      record.hall = hall;
      record.hallChangedAt = now;
      record.progress.hallPoints = 0;
    }
  }
  await store.savePlayer(record);
  return { record, account, guestToken };
}

// ---------- Lifecycle ----------

const DAY_MS = 24 * 60 * 60 * 1000;

async function main() {
  await store.init();
  await refreshHalls();
  districtFor("ozu");
  districtFor("unilag");
  setInterval(() => void refreshHalls(), 60_000);
  server.listen(config.port, () =>
    log("info", "server_started", { port: config.port, store: config.databaseUrl ? "postgres" : "file", auth: config.supabaseUrl ? "supabase+guest" : "guest" }),
  );
}

async function shutdown(signal: string) {
  log("info", "shutdown", { signal });
  for (const d of districts) {
    d.broadcast({ t: "notice", level: "warn", text: "Server is restarting — you'll reconnect automatically." });
    for (const s of d.sessions.values()) await d.persist(s);
    d.stop();
  }
  wss.clients.forEach((c) => c.close(1012, "Restarting"));
  await store.close();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (e) => log("error", "unhandled_rejection", { error: String(e) }));

main().catch((e) => {
  log("error", "startup_failed", { error: String(e) });
  process.exit(1);
});
