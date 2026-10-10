import type { MapId } from "./world";

/** Things a player can do at a place. Rewards are validated on the server. */
export type ActionId = "food" | "quiz" | "result" | "chill" | "penalty" | "shot" | "shop" | "dance" | "travel" | "radio";

export interface ActionDef {
  id: ActionId;
  label: string;
  emoji: string;
  hint: string;
}

export const ACTIONS: Record<ActionId, ActionDef> = {
  food: { id: "food", label: "Buy food", emoji: "🍛", hint: "Chop something — your treat." },
  quiz: { id: "quiz", label: "Quick quiz", emoji: "🧠", hint: "3 questions. Coins for every correct answer." },
  result: { id: "result", label: "Check your result", emoji: "📜", hint: "Once a day. Pray first." },
  chill: { id: "chill", label: "Sit and catch vibes", emoji: "🌅", hint: "Relax for a bit and earn rep." },
  penalty: { id: "penalty", label: "Penalty shootout", emoji: "⚽", hint: "5 kicks. Tap at the right time." },
  shot: { id: "shot", label: "Shoot your shot", emoji: "💌", hint: "Send a sweet line to someone nearby." },
  shop: { id: "shop", label: "Buy drip", emoji: "🛍️", hint: "New accessories for your character." },
  dance: { id: "dance", label: "Dance", emoji: "💃", hint: "Show your moves. Rep for good energy." },
  travel: { id: "travel", label: "Take a danfo", emoji: "🚌", hint: "Ride between Ozu District and Unilag." },
  radio: { id: "radio", label: "Tune in to live radio", emoji: "📻", hint: "Listen to real Nigerian stations live." },
};

export interface Place {
  /** Matches a map location id. */
  id: string;
  map: MapId;
  emoji: string;
  /** Building tapped in the 3D world that opens this place. */
  buildingId?: string;
  actions: ActionId[];
}

export const PLACES: Place[] = [
  { id: "plaza", map: "ozu", emoji: "⛲", actions: ["chill", "dance"] },
  { id: "buka", map: "ozu", emoji: "🍲", buildingId: "buka", actions: ["food"] },
  { id: "market", map: "ozu", emoji: "🛍️", buildingId: "market-2", actions: ["shop"] },
  { id: "lounge", map: "ozu", emoji: "🎶", buildingId: "lounge", actions: ["dance"] },
  { id: "park", map: "ozu", emoji: "🚌", buildingId: "park-shed", actions: ["travel"] },
  { id: "lookout", map: "ozu", emoji: "🌊", actions: ["chill"] },
  { id: "u-gate", map: "unilag", emoji: "🚌", buildingId: "u-shuttle", actions: ["travel"] },
  { id: "u-senate", map: "unilag", emoji: "🏛️", buildingId: "u-senate", actions: ["result"] },
  { id: "u-library", map: "unilag", emoji: "📚", buildingId: "u-library", actions: ["quiz"] },
  { id: "u-lagoon", map: "unilag", emoji: "🌅", actions: ["chill"] },
  { id: "u-sports", map: "unilag", emoji: "⚽", buildingId: "u-stands", actions: ["penalty"] },
  { id: "u-garden", map: "unilag", emoji: "💞", actions: ["shot", "chill"] },
  { id: "u-buka", map: "unilag", emoji: "🍛", buildingId: "u-buka", actions: ["food"] },
  { id: "u-auditorium", map: "unilag", emoji: "🎭", buildingId: "u-auditorium", actions: ["dance", "chill"] },
  { id: "u-radio", map: "unilag", emoji: "📻", buildingId: "u-radio", actions: ["radio"] },
];

export function placeFor(id: string) {
  return PLACES.find((p) => p.id === id);
}

export const PLACE_RANGE = 10;
export const GOTO_COOLDOWN_MS = 5000;

// ---------------- Food ----------------

export const FOODS = [
  { id: "jollof", name: "Jollof rice & chicken", emoji: "🍗", price: 15 },
  { id: "amala", name: "Amala, ewedu & gbegiri", emoji: "🥣", price: 12 },
  { id: "suya", name: "Suya", emoji: "🍢", price: 10 },
  { id: "puff", name: "Puff-puff", emoji: "🍩", price: 4 },
  { id: "zobo", name: "Chilled zobo", emoji: "🥤", price: 3 },
  { id: "indomie", name: "Indomie & egg", emoji: "🍜", price: 8 },
] as const;

// ---------------- Quiz ----------------

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
}

