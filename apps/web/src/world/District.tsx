import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MAPS, type Box, type Building, type MapId } from "@ozu/shared";
import { asphalt, danfoSide, facade, grass, ground, paving, plazaTiles, signTexture } from "./textures";
import { daylight, gameHour } from "./time";
import { CampusScene } from "./Campus";

/** Shared, mutable "night" amount (0 day … 1 night) written once per frame by <Lighting/>. */
export const env = { night: 0 };

export const box = new THREE.BoxGeometry(1, 1, 1);
export const cyl = new THREE.CylinderGeometry(1, 1, 1, 16);

export const M = {
  kerbA: new THREE.MeshStandardMaterial({ color: "#f6c700", roughness: 0.8 }),
  kerbB: new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.8 }),
  white: new THREE.MeshStandardMaterial({ color: "#eeeeee", roughness: 0.7 }),
  roof: new THREE.MeshStandardMaterial({ color: "#6b625a", roughness: 0.95 }),
  tank: new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.6 }),
  ac: new THREE.MeshStandardMaterial({ color: "#d8d8d8", roughness: 0.5, metalness: 0.2 }),
  metal: new THREE.MeshStandardMaterial({ color: "#444a50", roughness: 0.5, metalness: 0.7 }),
  wood: new THREE.MeshStandardMaterial({ color: "#7a5332", roughness: 0.85 }),
  trunk: new THREE.MeshStandardMaterial({ color: "#6e5a44", roughness: 1 }),
  frond: new THREE.MeshStandardMaterial({ color: "#3f7a2c", roughness: 0.8, side: THREE.DoubleSide }),
  glassDark: new THREE.MeshStandardMaterial({ color: "#1a2228", roughness: 0.15, metalness: 0.5 }),
  lamp: new THREE.MeshStandardMaterial({ color: "#fff3d0", emissive: "#ffd28a", emissiveIntensity: 0 }),
  tyre: new THREE.MeshStandardMaterial({ color: "#121212", roughness: 0.9 }),
  stone: new THREE.MeshStandardMaterial({ color: "#d6cbb8", roughness: 0.9 }),
  water: new THREE.MeshStandardMaterial({ color: "#2b6273", roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.92 }),
  brand: new THREE.MeshStandardMaterial({ color: "#ff7a1a", roughness: 0.35, metalness: 0.3, emissive: "#ff7a1a", emissiveIntensity: 0.1 }),
};

const OZU = MAPS.ozu;
const WATER = OZU.water[0];

export function District({ quality, map }: { quality: "high" | "low"; map: MapId }) {
  if (map === "unilag") return <CampusScene quality={quality} />;
  return (
    <group>
      <Ground />
      {OZU.buildings.map((b) => <BuildingMesh key={b.id} b={b} />)}
      <Plaza />
      <StreetFurniture quality={quality} />
      <DanfoPark />
      <Lagoon />
      <Traffic />
      <Skyline />
    </group>
  );
}

function Ground() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial map={ground()} roughness={1} />
      </mesh>
      {/* Pavements */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, 20]} receiveShadow>
        <planeGeometry args={[92, 74]} />
        <meshStandardMaterial map={paving(23, 18)} roughness={0.95} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, -38]} receiveShadow>
        <planeGeometry args={[120, 22]} />
        <meshStandardMaterial map={paving(30, 6)} roughness={0.95} />
      </mesh>
      {/* Grass verges */}
      {[[-12, 8, 6, 10], [12, 8, 6, 10], [-38, -10, 10, 8], [38, -10, 10, 8], [30, -46, 22, 6]].map(([x, z, w, d], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[x, 0.025, z]} receiveShadow>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial map={grass(Math.ceil(w / 4), Math.ceil(d / 4))} roughness={1} />
        </mesh>
      ))}
      {/* Roads */}
      <Roads roads={OZU.roads} />
      <LaneMarkings />
    </group>
  );
}

