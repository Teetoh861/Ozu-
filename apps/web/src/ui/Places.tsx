import { useEffect, useRef, useState } from "react";
import {
  ACTIONS, CHILL_SECONDS, COSMETICS, FOODS, MAPS, PLACES, SHOT_LINES, getMap, placeFor, type ActionId, type MapId,
} from "@ozu/shared";
import { useGame } from "../state/store";
import { client } from "../net/client";
import { walkToPlace } from "../world/nav";
import { playEmote } from "../world/Players";
import { Modal } from "./Panels";

function locationOf(placeId: string) {
  const p = placeFor(placeId);
  return p ? getMap(p.map).locations.find((l) => l.id === placeId) : undefined;
}

const RIDE: Record<MapId, string> = { ozu: "🛺 Keke", unilag: "🚌 Shuttle" };

/** 📍 Places: every spot in both districts, one tap away. */
export function PlacesSheet() {
  const { map, set } = useGame();
  const order: MapId[] = map === "unilag" ? ["unilag", "ozu"] : ["ozu", "unilag"];
  return (
    <Modal title="Where do you want to go?" onClose={() => set({ panel: null })}>
      {order.map((m) => (
        <section key={m} className="places-section">
          <h3>{m === map ? `Here in ${MAPS[m].short}` : `Over in ${MAPS[m].short}`}</h3>
          <ul className="places">
            {PLACES.filter((p) => p.map === m).map((p) => {
              const loc = locationOf(p.id)!;
              return (
                <li key={p.id}>
                  <span className="pe">{p.emoji}</span>
                  <div className="pt">
                    <strong>{loc.name}</strong>
                    <span>{p.actions.map((a) => ACTIONS[a].emoji + " " + ACTIONS[a].label).join(" · ")}</span>
                  </div>
                  <div className="pb">
                    {m === map && (
                      <button className="btn small ghost" onClick={() => { set({ panel: null }); walkToPlace(p.id); }}>🚶 Walk</button>
                    )}
                    <button className="btn small primary" onClick={() => client.goto(p.id)}>
                      {m === map ? RIDE[m] : "🚌 Danfo"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="muted small">Tip: tap anywhere on the ground to walk there, or tap a building to see what you can do inside.</p>
    </Modal>
  );
}

/** Bottom sheet for the place you're at: what you can do here. */
export function PlaceCard() {
  const placeId = useGame((s) => s.activePlace);
  const set = useGame((s) => s.set);
  if (!placeId) return null;
  const place = placeFor(placeId);
  const loc = locationOf(placeId);
  if (!place || !loc) return null;
  const start = (a: ActionId) => {
    set({ activePlace: null });
    switch (a) {
      case "food":
      case "shop":
      case "penalty":
      case "shot":
        return set({ activity: { kind: a, place: place.id } });
      case "quiz":
        set({ activity: { kind: "quiz", place: place.id, id: "", questions: [] } });
        if (!client.act("quiz", place.id)) set({ activity: null });
        return;
      case "result":
        client.act("result", place.id);
        return;
      case "chill":
        if (client.act("chill", place.id, { phase: "start" })) set({ activity: { kind: "chill", place: place.id, until: Date.now() + CHILL_SECONDS * 1000 } });
        return;
      case "dance":
        playEmote("dance");
        client.act("dance", place.id);
        return;
      case "radio":
        set({ panel: "radio", radioTab: "live-unilag" });
        return;
      case "travel": {
        const other = place.map === "ozu" ? "unilag" : "ozu";
        client.goto(other === "unilag" ? "u-gate" : "park");
        return;
      }
    }
  };
  return (
    <div className="place-card" role="dialog" aria-label={loc.name}>
      <button className="icon-btn close" onClick={() => set({ activePlace: null })} aria-label="Close">✕</button>
      <div className="pc-head">
        <span className="pe big">{place.emoji}</span>
        <div>
          <h3>{loc.name}</h3>
          <p className="muted small">{loc.blurb}</p>
        </div>
      </div>
      <div className="pc-actions">
        {place.actions.map((a) => (
          <button key={a} className="action" onClick={() => start(a)}>
            <span className="ae">{a === "travel" ? "🚌" : ACTIONS[a].emoji}</span>
            <span>
              <strong>{a === "travel" ? (place.map === "ozu" ? "Danfo to Unilag" : "Danfo to Ozu") : ACTIONS[a].label}</strong>
              <small>{ACTIONS[a].hint}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Renders whichever mini-activity is running. */
export function ActivityLayer() {
  const activity = useGame((s) => s.activity);
  const close = () => useGame.getState().set({ activity: null });
  if (!activity) return null;
  switch (activity.kind) {
    case "food":
      return <FoodMenu place={activity.place} onClose={close} />;
    case "shop":
      return <Shop place={activity.place} onClose={close} />;
    case "quiz":
      return <Quiz onClose={close} />;
    case "result":
      return (
        <Modal title="Your result is out 📜" onClose={close}>
          <div className="grade">{activity.grade}</div>
          <p className="center">{activity.line}</p>
          <p className="muted small center">Just for fun. Come back tomorrow for another check.</p>
          <button className="btn primary big" onClick={close}>Close</button>
        </Modal>
      );
    case "chill":
      return <Chill place={activity.place} until={activity.until} onClose={close} />;
    case "penalty":
      return <Penalty place={activity.place} onClose={close} />;
    case "shot":
      return <Shot place={activity.place} onClose={close} />;
  }
}

function Coins() {
  const coins = useGame((s) => s.progress?.coins ?? 0);
  return <p className="wallet">Your wallet: <strong>● {coins}</strong></p>;
}

function FoodMenu({ place, onClose }: { place: string; onClose: () => void }) {
  const coins = useGame((s) => s.progress?.coins ?? 0);
  return (
    <Modal title="What are you eating today? 🍛" onClose={onClose}>
      <Coins />
      <ul className="menu">
        {FOODS.map((f) => (
          <li key={f.id}>
            <span className="pe">{f.emoji}</span>
            <strong>{f.name}</strong>
            <button className="btn small primary" disabled={coins < f.price} onClick={() => { client.act("food", place, { item: f.id }); onClose(); }}>
              ● {f.price}
            </button>
          </li>
        ))}
      </ul>
      <p className="muted small">Earn coins from quizzes, lectures, clean-ups and meeting people.</p>
    </Modal>
  );
}

function Shop({ place, onClose }: { place: string; onClose: () => void }) {
  const coins = useGame((s) => s.progress?.coins ?? 0);
  const unlocked = useGame((s) => s.progress?.unlocked ?? []);
  return (
    <Modal title="Balogun Row — fresh drip 🛍️" onClose={onClose}>
      <Coins />
      <ul className="menu">
        {COSMETICS.filter((c) => c.price > 0).map((c) => {
          const owned = unlocked.includes(c.id);
          return (
            <li key={c.id}>
              <div>
                <strong>{c.name}</strong>
                <small className="muted">{c.description}</small>
              </div>
              <button className="btn small primary" disabled={owned || coins < c.price} onClick={() => { client.act("shop", place, { item: c.id }); onClose(); }}>
                {owned ? "Owned" : `● ${c.price}`}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="muted small">Wear or remove items any time from your Profile.</p>
    </Modal>
  );
}

function Quiz({ onClose }: { onClose: () => void }) {
  const activity = useGame((s) => s.activity);
  const [picked, setPicked] = useState<number[]>([]);
  if (activity?.kind !== "quiz") return null;
  if (!activity.questions.length)
    return (
      <Modal title="Library quiz 🧠" onClose={onClose}>
        <div className="spinner" />
      </Modal>
    );
  const done = !!activity.result;
  const i = Math.min(picked.length, activity.questions.length - 1);
  const q = activity.questions[i];
  const choose = (k: number) => {
    const next = [...picked, k];
    setPicked(next);
    if (next.length === activity.questions.length) client.act("quiz", activity.place, { id: activity.id, answers: next });
  };
  return (
    <Modal title="Library quiz 🧠" onClose={onClose}>
      {!done ? (
        picked.length < activity.questions.length ? (
          <>
            <p className="muted small">Question {i + 1} of {activity.questions.length}</p>
            <h3 className="quiz-q">{q.q}</h3>
            <div className="quiz-options">
              {q.options.map((o, k) => <button key={k} className="btn" onClick={() => choose(k)}>{o}</button>)}
            </div>
          </>
        ) : (
          <div className="spinner" />
        )
      ) : (
        <>
          <div className="grade">{activity.result!.correct}/{activity.questions.length}</div>
          <ol className="quiz-review">
            {activity.questions.map((qq, k) => {
              const answer = activity.result!.answers[k];
              const right = answer === picked[k];
              return (
                <li key={k} className={right ? "ok" : "no"}>
                  {qq.q}<br />
                  {right ? (
                    <strong>✓ {qq.options[answer]}</strong>
                  ) : (
                    <>
                      <strong>✗ You picked {qq.options[picked[k]]}</strong>
                      <span className="answer"> — answer: {qq.options[answer]}</span>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
          <button className="btn primary big" onClick={onClose}>Done</button>
        </>
      )}
    </Modal>
  );
}

function Chill({ place, until, onClose }: { place: string; until: number; onClose: () => void }) {
  const [, tick] = useState(0);
  const sent = useRef(false);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, until - Date.now());
  useEffect(() => {
    if (left === 0 && !sent.current) {
      sent.current = true;
      client.act("chill", place, { phase: "done" });
      setTimeout(onClose, 600);
    }
  });
  const pct = 100 - (left / (CHILL_SECONDS * 1000)) * 100;
  return (
    <div className="chill" role="status">
      <p>🌅 Catching vibes… breathe in that Lagos breeze.</p>
      <div className="meter"><div className="meter-fill" style={{ width: `${pct}%` }} /><span>{Math.ceil(left / 1000)}s</span></div>
    </div>
  );
}

function Shot({ place, onClose }: { place: string; onClose: () => void }) {
  return (
    <Modal title="Shoot your shot 💌" onClose={onClose}>
      <p className="muted small">Pick a line — it goes to the person closest to you. Keep it sweet and respectful.</p>
      <div className="quiz-options">
        {SHOT_LINES.map((l, i) => (
          <button key={i} className="btn" onClick={() => { client.act("shot", place, { line: i }); onClose(); }}>{l}</button>
        ))}
      </div>
    </Modal>
  );
}

/** Tap when the ball's aim marker is inside the goal, away from the keeper. */
function Penalty({ place, onClose }: { place: string; onClose: () => void }) {
  const [kicks, setKicks] = useState<boolean[]>([]);
  const [started, setStarted] = useState(false);
  const aim = useRef<HTMLDivElement>(null);
  const keeper = useRef<HTMLDivElement>(null);
  const state = useRef({ t: 0, keeperX: 0.5, raf: 0 });
  const finished = kicks.length >= 5;

  useEffect(() => {
    if (!started || finished) return;
    let last = performance.now();
    const loop = (now: number) => {
      const s = state.current;
      s.t += (now - last) / 1000;
      last = now;
      const x = 0.5 + Math.sin(s.t * (2.4 + kicks.length * 0.35)) * 0.48;
      s.keeperX = 0.5 + Math.sin(s.t * 1.3 + 1) * 0.3;
      if (aim.current) aim.current.style.left = `${x * 100}%`;
      if (keeper.current) keeper.current.style.left = `${s.keeperX * 100}%`;
      (aim.current as unknown as { _x: number })._x = x;
      s.raf = requestAnimationFrame(loop);
    };
    state.current.raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(state.current.raf);
  }, [started, finished, kicks.length]);

  const kick = () => {
    const x = (aim.current as unknown as { _x?: number } | null)?._x ?? 0.5;
    const inGoal = x > 0.12 && x < 0.88;
    const saved = Math.abs(x - state.current.keeperX) < 0.13;
    const next = [...kicks, inGoal && !saved];
    setKicks(next);
    if (next.length === 5) client.act("penalty", place, { phase: "done", goals: next.filter(Boolean).length });
  };

  return (
    <Modal title="Penalty shootout ⚽" onClose={onClose}>
      {!started ? (
        <>
          <p>Tap <strong>Shoot!</strong> when the ball marker is inside the goal and away from the keeper. 5 kicks — every goal earns coins.</p>
          <button className="btn primary big" onClick={() => { if (client.act("penalty", place, { phase: "start" })) setStarted(true); }}>Start</button>
        </>
      ) : (
        <>
          <div className="pitch">
            <div className="goal" />
            <div ref={keeper} className="keeper">🧤</div>
            {!finished && <div ref={aim} className="aim">⚽</div>}
          </div>
          <div className="kicks">{Array.from({ length: 5 }).map((_, i) => <span key={i}>{i < kicks.length ? (kicks[i] ? "🟢" : "❌") : "⚪"}</span>)}</div>
          {!finished ? (
            <button className="btn primary big" onClick={kick}>Shoot!</button>
          ) : (
            <>
              <p className="center"><strong>{kicks.filter(Boolean).length}/5 goals!</strong> {kicks.filter(Boolean).length >= 4 ? "Osimhen who? 🔥" : kicks.filter(Boolean).length >= 2 ? "Not bad at all." : "The keeper had a good day."}</p>
              <button className="btn big" onClick={onClose}>Done</button>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

// ---------------- Choose where to start ----------------

export function StartChooser({ onPick }: { onPick: (m: MapId) => void }) {
  return (
    <div className="start-choose">
      <h2>Where do you want to start?</h2>
      <div className="start-cards">
        <button className="start-card ozu" onClick={() => onPick("ozu")}>
          <span className="sc-emoji">🌆</span>
          <strong>Ozu, Lagos</strong>
          <span>Plaza, buka, Balogun Row, Shrine Lounge, danfos and the lagoon.</span>
        </button>
        <button className="start-card unilag" onClick={() => onPick("unilag")}>
          <span className="sc-emoji">🎓</span>
          <strong>Unilag, Akoka</strong>
          <span>Halls, Senate, library quiz, Lagoon Front, penalties and lecture rush.</span>
        </button>
      </div>
      <p className="muted small">You can switch any time with 📍 Places.</p>
    </div>
  );
}
