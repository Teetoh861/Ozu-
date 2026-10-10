import type { MapId } from "./world";

/** Things a player can do at a place. Rewards are validated on the server. */
export type ActionId = "food" | "quiz" | "class" | "result" | "chill" | "penalty" | "shot" | "shop" | "dance" | "travel" | "radio" | "chant";

export interface ActionDef {
  id: ActionId;
  label: string;
  emoji: string;
  hint: string;
}

export const ACTIONS: Record<ActionId, ActionDef> = {
  food: { id: "food", label: "Buy food", emoji: "🍛", hint: "See the menu — and haggle if you dare." },
  quiz: { id: "quiz", label: "Quick quiz", emoji: "🧠", hint: "3 questions. Coins for every correct answer." },
  class: { id: "class", label: "Sit in for class", emoji: "📝", hint: "Surprise test! Coins for every correct answer." },
  result: { id: "result", label: "Check your result", emoji: "📜", hint: "Once a day. Pray first." },
  chill: { id: "chill", label: "Sit and catch vibes", emoji: "🌅", hint: "Relax for a bit and earn rep." },
  penalty: { id: "penalty", label: "Penalty shootout", emoji: "⚽", hint: "5 kicks. Tap at the right time." },
  shot: { id: "shot", label: "Shoot your shot", emoji: "💌", hint: "Send a sweet line to someone nearby." },
  shop: { id: "shop", label: "Buy drip", emoji: "🛍️", hint: "New accessories for your character." },
  dance: { id: "dance", label: "Dance", emoji: "💃", hint: "Show your moves. Rep for good energy." },
  travel: { id: "travel", label: "Take a danfo", emoji: "🚌", hint: "Ride between Ozu District and Unilag." },
  radio: { id: "radio", label: "Tune in to live radio", emoji: "📻", hint: "Listen to real Nigerian stations live." },
  chant: { id: "chant", label: "Hall chant", emoji: "📣", hint: "Rep your hall loud. Points if it's your hall!" },
};

export type PlaceCategory = "food" | "fun" | "study" | "halls" | "shops" | "transport";

export const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  food: "🍛 Food & drinks",
  fun: "🎉 Hangouts & fun",
  study: "📚 Study & campus life",
  halls: "🏠 Halls",
  shops: "🛍️ Shops",
  transport: "🚌 Transport",
};

export interface Place {
  /** Matches a map location id. */
  id: string;
  map: MapId;
  emoji: string;
  category: PlaceCategory;
  /** Buildings that open this place when tapped in the 3D world. */
  buildingIds?: string[];
  actions: ActionId[];
  /** Hall id for hall places (enables the hall chant). */
  hall?: string;
}

export const PLACES: Place[] = [
  // Ozu District
  { id: "plaza", map: "ozu", emoji: "⛲", category: "fun", actions: ["chill", "dance"] },
  { id: "buka", map: "ozu", emoji: "🍲", category: "food", buildingIds: ["buka"], actions: ["food"] },
  { id: "suya", map: "ozu", emoji: "🍢", category: "food", buildingIds: ["suya"], actions: ["food"] },
  { id: "provisions", map: "ozu", emoji: "🥖", category: "food", buildingIds: ["s-shop-1"], actions: ["food"] },
  { id: "market", map: "ozu", emoji: "🛍️", category: "shops", buildingIds: ["market-1", "market-2", "market-3"], actions: ["shop"] },
  { id: "lounge", map: "ozu", emoji: "🎶", category: "fun", buildingIds: ["lounge"], actions: ["dance"] },
  { id: "lookout", map: "ozu", emoji: "🌊", category: "fun", actions: ["chill"] },
  { id: "park", map: "ozu", emoji: "🚌", category: "transport", buildingIds: ["park-shed"], actions: ["travel"] },
  // Unilag
  { id: "u-newhall", map: "unilag", emoji: "🍽️", category: "food", buildingIds: ["u-newhall"], actions: ["food"] },
  { id: "u-complex", map: "unilag", emoji: "🥤", category: "food", buildingIds: ["u-complex"], actions: ["food"] },
  { id: "u-buka", map: "unilag", emoji: "🍛", category: "food", buildingIds: ["u-buka"], actions: ["food"] },
  { id: "u-garden", map: "unilag", emoji: "🍿", category: "fun", actions: ["food", "shot", "chill"] },
  { id: "u-lagoon", map: "unilag", emoji: "🌅", category: "fun", actions: ["chill"] },
  { id: "u-auditorium", map: "unilag", emoji: "🎭", category: "fun", buildingIds: ["u-auditorium"], actions: ["dance", "chill"] },
  { id: "u-sports", map: "unilag", emoji: "⚽", category: "fun", buildingIds: ["u-stands"], actions: ["penalty"] },
  { id: "u-radio", map: "unilag", emoji: "📻", category: "fun", buildingIds: ["u-radio"], actions: ["radio"] },
  { id: "u-library", map: "unilag", emoji: "📚", category: "study", buildingIds: ["u-library"], actions: ["quiz"] },
  { id: "u-arts", map: "unilag", emoji: "🎨", category: "study", buildingIds: ["u-arts"], actions: ["class"] },
  { id: "u-science", map: "unilag", emoji: "🔬", category: "study", buildingIds: ["u-science"], actions: ["class"] },
  { id: "u-engineering", map: "unilag", emoji: "⚙️", category: "study", buildingIds: ["u-engineering"], actions: ["class"] },
  { id: "u-senate", map: "unilag", emoji: "🏛️", category: "study", buildingIds: ["u-senate"], actions: ["result"] },
  { id: "u-jaja", map: "unilag", emoji: "💙", category: "halls", buildingIds: ["u-jaja"], actions: ["chant", "chill"], hall: "jaja" },
  { id: "u-moremi", map: "unilag", emoji: "👑", category: "halls", buildingIds: ["u-moremi"], actions: ["chant", "chill"], hall: "moremi" },
  { id: "u-mariere", map: "unilag", emoji: "💜", category: "halls", buildingIds: ["u-mariere"], actions: ["chant"], hall: "mariere" },
  { id: "u-kofo", map: "unilag", emoji: "💚", category: "halls", buildingIds: ["u-kofo"], actions: ["chant"], hall: "kofo" },
  { id: "u-eni-njoku", map: "unilag", emoji: "🧡", category: "halls", buildingIds: ["u-eni-njoku"], actions: ["chant"], hall: "eni-njoku" },
  { id: "u-fagunwa", map: "unilag", emoji: "❤️", category: "halls", buildingIds: ["u-fagunwa"], actions: ["chant"], hall: "fagunwa" },
  { id: "u-gate", map: "unilag", emoji: "🚌", category: "transport", buildingIds: ["u-shuttle"], actions: ["travel"] },
];

