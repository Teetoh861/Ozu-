import { useEffect, useRef, useState } from "react";
import { WORLD_HALF, getMap, type Anim } from "@ozu/shared";
import { camState, input, local, useGame } from "../state/store";
import { client, multiplayerConfigured } from "../net/client";
import { GameCanvas } from "../world/GameCanvas";
import { LabelLayer } from "../world/labels";
import { playEmote } from "../world/Players";
import { formatHour, gameHour } from "../world/time";
import { Logo } from "../App";
import { ActivityLayer, PlaceCard, PlacesSheet } from "./Places";
import { Radio, STATIONS } from "./radio";
import { capture } from "../world/Tap";
import { navigateTo } from "../world/nav";
import { multiplayerConfigured as mpConfigured } from "../net/client";
import { ActivitiesPanel, HallsPanel, HelpPanel, Meter, PlayerCard, ProfilePanel, ReportModal, SettingsPanel } from "./Panels";
import { useAmbientSound } from "./sound";

export default function Play() {
  const panel = useGame((s) => s.panel);
  const reportTarget = useGame((s) => s.reportTarget);

  useEffect(() => {
    // Offline preview: start in the chosen district without a server.
    if (!mpConfigured) {
      const g = useGame.getState();
      const sp = getMap(g.startMap).spawn;
      local.x = sp.x;
      local.z = sp.z;
      camState.yaw = g.startMap === "unilag" ? 0 : Math.PI;
      g.set({ map: g.startMap });
    }
    void client.connect();
    const seen = localStorage.getItem("ozu.seenHelp");
    if (!seen) {
      useGame.getState().set({ panel: "help" });
      try { localStorage.setItem("ozu.seenHelp", "1"); } catch {}
    }
    return () => client.disconnect();
  }, []);
  useKeyboard();
  useAmbientSound();

  return (
    <div className="play">
      <GameCanvas />
      <LabelLayer />
      <TopBar />
      <ConnectionBanner />
      <Minimap />
      <ChallengeHud />
      <EventBanner />
      <InteractionPrompt />
      <Chat />
      <EmoteBar />
      <BottomDock />
      <TouchControls />
      <PlaceCard />
      <ActivityLayer />
      <Toasts />
      <TravelOverlay />
      <PhotoPreview />
      {panel === "activities" && <ActivitiesPanel />}
      {panel === "halls" && <HallsPanel />}
      {panel === "places" && <PlacesSheet />}
      {panel === "radio" && <RadioPanel />}
      {panel === "profile" && <ProfilePanel />}
      {panel === "settings" && <SettingsPanel />}
      {panel === "help" && <HelpPanel />}
      {panel === "player" && <PlayerCard />}
      {reportTarget && <ReportModal />}
    </div>
  );
}

function useKeyboard() {
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT";
    };
    const down = (e: KeyboardEvent) => {
      const g = useGame.getState();
      if (e.key === "Escape") {
        g.set({ panel: null, chatOpen: false, reportTarget: null, selectedPlayer: null, activePlace: null, activity: null });
        input.keys.clear();
        return;
      }
      if (typing(e) || g.panel || g.reportTarget || g.activity) return;
      if (e.key === "Enter") {
        e.preventDefault();
        g.set({ chatOpen: true });
        input.keys.clear();
        return;
      }
      if (e.code === "KeyE" && g.prompt) g.prompt.action();
      const emotes: Record<string, Anim> = { Digit1: "wave", Digit2: "dance", Digit3: "clap" };
      if (emotes[e.code]) playEmote(emotes[e.code]);
      input.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => input.keys.delete(e.code);
    const blur = () => input.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
}

