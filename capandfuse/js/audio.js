// Cap & Fuse audio: an 8-bit soundtrack played live by a little NES-style
// sound chip built with Web Audio: two pulse channels (12.5/25/50% duty),
// a stepped triangle bass, and an LFSR noise channel for drums. Volume and
// vibrato update 60 times a second, like real NES sound drivers.

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return null;
  return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
const CHORD_Q = { "": [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dim: [0, 3, 6], sus4: [0, 5, 7] };
function chord(name) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(name);
  const root = 36 + NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  return { root, iv: CHORD_Q[m[3]] || CHORD_Q[""] };
}
function degree(ch, d) {
  const iv = ch.iv;
  switch (d) {
    case "1": return ch.root; case "3": return ch.root + iv[1]; case "5": return ch.root + iv[2];
    case "7": return ch.root + (iv[3] != null ? iv[3] : 12); case "8": return ch.root + 12; case "0": return ch.root - 5;
    default: return null;
  }
}
const FRAME = 1 / 60;

// ---------------------------------------------------------------------------
// THE SOUNDTRACK. Melody tokens are 8th notes: "-" holds, "." rests.
// Fuse's Theme hook: G G . G E G C' -  /  B A G E F E D .
// (repeated notes, then a leap: the earworm recipe)
// ---------------------------------------------------------------------------
const BASS = {
  bounce: "1 . 8 . 1 . 8 . 1 . 8 . 5 . 8 .",
  octave: "1 8 1 8 1 8 1 8 1 8 1 8 5 8 5 8",
  island: "1 . . 1 . . 5 . 8 . . 5 . . 3 .",
  walk: "1 . 3 . 5 . 8 . 7 . 5 . 3 . 5 .",
  soft: "1 - - - 5 - - - 8 - - - 5 - - -",
  funk: "1 . 1 8 . 1 . 7 . 1 . 8 . 5 7 8",
  drive: "1 1 8 1 1 8 1 1 8 1 1 8 5 5 8 5",
  march: "1 . 5 . 8 . 5 . 1 . 5 . 8 . 5 .",
};
const DRUMS = {
  pop: { k: "x.......x.x.....", s: "....x.......x...", h: "x.x.x.x.x.x.x.xo" },
  island: { k: "x..x..x...x..x..", s: "....x.......x...", h: "xx.xx.xxxx.xx.xx" },
  funk: { k: "x..x......x.x...", s: "....x..x.x..x...", h: "x.xxx.xxx.xxx.xo" },
  drive: { k: "x.x.x.x.x.x.x.x.", s: "....x.......x.xx", h: "xxxxxxxxxxxxxxxx" },
  light: { k: "x.......x.......", s: "....x.......x...", h: "..x...x...x...x." },
  shaker: { h: "x.xxx.xxx.xxx.xx" },
  march: { k: "x...x...x...x...", s: "..x...x...x.x.xx", h: "x.x.x.x.x.x.x.x." },
  none: {},
};

