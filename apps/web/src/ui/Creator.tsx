import { lazy, Suspense, useState } from "react";
import {
  BODIES, HAIRSTYLES, HAIR_LABELS, OUTFITS, OUTFIT_LABELS, OUTFIT_PALETTES, SKIN_TONES, validateDisplayName, type Avatar,
} from "@ozu/shared";
import { useGame } from "../state/store";
import { Logo } from "../App";

const AvatarPreview = lazy(() => import("../world/Preview").then((m) => ({ default: m.AvatarPreview })));

export function Creator() {
  const g = useGame();
  const [avatar, setAvatar] = useState<Avatar>(g.avatar);
  const [name, setName] = useState(g.name);
  const check = validateDisplayName(name);
  const patch = (p: Partial<Avatar>) => setAvatar((a) => ({ ...a, ...p }));

  const randomise = () =>
    setAvatar({
      body: BODIES[Math.floor(Math.random() * BODIES.length)],
      skin: Math.floor(Math.random() * SKIN_TONES.length),
      hair: HAIRSTYLES[Math.floor(Math.random() * HAIRSTYLES.length)],
      outfit: OUTFITS[Math.floor(Math.random() * OUTFITS.length)],
      palette: Math.floor(Math.random() * OUTFIT_PALETTES.length),
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!check.ok) return;
    g.setProfile(check.name, avatar);
    g.set({ phase: "playing" });
  };

  return (
    <main className="creator">
      <header className="creator-top">
        <Logo small />
        <h1>Create your character</h1>
        <button className="btn ghost" onClick={() => g.set({ phase: "landing" })}>Back</button>
      </header>
      <div className="creator-body">
        <div className="preview-wrap">
          <Suspense fallback={<div className="spinner" />}>
            <AvatarPreview avatar={avatar} />
          </Suspense>
          <button className="btn ghost small" onClick={randomise}>🎲 Surprise me</button>
        </div>
        <form className="options card" onSubmit={submit}>
          <label className="field">
            <span>Display name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} placeholder="e.g. Tobi" autoFocus aria-invalid={!check.ok && name.length > 0} />
            <small className={!check.ok && name ? "error" : "muted"}>{!check.ok && name ? check.error : "3–16 characters. Visible to other players."}</small>
          </label>

          <Group label="Body">
            {BODIES.map((b) => (
              <Chip key={b} on={avatar.body === b} onClick={() => patch({ body: b })}>{b === "masc" ? "Body A" : "Body B"}</Chip>
            ))}
          </Group>

          <Group label="Skin tone">
            {SKIN_TONES.map((c, i) => (
              <button type="button" key={c} className={`swatch ${avatar.skin === i ? "on" : ""}`} style={{ background: c }} onClick={() => patch({ skin: i })} aria-label={`Skin tone ${i + 1}`} aria-pressed={avatar.skin === i} />
            ))}
          </Group>

          <Group label="Hair">
            {HAIRSTYLES.map((h) => <Chip key={h} on={avatar.hair === h} onClick={() => patch({ hair: h })}>{HAIR_LABELS[h]}</Chip>)}
          </Group>

          <Group label="Outfit">
            {OUTFITS.map((o) => <Chip key={o} on={avatar.outfit === o} onClick={() => patch({ outfit: o })}>{OUTFIT_LABELS[o]}</Chip>)}
          </Group>

          <Group label="Colourway">
            {OUTFIT_PALETTES.map((p, i) => (
              <button type="button" key={i} className={`swatch tri ${avatar.palette === i ? "on" : ""}`} onClick={() => patch({ palette: i })} aria-label={`Colourway ${i + 1}`} aria-pressed={avatar.palette === i}
                style={{ background: `linear-gradient(135deg, ${p[0]} 0 45%, ${p[1]} 45% 70%, ${p[2]} 70%)` }} />
            ))}
          </Group>

          <button className="btn primary big" disabled={!check.ok}>Enter the district</button>
        </form>
      </div>
    </main>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="group">
      <legend>{label}</legend>
      <div className="chips">{children}</div>
    </fieldset>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`chip ${on ? "on" : ""}`} onClick={onClick} aria-pressed={on}>
      {children}
    </button>
  );
}
