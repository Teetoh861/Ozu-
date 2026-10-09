import { useEffect } from "react";
import { useGame } from "../state/store";

/**
 * Procedural ambient city sound (traffic rumble + occasional danfo horns) via WebAudio,
 * so we ship no audio files. Captions provide a text alternative for audio cues.
 */
export function useAmbientSound() {
  const enabled = useGame((s) => s.settings.sound);
  useEffect(() => {
    if (!enabled) return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx: AudioContext = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);

    // Brown noise → low-pass = distant traffic
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    noise.connect(lp).connect(master);
    noise.start();

    const horn = () => {
      const t = ctx.currentTime;
      for (const [f, start] of [[392, 0], [440, 0], [392, 0.32], [440, 0.32]] as const) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t + start);
        g.gain.linearRampToValueAtTime(0.05, t + start + 0.02);
        g.gain.linearRampToValueAtTime(0, t + start + 0.22);
        o.connect(g).connect(master);
        o.start(t + start);
        o.stop(t + start + 0.25);
      }
      if (useGame.getState().settings.captions) useGame.getState().toast("🔊 A danfo horn honks in the distance", "info");
    };
    const timer = setInterval(() => Math.random() < 0.5 && horn(), 14000);
    const resume = () => void ctx.resume();
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });
    return () => {
      clearInterval(timer);
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      void ctx.close();
    };
  }, [enabled]);
}
