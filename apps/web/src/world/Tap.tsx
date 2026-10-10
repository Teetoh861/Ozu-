import { useEffect, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { PLACES, getMap, type Building } from "@ozu/shared";
import { useGame } from "../state/store";
import { nav, navigateTo } from "./nav";

/** A tap is a short press without much movement — drags rotate the camera instead. */
export function isTap(e: ThreeEvent<MouseEvent>) {
  return e.delta < 10;
}

/** Invisible ground plane: tap anywhere to walk there. */
export function TapPlane() {
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[0, 0.02, 0]}
      onClick={(e) => {
        if (!isTap(e)) return;
        e.stopPropagation();
        navigateTo(e.point.x, e.point.z);
      }}
    >
      <planeGeometry args={[130, 130]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

/** Tapping a building opens its place (e.g. tap the Library to take the quiz) or walks to its front door. */
export function onBuildingTap(b: Building) {
  return (e: ThreeEvent<MouseEvent>) => {
    if (!isTap(e)) return;
    e.stopPropagation();
    const g = useGame.getState();
    const place = PLACES.find((p) => p.buildingId === b.id && p.map === g.map);
    if (place) {
      const loc = getMap(g.map).locations.find((l) => l.id === place.id);
      if (loc) return navigateTo(loc.x, loc.z, place.id);
    }
    // No activity here: walk to the front of the building.
    const fx = Math.sin(b.facing), fz = Math.cos(b.facing);
    const depth = Math.abs(fx) > 0.5 ? b.w : b.d;
    navigateTo(b.x + fx * (depth / 2 + 2), b.z + fz * (depth / 2 + 2));
  };
}

const markerMat = new THREE.MeshBasicMaterial({ color: "#f6c700", transparent: true, opacity: 0.85, depthWrite: false });
const dotGeo = new THREE.CircleGeometry(0.12, 10);

/** Destination ring and breadcrumb dots along the route. */
export function NavMarker() {
  const target = useGame((s) => s.navTarget);
  const ring = useRef<THREE.Mesh>(null);
  const dots = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ring.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 5) * 0.12;
      ring.current.scale.set(s, s, s);
    }
    const g = dots.current;
    if (!g) return;
    let k = 0;
    const pts = nav.path;
    let px = 0, pz = 0;
    for (let i = 0; i < pts.length && k < g.children.length; i++) {
      const [x, z] = pts[i];
      if (i > 0) {
        [px, pz] = pts[i - 1];
        const d = Math.hypot(x - px, z - pz);
        for (let t = 1.2; t < d && k < g.children.length; t += 1.2, k++) g.children[k].position.set(px + ((x - px) * t) / d, 0.05, pz + ((z - pz) * t) / d);
      }
    }
    for (; k < g.children.length; k++) g.children[k].position.set(0, -10, 0);
  });
  if (!target) return null;
  return (
    <group>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[target.x, 0.06, target.z]} material={markerMat}>
        <ringGeometry args={[0.45, 0.65, 32]} />
      </mesh>
      <group ref={dots}>
        {Array.from({ length: 60 }).map((_, i) => (
          <mesh key={i} geometry={dotGeo} material={markerMat} rotation-x={-Math.PI / 2} position={[0, -10, 0]} />
        ))}
      </group>
    </group>
  );
}

// ---------------- Photo capture ----------------

export const capture: { take: (() => string | null) | null } = { take: null };

/** Lets the UI grab a frame of the 3D scene for the 📸 share feature. */
export function CaptureHook() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    capture.take = () => {
      try {
        gl.render(scene, camera);
        return gl.domElement.toDataURL("image/jpeg", 0.9);
      } catch {
        return null;
      }
    };
    return () => {
      capture.take = null;
    };
  }, [gl, scene, camera]);
  return null;
}
