import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { HALLS, type Avatar, type Progress, type ReportReason } from "@ozu/shared";

export interface PlayerRecord {
  id: string;
  name: string;
  avatar: Avatar;
  progress: Progress;
  /** otherPlayerId -> timestamp of last rewarded greeting. */
  greetPairs: Record<string, number>;
  greetDay: { day: string; count: number };
  blocked: string[];
  banned: { reason: string; at: number } | null;
  /** Self-declared 16–17 year old: stricter safeguards apply. */
  minor: boolean;
  /** Unilag hall affiliation and when it last changed. */
  hall: string | null;
  hallChangedAt: number;
  /** Signed in with a Unilag email address. */
  student: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ReportRecord {
  id: string;
  reporterId: string;
  targetId: string;
  targetName: string;
  reason: ReportReason;
  details: string;
  evidence: { text: string; ts: number }[];
  status: "open" | "actioned" | "dismissed";
  /** High when an under-18 player is involved. */
  priority: "high" | "normal";
  resolution?: string;
  createdAt: number;
}

export interface Store {
  init(): Promise<void>;
  getPlayer(id: string): Promise<PlayerRecord | null>;
  savePlayer(p: PlayerRecord): Promise<void>;
  deletePlayer(id: string): Promise<void>;
  addReport(r: ReportRecord): Promise<void>;
  listReports(status?: ReportRecord["status"]): Promise<ReportRecord[]>;
  updateReport(id: string, status: ReportRecord["status"], resolution: string): Promise<boolean>;
  /** Total hall points per hall across all players. */
  hallTotals(): Promise<Record<string, number>>;
  close(): Promise<void>;
}

export function emptyProgress(): Progress {
  return { coins: 0, rep: 0, discovered: [], greetings: 0, cleanups: 0, challengesCompleted: 0, unlocked: [], equipped: null, hallPoints: 0, lecturesAttended: 0 };
}

/** Fill fields added after a record was first saved. */
export function normalizeRecord(p: PlayerRecord | null): PlayerRecord | null {
  if (!p) return null;
  return {
    ...p,
    progress: { ...emptyProgress(), ...p.progress },
    blocked: p.blocked ?? [],
    minor: p.minor ?? false,
    hall: p.hall ?? null,
    hallChangedAt: p.hallChangedAt ?? 0,
    student: p.student ?? false,
  };
}

function emptyHallTotals(): Record<string, number> {
  return Object.fromEntries(HALLS.map((h) => [h.id, 0]));
}

/** JSON-file store for local development and single-instance hosting with a persistent disk. */
export class FileStore implements Store {
  private players = new Map<string, PlayerRecord>();
  private reports: ReportRecord[] = [];
  private dirty = false;
  private timer: NodeJS.Timeout | null = null;
  private writing: Promise<void> = Promise.resolve();
  constructor(private dir: string) {}

  private get file() {
    return path.join(this.dir, "ozu-db.json");
  }

