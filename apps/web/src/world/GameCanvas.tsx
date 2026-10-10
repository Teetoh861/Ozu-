import { Suspense, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import * as THREE from "three";
import { camState, useGame } from "../state/store";
import { District } from "./District";
import { Lighting } from "./Lighting";
import { LocalPlayer, RemotePlayers, useBubbleSweep } from "./Players";
import { LabelProjector } from "./labels";
import { ChallengeItems, EventMarker, LocationMarkers, NPCs } from "./Activities";

export function GameCanvas() {
  const quality = useGame((s) => s.settings.quality);
  const map = useGame((s) => s.map);
  const high = quality === "high";
  useBubbleSweep();
  useCameraControls();
  return (
    <Canvas
      className="game-canvas"
      shadows={high ? "soft" : false}
      dpr={high ? [1, 2] : [0.75, 1]}
      gl={{ antialias: high, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
      camera={{ fov: 55, near: 0.1, far: 400, position: [0, 4, 0] }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          useGame.getState().toast("Graphics were reset by your browser. Switching to low quality.", "warn");
          useGame.getState().updateSettings({ quality: "low" });
        });
      }}
    >
      <Suspense fallback={null}>
        <Lighting shadows={high} />
        <District quality={quality} map={map} />
        <LocationMarkers key={`m-${map}`} />
        <EventMarker />
        <ChallengeItems />
        <NPCs key={`n-${map}`} map={map} count={high ? 14 : 6} />
        <RemotePlayers />
        <LocalPlayer />
        <LabelProjector />
      </Suspense>
      <AdaptiveDpr pixelated />
    </Canvas>
  );
}

/** Drag to orbit (mouse or the right side of a touch screen), wheel/pinch to zoom. */
function useCameraControls() {
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  useEffect(() => {
    const isCanvas = (t: EventTarget | null) => t instanceof HTMLCanvasElement;
    const down = (e: PointerEvent) => {
      if (!isCanvas(e.target)) return;
      if (e.pointerType === "touch" && e.clientX < window.innerWidth * 0.4) return; // joystick zone
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const { sensitivity, invertY } = useGame.getState().settings;
      const s = 0.005 * sensitivity;
      camState.yaw -= (e.clientX - d.x) * s;
      camState.pitch = Math.max(0.05, Math.min(1.25, camState.pitch + (e.clientY - d.y) * s * (invertY ? -1 : 1)));
      d.x = e.clientX;
      d.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (drag.current?.id === e.pointerId) drag.current = null;
    };
    const wheel = (e: WheelEvent) => {
      if (!isCanvas(e.target)) return;
      camState.dist = Math.max(3, Math.min(16, camState.dist + e.deltaY * 0.01));
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("wheel", wheel, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("wheel", wheel);
    };
  }, []);
}
