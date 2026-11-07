// Cap & Fuse audio: an original soundtrack played live by small Web Audio
// instruments (marimba, bells, piano, brass, plucked bass, drums), plus all
// sound effects. Nothing is a recording, so it loads instantly.

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return null;
  return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
const CHORD_Q = { "": [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dim: [0, 3, 6], sus4: [0, 5, 7], sus2: [0, 2, 7] };
function chord(name) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(name);
  const root = 12 * 3 + NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0); // octave 2-ish base (C2 = 36)
  return { root, iv: CHORD_Q[m[3]] || CHORD_Q[""] };
}
function degree(ch, d) {
  const iv = ch.iv;
  switch (d) {
    case "1": return ch.root;
    case "3": return ch.root + iv[1];
    case "5": return ch.root + iv[2];
    case "7": return ch.root + (iv[3] != null ? iv[3] : 12);
    case "8": return ch.root + 12;
    case "9": return ch.root + 14;
    case "0": return ch.root - 5;
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// THE SOUNDTRACK (all original). Melody tokens: one per `res` 16th-steps,
// "-" holds the previous note, "." is a rest.
// Fuse's theme is the opening figure of the menu tune: E G C' . B G A -.
// ---------------------------------------------------------------------------
const BASS = {
  bounce: "1 . . 1 . . 5 . 8 . . 5 . . 1 .",
  walk: "1 . 3 . 5 . 3 . 1 . 5 . 8 . 5 .",
  drive: "1 1 8 1 1 1 8 1 1 1 8 1 5 5 8 5",
  soft: "1 . . . . . . . 5 . . . . . . .",
  island: "1 . . 1 . . 1 . 5 . . 5 . . 3 .",
  funk: "1 . . 8 . 1 . 7 . 1 . . 8 . 5 7",
  pulse: "1 . 1 . 1 . 1 . 5 . 5 . 5 . 5 .",
};
const ARP = {
  up: "1 3 5 8 5 3 1 3 5 8 9 8 5 3 5 8",
  sparkle: "8 . 5 . 9 . 5 . 8 . 3 . 5 . 8 .",
  gentle: "1 . 5 . 8 . 5 . 3 . 5 . 8 . 5 .",
  rapid: "1 5 8 5 3 5 8 5 1 5 8 5 3 5 9 5",
};
const DRUMS = {
  light: { k: "x.......x.......", s: "....x.......x...", h: "..x...x...x...x." },
  pop: { k: "x.....x.x.......", s: "....x.......x..x", h: "x.x.x.x.x.x.x.x." },
  island: { k: "x..x..x...x.....", s: "....x.......x...", h: "xx.x.xx.xx.x.xx.", sh: "x.x.x.x.x.x.x.x." },
  drive: { k: "x...x...x...x.x.", s: "....x.......x...", h: "xxxxxxxxxxxxxxxx" },
  funk: { k: "x..x....x.x.....", s: "....x..x....x...", h: "x.xxx.xxx.xxx.xx" },
  shaker: { sh: "x.xxx.xxx.xxx.xx" },
  none: {},
};

export const TRACKS = {
  menu: { title: "Main Menu: Fuse's Theme", bpm: 128, res: 2,
    chords: "C Am F G C Am Dm7 G7",
    mel: { inst: "marimba", oct: 0, vol: 0.9, notes:
      "E5 G5 C6 . B5 G5 A5 - G5 E5 D5 E5 C5 - - . F5 A5 C6 . A5 F5 G5 - G5 - B4 D5 G5 F5 E5 D5 " +
      "E5 G5 C6 . B5 G5 A5 - C6 - A5 G5 E5 G5 A5 - F5 E5 D5 F5 A5 G5 F5 D5 G5 - - . G4 A4 B4 D5" },
    dbl: { inst: "bell", oct: 1, vol: 0.18 },
    bass: { inst: "pluck", pat: BASS.bounce, vol: 0.8 },
    arp: { inst: "pluck", pat: ARP.sparkle, oct: 2, vol: 0.18 },
    pad: { inst: "pad", vol: 0.15 },
    drums: DRUMS.light },

  home: { title: "Fuse's Home", bpm: 92, res: 2,
    chords: "F Dm Bb C F Am Bb C",
    mel: { inst: "piano", oct: 0, vol: 0.85, notes:
      "A4 C5 F5 . E5 C5 D5 - C5 A4 G4 A4 F4 - - . Bb4 D5 F5 . D5 Bb4 C5 - C5 - E4 G4 C5 Bb4 A4 G4 " +
      "A4 C5 F5 . E5 C5 D5 - E5 - C5 A4 F4 A4 C5 - D5 C5 Bb4 D5 F5 E5 D5 C5 C5 - - . - - . ." },
    bass: { inst: "pluck", pat: BASS.soft, vol: 0.55 },
    arp: { inst: "piano", pat: ARP.gentle, oct: 1, vol: 0.22 },
    pad: { inst: "pad", vol: 0.2 },
    drums: DRUMS.shaker },

  blossom: { title: "Blossom Bay", bpm: 136, res: 2,
    chords: "G Em C D G Em Am7 D7 C D Bm Em C D G G",
    mel: { inst: "marimba", oct: 0, vol: 0.95, notes:
      "D5 G5 B5 . A5 G5 E5 - G5 - E5 D5 B4 - D5 . E5 G5 C6 . B5 A5 G5 - F#5 - A5 . D6 - C6 B5 " +
      "D5 G5 B5 . A5 G5 E5 - B5 - G5 E5 G5 - B5 . C6 B5 A5 G5 E5 G5 A5 C6 B5 - A5 - F#5 - D5 . " +
      "E5 . E5 G5 - . C6 - D6 . A5 F#5 - . D5 - F#5 . F#5 A5 - . D6 - B5 - G5 - E5 - G5 A5 " +
      "C6 - B5 A5 G5 - E5 G5 A5 - G5 F#5 D5 - F#5 A5 G5 - B5 - D6 - B5 - G5 - - . B4 C5 D5 ." },
    dbl: { inst: "steel", oct: 0, vol: 0.28 },
    bass: { inst: "pluck", pat: BASS.island, vol: 0.85 },
    arp: { inst: "pluck", pat: ARP.up, oct: 2, vol: 0.13 },
    stab: { inst: "brass", pat: "....x.......x...", vol: 0.16 },
    pad: { inst: "pad", vol: 0.1 },
    drums: DRUMS.island },

  candy: { title: "Candy Cloud Kingdom", bpm: 118, res: 2,
    chords: "A F#m D E A C#m D E",
    mel: { inst: "bell", oct: 0, vol: 0.7, notes:
      "E5 A5 C#6 . B5 A5 F#5 - A5 - F#5 E5 C#5 - E5 . F#5 A5 D6 . C#6 B5 A5 - G#5 - B5 . E6 - D6 C#6 " +
      "E5 A5 C#6 . B5 A5 F#5 - C#6 - G#5 E5 G#5 - C#6 . D6 C#6 B5 A5 F#5 A5 B5 D6 C#6 - B5 - G#5 - E5 ." },
    dbl: { inst: "marimba", oct: -1, vol: 0.35 },
    bass: { inst: "pluck", pat: BASS.walk, vol: 0.6 },
    arp: { inst: "bell", pat: ARP.sparkle, oct: 2, vol: 0.12 },
    pad: { inst: "pad", vol: 0.22 },
    drums: DRUMS.light },

  ember: { title: "Ember City", bpm: 124, res: 2,
    chords: "Em7 Em7 Am7 B7 Em7 Em7 Am7 B7",
    mel: { inst: "brass", oct: 0, vol: 0.55, notes:
      "E5 . G5 . A5 B5 . D6 B5 - A5 G5 E5 - . . A5 . C6 . D6 E6 . C6 B5 - - . D#5 F#5 A5 B5 " +
      "E5 . G5 . A5 B5 . D6 E6 D6 B5 A5 G5 A5 B5 - C6 B5 A5 G5 A5 - E5 G5 F#5 - D#5 - B4 - . ." },
    dbl: { inst: "lead", oct: 0, vol: 0.12 },
    bass: { inst: "synbass", pat: BASS.funk, vol: 0.8 },
    arp: { inst: "pluck", pat: ARP.rapid, oct: 2, vol: 0.1 },
    drums: DRUMS.funk },

  forest: { title: "The Forgotten Forest", bpm: 96, res: 2,
    chords: "Dm C Bb C Dm F G Am",
    mel: { inst: "flute", oct: 0, vol: 0.6, notes:
      "A4 - D5 - E5 F5 E5 D5 E5 - - - C5 - G4 - F4 - Bb4 - D5 - C5 Bb4 C5 - - - E5 - G5 - " +
      "A5 - G5 F5 E5 - D5 - C5 - F5 - A5 - C6 - B5 - G5 - D5 - B4 - C5 - E5 - A4 - - -" },
    dbl: { inst: "bell", oct: 1, vol: 0.1 },
    bass: { inst: "pluck", pat: BASS.soft, vol: 0.6 },
    arp: { inst: "marimba", pat: ARP.gentle, oct: 2, vol: 0.2 },
    pad: { inst: "pad", vol: 0.25 },
    drums: DRUMS.shaker },

  summit: { title: "Starfall Summit", bpm: 104, res: 2,
    chords: "Bm G D A Bm G Em F#",
    mel: { inst: "brass", oct: 0, vol: 0.5, notes:
      "F#5 - B5 - C#6 D6 C#6 B5 B5 - - - G5 - D5 - D5 - F#5 - A5 - D6 - C#6 - - - A5 - E5 - " +
      "F#5 - B5 - C#6 D6 E6 F#6 G6 - F#6 - E6 - D6 - E6 - D6 - B5 - G5 - F#5 - - - A#5 - C#6 -" },
    dbl: { inst: "bell", oct: 0, vol: 0.2 },
    bass: { inst: "pluck", pat: BASS.pulse, vol: 0.7 },
    arp: { inst: "bell", pat: ARP.up, oct: 2, vol: 0.1 },
    pad: { inst: "pad", vol: 0.28 },
    drums: DRUMS.light },

  boss: { title: "Boss Battle", bpm: 152, res: 2,
    chords: "Dm Dm Bb C Dm Dm Gm A7",
    mel: { inst: "brass", oct: 0, vol: 0.6, notes:
      "D5 . D5 F5 . D5 A5 - G5 F5 E5 F5 D5 - . . Bb4 . Bb4 D5 . F5 Bb5 - A5 G5 E5 G5 C6 - . . " +
      "D5 . D5 F5 . D5 A5 - C6 Bb5 A5 G5 F5 E5 D5 F5 G5 - Bb5 - D6 - C6 Bb5 A5 - E5 - C#5 - A4 ." },
    dbl: { inst: "lead", oct: 1, vol: 0.1 },
    bass: { inst: "synbass", pat: BASS.drive, vol: 0.85 },
    arp: { inst: "pluck", pat: ARP.rapid, oct: 2, vol: 0.12, layer: 1 },
    stab: { inst: "brass", pat: "x.....x.....x...", vol: 0.18 },
    drums: DRUMS.drive },

  finalboss: { title: "Final Boss: Grizzle", bpm: 160, res: 2,
    chords: "Cm Ab Bb G Cm Ab Fm G7",
    mel: { inst: "lead", oct: 0, vol: 0.4, notes:
      "Eb5 G5 C6 . B5 G5 Ab5 - G5 Eb5 D5 Eb5 C5 - - . Ab5 C6 Eb6 . C6 Ab5 Bb5 - B5 - D5 F5 G5 F5 Eb5 D5 " +
      "Eb5 G5 C6 . B5 G5 Ab5 - C6 - Ab5 G5 Eb5 G5 Ab5 - F5 Eb5 D5 F5 Ab5 G5 F5 D5 G5 - B4 - D5 - G5 ." },
    dbl: { inst: "brass", oct: -1, vol: 0.3 },
    bass: { inst: "synbass", pat: BASS.drive, vol: 0.9 },
    arp: { inst: "pluck", pat: ARP.rapid, oct: 2, vol: 0.14 },
    pad: { inst: "pad", vol: 0.15 },
    drums: DRUMS.drive },

  emotional: { title: "A Quiet Sky", bpm: 70, res: 2,
    chords: "Am F C G Am F G E",
    mel: { inst: "piano", oct: 0, vol: 0.8, notes:
      "A4 - C5 - E5 - D5 - C5 - - - A4 - G4 - G4 - C5 - E5 - G5 - F5 - E5 - D5 - - - " +
      "A4 - C5 - E5 - A5 - G5 - F5 - E5 - C5 - D5 - E5 - G5 - E5 - E5 - - - G#4 - B4 -" },
    bass: { inst: "pluck", pat: BASS.soft, vol: 0.5 },
    arp: { inst: "piano", pat: ARP.gentle, oct: 1, vol: 0.18 },
    pad: { inst: "pad", vol: 0.3 },
    drums: DRUMS.none },

  victory: { title: "Victory!", jingle: true, bpm: 140, res: 2,
    chords: "C G C",
    mel: { inst: "brass", oct: 0, vol: 0.6, notes: "E5 G5 C6 . B5 G5 A5 - B5 - D6 - C6 - - - . . . . . . . ." },
    dbl: { inst: "marimba", oct: 0, vol: 0.5 },
    bass: { inst: "pluck", pat: "1 . . . 1 . . . 5 . . . 1 . . .", vol: 0.8 },
    drums: { k: "x...x...x...x...", s: "....x.......xxxx" } },

  credits: { title: "Credits: Thanks for Playing", bpm: 112, res: 2,
    chords: "C Am F G C Am Dm7 G7 F G Em Am Dm G C C",
    mel: { inst: "piano", oct: 0, vol: 0.75, notes:
      "E5 G5 C6 . B5 G5 A5 - G5 E5 D5 E5 C5 - - . F5 A5 C6 . A5 F5 G5 - G5 - B4 D5 G5 F5 E5 D5 " +
      "E5 G5 C6 . B5 G5 A5 - C6 - A5 G5 E5 G5 A5 - F5 E5 D5 F5 A5 G5 F5 D5 G5 - - . . . . . " +
      "F5 - A5 - C6 - A5 - G5 - B5 - D6 - B5 - E5 - G5 - B5 - G5 - A5 - - - C6 B5 A5 G5 " +
      "F5 - E5 - D5 - C5 - D5 - E5 - G5 - D5 - C5 - E5 - G5 - C6 - C6 - - - . . . ." },
    dbl: { inst: "bell", oct: 1, vol: 0.14 },
    bass: { inst: "pluck", pat: BASS.walk, vol: 0.65 },
    arp: { inst: "marimba", pat: ARP.gentle, oct: 2, vol: 0.18 },
    pad: { inst: "pad", vol: 0.2 },
    drums: DRUMS.light },
};

// order shown in the Sound Test
export const TRACK_ORDER = ["menu", "home", "blossom", "candy", "ember", "forest", "summit", "boss", "finalboss", "emotional", "victory", "credits"];

function compile(t) {
  const chords = t.chords.split(/\s+/).map(chord);
  const bars = chords.length;
  const mel = [];
  if (t.mel) {
    const toks = t.mel.notes.trim().split(/\s+/);
    for (let i = 0; i < toks.length; i++) {
      const tk = toks[i];
      if (tk === "-" || tk === ".") continue;
      let len = 1;
      while (toks[i + len] === "-") len++;
      mel.push({ step: i * t.res, len: len * t.res, n: midi(tk) });
    }
  }
  const pat = (s) => (s ? s.trim().split(/\s+/) : null);
  return { ...t, chordsC: chords, bars, melC: mel, steps: bars * 16,
    bassP: t.bass && pat(t.bass.pat), arpP: t.arp && pat(t.arp.pat) };
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
    this.master.threshold.value = -14; this.master.ratio.value = 4;
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
    this.duck = ctx.createGain(); this.duck.connect(this.musicBus);
    // small room reverb from a generated impulse
    const len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.verb = ctx.createConvolver(); this.verb.buffer = ir;
    this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.22;
    this.verbSend.connect(this.verb); this.verb.connect(this.musicBus);
    this.sfxVerb = ctx.createGain(); this.sfxVerb.gain.value = 0.12; this.sfxVerb.connect(this.verb);
    // shared noise
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noise = nb;
    this.applyVolumes();
    this.timer = setInterval(() => this._schedule(), 25);
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
    });
    if (this.pending) { const p = this.pending; this.pending = null; this.play(p); }
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.musicMuted ? 0 : this.musicVol * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.sfxMuted ? 0 : this.sfxVol * 0.8, t, 0.05);
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
    g.gain.linearRampToValueAtTime(1, t + Math.min(fade, 0.8));
    g.connect(this.duck); g.connect(this.verbSend);
    this.current = { name, tr: COMPILED[name], gain: g, step: 0, next: t + 0.08 };
  }
  stopMusic(fade = 1) { this.play(null, fade); }
  get trackName() { return this.current ? this.current.name : null; }

  // play a short tune over the music, ducking it
  jingle(name) {
    if (!this.ctx || !COMPILED[name]) return;
    const tr = COMPILED[name], t = this.ctx.currentTime + 0.05;
    const spb = 60 / tr.bpm / 4, dur = tr.steps * spb;
    this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setTargetAtTime(0.08, t, 0.08);
    this.duck.gain.setTargetAtTime(1, t + dur - 0.2, 0.4);
    const g = this.ctx.createGain(); g.gain.value = 1.1; g.connect(this.musicBus); g.connect(this.verbSend);
    for (let s = 0; s < tr.steps; s++) this._playStep(tr, s, t + s * spb, spb, g, true);
  }

  _schedule() {
    const ctx = this.ctx; if (!ctx) return;
    const ahead = ctx.currentTime + 0.15;
    // clean up faded voices
    this.voices = this.voices.filter((v) => {
      if (ctx.currentTime > v.stopAt) { try { v.gain.disconnect(); } catch (e) {} return false; }
      while (v.next < Math.min(ahead, v.stopAt)) this._advance(v);
      return true;
    });
    const c = this.current;
    if (!c) return;
    if (c.next < ctx.currentTime - 0.5) c.next = ctx.currentTime + 0.05; // came back from a pause
    while (c.next < ahead) {
      if (c.tr.jingle && c.step >= c.tr.steps) { this.current = null; return; }
      this._advance(c);
    }
  }
  _advance(v) {
    const tr = v.tr, spb = 60 / (tr.bpm * (1 + this.intensity * 0.06 * (tr === COMPILED.boss ? 1 : 0))) / 4;
    this._playStep(tr, v.step % tr.steps, v.next, spb, v.gain, false);
    v.step++;
    v.next += spb;
  }

  _playStep(tr, s, t, spb, out, jingle) {
    const bar = Math.floor(s / 16) % tr.bars, inBar = s % 16;
    const ch = tr.chordsC[bar];
    // swing the off 16ths a touch for bounce
    const tt = t + (inBar % 2 ? spb * 0.08 : 0);
    // melody
    for (const n of tr.melC) if (n.step === s) {
      const len = n.len * spb;
      this.inst(tr.mel.inst, n.n + 12 * (tr.mel.oct || 0), tt, len, tr.mel.vol, out);
      if (tr.dbl) this.inst(tr.dbl.inst, n.n + 12 * tr.dbl.oct, tt, len, tr.dbl.vol, out);
    }
    if (tr.bass && tr.bassP) {
      const d = tr.bassP[inBar];
      const n = degree(ch, d);
      if (n != null) this.inst(tr.bass.inst, n, tt, spb * 1.8, tr.bass.vol, out);
    }
    if (tr.arp && tr.arpP && (!tr.arp.layer || this.intensity >= tr.arp.layer)) {
      const n = degree(ch, tr.arpP[inBar]);
      if (n != null) this.inst(tr.arp.inst, n + 12 * tr.arp.oct, tt, spb * 1.5, tr.arp.vol, out);
    }
    if (tr.stab && tr.stab.pat[inBar] === "x") for (const iv of ch.iv.slice(0, 3)) this.inst(tr.stab.inst, ch.root + 24 + iv, tt, spb * 1.2, tr.stab.vol, out);
    if (tr.pad && inBar === 0) for (const iv of ch.iv) this.inst(tr.pad.inst, ch.root + 24 + iv, t, spb * 16, tr.pad.vol, out);
    const dr = tr.drums || {};
    if (dr.k && dr.k[inBar] === "x") this.drum("kick", t, out);
    if (dr.s && dr.s[inBar] === "x") this.drum("snare", t, out);
    if (dr.h && dr.h[inBar] === "x") this.drum("hat", tt, out, inBar % 4 === 2 ? 1 : 0.6);
    if (dr.sh && dr.sh[inBar] === "x") this.drum("shaker", tt, out);
  }

  // ---------------- instruments ----------------
  env(g, t, a, peak, dec, sus, len, rel = 0.08) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sus, t + a, dec);
    g.gain.setTargetAtTime(0.0001, t + Math.max(a, len), rel);
  }
  osc(type, f, t, stop, dest, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    o.connect(dest); o.start(t); o.stop(stop);
    return o;
  }

  inst(name, n, t, len, vol, out) {
    const ctx = this.ctx, f = hz(n);
    const g = ctx.createGain(); g.connect(out);
    switch (name) {
      case "marimba": {
        this.env(g, t, 0.004, 0.32 * vol, 0.18, 0.0, 0.5, 0.2);
        this.osc("sine", f, t, t + 0.9, g);
        const g2 = ctx.createGain(); g2.connect(out);
        g2.gain.setValueAtTime(0.12 * vol, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        this.osc("sine", f * 4, t, t + 0.12, g2);
        break;
      }
      case "steel": {
        this.env(g, t, 0.006, 0.18 * vol, 0.25, 0.0, 0.6, 0.25);
        this.osc("sine", f, t, t + 1, g); this.osc("sine", f * 2.01, t, t + 1, g); this.osc("triangle", f * 3.02, t, t + 0.4, g);
        break;
      }
      case "bell": {
        this.env(g, t, 0.003, 0.22 * vol, 0.5, 0.0, 1.2, 0.5);
        const car = this.osc("sine", f, t, t + 1.8, g);
        const mod = ctx.createOscillator(), mg = ctx.createGain();
        mod.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(1, t + 1.2);
        mod.connect(mg); mg.connect(car.frequency); mod.start(t); mod.stop(t + 1.8);
        break;
      }
      case "piano": {
        this.env(g, t, 0.005, 0.26 * vol, 0.45, 0.25, len, 0.25);
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(Math.min(9000, f * 8), t); lp.frequency.setTargetAtTime(f * 2.5, t, 0.4); lp.connect(g);
        this.osc("triangle", f, t, t + len + 1, lp); this.osc("sine", f * 2, t, t + len + 1, lp, 3);
        break;
      }
      case "pluck": {
        this.env(g, t, 0.004, 0.42 * vol, 0.12, 0.15, len, 0.06);
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 4;
        lp.frequency.setValueAtTime(Math.min(8000, f * 9), t); lp.frequency.setTargetAtTime(f * 1.6, t, 0.08); lp.connect(g);
        this.osc("triangle", f, t, t + len + 0.4, lp); this.osc("square", f, t, t + len + 0.4, lp, 6).frequency;
        break;
      }
      case "synbass": {
        this.env(g, t, 0.004, 0.36 * vol, 0.1, 0.4, len, 0.05);
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 8;
        lp.frequency.setValueAtTime(f * 10, t); lp.frequency.setTargetAtTime(f * 2, t, 0.07); lp.connect(g);
        this.osc("sawtooth", f, t, t + len + 0.3, lp);
        break;
      }
      case "brass": {
        this.env(g, t, 0.035, 0.2 * vol, 0.2, 0.7, len, 0.08);
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 2;
        lp.frequency.setValueAtTime(f * 1.5, t); lp.frequency.linearRampToValueAtTime(f * 6, t + 0.06); lp.frequency.setTargetAtTime(f * 3.5, t + 0.06, 0.2); lp.connect(g);
        this.osc("sawtooth", f, t, t + len + 0.4, lp, -6); this.osc("sawtooth", f, t, t + len + 0.4, lp, 6);
        break;
      }
      case "lead": {
        this.env(g, t, 0.01, 0.16 * vol, 0.2, 0.7, len, 0.06);
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = f * 5; lp.connect(g);
        const o = this.osc("square", f, t, t + len + 0.3, lp);
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + 0.3);
        lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + len + 0.3);
        break;
      }
      case "flute": {
        this.env(g, t, 0.06, 0.22 * vol, 0.3, 0.8, len, 0.12);
        this.osc("sine", f, t, t + len + 0.5, g); this.osc("triangle", f * 2, t, t + len + 0.5, g);
        const nb = ctx.createBufferSource(); nb.buffer = this.noise; const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f * 2; bp.Q.value = 6;
        const ng = ctx.createGain(); ng.gain.value = 0.04 * vol; nb.connect(bp); bp.connect(ng); ng.connect(g); nb.start(t); nb.stop(t + len + 0.3);
        break;
      }
      case "pad": {
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.1 * vol, t + len * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + len * 1.02);
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400; lp.connect(g);
        this.osc("triangle", f, t, t + len + 0.1, lp, -9); this.osc("triangle", f, t, t + len + 0.1, lp, 9); this.osc("sine", f / 2, t, t + len + 0.1, lp);
        break;
      }
    }
  }

  drum(kind, t, out, vel = 1) {
    const ctx = this.ctx, g = ctx.createGain(); g.connect(out);
    if (kind === "kick") {
      g.gain.setValueAtTime(0.75, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      const o = this.osc("sine", 140, t, t + 0.36, g); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    } else {
      const src = ctx.createBufferSource(); src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      if (kind === "snare") { f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 0.8; g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        const tg = ctx.createGain(); tg.connect(out); tg.gain.setValueAtTime(0.18, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); this.osc("triangle", 210, t, t + 0.12, tg); }
      else if (kind === "hat") { f.type = "highpass"; f.frequency.value = 8000; g.gain.setValueAtTime(0.09 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); }
      else { f.type = "bandpass"; f.frequency.value = 6000; f.Q.value = 1.5; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); }
      src.connect(f); f.connect(g); src.start(t, Math.random() * 0.5); src.stop(t + 0.3);
    }
  }

  // ---------------- sound effects ----------------
  sfx(name, opt = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, out = this.sfxBus;
    const g = ctx.createGain(); g.connect(out); g.connect(this.sfxVerb);
    const p = opt.pitch || 1;
    const tone = (type, f0, f1, dur, vol, at = 0) => {
      const gg = ctx.createGain(); gg.connect(g);
      gg.gain.setValueAtTime(0.0001, t + at); gg.gain.linearRampToValueAtTime(vol, t + at + 0.008); gg.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      const o = this.osc(type, f0 * p, t + at, t + at + dur + 0.02, gg); if (f1) o.frequency.exponentialRampToValueAtTime(f1 * p, t + at + dur);
      return o;
    };
    const noise = (ftype, f0, f1, dur, vol, q = 1, at = 0) => {
      const src = ctx.createBufferSource(); src.buffer = this.noise; const f = ctx.createBiquadFilter(); f.type = ftype; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t + at); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + at + dur);
      const gg = ctx.createGain(); gg.gain.setValueAtTime(0.0001, t + at); gg.gain.linearRampToValueAtTime(vol, t + at + 0.01); gg.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      src.connect(f); f.connect(gg); gg.connect(g); src.start(t + at); src.stop(t + at + dur + 0.05);
    };
    switch (name) {
      case "jump": tone("square", 280, 620, 0.12, 0.08); tone("sine", 300, 700, 0.14, 0.16); break;
      case "jump2": tone("square", 420, 900, 0.12, 0.07); tone("sine", 460, 1100, 0.16, 0.16); break;
      case "jump3": tone("sine", 360, 1300, 0.22, 0.18); tone("triangle", 720, 1800, 0.2, 0.08, 0.03); break;
      case "walljump": tone("triangle", 500, 900, 0.12, 0.14); noise("bandpass", 1500, 3000, 0.08, 0.1, 2); break;
      case "land": tone("sine", 140, 60, 0.12, 0.25); noise("lowpass", 900, 300, 0.08, 0.12); break;
      case "step": noise("bandpass", 1200 * p, 0, 0.04, 0.05, 2); break;
      case "throw": noise("bandpass", 800, 3500, 0.25, 0.22, 3); tone("triangle", 600, 1200, 0.15, 0.06); break;
      case "capspin": noise("bandpass", 2200, 1800, 0.12, 0.05, 6); break;
      case "capreturn": tone("sine", 900, 1400, 0.1, 0.1); break;
      case "capbounce": { const o = tone("sine", 220, 880, 0.35, 0.25); tone("triangle", 440, 1320, 0.25, 0.08, 0.02); break; }
      case "dive": noise("bandpass", 600, 2400, 0.3, 0.25, 2); tone("sine", 500, 260, 0.25, 0.1); break;
      case "slide": noise("lowpass", 1500, 500, 0.35, 0.12); break;
      case "roll": noise("bandpass", 400, 900, 0.25, 0.14, 1.5); tone("sine", 120, 180, 0.2, 0.12); break;
      case "pound1": tone("sine", 600, 1200, 0.18, 0.1); noise("bandpass", 3000, 1000, 0.18, 0.08, 2); break;
      case "pound": tone("sine", 160, 40, 0.35, 0.5); noise("lowpass", 1200, 200, 0.3, 0.3); break;
      case "bit": { const b = 1 + (opt.combo || 0) * 0.06; tone("sine", 1318 * b, 0, 0.12, 0.13); tone("sine", 1975 * b, 0, 0.18, 0.11, 0.05); break; }
      case "heart": [523, 659, 784, 1046, 1318].forEach((f, i) => tone("triangle", f, 0, 0.4, 0.13, i * 0.07)); tone("sine", 2093, 0, 0.8, 0.07, 0.35); break;
      case "relic": [392, 494, 587, 784, 988].forEach((f, i) => tone("sine", f, 0, 0.5, 0.14, i * 0.09)); break;
      case "hurt": tone("square", 520, 160, 0.3, 0.12); tone("sawtooth", 300, 90, 0.3, 0.06); break;
      case "fizzle": noise("highpass", 4000, 1000, 0.9, 0.18); tone("sine", 600, 80, 1.0, 0.15); break;
      case "stomp": tone("square", 300, 120, 0.12, 0.12); tone("sine", 900, 1500, 0.1, 0.1, 0.04); break;
      case "pop": tone("sine", 700, 1400, 0.08, 0.2); noise("bandpass", 2500, 0, 0.1, 0.1, 3); break;
      case "enemyhit": tone("square", 800, 300, 0.1, 0.1); break;
      case "boom": noise("lowpass", 2000, 80, 0.8, 0.5); tone("sine", 90, 30, 0.6, 0.5); break;
      case "roar": tone("sawtooth", 110, 70, 0.9, 0.18); tone("sawtooth", 113, 66, 0.9, 0.14); noise("lowpass", 600, 200, 0.9, 0.2); break;
      case "bosshit": tone("square", 300, 90, 0.4, 0.2); noise("lowpass", 3000, 200, 0.4, 0.3); tone("sine", 1200, 1800, 0.2, 0.1, 0.1); break;
      case "splash": noise("lowpass", 3000, 400, 0.5, 0.25); noise("bandpass", 1200, 3000, 0.3, 0.12, 2, 0.05); break;
      case "checkpoint": [659, 784, 1046].forEach((f, i) => tone("triangle", f, 0, 0.3, 0.14, i * 0.08)); break;
      case "menu": tone("sine", 880, 0, 0.06, 0.08); break;
      case "select": tone("triangle", 660, 0, 0.08, 0.12); tone("triangle", 990, 0, 0.12, 0.1, 0.06); break;
      case "back": tone("triangle", 660, 440, 0.12, 0.1); break;
      case "notify": tone("sine", 1046, 0, 0.12, 0.1); tone("sine", 1568, 0, 0.2, 0.08, 0.08); break;
      case "buy": [784, 988, 1175, 1568].forEach((f, i) => tone("sine", f, 0, 0.18, 0.1, i * 0.05)); break;
      case "nope": tone("square", 200, 150, 0.15, 0.08); tone("square", 150, 120, 0.15, 0.08, 0.12); break;
      case "talk": tone("square", (opt.voice || 400) * (0.9 + Math.random() * 0.25), 0, 0.045, 0.05); break;
      case "laugh": [0, 0.12, 0.24].forEach((a) => tone("square", 620, 500, 0.08, 0.06, a)); break;
      case "gasp": tone("sine", 400, 1100, 0.2, 0.1); break;
      case "wind": noise("bandpass", 400, 900, 1.5, 0.12, 0.6); break;
      case "ring": tone("sine", 1568, 0, 0.25, 0.12); tone("sine", 2349, 0, 0.3, 0.08, 0.06); break;
      case "door": tone("sine", 200, 300, 0.6, 0.15); noise("lowpass", 800, 300, 0.6, 0.12); break;
      case "fanfare": this.jingle("victory"); break;
    }
    if (opt.caption && this.onCaption) this.onCaption(opt.caption);
  }

  // looping ocean + gulls ambience
  ambience(on) {
    if (!this.ctx) return;
    if (on && !this.amb) {
      const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 500;
      const g = ctx.createGain(); g.gain.value = 0.05;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 0.04;
      lfo.connect(lg); lg.connect(g.gain); lfo.start();
      src.connect(lp); lp.connect(g); g.connect(this.sfxBus); src.start();
      this.amb = { src, lfo, g };
    } else if (!on && this.amb) {
      try { this.amb.src.stop(); this.amb.lfo.stop(); } catch (e) {}
      this.amb = null;
    }
  }
}
