// World layouts — single source of truth shared by client rendering and
// server-side validation. Units are metres; +x east, +z south.

export const WORLD_HALF = 60;
export const PLAYER_RADIUS = 0.4;
export const WALK_SPEED = 2.4;
export const RUN_SPEED = 5.2;
/** Server tolerance on top of RUN_SPEED to absorb jitter between updates. */
export const SPEED_TOLERANCE = 1.6;
export const INTERACT_RANGE = 3.5;
export const DISCOVER_RANGE = 8;
export const PICKUP_RANGE = 2.2;
export const TRANSIT_RANGE = 6;

export type MapId = "ozu" | "unilag";
export const MAP_IDS: MapId[] = ["ozu", "unilag"];

export type BuildingKind = "shop" | "food" | "venue" | "residential" | "office" | "kiosk" | "transport" | "hall" | "faculty" | "tower";

export interface Building {
  id: string;
  kind: BuildingKind;
  /** Centre x/z and world-axis footprint: width along x, depth along z. */
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  sign?: string;
  signColor?: string;
  /** Rotation of the frontage in radians (0 faces +z, π faces −z, π/2 faces +x, −π/2 faces −x). */
  facing: number;
}

export interface Location {
  id: string;
  name: string;
  blurb: string;
  x: number;
  z: number;
}

