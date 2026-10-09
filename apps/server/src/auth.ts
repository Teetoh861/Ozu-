import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { config } from "./config";

// Guest identity: "g_<uuid>.<hmac>" — lets a device keep its progress without
// an account, while preventing clients from claiming someone else's id.

function sign(id: string) {
  return createHmac("sha256", config.guestSecret).update(id).digest("base64url");
}

export function issueGuestToken(): { id: string; token: string } {
  const id = `g_${randomUUID()}`;
  return { id, token: `${id}.${sign(id)}` };
}

export function verifyGuestToken(token: unknown): string | null {
  if (typeof token !== "string" || token.length > 200) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const id = token.slice(0, dot);
  const sig = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(id));
  if (!/^g_[0-9a-f-]{36}$/.test(id) || sig.length !== expected.length) return null;
  return timingSafeEqual(sig, expected) ? id : null;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

/** Verify a Supabase access token. Returns the stable member id or null. */
export async function verifyMemberToken(token: unknown): Promise<{ id: string; email?: string } | null> {
  if (typeof token !== "string" || !config.supabaseUrl) return null;
  try {
    let payload: JWTPayload;
    const issuer = `${config.supabaseUrl}/auth/v1`;
    if (config.supabaseJwtSecret) {
      ({ payload } = await jwtVerify(token, new TextEncoder().encode(config.supabaseJwtSecret), { issuer }));
    } else {
      jwks ??= createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
      ({ payload } = await jwtVerify(token, jwks, { issuer }));
    }
    if (payload.role !== "authenticated" || typeof payload.sub !== "string") return null;
    return { id: `u_${payload.sub}`, email: typeof payload.email === "string" ? payload.email : undefined };
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