function TopBar() {
  const progress = useGame((s) => s.progress);
  const online = useGame((s) => Object.keys(s.players).length + (s.conn === "online" ? 1 : 0));
  const set = useGame((s) => s.set);
  const map = useGame((s) => s.map);
  const [clock, setClock] = useState(formatHour(gameHour()));
  useEffect(() => {
    const t = setInterval(() => setClock(formatHour(gameHour())), 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <header className="topbar">
      <div className="topbar-left">
        <Logo small />
        <div className="stat" title="Coins (no real-world value)"><span className="coin" aria-hidden>●</span>{progress?.coins ?? 0}</div>
        <div className="stat" title="Reputation">★ {progress?.rep ?? 0}</div>
        <div className="stat place" title="Where you are">📍 {getMap(map).short}</div>
        <div className="stat muted hide-sm" title="In-game time">{clock}</div>
        <div className="stat muted hide-sm" title="Players in this district">👥 {online}</div>
      </div>
      <nav className="topbar-right" aria-label="Game menu">
        {map === "unilag" && <button className="icon-btn label" onClick={() => set({ panel: "halls" })}>🏆<span>Halls</span></button>}
        <button className="icon-btn label" onClick={() => set({ panel: "activities" })}>🎯<span>Activities</span></button>
        <button className="icon-btn label" onClick={() => set({ panel: "profile" })}>👤<span>Profile</span></button>
        <button className="icon-btn label" onClick={() => set({ panel: "settings" })}>⚙️<span>Settings</span></button>
        <button className="icon-btn" onClick={() => set({ panel: "help" })} aria-label="Help">?</button>
      </nav>
    </header>
  );
}

function ConnectionBanner() {
  const conn = useGame((s) => s.conn);
  const err = useGame((s) => s.connError);
  if (conn === "online") return null;
  if (conn === "offline" && !multiplayerConfigured)
    return <div className="banner info" role="status">Solo preview — multiplayer server not configured for this build. Progress isn't saved.</div>;
  if (conn === "failed")
    return (
      <div className="banner error" role="alert">
        {err ?? "Disconnected."}{" "}
        <button className="btn small" onClick={() => client.retry()}>Reconnect</button>
        <button className="btn small ghost" onClick={() => useGame.getState().set({ phase: "create" })}>Change name</button>
      </div>
    );
  return <div className="banner warn" role="status">{conn === "connecting" ? "Connecting… (the free server can take up to a minute to wake up)" : "Connection lost — reconnecting…"}</div>;
}

function ChallengeHud() {
  const c = useGame((s) => s.challenge);
  const conn = useGame((s) => s.conn);
  if (conn !== "online") return null;
  return (
    <div className="challenge-hud">
      <Meter value={c.progress} max={c.goal} label={`♻️ Clean-up drive ${c.progress}/${c.goal}`} />
    </div>
  );
}

function EventBanner() {
  const event = useGame((s) => s.event);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!event) return;
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [event]);
  if (!event) return null;
  const left = Math.max(0, Math.ceil((event.endsAt - Date.now()) / 1000));
  const dist = Math.round(Math.hypot(event.x - local.x, event.z - local.z));
  const there = dist <= 7;
  return (
    <div className={`event-banner ${there ? "there" : ""}`} role="status" style={{ pointerEvents: "auto" }}>
      <strong>🔔 {event.venue}</strong>
      <span>{there ? "You're in class — stay here!" : `${dist} m away`}</span>
      <span className="timer">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>
      {!there && <button className="btn small" onClick={() => navigateTo(event.x, event.z)}>🏃 Run there</button>}
    </div>
  );
}

function TravelOverlay() {
  const traveling = useGame((s) => s.traveling);
  if (!traveling) return null;
  return (
    <div className="travel" role="status" aria-live="polite">
      <div className="travel-bus">{traveling === useGame.getState().map && traveling === "ozu" ? "🛺" : "🚌"}</div>
      <p>{traveling === useGame.getState().map ? (traveling === "unilag" ? "Campus shuttle dey carry you…" : "Keke dey carry you…") : traveling === "unilag" ? "Danfo dey go Akoka… Unilag!" : "Danfo dey go Ozu…"}</p>
      <div className="spinner" />
    </div>
  );
}

function InteractionPrompt() {
  const prompt = useGame((s) => s.prompt);
  if (!prompt) return null;
  return (
    <button className="prompt" onClick={prompt.action}>
      <kbd className="hide-touch">E</kbd> {prompt.label}
    </button>
  );
}

