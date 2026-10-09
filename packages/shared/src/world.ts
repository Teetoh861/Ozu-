// Ozu Social District — single source of truth for layout, shared by client
// rendering and server-side validation. Units are metres; +x east, +z south.

export const WORLD_HALF = 60;
export const PLAYER_RADIUS = 0.4;
export const WALK_SPEED = 2.4;
export const RUN_SPEED = 5.2;
/** Server tolerance on top of RUN_SPEED to absorb jitter between updates. */
export const SPEED_TOLERANCE = 1.6;
export const INTERACT_RANGE = 3.5;
export const DISCOVER_RANGE = 8;
export const PICKUP_RANGE = 2.2;

export type BuildingKind = "shop" | "food" | "venue" | "residential" | "office" | "kiosk" | "transport";

export interface Building {
  id: string;
  kind: BuildingKind;
  /** Centre x/z, footprint width (x) and depth (z), height. */
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  sign?: string;
  signColor?: string;
  /** Which side faces the street: rotation of the frontage in radians. */
  facing: number;
}

export interface Location {
  id: string;
  name: string;
  blurb: string;
  x: number;
  z: number;
}

export const LOCATIONS: Location[] = [
  { id: "plaza", name: "Ozu Plaza", blurb: "The heart of the district. Meet people, hang out, be seen.", x: 0, z: 0 },
  { id: "buka", name: "Mama Titi's Buka", blurb: "Amala, ewedu and the best gist in the district.", x: -30, z: 16 },
  { id: "market", name: "Balogun Row", blurb: "Fabric, phones, shoes — if it exists, someone here sells it.", x: 30, z: 16 },
  { id: "lounge", name: "Shrine Lounge", blurb: "Afrobeats, highlife and live sets every night.", x: 0, z: 40 },
  { id: "park", name: "Danfo Park", blurb: "Yellow buses, conductors calling routes, constant motion.", x: -38, z: -34 },
  { id: "lookout", name: "Lagoon Lookout", blurb: "Watch the sun set over the water.", x: 42, z: -46 },
];

// Main road runs east–west at z = -22; a cross street runs north–south at x = 0 (north of the road).
export const ROADS = [
  { x: 0, z: -22, w: 120, d: 10 },
  { x: -50, z: 20, w: 8, d: 74 },
  { x: 50, z: 20, w: 8, d: 74 },
];

export const BUILDINGS: Building[] = [
  // Food row (west of plaza)
  { id: "buka", kind: "food", x: -30, z: 26, w: 12, d: 8, h: 5, color: "#d9c3a0", sign: "MAMA TITI'S BUKA", signColor: "#0e8a5f", facing: Math.PI },
  { id: "suya", kind: "kiosk", x: -18, z: 24, w: 4, d: 4, h: 3, color: "#b5452f", sign: "SUYA SPOT", signColor: "#1b1240", facing: Math.PI },
  { id: "w-res-1", kind: "residential", x: -32, z: 42, w: 14, d: 10, h: 12, color: "#e8dcc8", facing: Math.PI },
  { id: "w-res-2", kind: "residential", x: -16, z: 44, w: 10, d: 10, h: 9, color: "#c9d6c1", facing: Math.PI },

  // Retail row (east of plaza)
  { id: "market-1", kind: "shop", x: 22, z: 26, w: 8, d: 7, h: 6, color: "#f2e1b9", sign: "ADIRE FABRICS", signColor: "#2a3d8f", facing: Math.PI },
  { id: "market-2", kind: "shop", x: 31, z: 26, w: 8, d: 7, h: 7, color: "#cfe0e8", sign: "OK PHONES & ACC.", signColor: "#c0262d", facing: Math.PI },
  { id: "market-3", kind: "shop", x: 40, z: 26, w: 8, d: 7, h: 6, color: "#ead0d0", sign: "LEKKI KICKS", signColor: "#1b1240", facing: Math.PI },
  { id: "e-office", kind: "office", x: 32, z: 44, w: 18, d: 12, h: 22, color: "#9fb3c2", facing: Math.PI },

  // Music venue (north end of cross street)
  { id: "lounge", kind: "venue", x: 0, z: 50, w: 20, d: 12, h: 8, color: "#2b2140", sign: "SHRINE LOUNGE", signColor: "#ff7a1a", facing: Math.PI },

  // South side of main road
  { id: "s-shop-1", kind: "shop", x: -20, z: -36, w: 10, d: 8, h: 7, color: "#efe3c8", sign: "MAMA PUT PROVISIONS", signColor: "#0e8a5f", facing: 0 },
  { id: "s-office-1", kind: "office", x: 2, z: -38, w: 14, d: 10, h: 18, color: "#b8c4cc", sign: "OZU TOWER", signColor: "#ff7a1a", facing: 0 },
  { id: "s-res-1", kind: "residential", x: 22, z: -37, w: 12, d: 9, h: 10, color: "#e6cfa8", facing: 0 },
  { id: "park-shed", kind: "transport", x: -40, z: -44, w: 16, d: 5, h: 4, color: "#f6c700", sign: "DANFO PARK", signColor: "#1b1240", facing: 0 },
];

/** Non-building no-go areas (the lagoon), as axis-aligned boxes. */
export const WATER = { x: 36, z: -55.5, w: 48, d: 11 };
export const BLOCKERS = [WATER];

/** Static collidable props (benches, fountain) as circles. */
export const PROPS_COLLIDERS = [{ x: 0, z: 0, r: 3.2 }];

export const CHALLENGE_ZONE = { x: 0, z: 4, r: 18 };
export const CHALLENGE_GOAL = 20;
export const CHALLENGE_MAX_ITEMS = 8;

export function clampToWorld(x: number, z: number): [number, number] {
  const m = WORLD_HALF - 1;
  return [Math.max(-m, Math.min(m, x)), Math.max(-m, Math.min(m, z))];
}

/** True if a circle of radius r at (x,z) overlaps any building footprint or prop. */
export function collides(x: number, z: number, r = PLAYER_RADIUS): boolean {
  for (const b of BUILDINGS) {
    const dx = Math.max(Math.abs(x - b.x) - b.w / 2, 0);
    const dz = Math.max(Math.abs(z - b.z) - b.d / 2, 0);
    if (dx * dx + dz * dz < r * r) return true;
  }
  for (const b of BLOCKERS) {
    if (Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r) return true;
  }
  for (const p of PROPS_COLLIDERS) {
    const dx = x - p.x, dz = z - p.z;
    if (dx * dx + dz * dz < (p.r + r) ** 2) return true;
  }
  return false;
}

/** Slide movement along obstacles: try full move, then each axis. */
export function resolveMove(fromX: number, fromZ: number, toX: number, toZ: number): [number, number] {
  let [tx, tz] = clampToWorld(toX, toZ);
  if (!collides(tx, tz)) return [tx, tz];
  if (!collides(tx, fromZ)) return [tx, fromZ];
  if (!collides(fromX, tz)) return [fromX, tz];
  return [fromX, fromZ];
}

export const SPAWN = { x: 0, z: -10 };
