import { Enemy } from './Enemy.js';

// Owns every enemy in the level: spawning, updating, alerts and cleanup.
export class EnemyManager {
  constructor(ctx) {
    this.ctx = ctx; // { scene, level, player, audio, events, tracers, nav }
    this.list = [];
    ctx.events.on('player:shot', (p) => this.onShot(p));
  }

  spawn(def) {
    const e = new Enemy(this.ctx, def, this);
    this.list.push(e);
    return e;
  }

  alive(group) {
    return this.list.filter((e) => e.alive && (!group || e.group === group));
  }

  update(dt) {
    for (const e of this.list) e.update(dt);
    // Keep enemies from standing inside each other.
    for (let i = 0; i < this.list.length; i++) {
      for (let j = i + 1; j < this.list.length; j++) {
        const a = this.list[i];
        const b = this.list[j];
        if (!a.alive || !b.alive) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.01 && d < 0.7) {
          const push = (0.7 - d) / 2;
          a.x -= (dx / d) * push;
          a.z -= (dz / d) * push;
          b.x += (dx / d) * push;
          b.z += (dz / d) * push;
        }
      }
    }
  }

  // An enemy that sees the player tells nearby allies.
  alertNear(src, radius) {
    for (const e of this.list) {
      if (!e.alive || e === src || e.state === 'combat') continue;
      if (Math.hypot(e.x - src.x, e.z - src.z) < radius) {
        e.lastKnown = src.lastKnown;
        e._enterCombat();
      }
    }
  }

  onShot({ x, z }) {
    for (const e of this.list) {
      if (e.alive && e.state !== 'combat' && Math.hypot(e.x - x, e.z - z) < 35) e.hear(x, z);
    }
  }

  clear() {
    for (const e of this.list) this.ctx.scene.remove(e.model.root);
    this.list = [];
  }
}
