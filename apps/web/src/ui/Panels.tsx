import { lazy, Suspense, useState } from "react";
import { COSMETICS, HALLS, REPORT_REASONS, getMap, hallName, type ReportReason } from "@ozu/shared";
import { useGame, persist } from "../state/store";
import { client } from "../net/client";
import { accountsEnabled } from "../net/auth";

const AvatarPreview = lazy(() => import("../world/Preview").then((m) => ({ default: m.AvatarPreview })));

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Guidelines({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Community guidelines" onClose={onClose}>
      <p>Ozu is a shared space. Everyone here should feel welcome and safe.</p>
      <ol className="rules">
        <li><strong>Respect people.</strong> No harassment, bullying, threats, or hate based on ethnicity, tribe, religion, gender, sexuality or disability.</li>
        <li><strong>Keep it clean.</strong> No sexual content or solicitation. Ozu is for players aged 16+, and players under 18 get extra protections. Adults must never pressure younger players to move a conversation off Ozu.</li>
        <li><strong>Protect privacy.</strong> Never share anyone's real address, phone number, social handles, account details or location — including your own. Ozu hides phone numbers and links in chat automatically.</li>
        <li><strong>No scams or spam.</strong> No selling, phishing, "send me money" schemes, or flooding chat.</li>
        <li><strong>Play fair.</strong> Don't exploit bugs or use tools to cheat activities or rewards.</li>
        <li><strong>Don't impersonate.</strong> No pretending to be staff, moderators or real people.</li>
      </ol>
      <p>Use <strong>Report</strong> on any player card to flag a problem. Reports include recent chat for moderators to review. Breaking these rules can lead to a mute, suspension or permanent ban.</p>
      <p className="muted small">Ozu coins and items have no real-world monetary value and cannot be bought, sold or exchanged.</p>
    </Modal>
  );
}

export function ActivitiesPanel() {
  const { progress, challenge, set, map, hall } = useGame();
  const p = progress;
  const discovered = p?.discovered ?? [];
  const mapDef = getMap(map);
  const LOCATIONS = mapDef.locations;
  const found = LOCATIONS.filter((l) => discovered.includes(l.id)).length;
  return (
    <Modal title={`Activities — ${mapDef.short}`} onClose={() => set({ panel: null })}>
      {map === "unilag" && (
        <div className="activity">
          <h3>🔔 Lecture rush</h3>
          <p>Every few minutes a lecture is announced. Race to the venue (follow the green beam) before the countdown ends. Everyone who makes it earns coins, rep and points for their hall.</p>
          <p className="muted small">Lectures attended: {p?.lecturesAttended ?? 0}{hall ? ` · Your hall: ${hallName(hall)} (${p?.hallPoints ?? 0} pts from you)` : " · Pick a hall in Edit character to earn hall points"}</p>
        </div>
      )}
      <div className="activity">
        <h3>👋 Meet &amp; greet</h3>
        <p>Walk up to another player and press <kbd>E</kbd> (or tap <em>Greet</em>). You both earn coins and rep — once per person per day.</p>
        <Meter value={p?.greetings ?? 0} max={Math.max(5, (p?.greetings ?? 0))} label={`${p?.greetings ?? 0} people greeted`} />
      </div>
      <div className="activity">
        <h3>🧭 Explore the district</h3>
        <p>Follow the orange light beams to discover named places. {map === "ozu" ? "Catch a danfo at Danfo Park to visit Unilag." : "The danfo at the Main Gate goes back to Ozu District."}</p>
        <Meter value={found} max={LOCATIONS.length} label={`${found} / ${LOCATIONS.length} places`} />
        <ul className="loc-list">
          {LOCATIONS.map((l) => (
            <li key={l.id} className={discovered.includes(l.id) ? "done" : ""}>
              <strong>{discovered.includes(l.id) ? "✓" : "◆"} {l.name}</strong>
              <span>{l.blurb}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="activity">
        <h3>♻️ {mapDef.challenge.label}</h3>
        <p>Pick up litter bags {map === "unilag" ? "around Lagoon Front" : "around Ozu Plaza"}. When everyone here reaches the goal together, everyone who helped earns a bonus.</p>
        <Meter value={challenge.progress} max={challenge.goal} label={`District: ${challenge.progress} / ${challenge.goal} bags`} />
        <p className="muted small">You've collected {p?.cleanups ?? 0} bags and completed {p?.challengesCompleted ?? 0} drives.</p>
      </div>
    </Modal>
  );
}

export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div className="meter" role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-label={label}>
      <div className="meter-fill" style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} />
      <span>{label}</span>
    </div>
  );
}

