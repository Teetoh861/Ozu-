import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { OUTFIT_PALETTES, SKIN_TONES, type Anim, type Avatar } from "@ozu/shared";
import { ankara, fabric } from "./textures";

export interface Motion {
  anim: Anim;
  speed: number;
}

// Shared geometry — every character reuses these buffers.
const G = {
  limb: new THREE.CapsuleGeometry(1, 1, 6, 12),
  sphere: new THREE.SphereGeometry(1, 24, 18),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 20, 1, true),
  cylClosed: new THREE.CylinderGeometry(1, 1, 1, 20),
  cone: new THREE.CylinderGeometry(0.55, 1, 1, 24, 1, true),
  torus: new THREE.TorusGeometry(1, 0.12, 8, 28),
};

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(key: string, make: () => THREE.MeshStandardMaterial) {
  let m = matCache.get(key);
  if (!m) {
    m = make();
    matCache.set(key, m);
  }
  return m;
}

function useMaterials(avatar: Avatar) {
  return useMemo(() => {
    const pal = OUTFIT_PALETTES[avatar.palette] ?? OUTFIT_PALETTES[0];
    const skinHex = SKIN_TONES[avatar.skin] ?? SKIN_TONES[2];
    const skin = mat(`skin-${skinHex}`, () => new THREE.MeshPhysicalMaterial({ color: skinHex, roughness: 0.48, sheen: 0.4, sheenColor: new THREE.Color("#ffd2b0"), sheenRoughness: 0.6 }));
    const hair = mat("hair", () => new THREE.MeshStandardMaterial({ color: "#151110", roughness: 0.95 }));
    const eyeWhite = mat("eyeW", () => new THREE.MeshStandardMaterial({ color: "#f4efe8", roughness: 0.3 }));
    const iris = mat("iris", () => new THREE.MeshStandardMaterial({ color: "#1d120c", roughness: 0.2 }));
    const lips = mat(`lips-${skinHex}`, () => new THREE.MeshStandardMaterial({ color: new THREE.Color(skinHex).multiplyScalar(0.72), roughness: 0.5 }));
    const print = mat(`ankara-${avatar.palette}`, () => new THREE.MeshStandardMaterial({ map: ankara(pal), roughness: 0.75 }));
    const plain = (c: string) => mat(`plain-${c}`, () => new THREE.MeshStandardMaterial({ map: fabric(c), roughness: 0.85 }));
    const shoe = mat("shoe", () => new THREE.MeshStandardMaterial({ color: "#2a1d15", roughness: 0.45 }));
    const sneaker = mat("sneaker", () => new THREE.MeshStandardMaterial({ color: "#f2f2f2", roughness: 0.6 }));
    const denim = plain("#2f4b72");
    const gold = mat("gold", () => new THREE.MeshStandardMaterial({ color: "#e6b422", metalness: 1, roughness: 0.25 }));
    const shades = mat("shades", () => new THREE.MeshStandardMaterial({ color: "#050505", metalness: 0.6, roughness: 0.1 }));
    const asoOke = mat("asooke", () => new THREE.MeshStandardMaterial({ map: ankara(["#7a1f3d", "#e6b422", "#3b0f1f"], 1), roughness: 0.7 }));

    let top = print, bottom = print, robe: THREE.Material | null = null, robeLength = 0, skirt = false, shoes = shoe, tie: THREE.Material | null = null;
    switch (avatar.outfit) {
      case "ankara":
        top = print;
        bottom = avatar.body === "fem" ? print : plain(pal[2]);
        skirt = avatar.body === "fem";
        break;
      case "agbada":
        top = plain(pal[0]);
        bottom = plain(pal[0]);
        robe = plain(pal[0]);
        robeLength = 1.0;
        break;
      case "streetwear":
        top = plain(pal[2] === "#f4efe6" ? "#222" : pal[2]);
        bottom = denim;
        shoes = sneaker;
        break;
      case "kaftan":
        top = plain(pal[0]);
        bottom = plain(pal[0]);
        robe = plain(pal[0]);
        robeLength = 0.62;
        break;
      case "office":
        top = plain("#f1f1f1");
        bottom = plain(avatar.body === "fem" ? pal[2] : "#22252b");
        skirt = avatar.body === "fem";
        tie = avatar.body === "masc" ? plain(pal[0]) : null;
        break;
    }
    return { skin, hair, eyeWhite, iris, lips, top, bottom, robe, robeLength, skirt, shoes, tie, gold, shades, asoOke, accent: plain(pal[1]) };
  }, [avatar.palette, avatar.skin, avatar.outfit, avatar.body]);
}

interface Props {
  avatar: Avatar;
  equipped?: string | null;
  motion: React.RefObject<Motion>;
  castShadow?: boolean;
}