export function Roads({ roads }: { roads: Box[] }) {
  return (
    <>
      {roads.map((r, i) => (
        <group key={i}>
          <mesh rotation-x={-Math.PI / 2} position={[r.x, 0.03, r.z]} receiveShadow>
            <planeGeometry args={[r.w, r.d]} />
            <meshStandardMaterial map={asphalt(Math.max(1, Math.round(r.w / 8)), Math.max(1, Math.round(r.d / 8)))} roughness={0.9} />
          </mesh>
          <Kerbs r={r} />
        </group>
      ))}
    </>
  );
}

function Kerbs({ r }: { r: { x: number; z: number; w: number; d: number } }) {
  // Lagos kerbs are painted in alternating yellow and black blocks.
  const horizontal = r.w > r.d;
  const len = horizontal ? r.w : r.d;
  const n = Math.floor(len / 1.5);
  const meshes = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number]; m: THREE.Material }[] = [];
    for (const side of [-1, 1])
      for (let i = 0; i < n; i++) {
        const t = -len / 2 + (i + 0.5) * (len / n);
        const p: [number, number, number] = horizontal ? [r.x + t, 0.09, r.z + side * (r.d / 2 + 0.12)] : [r.x + side * (r.w / 2 + 0.12), 0.09, r.z + t];
        const s: [number, number, number] = horizontal ? [len / n, 0.18, 0.24] : [0.24, 0.18, len / n];
        out.push({ p, s, m: i % 2 ? M.kerbA : M.kerbB });
      }
    return out;
  }, [r, n, len, horizontal]);
  return <>{meshes.map((k, i) => <mesh key={i} geometry={box} material={k.m} position={k.p} scale={k.s} receiveShadow />)}</>;
}

function LaneMarkings() {
  const dashes = [];
  for (let x = -58; x < 58; x += 4) if (Math.abs(x) > 4) dashes.push(<mesh key={x} geometry={box} material={M.white} position={[x, 0.04, -22]} scale={[2, 0.01, 0.15]} />);
  const zebra = [];
  for (let i = -4; i <= 4; i++) zebra.push(<mesh key={i} geometry={box} material={M.white} position={[i * 0.75, 0.04, -22]} scale={[0.45, 0.01, 9]} />);
  return <group>{dashes}{zebra}</group>;
}

