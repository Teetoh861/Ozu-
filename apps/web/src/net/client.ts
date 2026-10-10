import { getMap, type Anim, type ClientMessage, type MapId, type ServerMessage } from "@ozu/shared";
import { camState, local, useGame, persist } from "../state/store";
import { getAccessToken } from "./auth";

const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? `ws://${location.hostname}:2567` : "");

export const multiplayerConfigured = !!SERVER_URL;

class GameClient {
  private ws: WebSocket | null = null;
  private attempts = 0;
  private wantOpen = false;
  private moveTimer: number | null = null;
  private pingTimer: number | null = null;
  private lastSent = { x: NaN, z: NaN, ry: NaN, anim: "" as Anim | "" };
  private retryTimer: number | null = null;

  async connect() {
    const g = useGame.getState();
    if (!SERVER_URL) {
      g.set({ conn: "offline", connError: null });
      return;
    }
    this.wantOpen = true;
    g.set({ conn: this.attempts ? "reconnecting" : "connecting", connError: null });
    const accessToken = await getAccessToken();
    const ws = new WebSocket(SERVER_URL);
    this.ws = ws;
    ws.onopen = () => {
      const s = useGame.getState();
      this.send({
        t: "hello", guestToken: persist.get<string | undefined>("ozu.guestToken", undefined), accessToken: accessToken ?? undefined,
        name: s.name, avatar: s.avatar, ageGroup: s.ageGroup ?? "18+", hall: s.hall,
      });
    };
    ws.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(e.data));
      } catch (err) {
        console.error("bad message", err);
      }
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.stopTimers();
      this.ws = null;
      const s = useGame.getState();
      if (e.code >= 4000 && e.code < 4100 && e.code !== 4001) {
        // Server refused us (invalid name, banned, etc.) — don't retry automatically.
        this.wantOpen = false;
        s.set({ conn: "failed", connError: e.reason || "Disconnected by server." });
        return;
      }
      if (e.code === 4001) {
        this.wantOpen = false;
        s.set({ conn: "failed", connError: "You signed in from another tab or device." });
        return;
      }
      if (!this.wantOpen) return;
      this.attempts++;
      if (this.attempts > 8) {
        s.set({ conn: "failed", connError: "Can't reach the Ozu server. Check your connection and try again." });
        return;
      }
      s.set({ conn: "reconnecting" });
      const delay = Math.min(15000, 600 * 2 ** this.attempts) * (0.7 + Math.random() * 0.6);
      this.retryTimer = window.setTimeout(() => void this.connect(), delay);
    };
  }

  disconnect() {
    this.wantOpen = false;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.stopTimers();
    this.ws?.close(1000, "bye");
    this.ws = null;
    useGame.getState().set({ conn: "offline", players: {}, meId: null });
  }

  /** Ride to another district. Offline, the switch happens locally. */
  travel(to: MapId) {
    const g = useGame.getState();
    if (g.traveling) return;
    g.set({ traveling: to, prompt: null });
    if (this.online) {
      this.send({ t: "travel", to });
      // If the server refuses (not at a stop), clear the overlay after a moment.
      window.setTimeout(() => {
        if (useGame.getState().traveling === to) useGame.getState().set({ traveling: null });
      }, 8000);
      return;
    }
    window.setTimeout(() => {
      const from = useGame.getState().map;
      const at = getMap(to).arrival[from] ?? getMap(to).spawn;
      local.x = at.x;
      local.z = at.z;
      camState.yaw = to === "unilag" ? 0 : Math.PI;
      useGame.getState().set({ map: to, traveling: null, players: {}, items: [], event: null });
    }, 1400);
  }

  retry() {
    this.attempts = 0;
    void this.connect();
  }

  send(m: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  get online() {
    return this.ws?.readyState === WebSocket.OPEN && useGame.getState().conn === "online";
  }

  private stopTimers() {
    if (this.moveTimer) clearInterval(this.moveTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.moveTimer = this.pingTimer = null;
  }

  private startTimers() {
    this.stopTimers();
    this.moveTimer = window.setInterval(() => {
      const l = this.lastSent;
      if (Math.abs(l.x - local.x) < 0.01 && Math.abs(l.z - local.z) < 0.01 && Math.abs(l.ry - local.ry) < 0.02 && l.anim === local.anim) return;
      this.lastSent = { x: local.x, z: local.z, ry: local.ry, anim: local.anim };
      this.send({ t: "move", x: +local.x.toFixed(3), z: +local.z.toFixed(3), ry: +local.ry.toFixed(3), anim: local.anim });
    }, 100);
    this.pingTimer = window.setInterval(() => this.send({ t: "ping", n: performance.now() }), 5000);
  }

  private onMessage(m: ServerMessage) {
    const g = useGame.getState();
    switch (m.t) {
      case "welcome": {
        this.attempts = 0;
        if (m.guestToken) persist.set("ozu.guestToken", m.guestToken);
        local.x = m.you.x;
        local.z = m.you.z;
        // Face into the district on arrival: campus lies north of the gate, the Ozu plaza south of the park.
        if (m.map !== g.map || !g.meId) camState.yaw = m.map === "unilag" ? 0 : Math.PI;
        const players: Record<string, ReturnType<typeof useGame.getState>["players"][string]> = {};
        for (const p of m.players) players[p.id] = { ...p, tx: p.x, tz: p.z, tr: p.ry };
        g.set({
          conn: "online", connError: null, meId: m.you.id, progress: m.progress, players, items: m.items,
          challenge: m.challenge, blocked: m.blocked, account: m.account, map: m.map, traveling: null,
          hall: m.hall, student: m.student, halls: m.halls,
          event: m.event ? { ...m.event, endsAt: Date.now() + m.event.secondsLeft * 1000 } : null,
        });
        this.startTimers();
        return;
      }
      case "snap": {
        const players = { ...g.players };
        let changed = false;
        for (const [id, x, z, ry, anim] of m.p) {
          const p = players[id];
          if (!p) continue;
          players[id] = { ...p, tx: x, tz: z, tr: ry, anim };
          changed = true;
        }
        if (changed) useGame.setState({ players });
        return;
      }
      case "join":
        g.set({ players: { ...g.players, [m.player.id]: { ...m.player, tx: m.player.x, tz: m.player.z, tr: m.player.ry } } });
        return;
      case "leave": {
        const players = { ...g.players };
        delete players[m.id];
        g.set({ players, selectedPlayer: g.selectedPlayer === m.id ? null : g.selectedPlayer });
        return;
      }
      case "player": {
        const p = g.players[m.player.id];
        if (p) g.set({ players: { ...g.players, [m.player.id]: { ...p, ...m.player, x: p.x, z: p.z, anim: p.anim } } });
        return;
      }
      case "chat": {
        if (g.blocked.includes(m.from) || g.muted.includes(m.from)) return;
        g.addChat({ from: m.from, name: m.name, text: m.text, ts: m.ts });
        const p = g.players[m.from];
        if (p) g.set({ players: { ...g.players, [m.from]: { ...p, bubble: { text: m.text, until: Date.now() + 6000 } } } });
        return;
      }
      case "emote": {
        const p = g.players[m.id];
        if (p) g.set({ players: { ...g.players, [m.id]: { ...p, anim: m.emote, emoteUntil: Date.now() + 2500 } } });
        return;
      }
      case "greeted":
        if (!g.blocked.includes(m.fromId)) g.toast(`👋 ${m.name} greeted you!`, "info");
        return;
      case "progress":
        g.set({ progress: m.progress });
        if (m.reward) g.reward(m.reward);
        return;
      case "items":
        g.set({ items: m.items });
        return;
      case "challenge":
        g.set({ challenge: { progress: m.progress, goal: m.goal } });
        if (m.completed) g.toast("🎉 Community clean-up complete! Everyone who helped earns a bonus.", "reward");
        return;
      case "correct":
        local.x = m.x;
        local.z = m.z;
        return;
      case "notice":
        g.toast(m.text, m.level);
        return;
      case "kicked":
        this.wantOpen = false;
        g.set({ conn: "failed", connError: m.reason });
        return;
      case "event":
        if (m.event) {
          g.set({ event: { ...m.event, endsAt: Date.now() + m.event.secondsLeft * 1000 } });
          g.toast(`📚 ${m.event.title} Get there before the bell!`, "warn");
        } else {
          g.set({ event: null });
          if (m.result) {
            const others = m.result.attended - (m.result.you ? 1 : 0);
            g.toast(
              m.result.you
                ? `✅ You made it to class${others > 0 ? ` with ${others} other${others > 1 ? "s" : ""}` : ""}!`
                : `🔔 Class started at the ${m.result.venue}. ${m.result.attended} made it — catch the next one!`,
              m.result.you ? "reward" : "info",
            );
          }
        }
        return;
      case "halls":
        g.set({ halls: m.halls });
        return;
      case "pong":
        g.set({ ping: Math.round(performance.now() - m.n) });
        return;
    }
  }
}

export const client = new GameClient();
