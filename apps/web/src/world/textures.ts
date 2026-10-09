import * as THREE from "three";

const cache = new Map<string, THREE.Texture>();

function canvasTex(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat?: [number, number], srgb = true) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d")!);
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  cache.set(key, t);
  return t;
}

function rand(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function noise(c: CanvasRenderingContext2D, w: number, h: number, base: string, spread: number, n: number, seed = 1) {
  c.fillStyle = base;
  c.fillRect(0, 0, w, h);
  const r = rand(seed);
  for (let i = 0; i < n; i++) {
    const v = Math.floor((r() - 0.5) * spread);
    c.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`;
    c.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
}

export const asphalt = (rx: number, rz: number) =>
  canvasTex(`asphalt-${rx}-${rz}`, 256, 256, (c) => {
    noise(c, 256, 256, "#3a3a3d", 90, 9000, 3);
    // patches & stains — Lagos roads are well-used
    const r = rand(9);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = `rgba(20,20,22,${0.15 + r() * 0.2})`;
      c.beginPath();
      c.ellipse(r() * 256, r() * 256, 10 + r() * 30, 6 + r() * 16, r() * 3, 0, Math.PI * 2);
      c.fill();
    }
  }, [rx, rz]);

export const paving = (rx: number, rz: number) =>
  canvasTex(`paving-${rx}-${rz}`, 256, 256, (c) => {
    // Interlocking paving stones
    noise(c, 256, 256, "#9a8f84", 40, 3000, 5);
    const r = rand(7);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const off = (y % 2) * 16;
        const tone = 140 + Math.floor(r() * 30);
        c.fillStyle = `rgb(${tone},${tone - 8},${tone - 18})`;
        c.fillRect(x * 32 + off - 32 + 2, y * 32 + 2, 28, 28);
        c.fillStyle = `rgb(${tone + 12},${tone + 4},${tone - 6})`;
        c.fillRect(x * 32 + off + 2, y * 32 + 2, 28, 28);
      }
  }, [rx, rz]);

export const plazaTiles = () =>
  canvasTex("plaza", 512, 512, (c) => {
    noise(c, 512, 512, "#c9b79c", 30, 4000, 11);
    c.strokeStyle = "rgba(90,70,50,0.35)";
    c.lineWidth = 3;
    for (let i = 0; i <= 512; i += 64) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 512); c.stroke();
      c.beginPath(); c.moveTo(0, i); c.lineTo(512, i); c.stroke();
    }
    c.fillStyle = "rgba(255,122,26,0.18)";
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 4 === 0) c.fillRect(i * 64 + 4, j * 64 + 4, 56, 56);
  }, [4, 4]);

export const grass = (rx: number, rz: number) =>
  canvasTex(`grass-${rx}-${rz}`, 256, 256, (c) => {
    noise(c, 256, 256, "#5c7a3a", 70, 12000, 13);
    const r = rand(17);
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(120,100,60,${0.15 + r() * 0.2})`;
      c.beginPath();
      c.arc(r() * 256, r() * 256, 4 + r() * 14, 0, Math.PI * 2);
      c.fill();
    }
  }, [rx, rz]);

export const ground = () =>
  canvasTex("ground", 256, 256, (c) => noise(c, 256, 256, "#8a7a62", 60, 9000, 19), [40, 40]);

