# Ozu

**Your city. Your people. Your story.**

Ozu is a multiplayer, Lagos-inspired social-life simulation that runs in the browser. Players create a character, explore the Ozu Social District, meet other real players, take part in community activities, and build a reputation that persists between sessions.

| | |
|---|---|
| **Client** | React 19 · TypeScript · Three.js via React Three Fiber · Vite |
| **Game server** | Node 22 · TypeScript · authoritative WebSocket server (`ws`) |
| **Persistence** | PostgreSQL (Supabase), or a JSON file for local/single-instance use |
| **Accounts** | Device-bound guest identity (HMAC-signed) + optional Supabase email sign-in |
| **Hosting** | Web → Vercel · Game server → Render or Fly.io (Docker) · DB/Auth → Supabase |

## What's in the MVP

- **District**: plaza with the Ozu ring sculpture, Mama Titi's Buka, Balogun Row shops, Shrine Lounge, Danfo Park, and Lagoon Lookout. Also yellow-and-black kerbs, danfo buses and traffic, palms, roadside sellers, a day/night cycle with lit windows and streetlights, ambient pedestrians, and a distant skyline.
- **Characters**: rigged procedural humans with 2 body types, 6 skin tones, 6 hairstyles (including gele, braids and locs), 5 outfits (ankara, agbada, kaftan, streetwear, office) and 5 colourways. Walk, run, idle, wave, dance and clap animations.
- **Multiplayer**: shared district with server-authoritative movement (speed and collision checks), interpolation, name tags, chat bubbles, and automatic sharding at 40 players per district.
- **Activities** (all validated on the server):
  1. **Meet & greet**: approach a player and greet them. Both players are rewarded, once per pair per day, capped at 20 per day.
  2. **Explore**: discover the 6 named places, with a bonus for completing all of them.
  3. **Community clean-up**: a shared district goal of 20 litter bags. Every contributor earns a bonus when the goal is reached.
- **Progression**: coins (no real-world value), reputation, and 3 cosmetics that unlock by rep (Lekki Shades, Aso-oke Cap, Owambe Gold Chain). All of it persists.
- **Safety**: 16+ age gate and guidelines acceptance; report (with chat evidence), block, and mute; display-name and chat filtering (English, Pidgin, Yoruba and Igbo terms); rate limits with auto-mute; admin review, ban, and announcement API.
- **Access**: keyboard, mouse, and touch (virtual joystick), adjustable camera, low/high graphics modes, captions for audio cues, reduced-motion support.

## Unilag (Akoka) campus — v0.2

- **Second district**: board the danfo at Danfo Park (or the Main Gate stop on campus) to travel between Ozu District and an original, recognisable take on the Akoka campus. It includes the Main Gate, Senate Building, Main Library, the Faculties of Arts, Science and Engineering, Jaja, Mariere, Kofo Ademola and Moremi halls, Lagoon Front, the Sports Centre, Love Garden and a campus buka.
- **Hall rivalry**: players pick a hall (the choice can change once every 30 days). Everything earned on campus adds points to that hall, shown on a live leaderboard.
- **Lecture rush**: every 4 minutes a lecture is announced at a random faculty. Players who reach the venue before the 75-second bell earn coins, rep and hall points.
- **Verified students**: members who sign in with a `@live.unilag.edu.ng` or `@unilag.edu.ng` email get a 🎓 badge. This needs Supabase accounts to be enabled.
- **Age policy 16+**: players choose an age group on entry, and under-16s are turned away. For under-18s, any report involving them is marked high priority and sorted to the top of the moderation queue. For everyone, phone numbers, links and @handles are hidden in chat.

## Run locally

```bash
npm install
npm run dev          # server on :2567, web on :5173
npm test             # server + rules tests
npm run typecheck
npm run build
```

Open http://localhost:5173. To test multiplayer, open a second browser window (or a private window, so it gets a separate guest identity).

Add `?hour=13` to the URL to pin the time of day, which is useful for QA and screenshots.

## Deploy

See [docs/RUNBOOK.md](docs/RUNBOOK.md). In short:

1. **Game server**: deploy `render.yaml` (Render Blueprint) or `fly.toml`. Set `GUEST_TOKEN_SECRET`, `ADMIN_TOKEN`, `ALLOWED_ORIGINS` and (recommended) `DATABASE_URL`.
2. **Database**: run `supabase/migrations/0001_init.sql` in Supabase.
3. **Web**: deploy the Vercel project with root directory `apps/web`, and set `VITE_SERVER_URL=wss://<your-server-host>`.

## Repository layout

```
apps/web        Browser client (React Three Fiber)
apps/server     Authoritative game server + admin API
packages/shared World layout, protocol, avatar schema, moderation rules (used by both)
supabase/       Database migrations
docs/           PRD, architecture, runbook, community guidelines
```