export function placeFor(id: string) {
  return PLACES.find((p) => p.id === id);
}

export const PLACE_RANGE = 10;
export const GOTO_COOLDOWN_MS = 5000;

// ---------------- Vendors & menus ----------------

export interface MenuItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
}

export interface Vendor {
  id: string;
  name: string;
  greeting: string;
  items: MenuItem[];
  /** Replies when you haggle: a deal, extra jara, or a funny no. */
  replies: { deal: string; jara: string; no: string };
}

const STD = {
  deal: "Ehen! Because you be my person, I don reduce am small. 🤝",
  jara: "Ok o, I don add jara for you. Enjoy! 😄",
  no: "Ahn ahn! Price don already reduce reach ground. No vex. 😂",
};

export const VENDORS: Record<string, Vendor[]> = {
  buka: [{
    id: "mama-titi", name: "Mama Titi", greeting: "My pikin, wetin you go chop today?",
    items: [
      { id: "amala", name: "Amala, ewedu & gbegiri", emoji: "🥣", price: 12 },
      { id: "jollof", name: "Jollof rice & chicken", emoji: "🍗", price: 15 },
      { id: "ofada", name: "Ofada rice & ayamase", emoji: "🌶️", price: 14 },
      { id: "zobo", name: "Chilled zobo", emoji: "🥤", price: 3 },
    ],
    replies: { deal: "Because say you greet me well, I go remove small. 🤝", jara: "I don add extra meat — no tell anybody o! 🤫", no: "My pikin, gas price don go up. I no fit. 😩" },
  }],
  suya: [{
    id: "mallam", name: "Mallam's Suya", greeting: "Oga/Madam, how many sticks? Fresh one dey!",
    items: [
      { id: "beef-suya", name: "Beef suya (plenty pepper)", emoji: "🍢", price: 10 },
      { id: "ram-suya", name: "Ram suya", emoji: "🐏", price: 14 },
      { id: "kilishi", name: "Kilishi", emoji: "🥩", price: 8 },
      { id: "kidney", name: "Kidney & liver mix", emoji: "🔥", price: 9 },
    ],
    replies: { deal: "Ok, I go round am off for you. Na only you I dey do am for! 😅", jara: "I don add fat and onions. Correct suya! 🔥", no: "Fat no dey free o, my brother. Cow no be my papa own! 😂" },
  }],
  provisions: [{
    id: "mama-put", name: "Mama Put Provisions", greeting: "Welcome! Bread, beans, snacks — everything dey.",
    items: [
      { id: "agege-ewa", name: "Agege bread & ewa agoyin", emoji: "🥖", price: 9 },
      { id: "sausage-malt", name: "Sausage roll & malt drink", emoji: "🥤", price: 6 },
      { id: "puff", name: "Puff-puff", emoji: "🍩", price: 4 },
      { id: "chinchin", name: "Chin-chin", emoji: "🍪", price: 3 },
    ],
    replies: STD,
  }],
  "u-buka": [{
    id: "campus-buka", name: "Campus Buka", greeting: "Quick quick, lecture dey wait you! Wetin you want?",
    items: [
      { id: "jollof", name: "Jollof rice & chicken", emoji: "🍗", price: 15 },
      { id: "rice-beans", name: "Rice & beans with plantain", emoji: "🍛", price: 10 },
      { id: "egusi", name: "Eba & egusi", emoji: "🥘", price: 11 },
      { id: "indomie", name: "Indomie & egg", emoji: "🍜", price: 8 },
      { id: "zobo", name: "Chilled zobo", emoji: "🥤", price: 3 },
    ],
    replies: { deal: "Student discount activated! Na because of you o. 🎓", jara: "I don add extra plantain for my scholar! 🍌", no: "Abeg, na student price be this already! 😂" },
  }],
  "u-newhall": [
    {
      id: "ijay", name: "IJAY's Bistro", greeting: "Welcome to IJAY's! Wetin we dey run today?",
      items: [
        { id: "shawarma", name: "Chicken shawarma", emoji: "🌯", price: 16 },
        { id: "fried-rice", name: "Fried rice & chicken", emoji: "🍗", price: 15 },
        { id: "small-chops", name: "Small chops platter", emoji: "🍢", price: 12 },
      ],
      replies: { deal: "Because you be regular, I don apply discount. 🤝", jara: "I don add extra chicken! You go thank me later. 😄", no: "Shawarma no dey do discount, boss! 😂" },
    },
    {
      id: "mara", name: "Mara's Pepper Soup", greeting: "Hot pepper soup dey! E go clear your head before exam.",
      items: [
        { id: "goat-pepper", name: "Goat meat pepper soup", emoji: "🍲", price: 14 },
        { id: "catfish-pepper", name: "Catfish pepper soup", emoji: "🐟", price: 16 },
        { id: "chicken-pepper", name: "Chicken pepper soup", emoji: "🍗", price: 13 },
      ],
      replies: { deal: "Ok, I go reduce am small for you. E sweet? 😋", jara: "I don add extra meat inside — e go burst your head! 🌶️", no: "Fish price don double this week. I no fit. 🐟😩" },
    },
  ],
  "u-complex": [
    {
      id: "grill", name: "2001 Complex Grill", greeting: "Asun and chicken just comot for fire!",
      items: [
        { id: "asun", name: "Asun (spicy goat)", emoji: "🔥", price: 14 },
        { id: "chicken-chips", name: "Chicken & chips", emoji: "🍟", price: 15 },
        { id: "noodles", name: "Stir-fry noodles", emoji: "🍜", price: 10 },
      ],
      replies: STD,
    },
    {
      id: "drinks", name: "Cold Drinks Stand", greeting: "Everything chilled! Which one you want?",
      items: [
        { id: "soda", name: "Chilled soft drink", emoji: "🥤", price: 3 },
        { id: "chapman", name: "Chapman", emoji: "🍹", price: 6 },
        { id: "zobo", name: "Zobo", emoji: "🧃", price: 3 },
        { id: "parfait", name: "Yoghurt parfait", emoji: "🍨", price: 8 },
      ],
      replies: STD,
    },
  ],
  "u-garden": [{
    id: "popcorn", name: "Love Garden Popcorn", greeting: "Fresh milky popcorn! Buy for your crush. 🍿💕",
    items: [
      { id: "milky-small", name: "Milky popcorn (small)", emoji: "🍿", price: 3 },
      { id: "milky-big", name: "Milky popcorn (big — share am)", emoji: "🍿", price: 6 },
      { id: "caramel", name: "Caramel popcorn", emoji: "🍯", price: 5 },
    ],
    replies: { deal: "Na for your crush? Ok, I go reduce am. Go and shoot! 💘", jara: "I don fill am well well, make una share! 🍿", no: "Popcorn price no dey reduce like your crush reply! 😂" },
  }],
};

