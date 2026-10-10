import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MAPS, collides } from "@ozu/shared";
import { BuildingMesh, DanfoBus, M, PalmTree, Roads, box, cyl, env } from "./District";
import { grass, paving, signTexture } from "./textures";

const U = MAPS.unilag;
const WATER = U.water[0];

/** Unilag (Akoka) campus: green lawns, faculties, halls, Senate tower, Lagoon Front and the sports centre. */
export function CampusScene({ quality }: { quality: "high" | "low" }) {
  return (
    <group>
      <CampusGround />
      <Roads roads={U.roads} />
      {U.buildings.map((b) => <BuildingMesh key={b.id} b={b} />)}
      <MainGate />
      <Trees count={quality === "high" ? 90 : 45} />
      <LagoonFront />
      <SportsField />
      <LoveGarden />
      <CampusLamps />
      <DanfoBus position={[-12, 0, 49.5]} rotation={0} />
      <PopcornCart position={[-12.6, 0, 44.6]} />
      <FoodCourt />
      {/* Umbrellas outside the campus buka */}
      {[[10.5, 38, "#0e8a5f"], [10.5, 46, "#c0262d"]].map(([x, z, c], i) => (
        <group key={i} position={[x as number, 0, z as number]}>
          <mesh geometry={cyl} material={M.metal} position={[0, 1.2, 0]} scale={[0.04, 2.4, 0.04]} />
          <mesh position={[0, 2.4, 0]} castShadow>
            <coneGeometry args={[1.5, 0.5, 8, 1, true]} />
            <meshStandardMaterial color={c as string} side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
          <mesh geometry={box} material={M.wood} position={[0, 0.75, 0]} scale={[1.2, 0.06, 1.2]} castShadow />
        </group>
      ))}
    </group>
  );
}

function CampusGround() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial map={grass(40, 40)} roughness={1} />
      </mesh>
      {/* Paved walkways: avenue sides, Senate/Library forecourt, hall courtyards */}
      {[
        [0, 12, 22, 88],
        [0, -14, 34, 18],
        [-33, 8, 6, 60],
        [24, 28, 6, 20],
        [-8, 46, 22, 10],
        [28, -6, 20, 10],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[x, 0.015, z]} receiveShadow>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial map={paving(Math.ceil(w / 4), Math.ceil(d / 4))} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function MainGate() {
  const sign = signTexture("UNILAG · AKOKA", "#7a1f3d", "#f6c700");
  return (
    <group position={[0, 0, 51]}>
      {[-6.5, 6.5].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh geometry={box} material={M.stone} position={[0, 3.5, 0]} scale={[1.6, 7, 1.6]} castShadow receiveShadow />
          <mesh geometry={box} position={[0, 7.2, 0]} scale={[1.9, 0.4, 1.9]} castShadow>
            <meshStandardMaterial color="#7a1f3d" roughness={0.6} />
          </mesh>
        </group>
      ))}
      <mesh geometry={box} position={[0, 6.4, 0]} scale={[14.6, 1.6, 1]} castShadow>
        <meshStandardMaterial color="#7a1f3d" roughness={0.6} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, 6.4, s * 0.51]} rotation-y={s > 0 ? 0 : Math.PI}>
          <planeGeometry args={[10, 1.4]} />
          <meshStandardMaterial map={sign} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/** Instanced shade trees scattered over the lawns, avoiding buildings, roads and water. */
