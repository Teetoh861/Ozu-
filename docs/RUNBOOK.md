# Ozu — Operations Runbook

## 1. Environments and secrets

| Component | Where | Required settings |
|---|---|---|
| Web client | Vercel project `ozu`, root `apps/web` | `VITE_SERVER_URL` (wss URL of the game server); optional `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Game server | Render (`render.yaml`) or Fly (`fly.toml`) | `NODE_ENV=production`, `GUEST_TOKEN_SECRET` (≥32 chars), `ADMIN_TOKEN` (≥24 chars), `ALLOWED_ORIGINS` (the web URL), `DATABASE_URL` (recommended), `SUPABASE_URL` (for accounts) |
| Database | Supabase | Run `supabase/migrations/0001_init.sql` |

The server **refuses to start** in production with missing or weak secrets. Never put `DATABASE_URL`, `ADMIN_TOKEN` or `GUEST_TOKEN_SECRET` in the web project. Anything prefixed `VITE_` is public.

Rotating `GUEST_TOKEN_SECRET` invalidates every guest identity, which resets guest progress. Rotate it only after a compromise.

## 2. First deployment

1. **Database**: in Supabase, open the SQL editor and run `0001_init.sql`. Copy the pooled connection string (port 6543) into the server's `DATABASE_URL`.
2. **Game server (Render)**: New → Blueprint → select this repo. Render generates `GUEST_TOKEN_SECRET` and `ADMIN_TOKEN`. Set `ALLOWED_ORIGINS` to the production web URL and fill in `DATABASE_URL`. Wait for `/health` to return `{"ok":true}`.
3. **Web (Vercel)**: set `VITE_SERVER_URL=wss://<server-host>` and redeploy.
4. **Accounts (optional)**: in Supabase Auth, enable Email, add the web URL to the redirect URLs, then set `SUPABASE_URL` on the server and `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` on the web project.
5. **Smoke test**: open the site in two browsers. Confirm both players see each other, greeting rewards both, chat delivers, a report appears in `/admin/reports`, and progress survives a reload.

## 3. Monitoring

- `GET /health`: liveness (wired to Render/Fly health checks).
- `GET /metrics`: online players, players per shard, handshake failures, memory.
- Logs are JSON lines. Key events: `player_join`, `player_leave`, `movement_rejected`, `chat_auto_mute`, `player_reported`, `player_banned`, `admin_auth_failed`, `persist_failed`, `handshake_failed`.
- Alert on: health check failures, any `persist_failed`, a spike in `handshake_failed`, or `admin_auth_failed` bursts.
- Vercel Web Analytics (optional) for page-level metrics.

## 4. Moderation procedure

All admin calls need `Authorization: Bearer $ADMIN_TOKEN`.

```bash
S=https://<server-host>; H="Authorization: Bearer $ADMIN_TOKEN"
curl -H "$H" "$S/admin/reports?status=open"                         # review queue (includes chat evidence)
curl -H "$H" -X POST "$S/admin/reports/<id>/resolve" -d '{"status":"actioned","resolution":"Banned for hate speech"}'
curl -H "$H" -X POST "$S/admin/ban"   -d '{"playerId":"g_…","reason":"Harassment"}'   # kicks if online
curl -H "$H" -X POST "$S/admin/unban" -d '{"playerId":"g_…"}'
curl -H "$H" -X POST "$S/admin/announce" -d '{"text":"Server restart in 5 minutes"}'
```

**Review service levels (proposed):** threats, sexual content and hate speech are reviewed within 4 hours. Everything else is reviewed within 48 hours. Record every decision in the `resolution` field.

**Escalation:** for credible threats to life or child-safety concerns, preserve the report record and escalate to the founder or legal contact immediately.

## 5. Backups and recovery

- **Postgres**: Supabase daily backups (enable point-in-time recovery on paid plans).
- **File store**: the Render disk at `/data/ozu-db.json`. Writes are atomic (temp file plus rename). Snapshot the disk regularly.
- **Restarts**: on SIGTERM the server notifies players, saves every session and closes cleanly. Clients reconnect automatically with backoff.

## 6. Incidents

| Symptom | Check | Action |
|---|---|---|
| Players stuck on "Connecting…" | `/health`, server logs, `ALLOWED_ORIGINS` | Fix the origin list, or restart the service |
| "Can't reach the Ozu server" | DNS/TLS for the server host | Confirm `VITE_SERVER_URL` uses `wss://` |
| Progress not saving | `persist_failed` in logs | Check `DATABASE_URL` and Supabase status |
| Spam wave | `chat_auto_mute` / reports | Ban offenders; temporarily set `GUEST_CHAT=false` |
| Low FPS reports | Device/browser | Advise low-quality mode; review the scene budget |

## 7. Release checklist

- [ ] `npm run typecheck && npm test && npm run build` pass (CI does this on every push)
- [ ] Two-browser smoke test on staging
- [ ] Mobile check (iOS Safari and Android Chrome)
- [ ] Secrets set; `ALLOWED_ORIGINS` correct
- [ ] Database migration applied
- [ ] Rollback plan: redeploy the previous Vercel deployment and the previous server image
