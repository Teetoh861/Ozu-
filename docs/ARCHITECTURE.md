# Ozu — Architecture

```
 Browser (Vercel CDN)                    Game server (Render / Fly, Docker)          Supabase
 ┌──────────────────────┐   wss://      ┌────────────────────────────────┐         ┌──────────────┐
 │ React UI + R3F scene │ ────────────▶ │ District shards (≤40 players)  │ ──SQL──▶│ Postgres     │
 │ local prediction     │ ◀──────────── │ movement / reward validation   │         │ ozu_players  │
 │ interpolation        │  10 Hz snaps  │ chat filter · rate limits      │         │ ozu_reports  │
 └─────────┬────────────┘               │ reports · bans · admin API     │         └──────────────┘
           │ email magic link (optional)└────────────────────────────────┘         ┌──────────────┐
           └──────────────────────────────────────────────────────────────────────▶│ Supabase Auth│
                                                                                     └──────────────┘
```

## Key decisions

| Decision | Rationale |
|---|---|
| **Custom `ws` server instead of Colyseus** | The PRD lists Colyseus as a candidate. At MVP scale we need room sharding, authoritative validation and reconnection. ~600 lines of code we own covers that, with no framework version lock-in or schema codegen. Colyseus remains an option if matchmaking needs grow. |
| **Shared package for world and rules** | Collision geometry, ranges, rewards, avatar schema and moderation rules come from one source. The client predicts with them and the server enforces them. |
| **Server authority** | The client sends its desired position. The server clamps it to the max speed plus a tolerance, rejects positions inside walls or water, and sends a correction. Discoveries, pickups and greetings are all checked against the *server's* position. Coins and rep are only ever written by the server. |
| **Guest identity** | `g_<uuid>.<hmac>` is issued by the server and stored on the device. It cannot be forged without `GUEST_TOKEN_SECRET`. On a player's first member sign-in, guest progress migrates to the account. |
| **Procedural characters and textures** | No third-party asset licences, a tiny download (~0.5 MB of JS gzipped, no model files), and every option is a real 3D mesh. The `Character` component is the swap point for licensed rigged GLB models later (see the roadmap in the PRD). |
| **Wall-clock day/night** | Every player sees the same sky without network sync. |

## Protocol

JSON messages over WebSocket, defined in `packages/shared/src/protocol.ts`. Client → server: `hello, move, chat, emote, greet, discover, pickup, report, block, equip, ping`. Server → client: `welcome, snap, join, leave, player, chat, emote, greeted, progress, items, challenge, correct, notice, kicked, pong`.

## Limits

| Limit | Value |
|---|---|
| Players per district shard | 40 (`MAX_PLAYERS_PER_DISTRICT`); a new shard opens automatically |
| WebSocket message size | 4 KB |
| Connections per IP | 8 |
| Movement updates | ≤25/s (client sends 10/s) |
| Chat | 5 burst, then 1 per 2 s; 3 violations → 60 s auto-mute |
| Actions (greet/pickup/discover/emote) | 10 burst, 2/s |
| Reports | 3 burst, 1/min |

## Scaling path

A single Node process comfortably serves several hundred concurrent players across shards. Beyond that, run multiple instances behind a sticky load balancer and use Postgres (the file store is single-instance only). Moving shard state to a shared bus such as Redis pub/sub is the next step.
