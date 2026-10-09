import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useShallow } from "zustand/react/shallow";
import {
  INTERACT_RANGE, LOCATIONS, PICKUP_RANGE, RUN_SPEED, WALK_SPEED, DISCOVER_RANGE, resolveMove, type Anim,
} from "@ozu/shared";
import { camState, input, local, useGame, type Remote } from "../state/store";
import { client } from "../net/client";
import { Character, type Motion } from "./Character";

const EMOTE_ANIMS: Anim[] = ["wave", "dance", "clap"];
export const emoteState = { until: 0, anim: "idle" as Anim };

export function playEmote(anim: Anim) {
  emoteState.anim = anim;
  emoteState.until = performance.now() + 2500;
  local.anim = anim;
  if (client.online) client.send({ t: "emote", emote: anim as "wave" | "dance" | "clap" });
}

/** The local player: input → movement with collision, camera follow, proximity checks. */
export function LocalPlayer() {
  const avatar = useGame((s) => s.avatar);
  const equipped = useGame((s) => s.progress?.equipped ?? null);
  const group = useRef<THREE.Group>(null!);
  const motion = useRef<Motion>({ anim: "idle", speed: 0 });
  const { camera } = useThree();
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const camPos = useMemo(() => new THREE.Vector3(), []);
  const lastCheck = useRef(0);
  const pendingDiscover = useRef(new Set<string>());
  const pendingPickup = useRef(new Set<string>());

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const k = input.keys;
    let ix = input.joyX, iz = input.joyY;
    if (k.has("KeyW") || k.has("ArrowUp")) iz -= 1;
    if (k.has("KeyS") || k.has("ArrowDown")) iz += 1;
    if (k.has("KeyA") || k.has("ArrowLeft")) ix -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) ix += 1;
    const mag = Math.min(1, Math.hypot(ix, iz));
    const running = (input.run || k.has("ShiftLeft") || k.has("ShiftRight")) && mag > 0.1;
    let speed = 0;

    if (mag > 0.08) {
      emoteState.until = 0;
      // Camera-relative direction
      const yaw = camState.yaw;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const len = Math.hypot(ix, iz) || 1;
      const dx = (-iz * fx + ix * -fz) / len;
      const dz = (-iz * fz + ix * fx) / len;
      speed = (running ? RUN_SPEED : WALK_SPEED) * (input.joyX || input.joyY ? Math.max(0.35, mag) : 1);
      const [nx, nz] = resolveMove(local.x, local.z, local.x - dx * speed * dt, local.z - dz * speed * dt);
      const moved = Math.hypot(nx - local.x, nz - local.z);
      local.x = nx;
      local.z = nz;
      speed = moved / dt;
      const target = Math.atan2(-dx, -dz);
      let diff = target - local.ry;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      local.ry += diff * Math.min(1, dt * 12);
    }
    const emoting = performance.now() < emoteState.until;
    local.anim = emoting ? emoteState.anim : speed > 0.3 ? (running ? "run" : "walk") : "idle";
    local.speed = speed;
    motion.current.anim = local.anim;
    motion.current.speed = speed;
    group.current.position.set(local.x, 0, local.z);
    group.current.rotation.y = local.ry;

    // Third-person camera with smoothing; pull in if a building is in the way would need raycasts — keep it simple.
    const { yaw, pitch, dist } = camState;
    camTarget.set(local.x, 1.55, local.z);
    camPos.set(local.x + Math.sin(yaw) * Math.cos(pitch) * dist, 1.55 + Math.sin(pitch) * dist, local.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.position.lerp(camPos, 1 - Math.exp(-dt * 10));
    camera.lookAt(camTarget);

    // Proximity checks ~6x per second
    const now = performance.now();
    if (now - lastCheck.current < 160) return;
    lastCheck.current = now;
    const g = useGame.getState();

    let nearest: Remote | null = null, nd = INTERACT_RANGE;
    for (const p of Object.values(g.players)) {
      if (g.blocked.includes(p.id)) continue;
      const d = Math.hypot(p.x - local.x, p.z - local.z);
      if (d < nd) { nd = d; nearest = p; }
    }
    const nextPrompt = nearest
      ? { label: `Greet ${nearest.name}`, id: nearest.id }
      : null;
    if ((nextPrompt?.label ?? null) !== (g.prompt?.label ?? null)) {
      g.set({
        prompt: nextPrompt ? { label: nextPrompt.label, action: () => { client.send({ t: "greet", targetId: nextPrompt.id }); emoteState.anim = "wave"; emoteState.until = performance.now() + 2000; } } : null,
      });
    }

    if (!client.online) return;
    for (const loc of LOCATIONS) {
      if (g.progress?.discovered.includes(loc.id) || pendingDiscover.current.has(loc.id)) continue;
      if (Math.hypot(loc.x - local.x, loc.z - local.z) < DISCOVER_RANGE) {
        pendingDiscover.current.add(loc.id);
        client.send({ t: "discover", locationId: loc.id });
        setTimeout(() => pendingDiscover.current.delete(loc.id), 3000);
      }
    }
    for (const it of g.items) {
      if (pendingPickup.current.has(it.id)) continue;
      if (Math.hypot(it.x - local.x, it.z - local.z) < PICKUP_RANGE) {
        pendingPickup.current.add(it.id);
        client.send({ t: "pickup", itemId: it.id });
        setTimeout(() => pendingPickup.current.delete(it.id), 3000);
      }
    }
  });

  return (
    <group ref={group}>
      <Character avatar={avatar} equipped={equipped} motion={motion} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.45, 0.55, 32]} />
        <meshBasicMaterial color="#ff7a1a" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

