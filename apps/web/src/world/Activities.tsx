import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LECTURE_RADIUS, getMap, sanitizeAvatar, type Anim, type Avatar, type MapId } from "@ozu/shared";
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

// Stable empty array: a selector that returns a fresh [] each call makes React re-render forever.
const NONE: string[] = [];

const beamMat = new THREE.MeshBasicMaterial({ color: "#ff9a4a", transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });

/** Light beams over undiscovered locations, with labels when nearby. */
export function LocationMarkers() {
  const discovered = useGame((s) => s.progress?.discovered ?? NONE);
  const LOCATIONS = getMap(useGame((s) => s.map)).locations;
  const ref = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    beamMat.opacity = 0.16 + Math.sin(clock.elapsedTime * 2) * 0.06;
  });
  return (
    <group ref={ref}>
      {LOCATIONS.map((l) => {
        const done = discovered.includes(l.id);
        return (
          <group key={l.id} position={[l.x, 0, l.z]}>
            {!done && (
              <mesh material={beamMat} position={[0, 12, 0]}>
                <cylinderGeometry args={[0.45, 0.7, 24, 20, 1, true]} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ---------------- Ambient NPCs ----------------

const OZU_PATHS: [number, number][][] = [
  [[-12, -12], [12, -12], [12, 14], [-12, 14]],
  [[-40, -14], [-20, -14], [-20, 12], [-40, 12]],
  [[20, -14], [44, -14], [44, 18], [20, 18]],
  [[-8, 20], [-8, 40], [8, 40], [8, 20]],
  [[-44, -30], [-26, -30], [-26, -33], [-44, -33]],
  [[10, -30], [40, -30], [40, -33], [10, -33]],
  [[-15, -8], [15, -8], [15, 9], [-15, 9]],
  [[24, -44], [46, -44], [46, -40], [24, -40]],
];

const CAMPUS_PATHS: [number, number][][] = [
  [[-6, 44], [-6, -20], [6, -20], [6, 44]],
  [[-32, 34], [-32, -12], [-29, -12], [-29, 34]],
  [[-6, 8], [-24, 18], [-6, 30], [6, 20]],
  [[24, 20], [24, 36], [20, 36], [20, 20]],
  [[30, -12], [42, -12], [42, 4], [30, 4]],
  [[-30, -36], [-2, -36], [-2, -40], [-30, -40]],
  [[-24, 44], [-10, 48], [-8, 40], [-22, 40]],
  [[8, -24], [-8, -24], [-8, -4], [8, -4]],
];

type StaticNpc = { name: string; pos: [number, number]; ry: number; anim: Anim; avatar: Partial<Avatar> };

export const CAMPUS_NPCS: StaticNpc[] = [
  { name: "Mama Nkechi", pos: [11.0, 42], ry: -Math.PI / 2, anim: "idle", avatar: { body: "fem", hair: "gele", outfit: "ankara", palette: 3, skin: 1 } },
  { name: "Porter Baba", pos: [-33.5, 30], ry: Math.PI / 2, anim: "idle", avatar: { body: "masc", hair: "bald", outfit: "kaftan", palette: 4, skin: 0 } },
  { name: "Course Rep Tolu", pos: [-4, -10], ry: Math.PI, anim: "wave", avatar: { body: "fem", hair: "braids", outfit: "office", palette: 1, skin: 3 } },
  { name: "Popcorn Aunty", pos: [-11.6, 44.6], ry: -Math.PI / 2, anim: "idle", avatar: { body: "fem", hair: "gele", outfit: "ankara", palette: 2, skin: 2 } },
  { name: "IJAY", pos: [21, -40.4], ry: 0, anim: "wave", avatar: { body: "masc", hair: "lowcut", outfit: "streetwear", palette: 0, skin: 1 } },
  { name: "Mama Mara", pos: [27, -40.4], ry: 0, anim: "idle", avatar: { body: "fem", hair: "gele", outfit: "kaftan", palette: 1, skin: 0 } },
  { name: "Conductor Ifeanyi", pos: [-15, 48], ry: 0.3, anim: "wave", avatar: { body: "masc", hair: "lowcut", outfit: "streetwear", palette: 2, skin: 2 } },
];

export const OZU_NPCS: StaticNpc[] = [
  { name: "Mallam (Suya)", pos: [-18, 21.6], ry: Math.PI, anim: "idle", avatar: { body: "masc", hair: "bald", outfit: "kaftan", palette: 4, skin: 1 } },
  { name: "Iya Bisi", pos: [-20, -31.6], ry: 0, anim: "idle", avatar: { body: "fem", hair: "gele", outfit: "ankara", palette: 0, skin: 3 } },
  { name: "Mama Titi", pos: [-30, 21.4], ry: Math.PI, anim: "idle", avatar: { body: "fem", hair: "gele", outfit: "ankara", palette: 1, skin: 1 } },
  { name: "Conductor Sule", pos: [-40, -32], ry: 0.4, anim: "wave", avatar: { body: "masc", hair: "lowcut", outfit: "streetwear", palette: 3, skin: 0 } },
  { name: "DJ Kemi", pos: [0, 43], ry: Math.PI, anim: "dance", avatar: { body: "fem", hair: "braids", outfit: "streetwear", palette: 4, skin: 3 } },
  { name: "Mr. Ade", pos: [31, 21.9], ry: Math.PI, anim: "idle", avatar: { body: "masc", hair: "bald", outfit: "agbada", palette: 2, skin: 2 } },
];

function seeded(i: number) {
  let s = i * 2654435761;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) % 1000) / 1000;
}

export function NPCs({ count, map }: { count: number; map: MapId }) {
  const campus = map === "unilag";
  const PATHS = campus ? CAMPUS_PATHS : OZU_PATHS;
  const STATICS = campus ? CAMPUS_NPCS : OZU_NPCS;
  const walkers = useMemo(() => {
    const hairs = ["lowcut", "afro", "braids", "locs", "gele", "bald"] as const;
    const outfits = ["ankara", "agbada", "streetwear", "kaftan", "office"] as const;
    return Array.from({ length: count }, (_, i) => {
      const r = seeded(i + 3 + (campus ? 100 : 0));
      const body = r() > 0.5 ? "fem" : "masc";
      const avatar = sanitizeAvatar({
        body,
        skin: Math.floor(r() * 6),
        hair: body === "masc" ? (["lowcut", "afro", "bald", "locs"] as const)[Math.floor(r() * 4)] : hairs[Math.floor(r() * hairs.length)],
        outfit: outfits[Math.floor(r() * outfits.length)],
        palette: Math.floor(r() * 5),
      });
      const path = PATHS[i % PATHS.length];
      return { avatar, path, offset: r() * 4, speed: 1.1 + r() * 0.7, reverse: i % 2 === 1, backpack: campus && r() > 0.25, map };
    });
  }, [count, campus]);
  return (
    <>
      {walkers.map((w, i) => <Walker key={i} {...w} />)}
      {STATICS.map((n) => <StaticNpcView key={n.name} {...n} />)}
    </>
  );
}

function Walker({ avatar, path, offset, speed, reverse, backpack, map }: { avatar: Avatar; path: [number, number][]; offset: number; speed: number; reverse: boolean; backpack: boolean; map: MapId }) {
  const mapDef = getMap(map);
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
    if (d < 1.2) [x, z] = resolveMove(mapDef, x, z, x + ((x - local.x) / (d || 1)) * (1.2 - d), z + ((z - local.z) / (d || 1)) * (1.2 - d));
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
      <Character avatar={avatar} motion={motion} castShadow={false} backpack={backpack} />
    </group>
  );
}

function StaticNpcView({ name, pos, ry, anim, avatar }: StaticNpc) {
  const motion = useRef<Motion>({ anim, speed: 0 });

  const av = useMemo(() => sanitizeAvatar(avatar), [avatar]);
  return (
    <group position={[pos[0], 0, pos[1]]} rotation-y={ry}>
      <Character avatar={av} motion={motion} />
    </group>
  );
}

const eventMat = new THREE.MeshBasicMaterial({ color: "#4fd39b", transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });

/** Lecture-rush venue: a tall green beam and a ring showing where to stand. */
export function EventMarker() {
  const event = useGame((s) => s.event);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    eventMat.opacity = 0.2 + Math.sin(clock.elapsedTime * 4) * 0.08;
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.6;
  });
  if (!event) return null;
  return (
    <group position={[event.x, 0, event.z]}>
      <mesh material={eventMat} position={[0, 15, 0]}>
        <cylinderGeometry args={[1.2, 1.6, 30, 24, 1, true]} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.06, 0]} material={eventMat}>
        <ringGeometry args={[LECTURE_RADIUS - 0.4, LECTURE_RADIUS, 48]} />
      </mesh>
    </group>
  );
}

export const NPC_LABELS: Record<MapId, StaticNpc[]> = { ozu: OZU_NPCS, unilag: CAMPUS_NPCS };