export function findMenuItem(placeId: string, vendorId: unknown, itemId: unknown) {
  const vendor = VENDORS[placeId]?.find((v) => v.id === vendorId);
  const item = vendor?.items.find((i) => i.id === itemId);
  return vendor && item ? { vendor, item } : null;
}

/** Lagos-style haggling lines. Outcomes are decided on the server. */
export const HAGGLE_LINES = [
  { id: "fat", text: "Abeg add fat for me 🙏" },
  { id: "round", text: "Round it off for me na, I be your regular customer" },
  { id: "jara", text: "Add jara joor! 😄" },
] as const;

// ---------------- Hall chants & quick chat ----------------

export const HALL_CHANTS: Record<string, string> = {
  jaja: "JAJA! JAJA! King Jaja to the world — best hall, no debate! 💙",
  moremi: "MOREMI! Home of queens — self-acclaimed best hall since forever! 👑",
  mariere: "MARIERE! Mariere boys no dey carry last! 💜",
  kofo: "KOFO! Kofo Ademola dey shine everyday! 💚",
  "eni-njoku": "ENI NJOKU! Eni Njoku for life! 🧡",
  fagunwa: "FAGUNWA! Fagunwa queens on top! ❤️",
};

/** One-tap chat phrases (sent through the normal moderated chat). */
export const QUICK_CHAT = [
  "How far? 👋",
  "Aluta continua! ✊",
  "Victoria ascerta! 🙌",
  "E choke! 🔥",
  "Wetin dey happen? 👀",
  "Abeg who get notes for GST? 📚",
  "Make we go buka 🍛",
  "Jaja to the world 💙",
  "Moremi run things 👑",
  "No wahala 😎",
];

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
