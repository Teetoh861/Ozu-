// Lightweight first-line text moderation. This is a baseline filter, not a
// substitute for human review: reports go to the admin queue.

const BLOCKED = [
  "fuck", "fucker", "fucking", "shit", "bitch", "cunt", "nigger", "nigga", "whore", "slut",
  "dick", "pussy", "bastard", "asshole", "faggot", "fag", "retard", "rape", "rapist",
  // Nigerian Pidgin / Yoruba / Igbo insults commonly used as harassment
  "ashawo", "oloshi", "olosho", "werey", "agbaya", "onye ara", "dindinrin",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[013457@$!]/g, (c) => LEET[c] ?? c)
    .replace(/(.)\1{2,}/g, "$1$1")
    // Join letter-spaced evasion such as "f u c k" or "f.u.c.k".
    .replace(/\b[a-z](?:[\s._*-]+[a-z]\b){2,}/g, (m) => m.replace(/[^a-z]/g, ""));
}

// Whole-word match (optionally pluralised) to avoid flagging innocent words like "Scunthorpe".
const PATTERNS = BLOCKED.map((w) => new RegExp(`(^|[^a-z])${w.replace(/ /g, "[^a-z]*")}(e?s)?(?=$|[^a-z])`, "i"));

export function containsProfanity(text: string): boolean {
  const n = normalize(text);
  return PATTERNS.some((p) => p.test(n));
}

/** Replace offending words with asterisks; returns masked text. */
export function maskProfanity(text: string): string {
  return text
    .split(/(\s+)/)
    .map((tok) => (tok.trim() && containsProfanity(tok) ? "*".repeat(tok.length) : tok))
    .join("");
}

export const NAME_MIN = 3;
export const NAME_MAX = 16;
export const CHAT_MAX = 140;

const RESERVED = ["admin", "moderator", "ozu", "staff", "system", "official"];

export function validateDisplayName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Choose a display name." };
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < NAME_MIN || name.length > NAME_MAX)
    return { ok: false, error: `Names must be ${NAME_MIN}–${NAME_MAX} characters.` };
  if (!/^[\p{L}\p{N}][\p{L}\p{N} _.'-]*$/u.test(name))
    return { ok: false, error: "Use letters, numbers, spaces, _ . ' or -." };
  if (containsProfanity(name)) return { ok: false, error: "That name isn't allowed." };
  const lower = name.toLowerCase().replace(/[^a-z]/g, "");
  if (RESERVED.some((r) => lower === r || lower.startsWith(r + "team") || lower.endsWith("admin")))
    return { ok: false, error: "That name is reserved." };
  return { ok: true, name };
}

// Contact details and links are hidden for everyone: it protects younger players
// and cuts off the most common scam pattern ("DM me on WhatsApp", phishing links).
const PHONE = /(?:\+?234|\b0)[\s.-]?[789][01](?:[\s.-]?\d){8}\b|(?:\d[\s.-]?){10,}\d/g;
const LINK = /\b(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|ng|net|org|io|me|ly|app|xyz|link|co|gg)\b(?:\/\S*)?/gi;
const HANDLE = /(^|\s)@[\w.]{3,}/g;

export function maskContactInfo(text: string): string {
  return text
    .replace(PHONE, "[number hidden]")
    .replace(LINK, "[link hidden]")
    .replace(HANDLE, "$1[handle hidden]");
}

const CONTROL = /[\u0000-\u001f\u007f​-‏‪-‮]/g;

export function cleanChat(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Strip control characters and collapse whitespace.
  const text = raw.replace(CONTROL, "").replace(/\s+/g, " ").trim();
  if (!text || text.length > CHAT_MAX) return null;
  return maskContactInfo(maskProfanity(text));
}
