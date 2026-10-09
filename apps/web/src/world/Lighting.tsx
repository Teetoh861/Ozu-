import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import { local } from "../state/store";
import { env } from "./District";
import { daylight, gameHour } from "./time";

const dayFog = new THREE.Color("#e9d8c2");
const duskFog = new THREE.Color("#c98a6a");
const nightFog = new THREE.Color("#141a2e");
const tmp = new THREE.Color();

export function Lighting({ shadows }: { shadows: boolean }) {
  const sun = useRef<THREE.DirectionalLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const moon = useRef<THREE.DirectionalLight>(null!);
  const sky = useRef<any>(null);
  const sunPos = useRef(new THREE.Vector3(50, 80, 30));
  const { scene, gl } = useThree();

  useFrame(() => {
    const h = gameHour();
    const d = daylight(h);
    env.night = 1 - d;
    // Sun arc: rises east (+x) at 6am, sets west at 6:30pm. Lagos is near the equator, so the arc is high.
    const a = ((h - 6.25) / 12.5) * Math.PI;
    sunPos.current.set(Math.cos(a) * 100, Math.sin(a) * 100, -25);
    const elev = Math.max(0.05, Math.sin(a));

    const L = sun.current;
    L.position.set(local.x + sunPos.current.x * 0.4, Math.max(8, sunPos.current.y * 0.4), local.z + sunPos.current.z * 0.4);
    L.target.position.set(local.x, 0, local.z);
    L.target.updateMatrixWorld();
    const warm = 1 - Math.min(1, elev * 2.2);
    L.color.setRGB(1, 0.93 - warm * 0.25, 0.85 - warm * 0.45);
    L.intensity = 2.6 * d;

    // Nights stay readable: cool moonlight plus a brighter ambient floor.
    hemi.current.intensity = 1.1 + d * 0.5;
    hemi.current.color.setRGB(0.45 + d * 0.45, 0.52 + d * 0.38, 0.8 + d * 0.1);
    moon.current.intensity = (1 - d) * 1.1;
    moon.current.position.set(local.x - 30, 60, local.z + 20);

    const dusk = d > 0 && d < 1 ? 1 - Math.abs(d - 0.5) * 2 : 0;
    tmp.copy(nightFog).lerp(dayFog, d).lerp(duskFog, dusk * 0.6);
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(tmp);
    gl.toneMappingExposure = 1.05 - d * 0.1;

    if (sky.current?.material) {
      sky.current.material.uniforms.sunPosition.value.copy(sunPos.current.y > -10 ? sunPos.current : new THREE.Vector3(0, -10, -100));
    }
    scene.background = d < 0.02 ? nightFog : null;
  });

  return (
    <>
      <Sky ref={sky} distance={4500} turbidity={8} rayleigh={1.6} mieCoefficient={0.006} mieDirectionalG={0.8} />
      <hemisphereLight ref={hemi} args={["#cfe3ff", "#6b5440", 0.9]} />
      <directionalLight ref={moon} color="#9db8ff" intensity={0} />
      <directionalLight
        ref={sun}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-near={1}
        shadow-camera-far={200}
      />
      <fog attach="fog" args={["#e9d8c2", 70, 190]} />
    </>
  );
}