export const TRACKS = {
  menu: { title: "Main Menu: Fuse's Theme", bpm: 150, chords: "C G Am F C E F G",
    lead: { duty: 0.25, vol: 1, notes:
      "G5 G5 . G5 E5 G5 C6 - B5 A5 G5 E5 F5 E5 D5 . G5 G5 . G5 E5 G5 C6 - D6 C6 A5 F5 A5 G5 F5 . " +
      "G5 G5 . G5 E5 G5 C6 - B5 - G#5 - B5 D6 E6 - D6 C6 A5 C6 D6 C6 A5 F5 G5 - - . D5 E5 F5 F#5" },
    p2: "echo", echo: { delay: 3, vol: 0.32, duty: 0.125 },
    bass: BASS.bounce, drums: DRUMS.pop },

  home: { title: "Fuse's Home", bpm: 104, chords: "F Dm Bb C F Am Bb C7",
    lead: { duty: 0.5, vol: 0.8, notes:
      "C5 C5 . C5 A4 C5 F5 - E5 D5 C5 A4 Bb4 A4 G4 . D5 D5 . D5 Bb4 D5 F5 - E5 - D5 - C5 - . . " +
      "C5 C5 . C5 A4 C5 F5 - A5 - G5 - E5 - C5 - D5 F5 Bb5 - A5 G5 F5 D5 E5 - - - G4 A4 Bb4 B4" },
    p2: "arp", arp: { duty: 0.125, vol: 0.28, pat: "x.x.x.x.x.x.x.x." },
    bass: BASS.soft, drums: DRUMS.shaker },

  blossom: { title: "Blossom Bay", bpm: 146, chords: "G G C D G Em C D Em C G D Em C Am D7",
    lead: { duty: 0.25, vol: 1, notes:
      "D5 . G5 G5 . G5 A5 B5 D6 - B5 . G5 A5 B5 . E5 . C6 C6 . B5 A5 G5 F#5 - A5 - D5 - . . " +
      "D5 . G5 G5 . G5 A5 B5 D6 - E6 . D6 B5 G5 . E6 D6 C6 B5 A5 G5 A5 C6 B5 - A5 - - . D5 . " +
      "B5 - - G5 E5 - G5 - C6 - - B5 A5 - E5 - D5 - G5 - B5 - D6 - C6 - B5 - A5 - F#5 - " +
      "B5 - - G5 E5 - G5 - C6 - - D6 E6 - C6 - A5 B5 C6 D6 E6 D6 C6 A5 F#5 - - . A5 - C6 ." },
    p2: "echo", echo: { delay: 3, vol: 0.3, duty: 0.5 },
    bass: BASS.island, drums: DRUMS.island },

  candy: { title: "Candy Cloud Kingdom", bpm: 132, chords: "A C#m D E A F#m D E7",
    lead: { duty: 0.125, vol: 1, notes:
      "E5 A5 C#6 A5 E5 A5 C#6 E6 C#6 - B5 G#5 E5 - . . F#5 A5 D6 A5 F#5 A5 D6 F#6 E6 - D6 B5 G#5 - . . " +
      "E5 A5 C#6 A5 E5 A5 C#6 E6 F#6 - E6 C#6 A5 - C#6 - D6 C#6 B5 A5 F#5 A5 B5 D6 E6 - - . D6 - B5 ." },
    p2: "echo", echo: { delay: 2, vol: 0.35, duty: 0.25 },
    bass: BASS.walk, drums: DRUMS.light },

  ember: { title: "Ember City", bpm: 140, chords: "Em Em C D Em Em C B7",
    lead: { duty: 0.5, vol: 0.85, notes:
      "E5 E5 . E5 G5 . A5 . B5 . A5 G5 A5 - . . E5 E5 . E5 G5 . A5 . D6 . C6 B5 A5 - . . " +
      "E5 E5 . E5 G5 . A5 . B5 . D6 . E6 - D6 B5 C6 . B5 . A5 G5 A5 . B5 - D#5 - F#5 - A5 ." },
    p2: "echo", echo: { delay: 1, vol: 0.38, duty: 0.25 },
    bass: BASS.funk, drums: DRUMS.funk },

  forest: { title: "The Forgotten Forest", bpm: 112, chords: "Dm C Bb C Dm F G A",
    lead: { duty: 0.5, vol: 0.8, notes:
      "A4 D5 E5 F5 . E5 D5 . E5 - C5 - G4 - . . A4 D5 E5 F5 . G5 A5 . G5 - E5 - C5 - . . " +
      "D6 - A5 - F5 - D5 - C6 - A5 - F5 - C5 - B5 - G5 - D5 - B4 - C#5 - E5 - A5 - - ." },
    p2: "echo", echo: { delay: 4, vol: 0.3, duty: 0.125 },
    bass: BASS.soft, drums: DRUMS.shaker },

  summit: { title: "Starfall Summit", bpm: 138, chords: "Bm G D A Bm G Em F#",
    lead: { duty: 0.25, vol: 1, notes:
      "F#5 F#5 . F#5 B5 . C#6 D6 D6 - B5 - G5 - . . F#5 F#5 . F#5 A5 . D6 E6 E6 - C#6 - A5 - . . " +
      "F#5 F#5 . F#5 B5 . C#6 D6 G6 - F#6 - E6 - D6 - E6 - D6 C#6 B5 - G5 - A#5 - - . C#6 - F#5 ." },
    p2: "arp", arp: { duty: 0.125, vol: 0.26, pat: "xxxxxxxxxxxxxxxx" },
    bass: BASS.march, drums: DRUMS.march },

  boss: { title: "Boss Battle", bpm: 168, chords: "Dm Dm Bb C Dm Dm Gm A",
    lead: { duty: 0.25, vol: 1, notes:
      "D5 D5 D6 D5 C6 D5 A5 . D5 D5 D6 D5 C6 A5 F5 E5 D5 D5 D6 D5 C6 D5 Bb5 . C6 - Bb5 - G5 - E5 - " +
      "D5 D5 D6 D5 C6 D5 A5 . F5 G5 A5 D6 E6 F6 E6 D6 Bb5 - A5 G5 F5 - G5 - A5 - C#6 - E6 - A5 ." },
    p2: "echo", echo: { delay: 2, vol: 0.34, duty: 0.125 },
    bass: BASS.drive, drums: DRUMS.drive },

  finalboss: { title: "Final Boss: Grizzle", bpm: 176, chords: "Cm Ab Bb G Cm Ab Fm G",
    lead: { duty: 0.5, vol: 0.85, notes:
      "G5 G5 . G5 Eb5 G5 C6 - B5 Ab5 G5 Eb5 F5 Eb5 D5 . Bb5 Bb5 . Bb5 F5 Bb5 D6 - D6 - B5 - G5 - F5 D5 " +
      "G5 G5 . G5 Eb5 G5 C6 - Eb6 - D6 C6 Ab5 - C6 - F6 Eb6 D6 C6 Ab5 F5 Ab5 C6 B5 - D6 - G6 - F6 D6" },
    p2: "arp", arp: { duty: 0.125, vol: 0.27, pat: "xxxxxxxxxxxxxxxx" },
    bass: BASS.drive, drums: DRUMS.drive },

  emotional: { title: "A Quiet Sky", bpm: 84, chords: "Am F C G Am F Dm E",
    lead: { duty: 0.5, vol: 0.75, notes:
      "E5 E5 . E5 C5 E5 A5 - G5 F5 E5 C5 D5 C5 B4 . E5 E5 . E5 C5 E5 G5 - G5 - F5 - E5 - D5 - " +
      "E5 E5 . E5 C5 E5 A5 - C6 - B5 A5 F5 - A5 - F5 E5 D5 F5 A5 - G5 F5 E5 - - - G#4 - B4 ." },
    p2: "arp", arp: { duty: 0.125, vol: 0.2, pat: "x...x...x...x..." },
    bass: BASS.soft, drums: DRUMS.none },

  victory: { title: "Victory!", jingle: true, bpm: 150, chords: "C G C",
    lead: { duty: 0.25, vol: 1, notes: "G5 G5 . G5 E5 G5 C6 - D6 D6 . D6 B5 D6 G6 - C6 - E6 - G6 - - -" },
    p2: "arp", arp: { duty: 0.125, vol: 0.3, pat: "xxxxxxxxxxxxxxxx" },
    bass: "1 . 8 . 1 . 8 . 5 . 8 . 1 - - -",
    drums: { k: "x...x...x...x...", s: "............xxxx", h: "x.x.x.x.x.x.x.x." } },

  credits: { title: "Credits: Thanks for Playing", bpm: 132, chords: "C G Am F C E F G F G Em Am Dm G C C",
    lead: { duty: 0.25, vol: 1, notes:
      "G5 G5 . G5 E5 G5 C6 - B5 A5 G5 E5 F5 E5 D5 . G5 G5 . G5 E5 G5 C6 - D6 C6 A5 F5 A5 G5 F5 . " +
      "G5 G5 . G5 E5 G5 C6 - B5 - G#5 - B5 D6 E6 - D6 C6 A5 C6 D6 C6 A5 F5 G5 - - . . . . . " +
      "A5 - C6 - F6 - E6 D6 D6 - B5 - G5 - B5 D6 E6 - B5 - G5 - E6 D6 C6 - - - A5 B5 C6 D6 " +
      "F6 - E6 - D6 - A5 - B5 - D6 - G6 - F6 D6 E6 - C6 - G5 - E5 G5 C6 - - - D5 E5 F5 F#5" },
    p2: "echo", echo: { delay: 3, vol: 0.3, duty: 0.5 },
    bass: BASS.walk, drums: DRUMS.pop },
};

