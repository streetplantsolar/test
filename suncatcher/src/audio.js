// =============================================================================
// AudioEngine — procedurally synthesized chiptune music + SFX (WebAudio).
// Self-contained: no audio files, nothing to license. Mute persists in storage.
// =============================================================================
import { CONFIG } from './config.js';

// Frequencies for a small note table (equal temperament, A4 = 440).
function noteFreq(semitonesFromA4) {
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}

// Named scale degrees we use (relative to A4) for readability.
const N = {
  A3: noteFreq(-12),
  C4: noteFreq(-9),
  D4: noteFreq(-7),
  E4: noteFreq(-5),
  G4: noteFreq(-2),
  A4: noteFreq(0),
  C5: noteFreq(3),
  D5: noteFreq(5),
  E5: noteFreq(7),
  G5: noteFreq(10),
  A5: noteFreq(12),
};

// Day vs night arpeggio patterns (a step sequencer plays one note per step).
const DAY_BASS = [N.A3, N.A3, N.E4, N.C4];
const DAY_LEAD = [N.A4, N.C5, N.E5, N.C5, N.D5, N.C5, N.A4, N.G4];
const NIGHT_BASS = [N.A3, N.A3, N.D4, N.A3];
const NIGHT_LEAD = [N.A4, N.E4, N.G4, N.E4, N.A4, N.C5, N.G4, N.E4];

export class AudioEngine {
  constructor() {
    this.available = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    this.muted = localStorage.getItem(CONFIG.STORE_MUTED) === '1';
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this._step = 0;
    this._timer = null;
    this._night = false;
    this._started = false;
  }

  // Must be called from a user gesture (key press) so the browser allows audio.
  ensureContext() {
    if (!this.available) return;
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem(CONFIG.STORE_MUTED, muted ? '1' : '0');
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.6, this.ctx.currentTime, 0.02);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // ---- Music (step sequencer) ----
  startMusic() {
    if (!this.ctx || this._started) return;
    this._started = true;
    const stepMs = 150; // tempo
    this._timer = setInterval(() => this._tick(), stepMs);
  }

  stopMusic() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._started = false;
  }

  setNight(isNight) {
    this._night = isNight;
  }

  _tick() {
    if (!this.ctx) return;
    const bass = this._night ? NIGHT_BASS : DAY_BASS;
    const lead = this._night ? NIGHT_LEAD : DAY_LEAD;
    const s = this._step;

    // Bass on every 2nd step.
    if (s % 2 === 0) {
      this._osc(bass[(s / 2) % bass.length], 'triangle', 0.22, 0.18, this.musicGain);
    }
    // Lead arpeggio every step (quieter at night).
    this._osc(lead[s % lead.length], 'square', this._night ? 0.07 : 0.11, 0.13, this.musicGain);

    this._step = (s + 1) % 16;
  }

  // ---- Low-level synth helpers ----
  _osc(freq, type, gain, dur, destination) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(destination || this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise(dur, gain, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 2000;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur);
  }

  _sweep(f0, f1, type, gain, dur) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // ---- SFX ----
  sfxJump() {
    this._sweep(N.A4, N.A5, 'square', 0.18, 0.16);
  }
  sfxLand() {
    this._noise(0.09, 0.18, 1200);
  }
  sfxDamage(kind) {
    // Heavier hit = lower pitch.
    const map = { sheep: N.E4, hail: N.C4, nimby: N.A3 };
    const f = map[kind] || N.D4;
    this._sweep(f, f * 0.5, 'sawtooth', 0.22, 0.22);
    this._noise(0.12, 0.12, 800);
  }
  sfxWind() {
    this._noise(0.7, 0.10, 600);
  }
  sfxHail() {
    this._noise(0.25, 0.14, 4000);
  }
  sfxMilestone() {
    // Quick rising arpeggio ding.
    [N.C5, N.E5, N.G5, N.A5].forEach((f, i) => {
      setTimeout(() => this._osc(f, 'square', 0.18, 0.18), i * 60);
    });
  }
  sfxGameOver() {
    [N.A4, N.G4, N.E4, N.C4, N.A3].forEach((f, i) => {
      setTimeout(() => this._osc(f, 'triangle', 0.2, 0.35), i * 130);
    });
  }
  sfxSelect() {
    this._osc(N.E5, 'square', 0.16, 0.1);
  }
}