export function Character({ avatar, equipped, motion, castShadow = true }: Props) {
  const m = useMaterials(avatar);
  const fem = avatar.body === "fem";
  const shoulderW = fem ? 0.19 : 0.215;
  const hipW = fem ? 0.115 : 0.1;

  const hips = useRef<THREE.Group>(null!);
  const chest = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const lArm = useRef<THREE.Group>(null!), rArm = useRef<THREE.Group>(null!);
  const lFore = useRef<THREE.Group>(null!), rFore = useRef<THREE.Group>(null!);
  const lLeg = useRef<THREE.Group>(null!), rLeg = useRef<THREE.Group>(null!);
  const lKnee = useRef<THREE.Group>(null!), rKnee = useRef<THREE.Group>(null!);
  const robe = useRef<THREE.Mesh>(null);
  const phase = useRef(Math.random() * 10);
  const blink = useRef(0);
  const eyes = useRef<THREE.Group>(null!);
  const t0 = useRef(Math.random() * 100);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const mo = motion.current ?? { anim: "idle", speed: 0 };
    const t = (t0.current += dt);
    const moving = mo.anim === "walk" || mo.anim === "run";
    const run = mo.anim === "run";
    const k = 1 - Math.exp(-dt * 12); // smoothing factor
    const lerp = (o: THREE.Object3D, ax: "x" | "y" | "z", v: number) => (o.rotation[ax] += (v - o.rotation[ax]) * k);

    phase.current += dt * (moving ? (run ? 11 : 7.2) * Math.max(0.6, Math.min(1.3, mo.speed / (run ? 5.2 : 2.4))) : 0);
    const p = phase.current;
    const sw = moving ? (run ? 0.85 : 0.5) : 0;
    const s = Math.sin(p);

    // Legs
    lerp(lLeg.current, "x", s * sw);
    lerp(rLeg.current, "x", -s * sw);
    lerp(lKnee.current, "x", moving ? Math.max(0, -Math.cos(p)) * sw * 1.3 : 0);
    lerp(rKnee.current, "x", moving ? Math.max(0, Math.cos(p)) * sw * 1.3 : 0);

    // Hips bob & sway
    const baseY = 0.94;
    let bob = moving ? Math.abs(Math.cos(p)) * (run ? 0.06 : 0.03) : Math.sin(t * 1.6) * 0.004;
    let sway = moving ? s * 0.05 : 0;
    let lean = run ? 0.18 : moving ? 0.05 : 0;

    // Arms default: counter-swing
    let la = -s * sw * 0.9, ra = s * sw * 0.9, lz = 0.08, rz = -0.08, lf = moving ? -0.35 - (run ? 0.6 : 0) : -0.12, rf = lf;
    let headY = 0;

    if (mo.anim === "wave") {
      ra = -2.6; rz = -0.35; rf = -0.6 + Math.sin(t * 12) * 0.45;
    } else if (mo.anim === "dance") {
      const b = Math.sin(t * 7);
      bob = Math.abs(b) * 0.07;
      sway = Math.sin(t * 3.5) * 0.18;
      la = -2.2 + Math.sin(t * 7) * 0.5; ra = -2.2 - Math.sin(t * 7) * 0.5;
      lz = 0.5; rz = -0.5; lf = -0.8; rf = -0.8;
      headY = Math.sin(t * 3.5) * 0.3;
      lerp(lLeg.current, "x", Math.max(0, b) * 0.5);
      lerp(rLeg.current, "x", Math.max(0, -b) * 0.5);
      lerp(lKnee.current, "x", Math.max(0, b) * 0.9);
      lerp(rKnee.current, "x", Math.max(0, -b) * 0.9);
    } else if (mo.anim === "clap") {
      const c = Math.abs(Math.sin(t * 9));
      la = -1.2; ra = -1.2; lz = -0.35 - c * 0.25; rz = 0.35 + c * 0.25; lf = -0.9; rf = -0.9;
    }

    hips.current.position.y = baseY + bob;
    lerp(hips.current, "z", sway * 0.4);
    lerp(chest.current, "x", lean);
    lerp(chest.current, "z", -sway * 0.6);
    lerp(chest.current, "y", moving ? -s * 0.08 : 0);
    lerp(head.current, "y", headY + (moving ? s * 0.06 : Math.sin(t * 0.4) * 0.15));
    lerp(head.current, "x", -lean * 0.6 + (moving ? 0 : Math.sin(t * 0.7) * 0.03));
    lerp(lArm.current, "x", la);
    lerp(rArm.current, "x", ra);
    lerp(lArm.current, "z", lz);
    lerp(rArm.current, "z", rz);
    lerp(lFore.current, "x", lf);
    lerp(rFore.current, "x", rf);
    if (robe.current) robe.current.rotation.x = moving ? -s * sw * 0.08 : 0;

    // Blink every few seconds
    blink.current -= dt;
    if (blink.current < -0.12) blink.current = 2 + Math.random() * 4;
    eyes.current.scale.y = blink.current < 0 ? 0.1 : 1;
  });

  const cs = castShadow;
  const sleeve = m.robe ?? m.top;
  const shortSleeve = avatar.outfit === "ankara" && !fem;

  return (
    <group>
      <group ref={hips} position={[0, 0.94, 0]}>
        {/* Pelvis */}
        <mesh geometry={G.sphere} material={m.skirt ? m.bottom : m.bottom} scale={[fem ? 0.17 : 0.155, 0.12, 0.11]} castShadow={cs} />
        {m.skirt && <mesh geometry={G.cone} material={m.bottom} position={[0, -0.28, 0]} scale={[0.25, 0.5, 0.19]} rotation={[Math.PI, 0, 0]} castShadow={cs} />}

        {/* Legs */}
        {([[-1, lLeg, lKnee], [1, rLeg, rKnee]] as const).map(([side, leg, knee]) => (
          <group key={side} ref={leg} position={[side * hipW, -0.04, 0]}>
            {limb(fem ? 0.068 : 0.072, 0.36, m.skirt && avatar.outfit === "office" ? m.skin : m.bottom, -0.2, cs)}
            <group ref={knee} position={[0, -0.43, 0]}>
              {limb(0.055, 0.36, m.skirt ? m.skin : m.bottom, -0.2, cs)}
              <mesh geometry={G.sphere} material={m.shoes} position={[0, -0.42, 0.04]} scale={[0.055, 0.045, 0.13]} castShadow={cs} />
            </group>
          </group>
        ))}

        {/* Upper body */}
        <group ref={chest} position={[0, 0.06, 0]}>
          <mesh geometry={G.limb} material={m.top} position={[0, 0.26, 0]} scale={[fem ? 0.15 : 0.17, 0.14, fem ? 0.11 : 0.115]} castShadow={cs} />
          {fem && <mesh geometry={G.sphere} material={m.top} position={[0, 0.3, 0.06]} scale={[0.14, 0.08, 0.07]} castShadow={cs} />}
          {m.tie && <mesh geometry={G.box} material={m.tie} position={[0, 0.28, 0.118]} scale={[0.04, 0.26, 0.01]} />}
          {m.robe && (
            <mesh ref={robe} geometry={G.cone} material={m.robe} position={[0, 0.42 - m.robeLength / 2, 0]} scale={[avatar.outfit === "agbada" ? 0.42 : 0.24, m.robeLength + 0.1, avatar.outfit === "agbada" ? 0.24 : 0.17]} castShadow={cs} />
          )}
          {avatar.outfit === "agbada" && <mesh geometry={G.box} material={m.accent} position={[0, 0.33, 0.13]} scale={[0.09, 0.22, 0.01]} />}
          {/* Neck & head */}
          <mesh geometry={G.cylClosed} material={m.skin} position={[0, 0.5, 0]} scale={[0.052, 0.1, 0.052]} />
          <group ref={head} position={[0, 0.66, 0]}>
            <mesh geometry={G.sphere} material={m.skin} scale={[0.105, 0.128, 0.115]} castShadow={cs} />
            {/* jaw */}
            <mesh geometry={G.sphere} material={m.skin} position={[0, -0.055, 0.025]} scale={[0.085, 0.07, 0.085]} />
            {/* ears */}
            <mesh geometry={G.sphere} material={m.skin} position={[-0.104, 0, 0]} scale={[0.018, 0.03, 0.022]} />
            <mesh geometry={G.sphere} material={m.skin} position={[0.104, 0, 0]} scale={[0.018, 0.03, 0.022]} />
            {/* nose */}
            <mesh geometry={G.sphere} material={m.skin} position={[0, -0.018, 0.112]} scale={[0.026, 0.022, 0.022]} />
            {/* lips */}
            <mesh geometry={G.sphere} material={m.lips} position={[0, -0.064, 0.098]} scale={[0.032, 0.012, 0.012]} />
            {/* eyes */}
            <group ref={eyes} position={[0, 0.018, 0.094]}>
              {[-1, 1].map((sx) => (
                <group key={sx} position={[sx * 0.038, 0, 0]}>
                  <mesh geometry={G.sphere} material={m.eyeWhite} scale={[0.017, 0.011, 0.01]} />
                  <mesh geometry={G.sphere} material={m.iris} position={[0, 0, 0.007]} scale={[0.008, 0.008, 0.005]} />
                </group>
              ))}
            </group>
            {/* brows */}
            {[-1, 1].map((sx) => (
              <mesh key={sx} geometry={G.box} material={m.hair} position={[sx * 0.038, 0.045, 0.104]} rotation={[0, 0, sx * -0.12]} scale={[0.034, 0.007, 0.006]} />
            ))}
            <Hair style={avatar.hair} mats={m} />
            {equipped === "shades" && (
              <group position={[0, 0.02, 0.108]}>
                {[-1, 1].map((sx) => <mesh key={sx} geometry={G.box} material={m.shades} position={[sx * 0.038, 0, 0]} scale={[0.045, 0.026, 0.008]} />)}
                <mesh geometry={G.box} material={m.shades} scale={[0.12, 0.006, 0.006]} position={[0, 0.01, 0]} />
              </group>
            )}
            {equipped === "aso-oke-cap" && avatar.hair !== "gele" && (
              <mesh geometry={G.cylClosed} material={m.asoOke} position={[0.02, 0.12, -0.01]} rotation={[0.1, 0, -0.35]} scale={[0.11, 0.1, 0.115]} castShadow={cs} />
            )}
          </group>
          {equipped === "gold-chain" && <mesh geometry={G.torus} material={m.gold} position={[0, 0.4, 0.04]} rotation={[1.25, 0, 0]} scale={[0.085, 0.085, 0.4]} />}

          {/* Arms */}
          {([[-1, lArm, lFore], [1, rArm, rFore]] as const).map(([side, arm, fore]) => (
            <group key={side} ref={arm} position={[side * shoulderW, 0.4, 0]}>
              <mesh geometry={G.sphere} material={sleeve} scale={[0.065, 0.06, 0.065]} castShadow={cs} />
              {limb(avatar.outfit === "agbada" ? 0.085 : 0.05, 0.22, shortSleeve ? m.top : sleeve, -0.15, cs)}
              <group ref={fore} position={[0, -0.3, 0]}>
                {limb(0.043, 0.2, avatar.outfit === "streetwear" || avatar.outfit === "office" || avatar.outfit === "kaftan" ? sleeve : m.skin, -0.13, cs)}
                <mesh geometry={G.sphere} material={m.skin} position={[0, -0.29, 0.01]} scale={[0.04, 0.055, 0.025]} castShadow={cs} />
              </group>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

function limb(r: number, len: number, material: THREE.Material, y: number, cs: boolean) {
  return <mesh geometry={G.limb} material={material} position={[0, y, 0]} scale={[r, len / 2, r]} castShadow={cs} />;
}

function Hair({ style, mats }: { style: Avatar["hair"]; mats: ReturnType<typeof useMaterials> }) {
  const h = mats.hair;
  switch (style) {
    case "bald":
      return null;
    case "lowcut":
      return <mesh geometry={G.sphere} material={h} position={[0, 0.025, -0.008]} scale={[0.109, 0.118, 0.117]} />;
    case "afro":
      return <mesh geometry={G.sphere} material={h} position={[0, 0.07, -0.02]} scale={[0.17, 0.15, 0.16]} />;
    case "braids":
    case "locs": {
      const thick = style === "locs" ? 0.017 : 0.01;
      const len = style === "locs" ? 0.26 : 0.32;
      const strands = [];
      for (let i = 0; i < 14; i++) {
        const a = -Math.PI * 0.85 + (i / 13) * Math.PI * 1.7;
        strands.push(
          <mesh key={i} geometry={G.limb} material={h} position={[Math.sin(a) * 0.105, -0.06, -Math.cos(a) * 0.1 - 0.01]} rotation={[-0.1 * Math.cos(a), 0, 0.08 * Math.sin(a)]} scale={[thick, len / 2, thick]} />,
        );
      }
      return (
        <group>
          <mesh geometry={G.sphere} material={h} position={[0, 0.03, -0.01]} scale={[0.112, 0.12, 0.12]} />
          {strands}
        </group>
      );
    }
    case "gele":
      return (
        <group position={[0, 0.07, -0.015]}>
          <mesh geometry={G.sphere} material={mats.accent} scale={[0.13, 0.1, 0.13]} />
          <mesh geometry={G.cone} material={mats.accent} position={[0, 0.09, -0.02]} rotation={[-0.3, 0, 0]} scale={[0.2, 0.14, 0.14]} />
          <mesh geometry={G.torus} material={mats.accent} position={[0, 0.03, 0]} rotation={[Math.PI / 2 - 0.2, 0, 0]} scale={[0.135, 0.135, 0.5]} />
          <mesh geometry={G.sphere} material={mats.accent} position={[0.12, 0.13, -0.03]} rotation={[0, 0, -0.7]} scale={[0.09, 0.03, 0.08]} />
          <mesh geometry={G.sphere} material={mats.accent} position={[-0.12, 0.13, -0.03]} rotation={[0, 0, 0.7]} scale={[0.09, 0.03, 0.08]} />
        </group>
      );
  }
}