/** Facade with windows. Returns [colour map, emissive map for lit windows at night]. */
export function facade(key: string, wallColor: string, cols: number, rows: number, kind: string): [THREE.Texture, THREE.Texture] {
  const W = 256, H = 256;
  const r = rand(key.length * 97 + cols * 13 + rows);
  const lit: boolean[] = [];
  const draw = (emissive: boolean) => (c: CanvasRenderingContext2D) => {
    if (emissive) {
      c.fillStyle = "#000";
      c.fillRect(0, 0, W, H);
    } else {
      noise(c, W, H, wallColor, 26, 2500, key.length);
      // rain streaks / weathering
      for (let i = 0; i < 18; i++) {
        c.fillStyle = `rgba(60,50,40,${0.04 + r() * 0.06})`;
        c.fillRect(r() * W, 0, 2 + r() * 5, H * (0.3 + r() * 0.7));
      }
    }
    const cw = W / cols, rh = H / rows;
    let k = 0;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++, k++) {
        const wx = x * cw + cw * 0.18, wy = y * rh + rh * 0.2, ww = cw * 0.64, wh = rh * 0.55;
        if (!emissive) lit[k] = r() > 0.45;
        if (emissive) {
          if (lit[k]) {
            c.fillStyle = r() > 0.3 ? "#ffd9a0" : "#bfe0ff";
            c.fillRect(wx, wy, ww, wh);
          }
          continue;
        }
        c.fillStyle = kind === "office" ? "#4d6a80" : "#2c3a44";
        c.fillRect(wx, wy, ww, wh);
        c.fillStyle = "rgba(255,255,255,0.18)";
        c.fillRect(wx, wy, ww * 0.45, wh);
        if (kind === "residential") {
          // Burglar-proof bars, a common Lagos detail
          c.strokeStyle = "rgba(30,30,30,0.85)";
          c.lineWidth = 1.5;
          for (let b = 1; b < 5; b++) {
            c.beginPath(); c.moveTo(wx + (ww * b) / 5, wy); c.lineTo(wx + (ww * b) / 5, wy + wh); c.stroke();
          }
          c.fillStyle = "rgba(0,0,0,0.25)";
          c.fillRect(wx - 2, wy + wh, ww + 4, 3);
        }
        if (kind === "office") {
          c.fillStyle = "rgba(0,0,0,0.2)";
          c.fillRect(x * cw, y * rh, cw, 2);
        }
      }
  };
  const map = canvasTex(`facade-${key}`, W, H, draw(false));
  const em = canvasTex(`facade-em-${key}`, W, H, draw(true));
  return [map, em];
}

export function signTexture(text: string, bg: string, fg = "#ffffff") {
  return canvasTex(`sign-${text}-${bg}`, 512, 128, (c) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, 512, 128);
    c.strokeStyle = "rgba(255,255,255,0.35)";
    c.lineWidth = 6;
    c.strokeRect(6, 6, 500, 116);
    c.fillStyle = fg;
    let size = 64;
    c.font = `700 ${size}px "Space Grotesk", "Arial Black", sans-serif`;
    while (c.measureText(text).width > 470 && size > 20) {
      size -= 2;
      c.font = `700 ${size}px "Space Grotesk", "Arial Black", sans-serif`;
    }
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, 256, 68);
  });
}

/** Ankara-style wax print pattern in a three-colour palette. */
export function ankara(palette: readonly string[], variant = 0) {
  return canvasTex(`ankara-${palette.join()}-${variant}`, 256, 256, (c) => {
    const [a, b, d] = palette;
    c.fillStyle = a;
    c.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        const cx = x * 64 + 32 + (y % 2) * 32, cy = y * 64 + 32;
        c.fillStyle = b;
        c.beginPath();
        c.arc(cx, cy, 22, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = d;
        c.beginPath();
        c.arc(cx, cy, 13, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = b;
        for (let k = 0; k < 8; k++) {
          const ang = (k / 8) * Math.PI * 2;
          c.beginPath();
          c.ellipse(cx + Math.cos(ang) * 28, cy + Math.sin(ang) * 28, 5, 2.5, ang, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = a;
        c.beginPath();
        c.arc(cx, cy, 5, 0, Math.PI * 2);
        c.fill();
      }
  }, [2, 2]);
}

/** Subtle fabric weave for plain garments. */
export function fabric(color: string) {
  return canvasTex(`fabric-${color}`, 128, 128, (c) => {
    c.fillStyle = color;
    c.fillRect(0, 0, 128, 128);
    c.globalAlpha = 0.08;
    for (let i = 0; i < 128; i += 2) {
      c.fillStyle = i % 4 ? "#fff" : "#000";
      c.fillRect(0, i, 128, 1);
      c.fillRect(i, 0, 1, 128);
    }
  }, [3, 3]);
}

export function danfoSide() {
  return canvasTex("danfo-side", 512, 128, (c) => {
    c.fillStyle = "#f6c700";
    c.fillRect(0, 0, 512, 128);
    c.fillStyle = "#111";
    c.fillRect(0, 70, 512, 7);
    c.fillRect(0, 86, 512, 7);
    c.fillStyle = "#1b1b1b";
    c.font = "700 22px Arial";
    c.fillText("OSHODI - OBALENDE", 150, 116);
  });
}
