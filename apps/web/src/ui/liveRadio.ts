/**
 * Live radio via the community Radio Browser directory (radio-browser.info):
 * a free, keyless API used by many open-source radio apps. We only link to the
 * stations' own public streams (nothing is re-hosted), and only HTTPS streams
 * are used so they play on our HTTPS site.
 */

export interface LiveStation {
  stationuuid: string;
  name: string;
  url_resolved: string;
  favicon: string;
  tags: string;
  state: string;
  codec: string;
  bitrate: number;
  clickcount: number;
}

const MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://de2.api.radio-browser.info",
  "https://fi1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
];

let working: string | null = null;

async function api<T>(path: string): Promise<T> {
  const order = working ? [working, ...MIRRORS.filter((m) => m !== working)] : [...MIRRORS].sort(() => Math.random() - 0.5);
  let lastErr: unknown;
  for (const base of order) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(base + path, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      working = base;
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Radio directory unreachable");
}

const usable = (s: LiveStation) => s.url_resolved?.startsWith("https://") && !/\.m3u8?($|\?)/i.test(s.url_resolved);

function dedupe(list: LiveStation[]) {
  const seen = new Set<string>();
  return list.filter((s) => {
    const k = s.name.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Most-played Nigerian stations with HTTPS streams. */
export async function nigerianStations(): Promise<LiveStation[]> {
  const list = await api<LiveStation[]>("/json/stations/bycountrycodeexact/NG?hidebroken=true&order=clickcount&reverse=true&limit=120");
  return dedupe(list.filter(usable)).slice(0, 40);
}

export async function searchStations(q: string): Promise<LiveStation[]> {
  const params = new URLSearchParams({ name: q, hidebroken: "true", order: "clickcount", reverse: "true", limit: "60" });
  const list = await api<LiveStation[]>(`/json/stations/search?${params}`);
  return dedupe(list.filter(usable)).slice(0, 30);
}

/** Tell the directory a station was played (their recommended etiquette for clients). */
export function countClick(uuid: string) {
  void api(`/json/url/${encodeURIComponent(uuid)}`).catch(() => {});
}

// ---------------- Player ----------------

let audio: HTMLAudioElement | null = null;

export function playLive(url: string, volume: number, onError: () => void) {
  stopLive();
  audio = new Audio();
  audio.preload = "none";
  audio.src = url;
  audio.volume = volume;
  audio.onerror = onError;
  void audio.play().catch(onError);
}

export function setLiveVolume(v: number) {
  if (audio) audio.volume = v;
}

export function stopLive() {
  if (!audio) return;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  audio = null;
}