function Chat() {
  const chat = useGame((s) => s.chat);
  const open = useGame((s) => s.chatOpen);
  const conn = useGame((s) => s.conn);
  const meId = useGame((s) => s.meId);
  const set = useGame((s) => s.set);
  const [text, setText] = useState("");
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 640);
  const list = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [chat.length, open]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (t) client.send({ t: "chat", text: t });
    setText("");
    set({ chatOpen: false });
    inputRef.current?.blur();
  };
  return (
    <section className={`chat ${collapsed ? "collapsed" : ""}`} aria-label="Chat">
      <button className="chat-toggle" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}>💬 {collapsed ? "Chat" : "Hide"}</button>
      {!collapsed && (
        <>
          <div className="chat-log" ref={list} aria-live="polite">
            {chat.length === 0 && <p className="muted small">Say hello! Press Enter to chat. Be kind — reports are reviewed.</p>}
            {chat.map((c) => (
              <p key={c.id} className={c.from === meId ? "mine" : ""}>
                <button className="chat-name" onClick={() => c.from !== meId && set({ selectedPlayer: c.from, panel: "player" })}>{c.name}</button>
                <span>{c.text}</span>
              </p>
            ))}
          </div>
          <form onSubmit={send} className="chat-form">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => { set({ chatOpen: true }); input.keys.clear(); }}
              onBlur={() => set({ chatOpen: false })}
              maxLength={140}
              placeholder={conn === "online" ? "Press Enter to chat…" : "Chat unavailable offline"}
              disabled={conn !== "online"}
              aria-label="Chat message"
            />
          </form>
        </>
      )}
    </section>
  );
}

function EmoteBar() {
  return (
    <div className="emotes" aria-label="Emotes">
      <button onClick={() => playEmote("wave")} aria-label="Wave">👋</button>
      <button onClick={() => playEmote("dance")} aria-label="Dance">💃</button>
      <button onClick={() => playEmote("clap")} aria-label="Clap">👏</button>
    </div>
  );
}

function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => <div key={t.id} className={`toast ${t.level}`}>{t.text}</div>)}
    </div>
  );
}

const MAP = 132;
function Minimap() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [big, setBig] = useState(false);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = canvas.current?.getContext("2d");
      if (!c) return;
      const size = canvas.current!.width;
      const s = size / (WORLD_HALF * 2);
      const tx = (x: number) => (x + WORLD_HALF) * s, tz = (z: number) => (z + WORLD_HALF) * s;
      const g = useGame.getState();
      const map = getMap(g.map);
      c.fillStyle = map.id === "unilag" ? "#2f4a33" : "#2a2440";
      c.fillRect(0, 0, size, size);
      c.fillStyle = "#3d6b7a";
      for (const w of map.water) c.fillRect(tx(w.x - w.w / 2), tz(w.z - w.d / 2), w.w * s, w.d * s);
      c.fillStyle = "#4a4560";
      for (const r of map.roads) c.fillRect(tx(r.x - r.w / 2), tz(r.z - r.d / 2), r.w * s, r.d * s);
      c.fillStyle = "#8a7d6b";
      for (const b of map.buildings) c.fillRect(tx(b.x - b.w / 2), tz(b.z - b.d / 2), b.w * s, b.d * s);
      c.fillStyle = "#f6c700";
      for (const t of map.transit) c.fillRect(tx(t.x) - 3, tz(t.z) - 3, 6, 6);
      if (g.event) {
        c.strokeStyle = "#4fd39b";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(tx(g.event.x), tz(g.event.z), 6 + (Date.now() / 120) % 5, 0, Math.PI * 2);
        c.stroke();
      }
      for (const l of map.locations) {
        const done = g.progress?.discovered.includes(l.id);
        c.fillStyle = done ? "#0e8a5f" : "#ff7a1a";
        c.beginPath();
        c.arc(tx(l.x), tz(l.z), 3.5, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = "#cfe8d0";
      for (const it of g.items) c.fillRect(tx(it.x) - 1, tz(it.z) - 1, 2, 2);
      c.fillStyle = "#7ec8ff";
      for (const p of Object.values(g.players)) {
        if (g.blocked.includes(p.id)) continue;
        c.beginPath();
        c.arc(tx(p.x), tz(p.z), 2.5, 0, Math.PI * 2);
        c.fill();
      }
      // Me + view direction
      c.save();
      c.translate(tx(local.x), tz(local.z));
      c.rotate(-camState.yaw);
      c.fillStyle = "#f6c700";
      c.beginPath();
      c.moveTo(0, -6); c.lineTo(4, 4); c.lineTo(-4, 4);
      c.closePath();
      c.fill();
      c.restore();
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [big]);
  return (
    <button className={`minimap ${big ? "big" : ""}`} onClick={() => setBig(!big)} aria-label={big ? "Shrink map" : "Expand map"}>
      <canvas ref={canvas} width={big ? 300 : MAP} height={big ? 300 : MAP} />
    </button>
  );
}