export interface Box {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface Transit {
  x: number;
  z: number;
  to: MapId;
  label: string;
}

export interface MapDef {
  id: MapId;
  name: string;
  short: string;
  buildings: Building[];
  roads: Box[];
  locations: Location[];
  water: Box[];
  props: { x: number; z: number; r: number }[];
  spawn: { x: number; z: number };
  challenge: { x: number; z: number; r: number; label: string };
  transit: Transit[];
  /** Where players arrive when travelling in from another map. */
  arrival: Partial<Record<MapId, { x: number; z: number }>>;
}

const Q = Math.PI / 2;

// ---------------------------------------------------------------- Ozu district

const OZU: MapDef = {
  id: "ozu",
  name: "Ozu Social District",
  short: "Ozu District",
  locations: [
    { id: "plaza", name: "Ozu Plaza", blurb: "The heart of the district. Meet people, hang out, be seen.", x: 0, z: 0 },
    { id: "buka", name: "Mama Titi's Buka", blurb: "Amala, ewedu and the best gist in the district.", x: -30, z: 16 },
    { id: "market", name: "Balogun Row", blurb: "Fabric, phones, shoes — if it exists, someone here sells it.", x: 30, z: 16 },
    { id: "lounge", name: "Shrine Lounge", blurb: "Afrobeats, highlife and live sets every night.", x: 0, z: 40 },
    { id: "park", name: "Danfo Park", blurb: "Yellow buses, conductors calling routes. Catch a danfo to Unilag here.", x: -38, z: -34 },
    { id: "lookout", name: "Lagoon Lookout", blurb: "Watch the sun set over the water.", x: 42, z: -46 },
  ],
  roads: [
    { x: 0, z: -22, w: 120, d: 10 },
    { x: -50, z: 20, w: 8, d: 74 },
    { x: 50, z: 20, w: 8, d: 74 },
  ],
  buildings: [
    { id: "buka", kind: "food", x: -30, z: 26, w: 12, d: 8, h: 5, color: "#d9c3a0", sign: "MAMA TITI'S BUKA", signColor: "#0e8a5f", facing: Math.PI },
    { id: "suya", kind: "kiosk", x: -18, z: 24, w: 4, d: 4, h: 3, color: "#b5452f", sign: "SUYA SPOT", signColor: "#1b1240", facing: Math.PI },
    { id: "w-res-1", kind: "residential", x: -32, z: 42, w: 14, d: 10, h: 12, color: "#e8dcc8", facing: Math.PI },
    { id: "w-res-2", kind: "residential", x: -16, z: 44, w: 10, d: 10, h: 9, color: "#c9d6c1", facing: Math.PI },
    { id: "market-1", kind: "shop", x: 22, z: 26, w: 8, d: 7, h: 6, color: "#f2e1b9", sign: "ADIRE FABRICS", signColor: "#2a3d8f", facing: Math.PI },
    { id: "market-2", kind: "shop", x: 31, z: 26, w: 8, d: 7, h: 7, color: "#cfe0e8", sign: "OK PHONES & ACC.", signColor: "#c0262d", facing: Math.PI },
    { id: "market-3", kind: "shop", x: 40, z: 26, w: 8, d: 7, h: 6, color: "#ead0d0", sign: "LEKKI KICKS", signColor: "#1b1240", facing: Math.PI },
    { id: "e-office", kind: "office", x: 32, z: 44, w: 18, d: 12, h: 22, color: "#9fb3c2", facing: Math.PI },
    { id: "lounge", kind: "venue", x: 0, z: 50, w: 20, d: 12, h: 8, color: "#2b2140", sign: "SHRINE LOUNGE", signColor: "#ff7a1a", facing: Math.PI },
    { id: "s-shop-1", kind: "shop", x: -20, z: -36, w: 10, d: 8, h: 7, color: "#efe3c8", sign: "MAMA PUT PROVISIONS", signColor: "#0e8a5f", facing: 0 },
    { id: "s-office-1", kind: "office", x: 2, z: -38, w: 14, d: 10, h: 18, color: "#b8c4cc", sign: "OZU TOWER", signColor: "#ff7a1a", facing: 0 },
    { id: "s-res-1", kind: "residential", x: 22, z: -37, w: 12, d: 9, h: 10, color: "#e6cfa8", facing: 0 },
    { id: "park-shed", kind: "transport", x: -40, z: -44, w: 16, d: 5, h: 4, color: "#f6c700", sign: "DANFO PARK", signColor: "#1b1240", facing: 0 },
  ],
  water: [{ x: 36, z: -55.5, w: 48, d: 11 }],
  props: [{ x: 0, z: 0, r: 3.2 }],
  spawn: { x: 0, z: -10 },
  challenge: { x: 0, z: 4, r: 18, label: "Plaza clean-up drive" },
  transit: [{ x: -40, z: -31, to: "unilag", label: "Board the danfo to Unilag (Akoka)" }],
  arrival: { unilag: { x: -36, z: -29 } },
};

// ---------------------------------------------------------------- Unilag (Akoka) campus
// An original, recognisable take on the Akoka campus: main gate and avenue,
// Senate tower, library, faculties, halls of residence, Lagoon Front and the sports centre.

const UNILAG: MapDef = {
  id: "unilag",
  name: "Unilag (Akoka)",
  short: "Unilag",
  locations: [
    { id: "u-gate", name: "Main Gate", blurb: "Welcome to Akoka. Shuttles and danfos stop right here.", x: 0, z: 46 },
    { id: "u-senate", name: "Senate Building", blurb: "The tower you can see from anywhere on campus.", x: -5, z: -12 },
    { id: "u-library", name: "Main Library", blurb: "Quiet floors, loud gist on the steps outside.", x: 5, z: -14 },
    { id: "u-lagoon", name: "Lagoon Front", blurb: "The breeze, the view, the hangout spot.", x: 40, z: -6 },
    { id: "u-sports", name: "Sports Centre", blurb: "Track, pitch and inter-hall competitions.", x: -16, z: -38 },
    { id: "u-garden", name: "Love Garden", blurb: "Shade, benches and long conversations.", x: -16, z: 46 },
    { id: "u-buka", name: "Campus Buka", blurb: "Rice, swallow and cold drinks between lectures.", x: 8, z: 40 },
  ],
  roads: [
    { x: 0, z: 12, w: 9, d: 88 },
    { x: -5, z: -30, w: 100, d: 8 },
  ],
  buildings: [
    { id: "u-senate", kind: "tower", x: -14, z: -12, w: 12, d: 12, h: 44, color: "#d9d2c3", sign: "SENATE BUILDING", signColor: "#7a1f3d", facing: Q },
    { id: "u-library", kind: "faculty", x: 15, z: -14, w: 14, d: 16, h: 13, color: "#c9b79a", sign: "MAIN LIBRARY", signColor: "#2a3d8f", facing: -Q },
    { id: "u-arts", kind: "faculty", x: -16, z: 8, w: 12, d: 10, h: 11, color: "#e3cfb0", sign: "FACULTY OF ARTS", signColor: "#7a1f3d", facing: Q },
    { id: "u-science", kind: "faculty", x: 16, z: 8, w: 14, d: 10, h: 12, color: "#cfd8d0", sign: "FACULTY OF SCIENCE", signColor: "#0e8a5f", facing: -Q },
    { id: "u-engineering", kind: "faculty", x: -16, z: 30, w: 12, d: 10, h: 10, color: "#bcc6cf", sign: "FACULTY OF ENGINEERING", signColor: "#1b1240", facing: Q },
    { id: "u-jaja", kind: "hall", x: -40, z: 30, w: 10, d: 16, h: 15, color: "#e8d9b5", sign: "JAJA HALL", signColor: "#2a3d8f", facing: Q },
    { id: "u-mariere", kind: "hall", x: -40, z: 6, w: 10, d: 16, h: 15, color: "#d8c8e0", sign: "MARIERE HALL", signColor: "#6a2c70", facing: Q },
    { id: "u-kofo", kind: "hall", x: -40, z: -16, w: 10, d: 14, h: 13, color: "#cfe0cf", sign: "KOFO ADEMOLA HALL", signColor: "#0e8a5f", facing: Q },
    { id: "u-moremi", kind: "hall", x: 30, z: 28, w: 10, d: 16, h: 15, color: "#f0d2c8", sign: "MOREMI HALL", signColor: "#c0262d", facing: -Q },
    { id: "u-buka", kind: "food", x: 15, z: 42, w: 7, d: 8, h: 4, color: "#e8c98f", sign: "CAMPUS BUKA", signColor: "#0e8a5f", facing: -Q },
    { id: "u-shuttle", kind: "transport", x: -12, z: 54, w: 12, d: 4, h: 4, color: "#2a3d8f", sign: "SHUTTLE & DANFO", signColor: "#f6c700", facing: Math.PI },
    { id: "u-stands", kind: "venue", x: -16, z: -55, w: 26, d: 4, h: 5, color: "#9aa5a8", facing: Math.PI },
  ],
  water: [{ x: 53, z: 0, w: 14, d: 120 }],
  props: [
    { x: -6.5, z: 51, r: 1.1 },
    { x: 6.5, z: 51, r: 1.1 },
  ],
  spawn: { x: 0, z: 44 },
  challenge: { x: 22, z: -2, r: 10, label: "Lagoon Front clean-up" },
  transit: [{ x: -12, z: 49, to: "ozu", label: "Board the danfo back to Ozu District" }],
  arrival: { ozu: { x: -2, z: 40 } },
};

export const MAPS: Record<MapId, MapDef> = { ozu: OZU, unilag: UNILAG };

export function getMap(id: unknown): MapDef {
  return MAPS[id as MapId] ?? OZU;
}

// ---------------------------------------------------------------- Halls & campus events

export interface Hall {
  id: string;
  name: string;
  color: string;
}

export const HALLS: Hall[] = [
  { id: "jaja", name: "Jaja Hall", color: "#2a3d8f" },
  { id: "moremi", name: "Moremi Hall", color: "#c0262d" },
  { id: "mariere", name: "Mariere Hall", color: "#6a2c70" },
  { id: "kofo", name: "Kofo Ademola Hall", color: "#0e8a5f" },
];

export function hallName(id: string | null | undefined) {
  return HALLS.find((h) => h.id === id)?.name ?? null;
}

/** Lecture venues for the "lecture rush" campus event: a point in front of each faculty. */
export const LECTURE_VENUES = [
  { id: "u-arts", name: "Faculty of Arts", x: -7, z: 8 },
  { id: "u-science", name: "Faculty of Science", x: 7, z: 8 },
  { id: "u-engineering", name: "Faculty of Engineering", x: -7, z: 30 },
  { id: "u-library", name: "Main Library", x: 6, z: -14 },
];
export const LECTURE_RADIUS = 7;
export const LECTURE_SECONDS = 75;
export const LECTURE_INTERVAL_SECONDS = 240;

// ---------------------------------------------------------------- Collision

export function clampToWorld(x: number, z: number): [number, number] {
  const m = WORLD_HALF - 1;
  return [Math.max(-m, Math.min(m, x)), Math.max(-m, Math.min(m, z))];
}

/** True if a circle of radius r at (x,z) overlaps any building, water area or prop on the map. */
export function collides(map: MapDef, x: number, z: number, r = PLAYER_RADIUS): boolean {
  for (const b of map.buildings) {
    const dx = Math.max(Math.abs(x - b.x) - b.w / 2, 0);
    const dz = Math.max(Math.abs(z - b.z) - b.d / 2, 0);
    if (dx * dx + dz * dz < r * r) return true;
  }
  for (const b of map.water) {
    if (Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r) return true;
  }
  for (const p of map.props) {
    const dx = x - p.x, dz = z - p.z;
    if (dx * dx + dz * dz < (p.r + r) ** 2) return true;
  }
  return false;
}

/** Slide movement along obstacles: try full move, then each axis. */
export function resolveMove(map: MapDef, fromX: number, fromZ: number, toX: number, toZ: number): [number, number] {
  const [tx, tz] = clampToWorld(toX, toZ);
  if (!collides(map, tx, tz)) return [tx, tz];
  if (!collides(map, tx, fromZ)) return [tx, fromZ];
  if (!collides(map, fromX, tz)) return [fromX, tz];
  return [fromX, fromZ];
}

export const CHALLENGE_GOAL = 20;
export const CHALLENGE_MAX_ITEMS = 8;