export function BuildingMesh({ b: raw }: { b: Building }) {
  // Footprints are stored in world axes; when the frontage is turned 90° the local width/depth swap.
  const b = useMemo(() => (Math.abs(Math.sin(raw.facing)) > 0.5 ? { ...raw, w: raw.d, d: raw.w } : raw), [raw]);
  const look = b.kind === "hall" ? "residential" : b.kind === "faculty" || b.kind === "tower" ? "office" : b.kind;
  const floorH = 3;
  const floors = Math.max(1, Math.round(b.h / floorH));
  const [map, em] = useMemo(() => {
    const cols = Math.max(2, Math.round(b.w / 3));
    return facade(b.id, b.color, cols, floors, look);
  }, [b, floors, look]);
  const sideMaps = useMemo(() => {
    const cols = Math.max(2, Math.round(b.d / 3));
    return facade(b.id + "-side", b.color, cols, floors, look);
  }, [b, floors, look]);
  const mats = useMemo(() => {
    const front = new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0, roughness: 0.85 });
    const side = new THREE.MeshStandardMaterial({ map: sideMaps[0], emissiveMap: sideMaps[1], emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0, roughness: 0.85 });
    const top = M.roof;
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z
    return [side, side, top, top, front, front];
  }, [map, em, sideMaps]);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const n = env.night;
    (mats[0] as THREE.MeshStandardMaterial).emissiveIntensity = n * 0.9;
    (mats[4] as THREE.MeshStandardMaterial).emissiveIntensity = n * 0.9;
    if (glow.current) glow.current.emissiveIntensity = 0.4 + n * 2.2;
  });

  const shopfront = b.kind === "shop" || b.kind === "food" || b.kind === "kiosk";
  const sign = b.sign ? signTexture(b.sign, b.signColor ?? "#1b1240") : null;
  const hasTank = b.kind === "residential" || b.kind === "shop" || b.kind === "food" || b.kind === "hall";

  if (b.kind === "transport") {
    return (
      <group position={[b.x, 0, b.z]} rotation-y={b.facing}>
        {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} geometry={cyl} material={M.metal} position={[sx * (b.w / 2 - 0.3), b.h / 2, sz * (b.d / 2 - 0.3)]} scale={[0.12, b.h, 0.12]} castShadow />
        )))}
        <mesh geometry={box} position={[0, b.h, 0]} scale={[b.w + 0.6, 0.2, b.d + 0.8]} castShadow receiveShadow>
          <meshStandardMaterial color={b.color} roughness={0.6} metalness={0.3} />
        </mesh>
        {sign && (
          <mesh position={[0, b.h + 0.75, b.d / 2]}>
            <planeGeometry args={[6, 1.5]} />
            <meshStandardMaterial map={sign} />
          </mesh>
        )}
        {/* Waiting bench */}
        <mesh geometry={box} material={M.wood} position={[0, 0.45, -b.d / 2 + 0.8]} scale={[b.w - 2, 0.1, 0.5]} castShadow />
      </group>
    );
  }

  return (
    <group position={[b.x, 0, b.z]} rotation-y={b.facing}>
      <mesh geometry={box} material={mats} position={[0, b.h / 2, 0]} scale={[b.w, b.h, b.d]} castShadow receiveShadow />
      {/* Parapet */}
      <mesh geometry={box} material={M.roof} position={[0, b.h + 0.3, b.d / 2 - 0.1]} scale={[b.w, 0.6, 0.2]} castShadow />
      <mesh geometry={box} material={M.roof} position={[0, b.h + 0.3, -b.d / 2 + 0.1]} scale={[b.w, 0.6, 0.2]} castShadow />
      {/* Ground floor plinth */}
      <mesh geometry={box} position={[0, 0.2, 0]} scale={[b.w + 0.1, 0.4, b.d + 0.1]} receiveShadow>
        <meshStandardMaterial color={new THREE.Color(b.color).multiplyScalar(0.6)} roughness={0.95} />
      </mesh>
      {hasTank && (
        <mesh geometry={cyl} material={M.tank} position={[b.w / 2 - 1.4, b.h + 0.9, -b.d / 4]} scale={[0.75, 1.6, 0.75]} castShadow />
      )}
      {/* AC units on the facade */}
      {b.h > 6 && [0.25, -0.2].map((fx, i) => (
        <mesh key={i} geometry={box} material={M.ac} position={[b.w * fx, floorH * (i + 1) + 1.1, b.d / 2 + 0.25]} scale={[0.8, 0.5, 0.45]} castShadow />
      ))}
      {shopfront && (
        <group position={[0, 0, b.d / 2]}>
          {/* Open shop recess */}
          <mesh position={[0, 1.4, 0.02]}>
            <planeGeometry args={[b.w * 0.7, 2.6]} />
            <meshStandardMaterial color="#20170f" roughness={1} />
          </mesh>
          {/* Awning */}
          <mesh geometry={box} position={[0, 3, 0.8]} rotation-x={0.28} scale={[b.w * 0.85, 0.08, 1.8]} castShadow>
            <meshStandardMaterial color={b.signColor ?? "#0e8a5f"} roughness={0.8} />
          </mesh>
          {/* Goods table */}
          <mesh geometry={box} material={M.wood} position={[0, 0.8, 1.1]} scale={[b.w * 0.5, 0.08, 0.8]} castShadow />
          {[-1, 1].map((s) => <mesh key={s} geometry={box} material={M.wood} position={[s * b.w * 0.22, 0.4, 1.1]} scale={[0.08, 0.8, 0.7]} />)}
          {sign && (
            <mesh position={[0, 3.9, 0.05]}>
              <planeGeometry args={[Math.min(b.w * 0.9, 9), Math.min(b.w * 0.9, 9) / 4]} />
              <meshStandardMaterial map={sign} roughness={0.6} />
            </mesh>
          )}
        </group>
      )}
      {b.kind === "venue" && sign && (
        <group position={[0, 0, b.d / 2]}>
          <mesh position={[0, 5.6, 0.06]}>
            <planeGeometry args={[12, 3]} />
            <meshStandardMaterial ref={glow} map={sign} emissiveMap={sign} emissive="#ffffff" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, 1.5, 0.03]}>
            <planeGeometry args={[4, 3]} />
            <meshStandardMaterial color="#0b0712" />
          </mesh>
          <mesh geometry={box} material={M.brand} position={[0, 3.2, 0.2]} scale={[5, 0.12, 0.3]} />
        </group>
      )}
      {b.kind === "hall" && (
        <group position={[0, 0, b.d / 2]}>
          {/* Coloured hall band and entrance canopy */}
          <mesh geometry={box} position={[0, 3.2, 0.06]} scale={[b.w, 0.35, 0.1]}>
            <meshStandardMaterial color={b.signColor ?? "#2a3d8f"} roughness={0.6} />
          </mesh>
          <mesh geometry={box} material={M.stone} position={[0, 2.8, 1]} scale={[4.5, 0.2, 2]} castShadow />
          {[-2, 2].map((x) => <mesh key={x} geometry={cyl} material={M.stone} position={[x, 1.4, 1.8]} scale={[0.15, 2.8, 0.15]} />)}
          {sign && (
            <mesh position={[0, 4.1, 0.08]}>
              <planeGeometry args={[Math.min(b.w * 0.9, 8), Math.min(b.w * 0.9, 8) / 4]} />
              <meshStandardMaterial map={sign} roughness={0.6} />
            </mesh>
          )}
        </group>
      )}
      {(b.kind === "faculty" || b.kind === "tower") && (
        <group position={[0, 0, b.d / 2]}>
          {/* Columned portico — the classic Nigerian campus entrance */}
          <mesh geometry={box} material={M.stone} position={[0, 4.2, 1.6]} scale={[Math.min(b.w * 0.7, 9), 0.35, 3.2]} castShadow />
          {[-1, -0.33, 0.33, 1].map((f) => (
            <mesh key={f} geometry={cyl} material={M.stone} position={[f * Math.min(b.w * 0.7, 9) * 0.45, 2.1, 3]} scale={[0.22, 4.2, 0.22]} castShadow />
          ))}
          {[0, 1, 2].map((i) => <mesh key={i} geometry={box} material={M.stone} position={[0, 0.1 + i * 0.12, 3.6 + i * -0.35]} scale={[Math.min(b.w * 0.7, 9), 0.12, 1]} receiveShadow />)}
          {sign && (
            <mesh position={[0, 5.1, 0.08]}>
              <planeGeometry args={[Math.min(b.w * 0.85, 10), Math.min(b.w * 0.85, 10) / 4]} />
              <meshStandardMaterial map={sign} roughness={0.6} />
            </mesh>
          )}
        </group>
      )}
      {b.kind === "tower" && (
        <group>
          {/* Vertical fins and crown */}
          {[-1, 1].map((sx) => (
            <mesh key={sx} geometry={box} material={M.stone} position={[sx * (b.w / 2 + 0.2), b.h / 2, b.d / 2 - 1]} scale={[0.5, b.h, 1.2]} castShadow />
          ))}
          <mesh geometry={box} position={[0, b.h + 1.4, 0]} scale={[b.w * 0.6, 2.2, b.d * 0.6]} castShadow>
            <meshStandardMaterial color={b.signColor ?? "#7a1f3d"} roughness={0.5} />
          </mesh>
        </group>
      )}
      {(b.kind === "office") && sign && (
        <mesh position={[0, b.h - 1.2, b.d / 2 + 0.05]}>
          <planeGeometry args={[6, 1.5]} />
          <meshStandardMaterial map={sign} emissiveMap={sign} emissive="#ffffff" emissiveIntensity={0.3} />
        </mesh>
      )}
      {b.kind === "office" && (
        <mesh position={[0, 1.6, b.d / 2 + 0.03]}>
          <planeGeometry args={[4, 3]} />
          <primitive object={M.glassDark} attach="material" />
        </mesh>
      )}
    </group>
  );
}