  async init() {
    await mkdir(this.dir, { recursive: true });
    try {
      const raw = JSON.parse(await readFile(this.file, "utf8"));
      for (const p of raw.players ?? []) this.players.set(p.id, p);
      this.reports = raw.reports ?? [];
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
    this.timer = setInterval(() => void this.flush(), 2000);
  }

  private async flush() {
    if (!this.dirty) return;
    this.dirty = false;
    const data = JSON.stringify({ players: [...this.players.values()], reports: this.reports });
    // Write to a temp file then rename, so a crash never leaves a half-written database.
    this.writing = this.writing.then(async () => {
      const tmp = this.file + ".tmp";
      await writeFile(tmp, data);
      await rename(tmp, this.file);
    });
    await this.writing;
  }

  async getPlayer(id: string) {
    const p = this.players.get(id);
    return p ? normalizeRecord(structuredClone(p)) : null;
  }
  async hallTotals() {
    const t = emptyHallTotals();
    for (const p of this.players.values()) if (p.hall && p.hall in t) t[p.hall] += p.progress.hallPoints ?? 0;
    return t;
  }
  async savePlayer(p: PlayerRecord) {
    this.players.set(p.id, structuredClone(p));
    this.dirty = true;
  }
  async deletePlayer(id: string) {
    this.players.delete(id);
    this.dirty = true;
  }
  async addReport(r: ReportRecord) {
    this.reports.push(r);
    this.dirty = true;
  }
  async listReports(status?: ReportRecord["status"]) {
    return this.reports
      .filter((r) => !status || r.status === status)
      .slice(-500)
      .reverse()
      .sort((a, b) => (a.priority === "high" ? 0 : 1) - (b.priority === "high" ? 0 : 1));
  }
  async updateReport(id: string, status: ReportRecord["status"], resolution: string) {
    const r = this.reports.find((x) => x.id === id);
    if (!r) return false;
    r.status = status;
    r.resolution = resolution;
    this.dirty = true;
    return true;
  }
  async close() {
    if (this.timer) clearInterval(this.timer);
    this.dirty = true;
    await this.flush();
  }
}

/** PostgreSQL store (e.g. Supabase). Schema: supabase/migrations/0001_init.sql */
export class PgStore implements Store {
  private pool: pg.Pool;
  constructor(url: string) {
    const local = /localhost|127\.0\.0\.1/.test(url);
    this.pool = new pg.Pool({ connectionString: url, max: 5, ssl: local ? undefined : { rejectUnauthorized: false } });
  }
  async init() {
    await this.pool.query("select 1 from ozu_players limit 1");
  }
  async getPlayer(id: string) {
    const r = await this.pool.query("select data from ozu_players where id = $1", [id]);
    return normalizeRecord((r.rows[0]?.data as PlayerRecord) ?? null);
  }
  async savePlayer(p: PlayerRecord) {
    await this.pool.query(
      `insert into ozu_players (id, display_name, coins, rep, banned, data, updated_at)
       values ($1, $2, $3, $4, $5, $6, now())
       on conflict (id) do update set display_name = excluded.display_name, coins = excluded.coins,
         rep = excluded.rep, banned = excluded.banned, data = excluded.data, updated_at = now()`,
      [p.id, p.name, p.progress.coins, p.progress.rep, !!p.banned, p],
    );
  }
  async deletePlayer(id: string) {
    await this.pool.query("delete from ozu_players where id = $1", [id]);
  }
  async hallTotals() {
    const r = await this.pool.query(
      `select data->>'hall' as hall, coalesce(sum((data->'progress'->>'hallPoints')::int), 0) as points
       from ozu_players where data->>'hall' is not null and not banned group by 1`,
    );
    const t = emptyHallTotals();
    for (const row of r.rows) if (row.hall in t) t[row.hall] = Number(row.points);
    return t;
  }
  async addReport(r: ReportRecord) {
    await this.pool.query(
      `insert into ozu_reports (id, reporter_id, target_id, reason, status, data, created_at)
       values ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))`,
      [r.id, r.reporterId, r.targetId, r.reason, r.status, r, r.createdAt],
    );
  }
  async listReports(status?: ReportRecord["status"]) {
    const r = status
      ? await this.pool.query("select data from ozu_reports where status = $1 order by (data->>'priority' = 'high') desc, created_at desc limit 500", [status])
      : await this.pool.query("select data from ozu_reports order by (data->>'priority' = 'high') desc, created_at desc limit 500");
    return r.rows.map((x) => x.data as ReportRecord);
  }
  async updateReport(id: string, status: ReportRecord["status"], resolution: string) {
    const r = await this.pool.query(
      `update ozu_reports set status = $2, data = jsonb_set(jsonb_set(data, '{status}', to_jsonb($2::text)), '{resolution}', to_jsonb($3::text))
       where id = $1`,
      [id, status, resolution],
    );
    return (r.rowCount ?? 0) > 0;
  }
  async close() {
    await this.pool.end();
  }
}

/** In-memory store for tests. */
export class MemoryStore extends FileStore {
  constructor() {
    super("");
  }
  override async init() {}
  override async close() {}
}