export const TRACK_ORDER = ["menu", "home", "blossom", "candy", "ember", "forest", "summit", "boss", "finalboss", "emotional", "victory", "credits"];

function compile(t) {
  const chords = t.chords.split(/\s+/).map(chord);
  const bars = chords.length;
  const mel = [];
  const toks = t.lead.notes.trim().split(/\s+/);
  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i];
    if (tk === "-" || tk === ".") continue;
    let len = 1; while (toks[i + len] === "-") len++;
    mel.push({ step: i * 2, len: len * 2, n: midi(tk), afterRest: i === 0 || toks[i - 1] === "." });
  }
  const melAt = new Map(); for (const n of mel) melAt.set(n.step, n);
  const bassP = t.bass.trim().split(/\s+/);
  return { ...t, chordsC: chords, bars, mel, melAt, steps: bars * 16, bassP };
}
const COMPILED = {};
for (const k in TRACKS) COMPILED[k] = compile(TRACKS[k]);

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.7; this.sfxVol = 0.8; this.musicMuted = false; this.sfxMuted = false;
    this.current = null; this.voices = [];
    this.intensity = 0;
    this.onCaption = null;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createDynamicsCompressor();
    this.master.threshold.value = -10; this.master.ratio.value = 3;
    this.master.connect(ctx.destination);
    // NES output filtering: a low cut around 90 Hz and a high cut around 12 kHz
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 90;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 12000;
    hp.connect(lp); lp.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.connect(hp);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(hp);
    this.duck = ctx.createGain(); this.duck.connect(this.musicBus);
    this.sfxVerb = ctx.createGain(); this.sfxVerb.gain.value = 0; // dry, like the real chip
    this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0;
    this._makeWaves();
    this.applyVolumes();
    this.timer = setInterval(() => this._schedule(), 25);
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
    });
    if (this.pending) { const p = this.pending; this.pending = null; this.play(p); }
  }

  _makeWaves() {
    const ctx = this.ctx, N = 64;
    this.pulse = {};
    for (const d of [0.125, 0.25, 0.5]) {
      const re = new Float32Array(N), im = new Float32Array(N);
      for (let n = 1; n < N; n++) re[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * d);
      this.pulse[d] = ctx.createPeriodicWave(re, im);
    }
    // the NES triangle is a 32-step staircase, which gives it that gritty buzz
    const S = 32, steps = [];
    for (let i = 0; i < S; i++) steps.push(i < 16 ? 15 - i : i - 16);
    const re = new Float32Array(N), im = new Float32Array(N);
    for (let n = 1; n < N; n++) {
      let a = 0, b = 0;
      for (let i = 0; i < S; i++) { const v = steps[i] / 7.5 - 1; const ph0 = (2 * Math.PI * n * i) / S, ph1 = (2 * Math.PI * n * (i + 1)) / S; a += v * (Math.sin(ph1) - Math.sin(ph0)) / (n * Math.PI); b += v * (Math.cos(ph0) - Math.cos(ph1)) / (n * Math.PI); }
      re[n] = a; im[n] = b;
    }
    this.tri = ctx.createPeriodicWave(re, im);
    // LFSR noise: long mode (hiss) and short mode (metallic), clocked once per sample
    const mk = (tap) => {
      const len = tap === 6 ? 93 * 64 : 32767, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let r = 1;
      for (let i = 0; i < len; i++) { const fb = (r & 1) ^ ((r >> tap) & 1); r = (r >> 1) | (fb << 14); d[i] = r & 1 ? -1 : 1; }
      return buf;
    };
    this.noiseLong = mk(1); this.noiseShort = mk(6);
    this.noise = this.noiseLong;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.musicMuted ? 0 : this.musicVol * 0.5, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.sfxMuted ? 0 : this.sfxVol * 0.55, t, 0.05);
  }
  setVolumes(o) { Object.assign(this, o); this.applyVolumes(); }

  // ---------------- music ----------------
  play(name, fade = 1.2) {
    if (!this.ctx) { this.pending = name; return; }
    if (this.current && this.current.name === name) return;
    const t = this.ctx.currentTime;
    if (this.current) {
      const old = this.current;
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + fade);
      old.stopAt = t + fade;
      this.voices.push(old);
    }
    if (!name || !COMPILED[name]) { this.current = null; return; }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + Math.min(fade, 0.6));
    g.connect(this.duck);
    this.current = { name, tr: COMPILED[name], gain: g, step: 0, next: t + 0.08 };
  }
  stopMusic(fade = 1) { this.play(null, fade); }
  get trackName() { return this.current ? this.current.name : null; }

  jingle(name) {
    if (!this.ctx || !COMPILED[name]) return;
    const tr = COMPILED[name], t = this.ctx.currentTime + 0.05;
    const spb = 60 / tr.bpm / 4, dur = tr.steps * spb;
    this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setTargetAtTime(0.06, t, 0.05);
    this.duck.gain.setTargetAtTime(1, t + dur - 0.2, 0.4);
    const g = this.ctx.createGain(); g.gain.value = 1; g.connect(this.musicBus);
    for (let s = 0; s < tr.steps; s++) this._playStep(tr, s, t + s * spb, spb, g);
  }

  _schedule() {
    const ctx = this.ctx; if (!ctx) return;
    const ahead = ctx.currentTime + 0.15;
    this.voices = this.voices.filter((v) => {
      if (ctx.currentTime > v.stopAt) { try { v.gain.disconnect(); } catch (e) {} return false; }
      while (v.next < Math.min(ahead, v.stopAt)) this._advance(v);
      return true;
    });
    const c = this.current;
    if (!c) return;
    if (c.next < ctx.currentTime - 0.5) c.next = ctx.currentTime + 0.05;
    while (c.next < ahead) {
      if (c.tr.jingle && c.step >= c.tr.steps) { this.current = null; return; }
      this._advance(c);
    }
  }
  _advance(v) {
    const tr = v.tr, boost = tr === COMPILED.boss ? 1 + this.intensity * 0.05 : 1;
    const spb = 60 / (tr.bpm * boost) / 4;
    this._playStep(tr, v.step % tr.steps, v.next, spb, v.gain);
    v.step++; v.next += spb;
  }

  _playStep(tr, s, t, spb, out) {
    const bar = Math.floor(s / 16) % tr.bars, inBar = s % 16;
    const ch = tr.chordsC[bar];
    // pulse 1: lead
    const n = tr.melAt.get(s);
    if (n) this.pulseNote(tr.lead.duty, n.n, t, n.len * spb, 0.3 * tr.lead.vol, out, { vib: n.len >= 4, slide: n.afterRest });
    // pulse 2: echo of the lead, or chord arpeggios
    if (tr.p2 === "echo") {
      const e = tr.echo, src = tr.melAt.get((s - e.delay + tr.steps) % tr.steps);
      if (src) this.pulseNote(e.duty, src.n, t, Math.max(1, src.len - 0.5) * spb, 0.3 * tr.lead.vol * e.vol, out, { detune: 8 });
    } else if (tr.p2 === "arp" && tr.arp.pat[inBar] === "x") {
      this.arpNote(tr.arp.duty, ch, t, spb * (tr.arp.pat[inBar + 1] === "x" ? 1 : 2), 0.3 * tr.arp.vol, out);
    }
    // triangle: bass
    const d = tr.bassP[inBar];
    if (d && d !== "." && d !== "-") {
      let len = 1; while (tr.bassP[inBar + len] === "-") len++;
      let bn = degree(ch, d); if (bn < 40) bn += 12;
      this.triNote(bn, t, len * spb * (len > 1 ? 0.98 : 0.8), out);
    }
    // noise: drums
    const dr = tr.drums || {};
    if (dr.k && dr.k[inBar] === "x") this.drum("kick", t, out);
    if (dr.s && dr.s[inBar] === "x") this.drum("snare", t, out);
    if (dr.h) { if (dr.h[inBar] === "x") this.drum("hat", t, out); else if (dr.h[inBar] === "o") this.drum("open", t, out); }
  }

  // ---------------- chip voices ----------------
  // stepped 16-level volume envelope, updated per frame
  stepEnv(g, t, dur, peak, sustain, decayFrames) {
    const q = (v) => Math.round(v * 15) / 15;
    const frames = Math.max(1, Math.floor(dur / FRAME));
    for (let f = 0; f < frames; f++) {
      const k = f < decayFrames ? f / decayFrames : 1;
      g.gain.setValueAtTime(q(1 - (1 - sustain) * k) * peak, t + f * FRAME);
    }
    g.gain.setValueAtTime(0, t + dur);
  }
  pulseNote(duty, n, t, dur, vol, out, o = {}) {
    const ctx = this.ctx, f0 = hz(n);
    const osc = ctx.createOscillator(); osc.setPeriodicWave(this.pulse[duty] || this.pulse[0.25]);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain(); g.gain.value = 0; osc.connect(g); g.connect(out);
    osc.frequency.setValueAtTime(o.slide ? f0 * 0.94 : f0, t);
    if (o.slide) osc.frequency.setValueAtTime(f0 * 0.97, t + FRAME); // tiny scoop into the note
    osc.frequency.setValueAtTime(f0, t + FRAME * 2);
    if (o.vib) { // delayed vibrato, frame-stepped
      for (let f = 10, tt = t + 10 * FRAME; tt < t + dur; f++, tt += FRAME) osc.frequency.setValueAtTime(f0 * (1 + 0.009 * Math.sin(f * 0.9)), tt);
    }
    this.stepEnv(g, t, dur, vol, 0.7, 8);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  arpNote(duty, ch, t, dur, vol, out) {
    const ctx = this.ctx;
    const notes = [ch.root + 24, ch.root + 24 + ch.iv[1], ch.root + 24 + ch.iv[2]];
    const osc = ctx.createOscillator(); osc.setPeriodicWave(this.pulse[duty]);
    const g = ctx.createGain(); g.gain.value = 0; osc.connect(g); g.connect(out);
    for (let f = 0, tt = t; tt < t + dur; f++, tt += FRAME) osc.frequency.setValueAtTime(hz(notes[Math.floor(f / 2) % 3]), tt);
    this.stepEnv(g, t, dur, vol, 0.25, 10);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  triNote(n, t, dur, out, vol = 0.5) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator(); osc.setPeriodicWave(this.tri);
    osc.frequency.setValueAtTime(hz(n), t);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.003); // the triangle is simply on or off
    g.gain.setValueAtTime(vol, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.004);
    osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + dur + 0.02);
  }
  noiseHit(t, rate, frames, vol, out, short = false) {
    const ctx = this.ctx, src = ctx.createBufferSource();
    src.buffer = short ? this.noiseShort : this.noiseLong; src.loop = true; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(out);
    for (let f = 0; f < frames; f++) g.gain.setValueAtTime(Math.round((1 - f / frames) * 15) / 15 * vol, t + f * FRAME);
    g.gain.setValueAtTime(0, t + frames * FRAME);
    src.start(t, Math.random()); src.stop(t + frames * FRAME + 0.02);
  }
  drum(kind, t, out) {
    if (kind === "kick") {
      // classic NES kick: a triangle that dives down in pitch, plus a click of noise
      const ctx = this.ctx, osc = ctx.createOscillator(); osc.setPeriodicWave(this.tri);
      for (let f = 0; f < 6; f++) osc.frequency.setValueAtTime(220 * Math.pow(0.62, f), t + f * FRAME);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.setValueAtTime(0, t + 6 * FRAME);
      osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 7 * FRAME);
      this.noiseHit(t, 0.12, 2, 0.18, out);
    } else if (kind === "snare") { this.noiseHit(t, 0.32, 8, 0.24, out); this.triNote(50, t, 2 * FRAME, out, 0.35); }
    else if (kind === "hat") this.noiseHit(t, 1, 2, 0.1, out, true);
    else if (kind === "open") this.noiseHit(t, 0.9, 7, 0.09, out, true);
  }

  // ---------------- sound effects (same chip) ----------------
  sfx(name, opt = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, g = ctx.createGain(); g.connect(this.sfxBus);
    const p = opt.pitch || 1;
    const WAVE = { sine: this.tri, triangle: this.tri, square: this.pulse[0.25], sawtooth: this.pulse[0.125] };
    const tone = (type, f0, f1, dur, vol, at = 0) => {
      const osc = ctx.createOscillator(); osc.setPeriodicWave(WAVE[type] || this.pulse[0.5]);
      const gg = ctx.createGain(); gg.gain.value = 0; osc.connect(gg); gg.connect(g);
      const frames = Math.max(1, Math.round(dur / FRAME)), lv = (type === "square" || type === "sawtooth" ? 0.55 : 1) * vol * 1.4;
      for (let f = 0; f < frames; f++) {
        const k = f / frames;
        osc.frequency.setValueAtTime((f1 ? f0 * Math.pow(f1 / f0, k) : f0) * p, t + at + f * FRAME);
        gg.gain.setValueAtTime(Math.round((1 - k) * 15) / 15 * lv, t + at + f * FRAME);
      }
      gg.gain.setValueAtTime(0, t + at + frames * FRAME);
      osc.start(t + at); osc.stop(t + at + frames * FRAME + 0.02);
      return osc;
    };
    const noise = (ftype, f0, f1, dur, vol, q = 1, at = 0) => {
      // map the old filter sweeps onto NES noise rates
      const rate = Math.min(1, Math.max(0.05, (f0 + (f1 || f0)) / 2 / 6000));
      this.noiseHit(t + at, rate, Math.max(2, Math.round(dur / FRAME)), vol * 0.9, g, ftype === "highpass");
    };
    switch (name) {
      case "jump": tone("square", 280, 620, 0.12, 0.08); tone("sine", 300, 700, 0.14, 0.12); break;
      case "jump2": tone("square", 420, 900, 0.12, 0.08); tone("sine", 460, 1100, 0.16, 0.12); break;
      case "jump3": tone("square", 360, 1300, 0.22, 0.1); tone("triangle", 720, 1800, 0.2, 0.08, 0.03); break;
      case "walljump": tone("square", 500, 900, 0.12, 0.1); noise("bandpass", 1500, 3000, 0.08, 0.1); break;
      case "land": tone("sine", 140, 60, 0.12, 0.25); noise("lowpass", 900, 300, 0.08, 0.1); break;
      case "step": noise("bandpass", 1200 * p, 0, 0.04, 0.05); break;
      case "throw": noise("bandpass", 800, 3500, 0.25, 0.16); tone("sawtooth", 600, 1200, 0.15, 0.06); break;
      case "capspin": noise("highpass", 2200, 1800, 0.06, 0.04); break;
      case "capreturn": tone("square", 900, 1400, 0.1, 0.08); break;
      case "capbounce": tone("square", 220, 880, 0.35, 0.14); tone("triangle", 440, 1320, 0.25, 0.1, 0.02); break;
      case "dive": noise("bandpass", 600, 2400, 0.3, 0.2); tone("square", 500, 260, 0.25, 0.08); break;
      case "slide": noise("lowpass", 1500, 500, 0.35, 0.1); break;
      case "roll": noise("bandpass", 400, 900, 0.25, 0.12); tone("sine", 120, 180, 0.2, 0.15); break;
      case "pound1": tone("square", 600, 1200, 0.18, 0.08); break;
      case "pound": tone("sine", 160, 40, 0.35, 0.5); noise("lowpass", 1200, 200, 0.3, 0.3); break;
      case "bit": { const b = 1 + (opt.combo || 0) * 0.06; tone("square", 1318 * b, 0, 0.06, 0.1); tone("square", 1975 * b, 0, 0.16, 0.1, 0.06); break; }
      case "heart": [523, 659, 784, 1046, 1318].forEach((f, i) => tone("square", f, 0, 0.3, 0.1, i * 0.07)); tone("triangle", 2093, 0, 0.6, 0.08, 0.35); break;
      case "relic": [392, 494, 587, 784, 988].forEach((f, i) => tone("square", f, 0, 0.4, 0.1, i * 0.09)); break;
      case "hurt": tone("square", 520, 160, 0.3, 0.12); tone("sawtooth", 300, 90, 0.3, 0.08); break;
      case "fizzle": noise("highpass", 4000, 1000, 0.9, 0.16); tone("square", 600, 80, 1.0, 0.1); break;
      case "stomp": tone("square", 300, 120, 0.12, 0.12); tone("square", 900, 1500, 0.1, 0.08, 0.04); break;
      case "pop": tone("square", 700, 1400, 0.08, 0.14); noise("bandpass", 2500, 0, 0.1, 0.08); break;
      case "enemyhit": tone("square", 800, 300, 0.1, 0.1); break;
      case "boom": noise("lowpass", 2000, 80, 0.8, 0.45); tone("sine", 90, 30, 0.6, 0.45); break;
      case "roar": tone("sawtooth", 110, 70, 0.9, 0.16); noise("lowpass", 600, 200, 0.9, 0.18); break;
      case "bosshit": tone("square", 300, 90, 0.4, 0.16); noise("lowpass", 3000, 200, 0.4, 0.26); tone("square", 1200, 1800, 0.2, 0.08, 0.1); break;
      case "splash": noise("lowpass", 3000, 400, 0.5, 0.22); noise("highpass", 1200, 3000, 0.3, 0.1, 2, 0.05); break;
      case "checkpoint": [659, 784, 1046].forEach((f, i) => tone("square", f, 0, 0.22, 0.1, i * 0.08)); break;
      case "menu": tone("square", 880, 0, 0.05, 0.07); break;
      case "select": tone("square", 660, 0, 0.06, 0.09); tone("square", 990, 0, 0.1, 0.09, 0.06); break;
      case "back": tone("square", 660, 440, 0.12, 0.09); break;
      case "notify": tone("square", 1046, 0, 0.1, 0.09); tone("square", 1568, 0, 0.18, 0.08, 0.08); break;
      case "buy": [784, 988, 1175, 1568].forEach((f, i) => tone("square", f, 0, 0.14, 0.09, i * 0.05)); break;
      case "nope": tone("square", 200, 150, 0.15, 0.09); tone("square", 150, 120, 0.15, 0.09, 0.12); break;
      case "talk": tone("square", (opt.voice || 400) * (0.9 + Math.random() * 0.25), 0, 0.04, 0.05); break;
      case "laugh": [0, 0.12, 0.24].forEach((a) => tone("square", 620, 500, 0.08, 0.06, a)); break;
      case "gasp": tone("square", 400, 1100, 0.2, 0.08); break;
      case "wind": noise("bandpass", 400, 900, 1.5, 0.1); break;
      case "ring": tone("square", 1568, 0, 0.2, 0.1); tone("square", 2349, 0, 0.25, 0.07, 0.06); break;
      case "door": tone("sine", 200, 300, 0.6, 0.18); noise("lowpass", 800, 300, 0.6, 0.1); break;
      case "fanfare": this.jingle("victory"); break;
    }
    if (opt.caption && this.onCaption) this.onCaption(opt.caption);
  }

  // soft waves on the shore (filtered chip noise)
  ambience(on) {
    if (!this.ctx) return;
    if (on && !this.amb) {
      const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noiseLong; src.loop = true; src.playbackRate.value = 0.25;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 500;
      const g = ctx.createGain(); g.gain.value = 0.04;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 0.03;
      lfo.connect(lg); lg.connect(g.gain); lfo.start();
      src.connect(lp); lp.connect(g); g.connect(this.sfxBus); src.start();
      this.amb = { src, lfo, g };
    } else if (!on && this.amb) {
      try { this.amb.src.stop(); this.amb.lfo.stop(); } catch (e) {}
      this.amb = null;
    }
  }
}
