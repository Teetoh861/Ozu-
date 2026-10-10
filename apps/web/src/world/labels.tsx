import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HALLS, getMap, hallName } from "@ozu/shared";
import { local, useGame } from "../state/store";
import { NPC_LABELS } from "./Activities";

/**
 * Lightweight world-space labels. React renders plain DOM labels in an overlay
 * (outside the canvas); a single projector inside the canvas positions them each frame.
 * Replaces drei <Html>, whose per-label React roots misbehave under React 19 on unmount.
 */

type Pos = () => { x: number; y: number; z: number } | null;
interface Entry {
  el: HTMLElement;
  pos: Pos;
  maxDist: number;
}

const entries = new Map<string, Entry>();
/** Live world positions of remote players, written by their 3D components. */
export const playerPositions = new Map<string, THREE.Vector3>();

function useLabel(key: string, pos: Pos, maxDist: number) {
  const ref = useRef<HTMLDivElement>(null);
  const posRef = useRef(pos);
  posRef.current = pos;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.display = "none";
    entries.set(key, { el, pos: () => posRef.current(), maxDist });
    return () => {
      if (entries.get(key)?.el === el) entries.delete(key);
    };
  }, [key, maxDist]);
  return ref;
}

const v = new THREE.Vector3();

/** Mount inside the <Canvas>: projects every registered label to screen space. */
export function LabelProjector() {
  useFrame(({ camera, size }) => {
    for (const e of entries.values()) {
      const p = e.pos();
      if (!p || Math.hypot(p.x - local.x, p.z - local.z) > e.maxDist) {
        if (e.el.style.display !== "none") e.el.style.display = "none";
        continue;
      }
      v.set(p.x, p.y, p.z).project(camera);
      if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) {
        if (e.el.style.display !== "none") e.el.style.display = "none";
        continue;
      }
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      if (e.el.style.display === "none") e.el.style.display = "";
      e.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
      e.el.style.zIndex = String(Math.round((1 - v.z) * 1000));
    }
  });
  return null;
}

/** Mount outside the <Canvas>, directly above it. */
export function LabelLayer() {
  return (
    <div className="label-layer" aria-hidden={false}>
      <LocationLabels />
      <NpcLabels />
      <EventLabel />
      <PlayerLabels />
    </div>
  );
}

function LocationLabels() {
  const map = useGame((s) => s.map);
  const discovered = useGame((s) => s.progress?.discovered);
  return (
    <>
      {getMap(map).locations.map((l) => {
        const done = !!discovered?.includes(l.id);
        return <LocationLabel key={`${map}:${l.id}`} id={`loc:${map}:${l.id}`} x={l.x} z={l.z} y={done ? 3.2 : 4.5} done={done} name={l.name} />;
      })}
    </>
  );
}

function LocationLabel({ id, x, y, z, done, name }: { id: string; x: number; y: number; z: number; done: boolean; name: string }) {
  const ref = useLabel(id, () => ({ x, y, z }), 45);
  return (
    <div ref={ref} className="wl">
      <div className={`loc-label ${done ? "done" : ""}`}>{done ? "✓ " : "◆ "}{name}</div>
    </div>
  );
}

function NpcLabels() {
  const map = useGame((s) => s.map);
  return <>{NPC_LABELS[map].map((n) => <NpcLabel key={`${map}:${n.name}`} id={`npc:${map}:${n.name}`} name={n.name} x={n.pos[0]} z={n.pos[1]} />)}</>;
}

function NpcLabel({ id, name, x, z }: { id: string; name: string; x: number; z: number }) {
  const ref = useLabel(id, () => ({ x, y: 2.1, z }), 22);
  return (
    <div ref={ref} className="wl">
      <div className="nametag npc">{name}</div>
    </div>
  );
}

function EventLabel() {
  const event = useGame((s) => s.event);
  const ref = useLabel("event", () => (event ? { x: event.x, y: 5.5, z: event.z } : null), 200);
  return (
    <div ref={ref} className="wl">
      {event && <div className="loc-label event">📚 {event.venue}</div>}
    </div>
  );
}

function PlayerLabels() {
  const ids = useGame((s) => Object.keys(s.players).filter((id) => !s.blocked.includes(id)).join("|"));
  return <>{ids ? ids.split("|").map((id) => <PlayerLabel key={id} id={id} />) : null}</>;
}

function PlayerLabel({ id }: { id: string }) {
  const name = useGame((s) => s.players[id]?.name ?? "");
  const rep = useGame((s) => s.players[id]?.rep ?? 0);
  const hall = useGame((s) => s.players[id]?.hall ?? null);
  const student = useGame((s) => s.players[id]?.student ?? false);
  const bubble = useGame((s) => s.players[id]?.bubble);
  const showNames = useGame((s) => s.settings.showNames);
  const ref = useLabel(`p:${id}`, () => {
    const p = playerPositions.get(id);
    return p ? { x: p.x, y: 2.2, z: p.z } : null;
  }, 35);
  const showBubble = !!bubble && bubble.until > Date.now();
  return (
    <div ref={ref} className="wl">
      <div className="tag">
        {showBubble && <div className="bubble">{bubble!.text}</div>}
        {showNames && (
          <button className="nametag" onClick={() => useGame.getState().set({ selectedPlayer: id, panel: "player" })} aria-label={`Open player card for ${name}`}>
            {hall && <span className="hall-dot" style={{ background: HALLS.find((h) => h.id === hall)?.color }} title={hallName(hall) ?? ""} />}
            {name}
            {student && <span title="Verified Unilag student"> 🎓</span>}
            <span className="rep">★ {rep}</span>
          </button>
        )}
      </div>
    </div>
  );
}