export function ProfilePanel() {
  const { progress, name, avatar, account, set } = useGame();
  const p = progress;
  const unlocked = p?.unlocked ?? [];
  return (
    <Modal title="Your profile" onClose={() => set({ panel: null })} wide>
      <div className="profile">
        <div className="profile-preview">
          <Suspense fallback={<div className="spinner" />}>
            <AvatarPreview avatar={avatar} equipped={p?.equipped ?? null} />
          </Suspense>
        </div>
        <div>
          <h3>{name}</h3>
          <p className="muted small">{account === "member" ? "Member account — progress saved to your account." : "Guest — progress saved on this device."}</p>
          <div className="stats">
            <div><strong>{p?.coins ?? 0}</strong><span>Coins</span></div>
            <div><strong>{p?.rep ?? 0}</strong><span>Rep</span></div>
            <div><strong>{p?.discovered.length ?? 0}</strong><span>Places</span></div>
            <div><strong>{p?.greetings ?? 0}</strong><span>Greetings</span></div>
          </div>
          <h4>Cosmetics</h4>
          <ul className="cosmetics">
            {COSMETICS.map((c) => {
              const has = unlocked.includes(c.id);
              const on = p?.equipped === c.id;
              return (
                <li key={c.id} className={has ? "" : "locked"}>
                  <div>
                    <strong>{c.name}</strong>
                    <span>{has ? c.description : `Unlocks at ${c.repRequired} rep`}</span>
                  </div>
                  <button className={`btn small ${on ? "" : "primary"}`} disabled={!has || !client.online} onClick={() => client.send({ t: "equip", cosmeticId: on ? null : c.id })}>
                    {on ? "Remove" : has ? "Wear" : "🔒"}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="row gap">
            <button className="btn" onClick={() => { client.disconnect(); set({ phase: "create", panel: null }); }}>Edit character</button>
            {accountsEnabled && account === "guest" && (
              <button className="btn" onClick={() => { client.disconnect(); set({ phase: "landing", panel: null }); }}>Sign in to save everywhere</button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function SettingsPanel() {
  const { settings, updateSettings, set, ping } = useGame();
  return (
    <Modal title="Settings" onClose={() => set({ panel: null })}>
      <div className="settings">
        <label className="setting">
          <span>Graphics quality</span>
          <select value={settings.quality} onChange={(e) => updateSettings({ quality: e.target.value as "high" | "low" })}>
            <option value="high">High — shadows, more pedestrians</option>
            <option value="low">Low — faster on phones &amp; older laptops</option>
          </select>
        </label>
        <label className="setting">
          <span>Camera sensitivity</span>
          <input type="range" min={0.3} max={2.5} step={0.1} value={settings.sensitivity} onChange={(e) => updateSettings({ sensitivity: +e.target.value })} />
        </label>
        <label className="setting check"><input type="checkbox" checked={settings.invertY} onChange={(e) => updateSettings({ invertY: e.target.checked })} /> Invert vertical camera</label>
        <label className="setting check"><input type="checkbox" checked={settings.showNames} onChange={(e) => updateSettings({ showNames: e.target.checked })} /> Show player names</label>
        <label className="setting check"><input type="checkbox" checked={settings.sound} onChange={(e) => updateSettings({ sound: e.target.checked })} /> Ambient city sound</label>
        <label className="setting check"><input type="checkbox" checked={settings.captions} onChange={(e) => updateSettings({ captions: e.target.checked })} /> Sound captions</label>
        <p className="muted small">Connection: {ping != null ? `${ping} ms` : "—"}</p>
      </div>
    </Modal>
  );
}

export function HelpPanel() {
  const set = useGame((s) => s.set);
  return (
    <Modal title="How to play" onClose={() => set({ panel: null })}>
      <table className="keys">
        <tbody>
          <tr><td><kbd>W A S D</kbd> / arrows</td><td>Move</td></tr>
          <tr><td><kbd>Shift</kbd></td><td>Run</td></tr>
          <tr><td>Drag mouse · scroll</td><td>Rotate · zoom camera</td></tr>
          <tr><td><kbd>E</kbd></td><td>Greet the nearest player</td></tr>
          <tr><td><kbd>Enter</kbd></td><td>Chat</td></tr>
          <tr><td><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></td><td>Wave · dance · clap</td></tr>
          <tr><td><kbd>Esc</kbd></td><td>Close panels</td></tr>
        </tbody>
      </table>
      <p className="muted small">On phones and tablets: drag the left side of the screen to walk, drag the right side to look around.</p>
    </Modal>
  );
}

export function PlayerCard() {
  const { selectedPlayer, players, blocked, muted, set } = useGame();
  const p = selectedPlayer ? players[selectedPlayer] : null;
  if (!p) return null;
  const isBlocked = blocked.includes(p.id);
  const isMuted = muted.includes(p.id);
  const close = () => set({ panel: null, selectedPlayer: null });
  const toggleMute = () => {
    const next = isMuted ? muted.filter((x) => x !== p.id) : [...muted, p.id];
    persist.set("ozu.muted", next);
    set({ muted: next });
  };
  const toggleBlock = () => {
    const next = isBlocked ? blocked.filter((x) => x !== p.id) : [...blocked, p.id];
    client.send({ t: "block", targetId: p.id, blocked: !isBlocked });
    set({ blocked: next });
    useGame.getState().toast(isBlocked ? `Unblocked ${p.name}.` : `Blocked ${p.name}. You won't see or hear each other.`, "info");
    if (!isBlocked) close();
  };
  return (
    <Modal title={p.name} onClose={close}>
      <p className="muted">★ {p.rep} reputation</p>
      <div className="row gap wrap">
        <button className="btn" onClick={toggleMute}>{isMuted ? "Unmute chat" : "Mute chat"}</button>
        <button className="btn" onClick={toggleBlock}>{isBlocked ? "Unblock" : "Block"}</button>
        <button className="btn danger" onClick={() => set({ reportTarget: p.id, panel: null })}>Report</button>
      </div>
      <p className="muted small">Muting hides their chat for you. Blocking hides them completely and stops them from interacting with you.</p>
    </Modal>
  );
}

export function ReportModal() {
  const { reportTarget, players, set, toast } = useGame();
  const [reason, setReason] = useState<ReportReason>("harassment");
  const [details, setDetails] = useState("");
  const p = reportTarget ? players[reportTarget] : null;
  if (!reportTarget) return null;
  const close = () => set({ reportTarget: null });
  const labels: Record<ReportReason, string> = {
    harassment: "Harassment or bullying", hate: "Hate speech", sexual: "Sexual content", spam: "Spam or scams",
    cheating: "Cheating or exploits", impersonation: "Impersonation", other: "Something else",
  };
  return (
    <Modal title={`Report ${p?.name ?? "player"}`} onClose={close}>
      <form
        className="report"
        onSubmit={(e) => {
          e.preventDefault();
          if (!client.online) return toast("You're offline — try again when reconnected.", "warn");
          client.send({ t: "report", targetId: reportTarget, reason, details: details.trim() });
          close();
        }}
      >
        <fieldset>
          <legend>What's happening?</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r} className="check">
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} /> {labels[r]}
            </label>
          ))}
        </fieldset>
        <label className="field">
          <span>Details (optional)</span>
          <textarea maxLength={500} rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What did they do?" />
        </label>
        <p className="muted small">Their recent chat messages will be attached for moderators. If you're in danger, contact local emergency services.</p>
        <div className="row gap">
          <button type="button" className="btn ghost" onClick={close}>Cancel</button>
          <button className="btn danger">Send report</button>
        </div>
      </form>
    </Modal>
  );
}

export function HallsPanel() {
  const { halls, hall, set, progress } = useGame();
  const max = Math.max(1, ...halls.map((h) => h.points));
  return (
    <Modal title="Hall leaderboard" onClose={() => set({ panel: null })}>
      <p className="muted">Everything players earn on campus counts for their hall: lectures, exploring, greetings and clean-ups.</p>
      <ol className="halls">
        {(halls.length ? halls : HALLS.map((h) => ({ id: h.id, points: 0 }))).map((s, i) => {
          const h = HALLS.find((x) => x.id === s.id)!;
          return (
            <li key={s.id} className={s.id === hall ? "mine" : ""}>
              <span className="pos">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
              <span className="name"><span className="hall-dot" style={{ background: h.color }} /> {h.name}{s.id === hall ? " (you)" : ""}</span>
              <span className="bar"><span style={{ width: `${(s.points / max) * 100}%`, background: h.color }} /></span>
              <strong>{s.points}</strong>
            </li>
          );
        })}
      </ol>
      {hall ? (
        <p className="small">You've earned <strong>{progress?.hallPoints ?? 0}</strong> points for {hallName(hall)}.</p>
      ) : (
        <p className="small">You haven't picked a hall. Go to <strong>Profile → Edit character</strong> to rep one.</p>
      )}
    </Modal>
  );
}