/** Virtual joystick on the left half of touch screens, plus a run toggle. */
function TouchControls() {
  const [touch, setTouch] = useState(false);
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const [run, setRun] = useState(false);
  const id = useRef<number | null>(null);
  useEffect(() => {
    const coarse = matchMedia("(pointer: coarse)").matches;
    setTouch(coarse);
  }, []);
  useEffect(() => {
    if (!touch) return;
    const R = 50;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || id.current !== null) return;
      if (!(e.target instanceof HTMLCanvasElement) || e.clientX > window.innerWidth * 0.4) return;
      id.current = e.pointerId;
      setStick({ x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id.current) return;
      setStick((s) => {
        if (!s) return s;
        let dx = e.clientX - s.x, dy = e.clientY - s.y;
        const m = Math.hypot(dx, dy);
        if (m > R) { dx = (dx / m) * R; dy = (dy / m) * R; }
        input.joyX = dx / R;
        input.joyY = dy / R;
        return { ...s, dx, dy };
      });
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id.current) return;
      id.current = null;
      input.joyX = input.joyY = 0;
      setStick(null);
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [touch]);
  if (!touch) return null;
  return (
    <>
      {stick ? (
        <div className="joystick" style={{ left: stick.x - 60, top: stick.y - 60 }} aria-hidden>
          <div className="knob" style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} />
        </div>
      ) : (
        <div className="joystick-hint" aria-hidden>Tap to walk · drag here to steer</div>
      )}
      <button
        className={`run-btn ${run ? "on" : ""}`}
        onClick={() => { input.run = !run; setRun(!run); }}
        aria-pressed={run}
      >
        {run ? "🏃 Running" : "🚶 Walking"}
      </button>
    </>
  );
}

/** Big, thumb-friendly actions: Places, photo and radio. */
function BottomDock() {
  const set = useGame((s) => s.set);
  const radio = useGame((s) => s.radio);
  return (
    <div className="dock">
      <button className="dock-btn primary" onClick={() => set({ panel: "places" })}>📍<span>Places</span></button>
      <button className="dock-btn" onClick={() => void takePhoto()}>📸<span>Snap</span></button>
      <button className={`dock-btn ${radio ? "on" : ""}`} onClick={() => set({ panel: "radio" })}>📻<span>Radio</span></button>
    </div>
  );
}

// ---------------- Photo ----------------

let photoUrl: string | null = null;
const photoListeners = new Set<() => void>();

