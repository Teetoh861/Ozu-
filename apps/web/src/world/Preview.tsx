import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import type { Avatar } from "@ozu/shared";
import { Character, type Motion } from "./Character";

function Turntable({ avatar, equipped }: { avatar: Avatar; equipped: string | null }) {
  const g = useRef<THREE.Group>(null!);
  const motion = useRef<Motion>({ anim: "idle", speed: 0 });
  const t = useRef(0);
  useFrame((_, dt) => {
    g.current.rotation.y += dt * 0.5;
    t.current += dt;
    // Occasionally wave to show the rig moving.
    motion.current.anim = t.current % 9 > 7 ? "wave" : "idle";
  });
  return (
    <group ref={g}>
      <Character avatar={avatar} equipped={equipped} motion={motion} />
    </group>
  );
}

export function AvatarPreview({ avatar, equipped = null }: { avatar: Avatar; equipped?: string | null }) {
  return (
    <Canvas
      className="preview-canvas"
      dpr={[1, 2]}
      camera={{ fov: 30, position: [0, 1.3, 4.4] }}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ camera }) => camera.lookAt(0, 0.95, 0)}
    >
      <hemisphereLight args={["#fff4e6", "#5a4030", 1.1]} />
      <directionalLight position={[3, 5, 4]} intensity={2.2} color="#ffe8cc" />
      <directionalLight position={[-4, 2, -3]} intensity={0.9} color="#9ec5ff" />
      <Turntable avatar={avatar} equipped={equipped} />
      <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={4} blur={2.5} far={2} />
    </Canvas>
  );
}