function Plaza() {
  const ring = useRef<THREE.Mesh>(null!);
  useFrame((_, dt) => (ring.current.rotation.y += dt * 0.25));
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.035, 0]} receiveShadow>
        <circleGeometry args={[15, 64]} />
        <meshStandardMaterial map={plazaTiles()} roughness={0.9} />
      </mesh>
      {/* Fountain basin */}
      <mesh geometry={cyl} material={M.stone} position={[0, 0.35, 0]} scale={[3, 0.7, 3]} castShadow receiveShadow />
      <mesh position={[0, 0.66, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[2.7, 48]} />
        <primitive object={M.water} attach="material" />
      </mesh>
      <mesh geometry={cyl} material={M.stone} position={[0, 1.4, 0]} scale={[0.6, 2.2, 0.6]} castShadow />
      {/* The Ozu ring sculpture */}
      <mesh ref={ring} material={M.brand} position={[0, 3.6, 0]} castShadow>
        <torusGeometry args={[1.25, 0.28, 20, 64]} />
      </mesh>
      {/* Benches around the plaza */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        return (
          <group key={i} position={[Math.cos(a) * 9, 0, Math.sin(a) * 9]} rotation-y={-a + Math.PI / 2}>
            <mesh geometry={box} material={M.wood} position={[0, 0.48, 0]} scale={[2, 0.08, 0.5]} castShadow receiveShadow />
            <mesh geometry={box} material={M.wood} position={[0, 0.8, -0.22]} scale={[2, 0.5, 0.06]} castShadow />
            {[-0.85, 0.85].map((x) => <mesh key={x} geometry={box} material={M.metal} position={[x, 0.24, 0]} scale={[0.08, 0.48, 0.45]} />)}
          </group>
        );
      })}
    </group>
  );
}

