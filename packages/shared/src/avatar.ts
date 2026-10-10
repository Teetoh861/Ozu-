export const SKIN_TONES = ["#3b2219", "#4f2d1f", "#6b3e26", "#8a5537", "#a86b45", "#c48a5c"] as const;
export const BODIES = ["masc", "fem"] as const;
export const HAIRSTYLES = ["lowcut", "afro", "braids", "locs", "gele", "bald"] as const;
export const OUTFITS = ["ankara", "agbada", "streetwear", "kaftan", "office"] as const;

export type Body = (typeof BODIES)[number];
export type Hair = (typeof HAIRSTYLES)[number];
export type Outfit = (typeof OUTFITS)[number];

export interface Avatar {
  body: Body;
  skin: number;
  hair: Hair;
  outfit: Outfit;
  /** Palette index for outfit colourway. */
  palette: number;
}

export const OUTFIT_LABELS: Record<Outfit, string> = {
  ankara: "Ankara set",
  agbada: "Agbada",
  streetwear: "Lagos streetwear",
  kaftan: "Kaftan",
  office: "Office smart",
};

export const HAIR_LABELS: Record<Hair, string> = {
  lowcut: "Low cut",
  afro: "Afro",
  braids: "Braids",
  locs: "Locs",
  gele: "Gele",
  bald: "Clean shave",
};

export const OUTFIT_PALETTES = [
  ["#0e8a5f", "#f6c700", "#1b1240"],
  ["#c0262d", "#ffb703", "#2a3d8f"],
  ["#2a3d8f", "#ff7a1a", "#f4efe6"],
  ["#6a2c70", "#f6c700", "#0e8a5f"],
  ["#1b1240", "#ff7a1a", "#e8dcc8"],
] as const;

export interface Cosmetic {
  id: string;
  name: string;
  description: string;
  /** Unlocked automatically at this rep (0 = not a rep reward). */
  repRequired: number;
  /** Coin price in the Balogun Row shop (0 = not for sale). */
  price: number;
}

export const COSMETICS: Cosmetic[] = [
  { id: "shades", name: "Lekki Shades", description: "Dark shades for bright Lagos days.", repRequired: 20, price: 0 },
  { id: "aso-oke-cap", name: "Aso-oke Cap", description: "Hand-woven fila. Instant respect.", repRequired: 50, price: 0 },
  { id: "gold-chain", name: "Owambe Gold Chain", description: "For when the party is serious.", repRequired: 100, price: 0 },
  { id: "headphones", name: "Akoka Headphones", description: "Afrobeats on repeat, world on mute.", repRequired: 0, price: 40 },
  { id: "bucket-hat", name: "Bucket Hat", description: "Lagoon Front approved.", repRequired: 0, price: 60 },
  { id: "eagles-scarf", name: "Super Eagles Scarf", description: "Green-white-green, match day ready.", repRequired: 0, price: 80 },
];

export const DEFAULT_AVATAR: Avatar = { body: "masc", skin: 2, hair: "lowcut", outfit: "ankara", palette: 0 };

export function sanitizeAvatar(input: unknown): Avatar {
  const a = (input ?? {}) as Partial<Avatar>;
  const intIn = (v: unknown, max: number, d: number) =>
    Number.isInteger(v) && (v as number) >= 0 && (v as number) < max ? (v as number) : d;
  return {
    body: BODIES.includes(a.body as Body) ? (a.body as Body) : DEFAULT_AVATAR.body,
    skin: intIn(a.skin, SKIN_TONES.length, DEFAULT_AVATAR.skin),
    hair: HAIRSTYLES.includes(a.hair as Hair) ? (a.hair as Hair) : DEFAULT_AVATAR.hair,
    outfit: OUTFITS.includes(a.outfit as Outfit) ? (a.outfit as Outfit) : DEFAULT_AVATAR.outfit,
    palette: intIn(a.palette, OUTFIT_PALETTES.length, DEFAULT_AVATAR.palette),
  };
}
