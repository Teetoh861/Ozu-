import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { LOCATIONS, sanitizeAvatar, type Anim, type Avatar } from "@ozu/shared";
import { local, useGame } from "../state/store";
import { Character, type Motion } from "./Character";
import { resolveMove } from "@ozu/shared";

const bagMat = new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.35, metalness: 0.1 });
const tieMat = new THREE.MeshStandardMaterial({ color: "#0e8a5f", roughness: 0.6 });
const ringMat = new THREE.MeshBasicMaterial({ color: "#0e8a5f", transparent: true, opacity: 0.55 });

/** Community clean-up drive: litter bags placed by the server. */
export function ChallengeItems() {
  const items = useGame((s) => s.items);
  const group = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    group.current.children.forEach((c, i) => {
      c.children[0].position.y = 0.35 + Math.sin(clock.elapsedTime * 2.2 + i) * 0.08;
      c.children[0].rotation.y = clock.elapsedTime * 0.8 + i;
    });
  });
  return (
    <group ref={group}>
      {items.map((it) => (
        <group key={it.id} position={[it.x, 0, it.z]}>
          <group>
            <mesh material={bagMat} scale={[0.28, 0.34, 0.26]} castShadow>
              <sphereGeometry args={[1, 16, 12]} />
            </mesh>
            <mesh material={tieMat} position={[0, 0.36, 0]} scale={[0.06, 0.08, 0.06]}>
              <sphereGeometry args={[1, 8, 6]} />
            </mesh>
          </group>
          <mesh material={ringMat} rotation-x={-Math.PI / 2} position={[0, 0.06, 0]}>
            <ringGeometry args={[0.55, 0.7, 28]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const beamMat = new THREE.MeshBasicMaterial({ color: "#ff9a4a", transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });

/** Light beams over undiscovered locations, with labels when nearby. */
export function LocationMarkers() {
  const discovered = useGame((s) => s.progress?.discovered ?? []);
  const ref = useRef<THREE.Group>(null!);
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  useFrame(({ clock }) => {
    beamMat.opacity = 0.16 + Math.sin(clock.elapsedTime * 2) * 0.06;
    // Only label places within ~45 m to keep the screen clean.
    LOCATIONS.forEach((l, i) => {
      const el = labels.current[i];
      if (el) el.style.display = Math.hypot(l.x - local.x, l.z - local.z) < 45 ? "" : "none";
    });
  });
  return (
    <group ref={ref}>
      {LOCATIONS.map((l, i) => {
        const done = discovered.includes(l.id);
        return (
          <group key={l.id} position={[l.x, 0, l.z]}>
            {!done && (
              <mesh material={beamMat} position={[0, 12, 0]}>
                <cylinderGeometry args={[0.45, 0.7, 24, 20, 1, true]} />
              </mesh>
            )}
            <Html ref={(el) => { labels.current[i] = el; }} position={[0, done ? 3.2 : 4.5, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
              <div className={`loc-label ${done ? "done" : ""}`}>{done ? "✓ " : "◆ "}{l.name}</div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

// ---------------- Ambient NPCs ----------------

const NPC_PATHS: [number, number][][] = [
  [[-12, -12], [12, -12], [12, 14], [-12, 14]],
  [[-40, -14], [-20, -14], [-20, 12], [-40, 12]],
  [[20, -14], [44, -14], [44, 18], [20, 18]],
  [[-8, 20], [-8, 40], [8, 40], [8, 20]],
  [[-44, -30], [-26, -30], [-26, -33], [-44, -33]],
  [[10, -30], [40, -30], [40, -33], [10, -33]],
  [[-15, -8], [15, -8], [15, 9], [-15, 9]],
  [[24, -44], [46, -44], [46, -40], [24, -40]],
];

const STATIC_NPCS: { name: string; pos: [number, number]; ry: number; anim: Anim; avatar: Partial<Avatar> }[] = [
  { name: "Mama Titi", pos: [-30, 21.4], ry: Math.PI, anim: "idle", avatar: { body: "fem", hair: "gele", outfit: "ankara", palette: 1, skin: 1 } },
  { name: "Conductor Sule", pos: [-40, -32], ry: 0.4, anim: "wave", avatar: { body: "masc", hair: "lowcut", outfit: "streetwear", palette: 3, skin: 0 } },
  { name: "DJ Kemi", pos: [0, 43], ry: Math.PI, anim: "dance", avatar: { body: "fem", hair: "braids", outfit: "streetwear", palette: 4, skin: 3 } },
  { name: "Mr. Ade", pos: [31, 21.9], ry: Math.PI, anim: "idle", avatar: { body: "masc", hair: "bald", outfit: "agbada", palette: 2, skin: 2 } },
];

function seeded(i: number) {
  let s = i * 2654435761;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) % 1000) / 1000;
}

export function NPCs({ count }: { count: number }) {
  const walkers = useMemo(() => {
    const hairs = ["lowcut", "afro", "braids", "locs", "gele", "bald"] as const;
    const outfits = ["ankara", "agbada", "streetwear", "kaftan", "office"] as const;
    return Array.from({ length: count }, (_, i) => {
      const r = seeded(i + 3);
      const body = r() > 0.5 ? "fem" : "masc";
      const avatar = sanitizeAvatar({
        body,
        skin: Math.floor(r() * 6),
        hair: body === "masc" ? (["lowcut", "afro", "bald", "locs"] as const)[Math.floor(r() * 4)] : hairs[Math.floor(r() * hairs.length)],
        outfit: outfits[Math.floor(r() * outfits.length)],
        palette: Math.floor(r() * 5),
      });
      const path = NPC_PATHS[i % NPC_PATHS.length];
      return { avatar, path, offset: r() * 4, speed: 1.1 + r() * 0.7, reverse: i % 2 === 1 };
    });
  }, [count]);
  return (
    <>
      {walkers.map((w, i) => <Walker key={i} {...w} />)}
      {STATIC_NPCS.map((n) => <StaticNpc key={n.name} {...n} />)}
    </>
  );
}

function Walker({ avatar, path, offset, speed, reverse }: { avatar: Avatar; path: [number, number][]; offset: number; speed: number; reverse: boolean }) {
  const pts = reverse ? [...path].reverse() : path;
  const group = useRef<THREE.Group>(null!);
  const motion = useRef<Motion>({ anim: "walk", speed });
  const state = useRef({ seg: Math.floor(offset) % pts.length, t: offset % 1, pause: 0 });
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = state.current;
    if (s.pause > 0) {
      s.pause -= dt;
      motion.current.anim = "idle";
      return;
    }
    const a = pts[s.seg], b = pts[(s.seg + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    s.t += (speed * dt) / len;
    if (s.t >= 1) {
      s.t = 0;
      s.seg = (s.seg + 1) % pts.length;
      if (Math.random() < 0.35) s.pause = 1.5 + Math.random() * 3;
    }
    let x = a[0] + (b[0] - a[0]) * s.t, z = a[1] + (b[1] - a[1]) * s.t;
    // Step aside around the local player
    const d = Math.hypot(local.x - x, local.z - z);
    if (d < 1.2) [x, z] = resolveMove(x, z, x + ((x - local.x) / (d || 1)) * (1.2 - d), z + ((z - local.z) / (d || 1)) * (1.2 - d));
    group.current.position.set(x, 0, z);
    const target = Math.atan2(b[0] - a[0], b[1] - a[1]);
    let diff = target - group.current.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    group.current.rotation.y += diff * Math.min(1, dt * 6);
    motion.current.anim = "walk";
    motion.current.speed = speed;
  });
  return (
    <group ref={group}>
      <Character avatar={avatar} motion={motion} castShadow={false} />
    </group>
  );
}

function StaticNpc({ name, pos, ry, anim, avatar }: (typeof STATIC_NPCS)[number]) {
  const motion = useRef<Motion>({ anim, speed: 0 });
  const label = useRef<HTMLDivElement>(null);
  useFrame(() => {
    if (label.current) label.current.style.display = Math.hypot(pos[0] - local.x, pos[1] - local.z) < 22 ? "" : "none";
  });
  const av = useMemo(() => sanitizeAvatar(avatar), [avatar]);
  return (
    <group position={[pos[0], 0, pos[1]]} rotation-y={ry}>
      <Character avatar={av} motion={motion} />
      <Html ref={label} position={[0, 2.1, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <div className="nametag npc">{name}</div>
      </Html>
    </group>
  );
}