export function PalmTree({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  const fronds = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.7, 3.2, 1, 6);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) + 1.6;
      pos.setZ(i, -0.08 * y * y);
      pos.setX(i, pos.getX(i) * (1 - y / 3.6));
    }
    g.translate(0, 1.6, 0);
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group position={position} scale={s}>
      <mesh geometry={cyl} material={M.trunk} position={[0, 3.5, 0]} scale={[0.18, 7, 0.18]} castShadow />
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} geometry={fronds} material={M.frond} position={[0, 7, 0]} rotation={[0.9 + (i % 2) * 0.35, (i / 9) * Math.PI * 2, 0]} castShadow />
      ))}
    </group>
  );
}

const lampPositions: [number, number][] = [];
for (let x = -50; x <= 50; x += 14) lampPositions.push([x, -16.4], [x + 7, -27.6]);
lampPositions.push([-6, 10], [6, 10], [-6, 30], [6, 30]);

function StreetFurniture({ quality }: { quality: "high" | "low" }) {
  const lights = useRef<THREE.Group>(null!);
  useFrame(() => {
    M.lamp.emissiveIntensity = env.night * 3;
    lights.current.children.forEach((l) => ((l as THREE.PointLight).intensity = env.night * 18));
  });
  const nearPlaza = lampPositions.filter(([x, z]) => Math.hypot(x, z + 4) < 26).slice(0, quality === "high" ? 6 : 0);
  return (
    <group>
      {lampPositions.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={cyl} material={M.metal} position={[0, 2.6, 0]} scale={[0.07, 5.2, 0.07]} castShadow />
          <mesh geometry={box} material={M.metal} position={[0, 5.15, z < -20 ? 0.5 : -0.5]} scale={[0.1, 0.08, 1.1]} />
          <mesh geometry={box} material={M.lamp} position={[0, 5.05, z < -20 ? 1 : -1]} scale={[0.35, 0.12, 0.5]} />
        </group>
      ))}
      <group ref={lights}>
        {nearPlaza.map(([x, z], i) => <pointLight key={i} position={[x, 4.8, z < -20 ? z + 1 : z - 1]} distance={16} decay={2} color="#ffcf8a" intensity={0} />)}
      </group>
      {/* Palms along the main road and boulevard */}
      {[-44, -30, -14, 14, 30, 44].map((x) => <PalmTree key={x} position={[x, 0, -15.6]} s={0.9 + (Math.abs(x) % 3) * 0.08} />)}
      {[12, 22, 32, 42].map((z) => <PalmTree key={`c${z}`} position={[-6.5, 0, z]} s={0.85} />)}
      {[12, 22, 32, 42].map((z) => <PalmTree key={`d${z}`} position={[6.5, 0, z]} s={0.95} />)}
      {[26, 34, 48].map((x) => <PalmTree key={`l${x}`} position={[x, 0, -46]} s={1.1} />)}
      {/* Roadside sellers' umbrellas */}
      {[[-12, 18, "#0e8a5f"], [14, 18, "#c0262d"], [-24, -30, "#2a3d8f"], [36, -30, "#f6c700"]].map(([x, z, c], i) => (
        <group key={i} position={[x as number, 0, z as number]}>
          <mesh geometry={cyl} material={M.metal} position={[0, 1.2, 0]} scale={[0.04, 2.4, 0.04]} />
          <mesh position={[0, 2.4, 0]} castShadow>
            <coneGeometry args={[1.5, 0.5, 8, 1, true]} />
            <meshStandardMaterial color={c as string} side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
          <mesh geometry={box} material={M.wood} position={[0, 0.75, 0]} scale={[1.2, 0.06, 0.7]} castShadow />
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[-0.35 + k * 0.35, 0.86, 0]} castShadow>
              <sphereGeometry args={[0.1, 10, 8]} />
              <meshStandardMaterial color={["#e85d04", "#ffba08", "#6a994e"][k]} roughness={0.6} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export function DanfoBus({ position = [0, 0, 0] as [number, number, number], rotation = 0 }) {
  const side = danfoSide();
  return (
    <group position={position} rotation-y={rotation}>
      <mesh geometry={box} position={[0, 1.25, 0]} scale={[4.6, 1.9, 2]} castShadow receiveShadow>
        <meshStandardMaterial color="#f6c700" roughness={0.55} metalness={0.15} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, 1.15, s * 1.005]} rotation-y={s > 0 ? 0 : Math.PI}>
          <planeGeometry args={[4.6, 1.15]} />
          <meshStandardMaterial map={side} roughness={0.55} />
        </mesh>
      ))}
      {/* Windows */}
      {[1, -1].map((s) => (
        <mesh key={`w${s}`} geometry={box} material={M.glassDark} position={[0.2, 1.75, s * 1.01]} scale={[3.6, 0.6, 0.02]} />
      ))}
      <mesh geometry={box} material={M.glassDark} position={[2.31, 1.65, 0]} scale={[0.02, 0.75, 1.7]} />
      {[[-1.5, 1], [1.5, 1], [-1.5, -1], [1.5, -1]].map(([x, z], i) => (
        <mesh key={i} geometry={cyl} material={M.tyre} position={[x, 0.38, z * 0.95]} rotation-x={Math.PI / 2} scale={[0.38, 0.25, 0.38]} castShadow />
      ))}
      <mesh geometry={box} material={M.metal} position={[0, 2.25, 0]} scale={[3.4, 0.08, 1.6]} />
    </group>
  );
}