function Trees({ count }: { count: number }) {
  const { trunks, canopies } = useMemo(() => {
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const onRoad = (x: number, z: number) => U.roads.some((b) => Math.abs(x - b.x) < b.w / 2 + 1.5 && Math.abs(z - b.z) < b.d / 2 + 1.5);
    const pts: { x: number; z: number; s: number }[] = [];
    let guard = 0;
    while (pts.length < count && guard++ < 4000) {
      const x = -56 + r() * 100, z = -58 + r() * 116;
      if (collides(U, x, z, 3) || onRoad(x, z)) continue;
      if (Math.abs(x + 16) < 21 && Math.abs(z + 45) < 12) continue; // sports field
      if (Math.abs(x) < 9 && z > 38) continue; // gate approach
      if (pts.some((p) => Math.hypot(p.x - x, p.z - z) < 4)) continue;
      pts.push({ x, z, s: 0.8 + r() * 0.7 });
    }
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1, 7);
    const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
    const trunks = new THREE.InstancedMesh(trunkGeo, M.trunk, pts.length);
    const canopyMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, pts.length * 2);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    const greens = ["#3f7a2c", "#4d8a34", "#2f6a2a", "#5a8f3a"];
    pts.forEach((p, i) => {
      m.compose(new THREE.Vector3(p.x, 1.6 * p.s, p.z), q, new THREE.Vector3(p.s, 3.2 * p.s, p.s));
      trunks.setMatrixAt(i, m);
      for (let k = 0; k < 2; k++) {
        const rad = (2.2 - k * 0.6) * p.s;
        m.compose(new THREE.Vector3(p.x + (k ? 0.6 : 0) * p.s, (3.6 + k * 1.3) * p.s, p.z + (k ? -0.4 : 0) * p.s), q, new THREE.Vector3(rad, rad * 0.8, rad));
        canopies.setMatrixAt(i * 2 + k, m);
        canopies.setColorAt(i * 2 + k, c.set(greens[(i + k) % greens.length]));
      }
    });
    trunks.castShadow = canopies.castShadow = true;
    return { trunks, canopies };
  }, [count]);
  return (
    <>
      <primitive object={trunks} />
      <primitive object={canopies} />
    </>
  );
}

function Bench({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh geometry={box} material={M.wood} position={[0, 0.48, 0]} scale={[2, 0.08, 0.5]} castShadow receiveShadow />
      <mesh geometry={box} material={M.wood} position={[0, 0.8, -0.22]} scale={[2, 0.5, 0.06]} castShadow />
      {[-0.85, 0.85].map((x) => <mesh key={x} geometry={box} material={M.metal} position={[x, 0.24, 0]} scale={[0.08, 0.48, 0.45]} />)}
    </group>
  );
}

function LagoonFront() {
  const water = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    water.current.position.y = -0.25 + Math.sin(clock.elapsedTime * 0.6) * 0.03;
  });
  const edge = WATER.x - WATER.w / 2;
  return (
    <group>
      <mesh ref={water} rotation-x={-Math.PI / 2} position={[WATER.x + 20, -0.25, WATER.z]}>
        <planeGeometry args={[WATER.w + 40, WATER.d + 40]} />
        <primitive object={M.water} attach="material" />
      </mesh>
      <mesh geometry={box} material={M.stone} position={[edge, 0.25, WATER.z]} scale={[0.5, 0.5, WATER.d]} castShadow receiveShadow />
      {Array.from({ length: 40 }).map((_, i) => (
        <mesh key={i} geometry={cyl} material={M.metal} position={[edge, 0.95, -58 + i * 3]} scale={[0.04, 0.9, 0.04]} />
      ))}
      <mesh geometry={box} material={M.metal} position={[edge, 1.4, WATER.z]} scale={[0.06, 0.06, WATER.d]} />
      {/* Benches facing the water */}
      {[-14, -9, -4, 1, 6].map((z) => <Bench key={z} position={[edge - 2, 0, z]} rotation={-Math.PI / 2} />)}
      {[-20, 12, 22].map((z) => <PalmTree key={z} position={[edge - 3, 0, z]} s={1} />)}
    </group>
  );
}

function SportsField() {
  return (
    <group position={[-16, 0, -45]}>
      {/* Running track */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} receiveShadow scale={[1.9, 1, 1]}>
        <ringGeometry args={[7.5, 9.5, 48]} />
        <meshStandardMaterial color="#a8432f" roughness={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.025, 0]} receiveShadow scale={[1.9, 1, 1]}>
        <circleGeometry args={[7.5, 48]} />
        <meshStandardMaterial color="#3f8a3a" roughness={1} />
      </mesh>
      {/* Pitch lines */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <planeGeometry args={[0.15, 13]} />
        <meshBasicMaterial color="#f4f4f4" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <ringGeometry args={[1.8, 2, 32]} />
        <meshBasicMaterial color="#f4f4f4" />
      </mesh>
      {[-12, 12].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {[-1.6, 1.6].map((z) => <mesh key={z} geometry={cyl} material={M.white} position={[0, 1, z]} scale={[0.07, 2, 0.07]} />)}
          <mesh geometry={box} material={M.white} position={[0, 2, 0]} scale={[0.1, 0.1, 3.3]} />
        </group>
      ))}
    </group>
  );
}

