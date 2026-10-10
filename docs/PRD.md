# Ozu — Product Requirements (v1.1)

**Status:** MVP implemented · **Market:** Lagos, Nigeria · **Platform:** web (desktop, tablet, mobile) · **Product owner:** to be confirmed

> v1.1 keeps the v1.0 vision, scope and Definition of Done. It adds the decisions, measurable targets and gap resolutions made during the build, plus a traceability matrix against the Definition of Done.

## 1. Vision and promise
A virtual Lagos where people meet, explore, express themselves and experience Nigerian city life together. *Your city. Your people. Your story.*

## 2. Decisions added in v1.1 (resolving v1.0 gaps)

| v1.0 gap | v1.1 decision |
|---|---|
| No numeric performance targets | See §4. Low-quality mode is auto-selected on touch devices and low-core CPUs. |
| Guest vs. safety | Guests get a server-signed device identity, so they can still be blocked, reported and banned. When member accounts are enabled, guest chat is **off by default** (`GUEST_CHAT`). Guest progress migrates to the account on first sign-in. |
| "Moderated chat" undefined | Three layers: (1) an automatic filter covering English plus Pidgin, Yoruba and Igbo insults, with leetspeak and letter-spacing normalisation; (2) rate limits with auto-mute; (3) player reports carrying the last 10 messages as evidence, reviewed through the admin API. Proposed review service levels are in the Runbook. |
| Auth ↔ game server integration | The server verifies Supabase JWTs (JWKS, or an HS256 secret) on handshake. Identity can never be asserted by the client. |
| Capacity | 40 players per district shard; extra shards open automatically. |
| Age | **v0.2: 16+.** Self-declared age group on entry (16–17 or 18+); under-16s are refused. Under-18 safeguards: reports involving them are high priority. For everyone: phone numbers, links and @handles are masked in chat. Future features with direct messages, nightlife, or money spraying must exclude under-18s. *Open item:* age self-attestation is not verification. Review this with legal counsel before marketing to schools. |
| Data protection (NDPA 2023) | Data is minimised: display name, avatar, progress, block list and reports. No location data, and no email stored by the game server. Chat evidence is kept only with reports. *Open item:* privacy notice, retention schedule and a data-subject request process. |
| NPCs | Ambient pedestrians and 4 named locals are client-side decoration, and are clearly not players (green name tags). |
| Real-money | None. Coins have no monetary value; this is stated in the UI and the guidelines. |

## 3. MVP scope (delivered)
District with 6 named locations · character creation (body, skin, hair, outfit, colourway) · rigged and animated characters · walk/run · shared multiplayer district · name tags and proximity greeting · moderated text chat · 3 activities (Meet & greet, Explore, Community clean-up) · persistent coins and rep · 3 cosmetic unlocks · report/block/mute · cloud deployment configuration · monitoring endpoints and runbook.

**Out of scope (unchanged):** full Lagos, vehicles, property, voice, user-generated content, real-money transactions, app-store releases.

## 4. Targets (to validate in the controlled public test)

| Metric | Target |
|---|---|
| First load (gzipped JS) | ≤ 0.6 MB, with no model downloads (current: ~0.45 MB) |
| Time to first movement (4G, mid-range Android) | ≤ 15 s |
| Frame rate | ≥ 30 fps (low mode, mid-range phone) · ≥ 55 fps (high mode, laptop with an integrated GPU from 2020 or later) |
| Time to first social interaction | ≤ 3 min median |
| Activity completion (≥ 1 per session) | ≥ 60 % |
| D1 / D7 return | ≥ 25 % / ≥ 10 % |
| Crash-free sessions | ≥ 99 % |
| Multiplayer handshake failures | < 2 % |
| Report review service level | Severe ≤ 4 h · other ≤ 48 h |

## 5. Definition of Done — traceability

| # | Requirement | Status |
|---|---|---|
| 1 | Open the public URL | ✅ Vercel |
| 2 | Account or guest session | ✅ Guest built in; email sign-in when Supabase is configured |
| 3 | Create a character | ✅ |
| 4 | Load the 3D district | ✅ |
| 5 | Move smoothly | ✅ Keyboard, mouse and touch joystick |
| 6 | See and interact with real players | ✅ Requires the game server to be deployed |
| 7 | Complete an activity | ✅ ×3 |
| 8 | Earn a validated reward | ✅ Server-validated |
| 9 | Leave and return without losing progress | ✅ Postgres or file store |
| 10 | Report or block another player | ✅ |
| 11 | Mobile and desktop browsers | ✅ Responsive and touch-ready; needs real-device QA |

## 6. Risks and next steps
1. **Visual realism.** The MVP uses stylised procedural characters and environment, chosen for licence safety, download size and speed. The path to the "realistic" target in v1.0 is commissioned or licensed rigged GLB characters (with authentic African facial features and hair) and building kits, loaded through the existing `Character` and `District` components with LODs and KTX2 textures. This is the largest budget item. Start art direction now.
2. **Moderation staffing.** Tooling exists, but someone must own the queue before the public test.
3. **Scale.** A single server instance is enough for the controlled test. Multi-instance scaling needs Postgres and a shared bus.
4. **Next features (by value):** friends list → events calendar at Shrine Lounge → food discovery at the buka → dance challenge → second neighbourhood.

## 7. v0.2 — Unilag campus (delivered)
- Second district: an original, recognisable take on the Akoka campus, reached by danfo. No official crests or logos are used.
- Hall affiliation and a live hall leaderboard, with campus earnings counting as hall points.
- Lecture rush: a recurring, server-run campus event that rewards players who reach the venue in time.
- Verified-student badge for Unilag email sign-ins. This activates when Supabase accounts are configured.
- 16+ age policy with under-18 safeguards.

**Next candidates:** Whot & Ludo tables (hall common rooms, buka); owambe and nightlife events (18+ only); hustle jobs; inter-hall sports day at the Sports Centre; departmental quiz battles.
