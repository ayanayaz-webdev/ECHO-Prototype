// All sound is generated with the Web Audio API (no audio files yet). Every method quietly
// does nothing if audio is unavailable, so the game never crashes because of sound.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.alarmNode = null;
  }

  // Must be called from a user gesture (the first click) or browsers keep audio muted.
  init() {
    if (this.ctx) {
      this.ctx.resume && this.ctx.resume();
      return;
    }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (e) {
      return;
    }
    if (this.ctx.resume) this.ctx.resume(); // iPhones start the audio context suspended
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.8;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(c.destination);
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this._ambient();
  }

  _out(pos) {
    if (!pos) return this.master;
    const p = this.ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = 3;
    p.rolloffFactor = 1.2;
    if (p.positionX) {
      p.positionX.value = pos.x;
      p.positionY.value = pos.y ?? 1.5;
      p.positionZ.value = pos.z;
    } else p.setPosition(pos.x, pos.y ?? 1.5, pos.z);
    p.connect(this.master);
    return p;
  }

  _noise(dur, { freq = 2000, type = 'lowpass', q = 1, gain = 0.5, attack = 0.002, delay = 0, pos = null } = {}) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this._out(pos));
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  _tone(freq, dur, { type = 'sine', gain = 0.3, slideTo = null, delay = 0, pos = null } = {}) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this._out(pos));
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _ambient() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 140;
    const g = c.createGain();
    g.gain.value = 0.14;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
    const o = c.createOscillator();
    o.frequency.value = 55;
    const og = c.createGain();
    og.gain.value = 0.012;
    o.connect(og);
    og.connect(this.master);
    o.start();
  }

  setListener(pos, yaw, pitch) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const fx = -Math.sin(yaw) * Math.cos(pitch);
    const fy = Math.sin(pitch);
    const fz = -Math.cos(yaw) * Math.cos(pitch);
    if (l.positionX) {
      l.positionX.value = pos.x;
      l.positionY.value = 1.7;
      l.positionZ.value = pos.z;
      l.forwardX.value = fx;
      l.forwardY.value = fy;
      l.forwardZ.value = fz;
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    } else {
      l.setPosition(pos.x, 1.7, pos.z);
      l.setOrientation(fx, fy, fz, 0, 1, 0);
    }
  }

  // ---- Sound effects ----
  shot() {
    this._noise(0.12, { freq: 3500, gain: 0.9 });
    this._noise(0.28, { freq: 500, gain: 0.7 });
    this._tone(95, 0.16, { gain: 0.7, slideTo: 40 });
  }
  enemyShot(pos) {
    this._noise(0.12, { freq: 3000, gain: 0.5, pos });
    this._noise(0.25, { freq: 450, gain: 0.45, pos });
    this._tone(85, 0.14, { gain: 0.4, slideTo: 40, pos });
  }
  empty() {
    this._noise(0.03, { freq: 2200, type: 'bandpass', gain: 0.4 });
  }
  reload() {
    [0.2, 0.95, 1.65].forEach((d) => this._noise(0.04, { freq: 2200, type: 'bandpass', q: 3, gain: 0.5, delay: d }));
    this._tone(180, 0.08, { type: 'square', gain: 0.08, delay: 0.2 });
  }
  pickup() {
    this._tone(520, 0.12, { type: 'triangle', gain: 0.25 });
    this._tone(780, 0.16, { type: 'triangle', gain: 0.25, delay: 0.1 });
  }
  electric() {
    for (let i = 0; i < 7; i++) this._noise(0.08, { freq: 4000, type: 'highpass', gain: 0.5, delay: i * 0.11 + Math.random() * 0.05 });
    this._tone(60, 1.6, { type: 'sawtooth', gain: 0.18, slideTo: 130 });
    this._noise(0.5, { freq: 900, type: 'bandpass', gain: 0.4, delay: 0.7 });
  }
  thump() {
    this._tone(70, 0.5, { gain: 0.6, slideTo: 30 });
    this._noise(0.4, { freq: 250, gain: 0.5 });
  }
  door() {
    this._noise(0.35, { freq: 320, gain: 0.45 });
    this._tone(180, 0.3, { type: 'triangle', gain: 0.18, slideTo: 110 });
  }
  beep(freq = 880) {
    this._tone(freq, 0.08, { type: 'square', gain: 0.1 });
  }
  typing() {
    this._noise(0.02, { freq: 3000, type: 'bandpass', gain: 0.25 });
  }
  radio(pos = null) {
    this._noise(0.12, { freq: 1800, type: 'bandpass', q: 2, gain: 0.35, pos });
    for (let i = 0; i < 5; i++) {
      this._tone(600 + Math.random() * 800, 0.06, { type: 'square', gain: 0.05, delay: 0.15 + i * 0.09, pos });
    }
    this._noise(0.1, { freq: 1800, type: 'bandpass', q: 2, gain: 0.3, delay: 0.7, pos });
  }
  footsteps(pos) {
    for (let i = 0; i < 4; i++) {
      this._tone(75, 0.12, { gain: 0.5, slideTo: 40, delay: i * 0.5, pos });
      this._noise(0.1, { freq: 500, gain: 0.25, delay: i * 0.5, pos });
    }
  }
  step() {
    this._tone(80, 0.08, { gain: 0.12, slideTo: 45 });
  }
  glitch() {
    this._noise(0.35, { freq: 1500, type: 'highpass', gain: 0.5 });
    for (let i = 0; i < 4; i++) this._tone(200 + Math.random() * 1500, 0.07, { type: 'sawtooth', gain: 0.1, delay: i * 0.06 });
  }
  hologram() {
    this._tone(180, 2.5, { gain: 0.15, slideTo: 420 });
    this._noise(1.5, { freq: 600, type: 'bandpass', gain: 0.25 });
  }
  hit() {
    this._tone(1400, 0.04, { type: 'square', gain: 0.12 });
  }
  hurt() {
    this._noise(0.2, { freq: 300, gain: 0.6 });
    this._tone(110, 0.2, { gain: 0.35, slideTo: 60 });
  }
  death(pos) {
    this._tone(130, 0.5, { gain: 0.3, slideTo: 50, pos });
    this._noise(0.4, { freq: 400, gain: 0.3, pos });
  }
  alarm(on) {
    if (!this.ctx) return;
    if (!on) {
      if (this.alarmNode) {
        this.alarmNode.stop();
        this.alarmNode = null;
      }
      return;
    }
    if (this.alarmNode) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 620;
    const lfo = c.createOscillator();
    lfo.frequency.value = 1.1;
    const depth = c.createGain();
    depth.gain.value = 180;
    lfo.connect(depth);
    depth.connect(o.frequency);
    const g = c.createGain();
    g.gain.value = 0.05;
    o.connect(g);
    g.connect(this.master);
    o.start();
    lfo.start();
    this.alarmNode = {
      stop: () => {
        o.stop();
        lfo.stop();
      },
    };
  }
}