export const QUIZ_BANK: QuizQuestion[] = [
  { q: "Unilag's main campus is in which part of Lagos?", options: ["Akoka", "Ikeja", "Lekki", "Ojo"], answer: 0 },
  { q: "What is the capital of Nigeria?", options: ["Lagos", "Abuja", "Ibadan", "Kano"], answer: 1 },
  { q: "Nigeria's currency is the…", options: ["Cedi", "Rand", "Naira", "Shilling"], answer: 2 },
  { q: "In what year did Nigeria gain independence?", options: ["1957", "1960", "1963", "1970"], answer: 1 },
  { q: "Which river joins the Niger at Lokoja?", options: ["Benue", "Ogun", "Osun", "Kaduna"], answer: 0 },
  { q: "The yellow Lagos minibus is called a…", options: ["Keke", "Okada", "Danfo", "Molue"], answer: 2 },
  { q: "Which of these is a Nigerian soup?", options: ["Gumbo", "Egusi", "Borscht", "Ramen"], answer: 1 },
  { q: "What does 'GST' stand for on most Nigerian campuses?", options: ["General Studies", "Government Science Test", "Graduate Skills Training", "General Science Theory"], answer: 0 },
  { q: "Which is the largest city in Nigeria by population?", options: ["Abuja", "Kano", "Lagos", "Port Harcourt"], answer: 2 },
  { q: "The Third Mainland Bridge connects Lagos Island to…", options: ["Lekki", "The mainland", "Badagry", "Ikorodu only"], answer: 1 },
  { q: "What is 15% of 200?", options: ["20", "25", "30", "35"], answer: 2 },
  { q: "Which planet is closest to the Sun?", options: ["Venus", "Mercury", "Earth", "Mars"], answer: 1 },
  { q: "H₂O is the chemical formula for…", options: ["Salt", "Water", "Oxygen", "Sugar"], answer: 1 },
  { q: "Who wrote 'Things Fall Apart'?", options: ["Wole Soyinka", "Chinua Achebe", "Chimamanda Adichie", "Ben Okri"], answer: 1 },
  { q: "Nigeria's first Nobel laureate in Literature is…", options: ["Chinua Achebe", "Wole Soyinka", "Buchi Emecheta", "Femi Osofisan"], answer: 1 },
  { q: "How many states does Nigeria have?", options: ["30", "36", "37", "40"], answer: 1 },
  { q: "Which is NOT a primary colour of light?", options: ["Red", "Green", "Blue", "Yellow"], answer: 3 },
  { q: "If a lecture starts at 8:00 and lasts 2 hours 30 minutes, it ends at…", options: ["10:00", "10:15", "10:30", "11:00"], answer: 2 },
  { q: "The 'Super Eagles' is the nickname of Nigeria's…", options: ["Basketball team", "Men's football team", "Athletics team", "Air force"], answer: 1 },
  { q: "Which language is the most widely spoken in Lagos?", options: ["Hausa", "Igbo", "Yoruba", "Efik"], answer: 2 },
  { q: "What is the square root of 144?", options: ["11", "12", "13", "14"], answer: 1 },
  { q: "CGPA stands for…", options: ["Cumulative Grade Point Average", "Course Grade Point Assessment", "Credit Grade Pass Average", "Common Grade Point Allocation"], answer: 0 },
  { q: "Which gas do plants absorb from the air?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Helium"], answer: 2 },
  { q: "Lagos State's motto is 'Centre of…'", options: ["Excellence", "Commerce", "Unity", "Hope"], answer: 0 },
];

export const QUIZ_LENGTH = 3;
export const QUIZ_COINS_PER_CORRECT = 5;

// ---------------- Result check (just for fun) ----------------

export const RESULTS = [
  { grade: "A", line: "First class energy! Your parents are already telling the whole street." },
  { grade: "A", line: "Distinction! Course rep is asking for your notes." },
  { grade: "B", line: "Solid B. Not bad at all — buka is on you today." },
  { grade: "B", line: "B! One more push and it's an A next semester." },
  { grade: "C", line: "C. We move. At least it's not a carryover." },
  { grade: "C", line: "C — the lecturer says 'see me', but kindly." },
  { grade: "D", line: "D. Still a pass! Library is calling your name." },
  { grade: "E", line: "E… The result is 'awaiting senate approval'. Check back tomorrow." },
] as const;

// ---------------- Shoot your shot ----------------

/** Pre-written, friendly lines only — no free text, so this can't be used to harass. */
export const SHOT_LINES = [
  "Your drip is clean today 🔥",
  "You get the best smile on campus 😊",
  "Abeg, which hall you dey? 👀",
  "Make we go buka together sometime? 🍛",
  "You dey shine like Lagoon Front sunset 🌅",
  "Your energy is a whole vibe ✨",
] as const;

export const CHILL_SECONDS = 8;
