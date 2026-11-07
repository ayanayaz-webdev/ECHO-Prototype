import * as THREE from 'three';

// Returns 0..1. Mostly 0, with short random bursts: used to make lights flicker.
export function flickerWave(t, phase) {
  const w =
    Math.sin(t * 13.0 + phase) *
    Math.sin(t * 5.3 + phase * 1.7) *
    Math.sin(t * 31.0 + phase * 0.3);
  return THREE.MathUtils.smoothstep(w, 0.35, 0.7);
}

// Low, cold ambient light so nothing is ever pitch black.
export function createAmbient(scene) {
  const hemi = new THREE.HemisphereLight(0x7f95b5, 0x0c0f14, 0.28);
  scene.add(hemi);
  return hemi;
}

// Every light in the facility. Tune the look of a room by editing its line here.
//   intensity: brightness   distance: how far it reaches   flicker: 0 (steady) to 1 (unstable)
export const LIGHT_SOURCES = [
  { name: 'exterior',   color: 0xbfd6ff, intensity: 90, pos: [0, 6.5, 16],    distance: 40, flicker: 0.35, scale: 1 },
  { name: 'reception',  color: 0xffc9b8, intensity: 30, pos: [0, 3.9, 2],     distance: 20, flicker: 0.5, scale: 0.5 },
  { name: 'corridorA',  color: 0xcfe6ff, intensity: 24, pos: [0, 2.8, -14],   distance: 16, flicker: 0.4, scale: 0.45 },
  { name: 'corridorB1', color: 0xcfe6ff, intensity: 26, pos: [-14, 2.8, -24], distance: 13, flicker: 0, scale: 0.45 },
  { name: 'corridorB2', color: 0xcfe6ff, intensity: 26, pos: [0, 2.8, -24],   distance: 13, flicker: 0.6, scale: 0.45 },
  { name: 'corridorB3', color: 0xcfe6ff, intensity: 26, pos: [14, 2.8, -24],  distance: 13, flicker: 0, scale: 0.45 },
  { name: 'lab',        color: 0xe6f0ff, intensity: 44, pos: [-14.5, 3.3, -34], distance: 24, flicker: 0.15, scale: 0.4 },
  { name: 'control',    color: 0x8fb8ff, intensity: 30, pos: [0, 3.0, -34],   distance: 20, flicker: 0, scale: 0.35 },
  { name: 'server',     color: 0xff4a3a, intensity: 22, pos: [14.5, 3.1, -34], distance: 22, flicker: 0.1, scale: 0.6 },
  { name: 'chamber',    color: 0xb9d4ff, intensity: 75, pos: [8, 5.2, -53],   distance: 34, flicker: 0, scale: 0.35 },
  { name: 'maintenance', color: 0xff9a6a, intensity: 26, pos: [-7, 2.8, -10], distance: 9, flicker: 0.5, scale: 0.35 },
  { name: 'armory',     color: 0xcfe6ff, intensity: 26, pos: [7, 2.8, -10],   distance: 9, flicker: 0, scale: 0.2 },
  { name: 'yard',       color: 0xaac6ff, intensity: 45, pos: [-16, 5, -56],   distance: 22, flicker: 0, scale: 1 },
];

// Real-time lights are expensive on integrated graphics, so the game only keeps a small
// pool of actual lights (default 6) and hands them to the sources nearest the player.
// Lights fade in and out when they change hands so you do not see them pop.
export class LightManager {
  constructor(scene, sources, poolSize = 6) {
    this.sources = sources.map((s) => ({ ...s, phase: Math.random() * 100, targetScale: s.scale ?? 1, scale: s.scale ?? 1 }));
    this.lockdown = false;
    this.pool = [];
    this.wanted = [];
    this.timer = 0;

    for (let i = 0; i < poolSize; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 10, 1.5);
      scene.add(light);
      this.pool.push({ light, source: null, fade: 0 });
    }
  }

  // Smoothly change how bright a named source is (1 = full). Used by power and story events.
  setScale(name, value) {
    const s = this.sources.find((x) => x.name === name);
    if (s) s.targetScale = value;
  }

  setLockdown(on) {
    this.lockdown = on;
  }

  _pickWanted(playerPos) {
    const px = playerPos.x;
    const pz = playerPos.z;
    this.wanted = [...this.sources]
      .map((s) => ({ s, d: Math.hypot(s.pos[0] - px, s.pos[2] - pz) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.pool.length)
      .map((o) => o.s);
  }

  _assign(slot, source) {
    slot.source = source;
    slot.light.color.setHex(source.color);
    slot.light.distance = source.distance;
    slot.light.position.set(...source.pos);
  }

  // Instantly fill the pool (used once at start so nothing fades in on the first frame).
  snap(playerPos) {
    this._pickWanted(playerPos);
    this.pool.forEach((slot, i) => {
      if (this.wanted[i]) {
        this._assign(slot, this.wanted[i]);
        slot.fade = 1;
      }
    });
  }

  update(dt, t, playerPos) {
    for (const s of this.sources) s.scale += (s.targetScale - s.scale) * Math.min(1, dt * 1.5);
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.15;
      this._pickWanted(playerPos);
    }

    for (const slot of this.pool) {
      const keep = slot.source && this.wanted.includes(slot.source);

      if (keep) {
        slot.fade = Math.min(1, slot.fade + dt * 3);
      } else {
        slot.fade = Math.max(0, slot.fade - dt * 3);
        if (slot.fade === 0) {
          slot.source = null;
          const free = this.wanted.find((s) => !this.pool.some((p) => p.source === s));
          if (free) this._assign(slot, free);
        }
      }

      if (slot.source) {
        const s = slot.source;
        const flick = 1 - s.flicker * flickerWave(t, s.phase) * 0.85;
        let k = s.intensity * flick * slot.fade * s.scale;
        if (this.lockdown) {
          slot.light.color.setHex(0xff2a1f);
          k *= 0.75 + 0.25 * Math.sin(t * 4);
        } else {
          slot.light.color.setHex(s.color);
        }
        slot.light.intensity = k;
      } else {
        slot.light.intensity = 0;
      }
    }
  }
}