function DanfoPark() {
  return (
    <group>
      <DanfoBus position={[-46, 0, -36]} rotation={0.1} />
      <DanfoBus position={[-38, 0, -37]} rotation={-0.05} />
      <DanfoBus position={[-30, 0, -36.5]} rotation={0.15} />
      {/* Okada (motorcycle) */}
      <group position={[-34, 0, -30]} rotation-y={0.6}>
        <mesh geometry={box} material={M.tank} position={[0, 0.7, 0]} scale={[1.3, 0.3, 0.3]} castShadow />
        {[-0.55, 0.55].map((x) => <mesh key={x} geometry={cyl} material={M.tyre} position={[x, 0.32, 0]} rotation-x={Math.PI / 2} scale={[0.32, 0.1, 0.32]} />)}
        <mesh geometry={box} material={M.brand} position={[0.45, 0.95, 0]} scale={[0.1, 0.4, 0.6]} />
      </group>
    </group>
  );
}

function Lagoon() {
  const water = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    water.current.position.y = -0.25 + Math.sin(clock.elapsedTime * 0.6) * 0.03;
  });
  return (
    <group>
      <mesh ref={water} rotation-x={-Math.PI / 2} position={[WATER.x, -0.25, WATER.z - 4]}>
        <planeGeometry args={[WATER.w + 30, WATER.d + 40]} />
        <primitive object={M.water} attach="material" />
      </mesh>
      {/* Sea wall with railing */}
      <mesh geometry={box} material={M.stone} position={[WATER.x, 0.25, WATER.z + WATER.d / 2]} scale={[WATER.w, 0.5, 0.5]} castShadow receiveShadow />
      {Array.from({ length: 25 }).map((_, i) => (
        <mesh key={i} geometry={cyl} material={M.metal} position={[WATER.x - WATER.w / 2 + i * 2, 0.95, WATER.z + WATER.d / 2]} scale={[0.04, 0.9, 0.04]} />
      ))}
      <mesh geometry={box} material={M.metal} position={[WATER.x, 1.4, WATER.z + WATER.d / 2]} scale={[WATER.w, 0.06, 0.06]} />
    </group>
  );
}