async function takePhoto() {
  const shot = capture.take?.();
  if (!shot) return useGame.getState().toast("Couldn't take a photo on this device.", "warn");
  const img = new Image();
  img.src = shot;
  await img.decode();
  const g = useGame.getState();
  const c = document.createElement("canvas");
  const w = Math.min(1440, img.width), h = Math.round((img.height / img.width) * w);
  c.width = w;
  c.height = h + Math.round(w * 0.09);
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0, w, h);
  const bar = c.height - h;
  const grad = x.createLinearGradient(0, h, w, c.height);
  grad.addColorStop(0, "#1b1240");
  grad.addColorStop(1, "#3a1838");
  x.fillStyle = grad;
  x.fillRect(0, h, w, bar);
  const fs = Math.round(bar * 0.38);
  x.strokeStyle = "#ff7a1a";
  x.lineWidth = fs * 0.22;
  x.beginPath();
  x.arc(bar * 0.5, h + bar / 2, fs * 0.55, 0, Math.PI * 2);
  x.stroke();
  x.fillStyle = "#f6c700";
  x.beginPath();
  x.arc(bar * 0.5, h + bar / 2, fs * 0.16, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = "#fff";
  x.font = `700 ${fs}px "Space Grotesk", sans-serif`;
  x.textBaseline = "middle";
  x.fillText("OZU", bar * 0.95, h + bar / 2);
  x.font = `500 ${Math.round(fs * 0.62)}px Inter, sans-serif`;
  x.fillStyle = "#ddd6ee";
  x.textAlign = "right";
  x.fillText(`${g.name} · ${getMap(g.map).name} · ozu.vercel.app`, w - bar * 0.4, h + bar / 2);
  photoUrl = c.toDataURL("image/jpeg", 0.9);
  photoListeners.forEach((f) => f());
}

function PhotoPreview() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const f = () => setUrl(photoUrl);
    photoListeners.add(f);
    return () => {
      photoListeners.delete(f);
    };
  }, []);
  if (!url) return null;
  const close = () => {
    photoUrl = null;
    setUrl(null);
  };
  const share = async () => {
    const blob = await (await fetch(url)).blob();
    const file = new File([blob], "ozu-snap.jpg", { type: "image/jpeg" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: "Ozu", text: "Catch me on Ozu 👉 https://ozu.vercel.app" });
      } catch {}
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = "ozu-snap.jpg";
      a.click();
    }
  };
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal photo" role="dialog" aria-label="Your snap">
        <header>
          <h2>Your snap 📸</h2>
          <button className="icon-btn" onClick={close} aria-label="Close">✕</button>
        </header>
        <div className="modal-body">
          <img src={url} alt="Your Ozu snapshot" className="snap" />
          <div className="row gap">
            <button className="btn primary big" onClick={() => void share()}>Share</button>
            <button className="btn big" onClick={close}>Close</button>
          </div>
          <p className="muted small">Post it on WhatsApp, Instagram or TikTok and bring your people to Ozu.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------- Radio ----------------

let radioInstance: Radio | null = null;

function RadioPanel() {
  const { radio, set } = useGame();
  const [vol, setVol] = useState(0.5);
  const tune = (id: string | null) => {
    radioInstance?.stop();
    radioInstance = null;
    if (id) {
      radioInstance = new Radio(id, vol);
      radioInstance.start();
    }
    set({ radio: id });
    if (id && useGame.getState().settings.captions) useGame.getState().toast(`📻 Now playing: ${STATIONS.find((s) => s.id === id)?.name}`, "info");
  };
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && set({ panel: null })}>
      <div className="modal" role="dialog" aria-label="Radio">
        <header>
          <h2>📻 Ozu Radio</h2>
          <button className="icon-btn" onClick={() => set({ panel: null })} aria-label="Close">✕</button>
        </header>
        <div className="modal-body">
          <ul className="stations">
            {STATIONS.map((s) => (
              <li key={s.id}>
                <button className={`station ${radio === s.id ? "on" : ""}`} onClick={() => tune(radio === s.id ? null : s.id)}>
                  <span className="st-icon">{radio === s.id ? "🔊" : "▶️"}</span>
                  <span>
                    <strong>{s.name}</strong>
                    <small>{s.tagline}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <label className="setting">
            <span>Volume</span>
            <input type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => { setVol(+e.target.value); radioInstance?.setVolume(+e.target.value); }} />
          </label>
          {radio && <button className="btn" onClick={() => tune(null)}>Turn radio off</button>}
          <p className="muted small">Original grooves made for Ozu. Live Lagos stations are coming as we sign licensing partners.</p>
        </div>
      </div>
    </div>
  );
}