export function RemotePlayers() {
  const ids = useGame(useShallow((s) => Object.keys(s.players).filter((id) => !s.blocked.includes(id))));
  return <>{ids.map((id) => <RemotePlayer key={id} id={id} />)}</>;
}

function RemotePlayer({ id }: { id: string }) {
  const avatar = useGame((s) => s.players[id]?.avatar);
  const equipped = useGame((s) => s.players[id]?.equipped ?? null);
  const name = useGame((s) => s.players[id]?.name ?? "");
  const rep = useGame((s) => s.players[id]?.rep ?? 0);
  const bubble = useGame((s) => s.players[id]?.bubble);
  const showNames = useGame((s) => s.settings.showNames);
  const group = useRef<THREE.Group>(null!);
  const motion = useRef<Motion>({ anim: "idle", speed: 0 });
  const init = useRef(false);
  const tag = useRef<HTMLDivElement>(null);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const p = useGame.getState().players[id];
    if (!p) return;
    if (!init.current) {
      group.current.position.set(p.tx, 0, p.tz);
      init.current = true;
    }
    const g = group.current;
    const k = 1 - Math.exp(-dt * 10);
    const ox = g.position.x, oz = g.position.z;
    g.position.x += (p.tx - g.position.x) * k;
    g.position.z += (p.tz - g.position.z) * k;
    // Snap if the gap is huge (respawn / correction)
    if (Math.hypot(p.tx - g.position.x, p.tz - g.position.z) > 12) g.position.set(p.tx, 0, p.tz);
    let diff = p.tr - g.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    g.rotation.y += diff * k;
    // Keep the store's x/z current for proximity checks.
    p.x = g.position.x;
    p.z = g.position.z;
    const emoting = p.emoteUntil && Date.now() < p.emoteUntil;
    motion.current.anim = emoting ? p.anim : EMOTE_ANIMS.includes(p.anim) ? "idle" : p.anim;
    motion.current.speed = Math.hypot(g.position.x - ox, g.position.z - oz) / dt;
    if (tag.current) tag.current.style.display = Math.hypot(g.position.x - local.x, g.position.z - local.z) < 35 ? "" : "none";
  });

  if (!avatar) return null;
  const showBubble = bubble && bubble.until > Date.now();
  return (
    <group ref={group}>
      <Character avatar={avatar} equipped={equipped} motion={motion} />
      {(showNames || showBubble) && (
        <Html ref={tag} position={[0, 2.15, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className="tag">
            {showBubble && <div className="bubble">{bubble!.text}</div>}
            {showNames && (
              <button
                className="nametag"
                style={{ pointerEvents: "auto" }}
                onClick={() => useGame.getState().set({ selectedPlayer: id, panel: "player" })}
                aria-label={`Open player card for ${name}`}
              >
                {name}
                <span className="rep">★ {rep}</span>
              </button>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Bubble timer: re-render remote players when bubbles expire. */
export function useBubbleSweep() {
  useEffect(() => {
    const t = setInterval(() => {
      const g = useGame.getState();
      let changed = false;
      const players = { ...g.players };
      for (const [id, p] of Object.entries(players))
        if (p.bubble && p.bubble.until < Date.now()) {
          players[id] = { ...p, bubble: undefined };
          changed = true;
        }
      if (changed) g.set({ players });
    }, 1000);
    return () => clearInterval(t);
  }, []);
}
