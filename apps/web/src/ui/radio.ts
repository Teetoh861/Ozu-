/**
 * Ozu FM — original, procedurally generated grooves via WebAudio.
 * No recordings are used, so there are no licensing issues. Licensed live
 * streams can be added later as stations with a `stream` URL.
 */

export interface Station {
  id: string;
  name: string;
  tagline: string;
  bpm: number;
  stream?: string;
}

export const STATIONS: Station[] = [
  { id: "afro", name: "Ozu FM 99.1 — Afro Vibes", tagline: "Danfo-ready Afrobeats grooves", bpm: 104 },
  { id: "piano", name: "Akoka 103 — Amapiano", tagline: "Log drums for Lagoon Front evenings", bpm: 112 },
  { id: "highlife", name: "Gold 88 — Highlife Classics", tagline: "Sunday-afternoon guitar, old-school feel", bpm: 120 },
];

const CHORDS: Record<string, number[][]> = {
  afro: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]],
  piano: [[50, 53, 57, 60], [48, 52, 55, 59], [46, 50, 53, 57], [45, 48, 52, 55]],
  highlife: [[55, 59, 62], [60, 64, 67], [62, 66, 69], [55, 59, 62]],
};
const BASS: Record<string, number[]> = { afro: [45, 41, 43, 40], piano: [38, 36, 34, 33], highlife: [43, 48, 50, 43] };

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

export class Radio {
  private ctx: AudioContext;
  private out: GainNode;
  private noise: AudioBuffer;
  private timer = 0;
  private step = 0;
  private nextTime = 0;
  private station: Station;

  constructor(stationId: string, volume = 0.5) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.out = this.ctx.createGain();
    this.out.gain.value = volume;
    const comp = this.ctx.createDynamicsCompressor();
    this.out.connect(comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.station = STATIONS.find((s) => s.id === stationId) ?? STATIONS[0];
  }

  start() {
    void this.ctx.resume();
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  setVolume(v: number) {
    this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  stop() {
    clearInterval(this.timer);
    this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    setTimeout(() => void this.ctx.close(), 400);
  }

  private schedule() {
    const sixteenth = 60 / this.station.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.play(this.step, this.nextTime);
      // Light swing on off-beats gives a human feel.
      this.nextTime += sixteenth * (this.step % 2 ? 0.9 : 1.1);
      this.step = (this.step + 1) % 64;
    }
  }

  private play(step: number, t: number) {
    const s = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const id = this.station.id;
    if (id === "afro") {
      if (s === 0 || s === 7 || s === 10) this.kick(t);
      if (s === 4 || s === 12) this.clap(t);
      this.shaker(t, s % 4 === 2 ? 0.16 : 0.07);
      if (s === 3 || s === 11) this.rim(t);
      if ([0, 3, 6, 10, 13].includes(s)) this.bass(t, BASS.afro[bar] + (s === 13 ? 7 : 0), 0.18);
      if (s === 2 || s === 10) this.chord(t, CHORDS.afro[bar], 0.12, "triangle");
      if (s === 0 && bar === 0) this.bell(t, 81);
    } else if (id === "piano") {
      if (s % 4 === 0) this.kick(t, 0.8);
      if (s === 8) this.clap(t);
      this.shaker(t, s % 2 ? 0.05 : 0.11);
      if ([0, 3, 6, 9, 11, 14].includes(s)) this.logDrum(t, BASS.piano[bar] + (s === 11 ? 5 : s === 14 ? 7 : 0));
      if (s === 0 || s === 6 || s === 12) this.chord(t, CHORDS.piano[bar], 0.32, "sine");
    } else {
      if (s === 0 || s === 8) this.kick(t, 0.7);
      if (s === 4 || s === 12) this.rim(t);
      this.shaker(t, 0.06);
      if (s % 2 === 0) {
        const c = CHORDS.highlife[bar];
        this.pluck(t, c[(s / 2) % c.length] + 12, 0.11);
      }
      if (s === 0 || s === 6 || s === 10) this.bass(t, BASS.highlife[bar], 0.2);
      if (s === 14) this.pluck(t, CHORDS.highlife[bar][2] + 14, 0.08);
    }
  }

  private env(t: number, peak: number, decay: number, attack = 0.005) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.out);
    return g;
  }

  private kick(t: number, v = 1) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    o.connect(this.env(t, 0.9 * v, 0.28));
    o.start(t);
    o.stop(t + 0.35);
  }

  private noiseHit(t: number, type: BiquadFilterType, freq: number, peak: number, decay: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    src.connect(f).connect(this.env(t, peak, decay, 0.002));
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.05);
  }

  private clap(t: number) {
    this.noiseHit(t, "bandpass", 1500, 0.5, 0.14);
    this.noiseHit(t + 0.012, "bandpass", 1200, 0.3, 0.1);
  }
  private shaker(t: number, v: number) {
    this.noiseHit(t, "highpass", 7000, v, 0.05);
  }
  private rim(t: number) {
    const o = this.ctx.createOscillator();
    o.type = "square";
    o.frequency.value = 820;
    o.connect(this.env(t, 0.08, 0.03));
    o.start(t);
    o.stop(t + 0.06);
  }

  private tone(t: number, midi: number, type: OscillatorType, peak: number, decay: number, attack = 0.005) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz(midi);
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 2200;
    o.connect(f).connect(this.env(t, peak, decay, attack));
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  private bass(t: number, midi: number, v: number) {
    this.tone(t, midi, "sine", v * 2, 0.32);
    this.tone(t, midi + 12, "triangle", v * 0.3, 0.12);
  }
  private logDrum(t: number, midi: number) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(hz(midi + 12), t);
    o.frequency.exponentialRampToValueAtTime(hz(midi), t + 0.06);
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    o.connect(f).connect(this.env(t, 0.55, 0.38));
    o.start(t);
    o.stop(t + 0.45);
  }
  private chord(t: number, notes: number[], dur: number, type: OscillatorType) {
    for (const n of notes) this.tone(t, n, type, 0.06, dur, 0.02);
  }
  private pluck(t: number, midi: number, v: number) {
    this.tone(t, midi, "triangle", v, 0.25, 0.002);
    this.tone(t, midi + 12, "sine", v * 0.3, 0.12, 0.002);
  }
  private bell(t: number, midi: number) {
    this.tone(t, midi, "sine", 0.05, 0.6, 0.002);
  }
}