/** Background traffic loops along the main road. Visual only. */
function Traffic() {
  const bus = useRef<THREE.Group>(null!);
  const cars = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    bus.current.position.x = ((t * 6) % 140) - 70;
    cars.current.children.forEach((c, i) => {
      const dir = i % 2 ? -1 : 1;
      c.position.x = dir * ((((t * (7 + i)) + i * 37) % 140) - 70);
    });
  });
  const colors = ["#c0262d", "#e8e8e8", "#2a3d8f", "#1b1b1b"];
  return (
    <group>
      <group ref={bus} position={[0, 0, -19.5]}>
        <DanfoBus />
      </group>
      <group ref={cars}>
        {colors.map((c, i) => (
          <group key={i} position={[0, 0, i % 2 ? -24.8 : -19.8]} rotation-y={i % 2 ? Math.PI : 0}>
            <mesh geometry={box} position={[0, 0.6, 0]} scale={[3.8, 0.7, 1.7]} castShadow>
              <meshStandardMaterial color={c} roughness={0.3} metalness={0.5} />
            </mesh>
            <mesh geometry={box} material={M.glassDark} position={[-0.2, 1.15, 0]} scale={[2, 0.55, 1.5]} castShadow />
            {[[-1.2, 1], [1.2, 1], [-1.2, -1], [1.2, -1]].map(([x, z], k) => (
              <mesh key={k} geometry={cyl} material={M.tyre} position={[x, 0.32, z * 0.8]} rotation-x={Math.PI / 2} scale={[0.32, 0.2, 0.32]} />
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

export function useDaylight() {
  return daylight(gameHour());
}

/** Distant city silhouette so the district sits inside a larger Lagos. Fog does the rest. */
function Skyline() {
  const mesh = useMemo(() => {
    const blocks: { x: number; z: number; w: number; h: number; d: number; c: THREE.Color }[] = [];
    let seed = 42;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const tones = ["#b9b1a6", "#a7b4bd", "#c9bca6", "#9aa5a8", "#d1c7b7"];
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2 + r() * 0.05;
      // Leave the lagoon (south-east) open.
      if (a > 0.15 * Math.PI && a < 0.6 * Math.PI) continue;
      const rad = 95 + r() * 40;
      blocks.push({ x: Math.cos(a) * rad, z: -Math.sin(a) * rad, w: 8 + r() * 14, d: 8 + r() * 14, h: 10 + r() ** 2 * 55, c: new THREE.Color(tones[Math.floor(r() * tones.length)]) });
    }
    const inst = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 1 }), blocks.length);
    const m = new THREE.Matrix4();
    blocks.forEach((b, i) => {
      m.compose(new THREE.Vector3(b.x, b.h / 2, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d));
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, b.c);
    });
    return inst;
  }, []);
  return <primitive object={mesh} />;
}
