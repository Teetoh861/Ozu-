import { WORLD_HALF, collides, getMap, type MapDef, type MapId } from "@ozu/shared";

/**
 * Tap-to-walk navigation: A* over a 1 m grid of each map, then path smoothing
 * so characters walk in natural straight lines instead of zig-zags.
 */

const N = WORLD_HALF * 2 + 1;
const grids = new Map<MapId, Uint8Array>();

function grid(map: MapDef) {
  let g = grids.get(map.id);
  if (g) return g;
  g = new Uint8Array(N * N);
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) g[j * N + i] = collides(map, i - WORLD_HALF, j - WORLD_HALF, 0.6) ? 1 : 0;
  grids.set(map.id, g);
  return g;
}

const cell = (v: number) => Math.max(0, Math.min(N - 1, Math.round(v + WORLD_HALF)));

function nearestFree(g: Uint8Array, ci: number, cj: number): [number, number] | null {
  if (!g[cj * N + ci]) return [ci, cj];
  for (let r = 1; r < 10; r++)
    for (let di = -r; di <= r; di++)
      for (let dj = -r; dj <= r; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = ci + di, j = cj + dj;
        if (i >= 0 && j >= 0 && i < N && j < N && !g[j * N + i]) return [i, j];
      }
  return null;
}

function lineClear(map: MapDef, ax: number, az: number, bx: number, bz: number) {
  const d = Math.hypot(bx - ax, bz - az);
  const steps = Math.ceil(d / 0.4);
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    if (collides(map, ax + (bx - ax) * t, az + (bz - az) * t, 0.45)) return false;
  }
  return true;
}

/** Returns waypoints from (sx,sz) to (tx,tz), excluding the start; null when unreachable. */
export function findPath(mapId: MapId, sx: number, sz: number, tx: number, tz: number): [number, number][] | null {
  const map = getMap(mapId);
  if (lineClear(map, sx, sz, tx, tz) && !collides(map, tx, tz, 0.45)) return [[tx, tz]];
  const g = grid(map);
  const start = nearestFree(g, cell(sx), cell(sz));
  const goal = nearestFree(g, cell(tx), cell(tz));
  if (!start || !goal) return null;
  const si = start[1] * N + start[0], gi = goal[1] * N + goal[0];

  const gScore = new Float32Array(N * N).fill(Infinity);
  const came = new Int32Array(N * N).fill(-1);
  const closed = new Uint8Array(N * N);
  // Binary heap of [f, index]
  const heap: [number, number][] = [];
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heap[p][0] <= heap[c][0]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1, r = l + 1;
        let m = c;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]];
        c = m;
      }
    }
    return top;
  };
  const h = (i: number) => {
    const dx = Math.abs((i % N) - goal[0]), dz = Math.abs(((i / N) | 0) - goal[1]);
    return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
  };
  gScore[si] = 0;
  push(h(si), si);
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  let found = false;
  while (heap.length) {
    const [, cur] = pop();
    if (cur === gi) { found = true; break; }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const ci = cur % N, cj = (cur / N) | 0;
    for (const [di, dj, cost] of DIRS) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const n = nj * N + ni;
      if (g[n] || closed[n]) continue;
      // No corner cutting through walls.
      if (di && dj && (g[cj * N + ni] || g[nj * N + ci])) continue;
      const t = gScore[cur] + cost;
      if (t < gScore[n]) {
        gScore[n] = t;
        came[n] = cur;
        push(t + h(n), n);
      }
    }
  }
  if (!found) return null;
  const raw: [number, number][] = [];
  for (let c = gi; c !== -1 && c !== si; c = came[c]) raw.push([(c % N) - WORLD_HALF, ((c / N) | 0) - WORLD_HALF]);
  raw.reverse();
  if (!collides(map, tx, tz, 0.45)) raw.push([tx, tz]);
  // Smooth: skip ahead to the furthest waypoint with a clear line of sight.
  const out: [number, number][] = [];
  let ax = sx, az = sz, k = 0;
  while (k < raw.length) {
    let far = k;
    for (let m = raw.length - 1; m > k; m--) if (lineClear(map, ax, az, raw[m][0], raw[m][1])) { far = m; break; }
    out.push(raw[far]);
    [ax, az] = raw[far];
    k = far + 1;
  }
  return out;
}

/** Live navigation state for the local player (mutated every frame, not React state). */
export const nav = {
  path: [] as [number, number][],
  /** Place to open when the walk ends. */
  placeId: null as string | null,
  /** Run instead of walk (for long trips and lecture rushes). */
  run: false,
  stuckTime: 0,
};

export function clearNav() {
  nav.path = [];
  nav.placeId = null;
  nav.stuckTime = 0;
}

import { useGame, local } from "../state/store";

/** Walk (or run) the local player to a point, optionally opening a place card on arrival. */
export function navigateTo(x: number, z: number, placeId: string | null = null) {
  const g = useGame.getState();
  if (g.traveling) return;
  const path = findPath(g.map, local.x, local.z, x, z);
  if (!path || !path.length) {
    g.toast("Can't get there from here.", "info");
    return;
  }
  nav.path = path;
  nav.placeId = placeId;
  const total = path.reduce((acc, p, i) => acc + Math.hypot(p[0] - (i ? path[i - 1][0] : local.x), p[1] - (i ? path[i - 1][1] : local.z)), 0);
  nav.run = total > 10;
  nav.stuckTime = 0;
  const end = path[path.length - 1];
  g.set({ navTarget: { x: end[0], z: end[1] }, activePlace: null });
}

/** Walk to a named place on the current map and open its card on arrival. */
export function walkToPlace(placeId: string) {
  const g = useGame.getState();
  const loc = getMap(g.map).locations.find((l) => l.id === placeId);
  if (loc) navigateTo(loc.x, loc.z, placeId);
}