function LoveGarden() {
  return (
    <group position={[-16, 0, 44]}>
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return <Bench key={i} position={[Math.cos(a) * 6, 0, Math.sin(a) * 4]} rotation={-a + Math.PI / 2} />;
      })}
      {[[-2, 0], [2, 0], [0, 1.5]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={cyl} material={M.stone} position={[0, 0.25, 0]} scale={[1, 0.5, 1]} />
          {Array.from({ length: 6 }).map((_, k) => (
            <mesh key={k} position={[Math.cos(k) * 0.6, 0.62, Math.sin(k) * 0.6]}>
              <sphereGeometry args={[0.16, 8, 6]} />
              <meshStandardMaterial color={["#e63946", "#f6c700", "#ff7a1a", "#ff4fa3"][k % 4]} roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

const lamps: [number, number][] = [];
for (let z = -22; z <= 44; z += 11) lamps.push([-5.6, z], [5.6, z + 5]);

function CampusLamps() {
  useFrame(() => {
    M.lamp.emissiveIntensity = env.night * 3;
  });
  return (
    <group>
      {lamps.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={cyl} material={M.metal} position={[0, 2.6, 0]} scale={[0.07, 5.2, 0.07]} castShadow />
          <mesh geometry={box} material={M.lamp} position={[x < 0 ? 0.5 : -0.5, 5.05, 0]} scale={[0.6, 0.12, 0.35]} />
        </group>
      ))}
    </group>
  );
}

const stripeRed = new THREE.MeshStandardMaterial({ color: "#d62828", roughness: 0.6 });
const glass = new THREE.MeshStandardMaterial({ color: "#fff3c4", roughness: 0.1, transparent: true, opacity: 0.55, emissive: "#ffd166", emissiveIntensity: 0.25 });

/** Love Garden's famous milky popcorn cart. */
function PopcornCart({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh geometry={box} material={stripeRed} position={[0, 0.75, 0]} scale={[1.1, 0.7, 0.7]} castShadow />
      <mesh geometry={box} material={glass} position={[0, 1.45, 0]} scale={[0.9, 0.7, 0.55]} />
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={i} position={[-0.3 + (i % 5) * 0.15, 1.2 + Math.floor(i / 5) * 0.12, 0.05]}>
          <sphereGeometry args={[0.06, 6, 5]} />
          <meshStandardMaterial color="#fff8e1" roughness={0.9} />
        </mesh>
      ))}
      <mesh geometry={box} material={stripeRed} position={[0, 1.88, 0]} scale={[1.2, 0.08, 0.8]} castShadow />
      {[-0.45, 0.45].map((x) => <mesh key={x} geometry={cyl} material={M.tyre} position={[x, 0.25, 0.38]} rotation-x={Math.PI / 2} scale={[0.22, 0.06, 0.22]} />)}
    </group>
  );
}

/** Tables and umbrellas outside New Hall and the 2001 Complex. */
function FoodCourt() {
  const spots: [number, number, string][] = [[14, -36, "#c0262d"], [18, -34.5, "#0e8a5f"], [30, -35, "#f6c700"], [34, -36.5, "#2a3d8f"], [4, -36, "#ff7a1a"]];
  return (
    <group>
      {spots.map(([x, z, c], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={cyl} material={M.metal} position={[0, 1.2, 0]} scale={[0.04, 2.4, 0.04]} />
          <mesh position={[0, 2.4, 0]} castShadow>
            <coneGeometry args={[1.4, 0.45, 8, 1, true]} />
            <meshStandardMaterial color={c} side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
          <mesh geometry={cyl} material={M.white} position={[0, 0.72, 0]} scale={[0.6, 0.05, 0.6]} castShadow />
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} geometry={box} material={M.white} position={[Math.cos(k * 1.57) * 0.95, 0.42, Math.sin(k * 1.57) * 0.95]} scale={[0.35, 0.06, 0.35]} />
          ))}
        </group>
      ))}
    </group>
  );
}
