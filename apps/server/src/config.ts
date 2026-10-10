function num(v: string | undefined, d: number) {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== "" ? n : d;
}

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";

export const config = {
  port: num(process.env.PORT, 2567),
  /** Comma-separated list of allowed browser origins. Empty = allow all (development only). */
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
  /** HMAC secret for signing guest identity tokens. Must be set in production. */
  guestSecret: process.env.GUEST_TOKEN_SECRET || "dev-only-insecure-guest-secret",
  adminToken: process.env.ADMIN_TOKEN || "",
  databaseUrl: process.env.DATABASE_URL || "",
  dataDir: process.env.DATA_DIR || "./data",
  supabaseUrl,
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET || "",
  /** Whether guests may use text chat. Defaults to true only when member accounts are unavailable. */
  guestChat: process.env.GUEST_CHAT ? process.env.GUEST_CHAT === "true" : !supabaseUrl,
  maxPerDistrict: num(process.env.MAX_PLAYERS_PER_DISTRICT, 40),
  /** Seconds between campus lecture-rush events (and delay before the first). */
  lectureIntervalS: num(process.env.LECTURE_INTERVAL_SECONDS, 0),
  production: process.env.NODE_ENV === "production",
};

export function assertProductionConfig() {
  if (!config.production) return;
  const problems: string[] = [];
  if (config.guestSecret.startsWith("dev-only") || config.guestSecret.length < 32)
    problems.push("GUEST_TOKEN_SECRET must be a random string of at least 32 characters");
  if (!config.adminToken || config.adminToken.length < 24) problems.push("ADMIN_TOKEN must be at least 24 characters");
  if (problems.length) {
    for (const p of problems) console.error(`[config] ${p}`);
    process.exit(1);
  }
}
