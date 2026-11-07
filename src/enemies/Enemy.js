import { rayBoxes } from '../systems/Ballistics.js';
import { resolveCircle, segmentClear } from '../world/Collision.js';
import { buildEnemyModel } from './EnemyModel.js';

const EYE_STAND = 1.65;
const EYE_CROUCH = 0.85;
const H_STAND = 1.8;
const H_CROUCH = 1.1;
const VIEW_RANGE = 30;
const FOV_HALF = 1.15; // radians either side of facing (about 130 degrees total)
const DAMAGE = 6;

const wrap = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// One APEX security operator.
// States: patrol -> suspicious -> investigate -> search -> combat -> return -> patrol
// Enemies only know where the player is if they see him, hear a shot, or are told by an ally.
export class Enemy {
  constructor(ctx, def, manager) {
    this.ctx = ctx;
    this.manager = manager;
    this.id = def.id;
    this.group = def.group || null;
    this.x = def.x;
    this.z = def.z;
    this.yaw = def.yaw || 0;
    this.home = { x: def.x, z: def.z };
    this.health = 120; // about five rifle hits to the body, three if you aim for the head
    this.alive = true;
    this.state = def.state || 'patrol';
    this.stateTime = 0;
    this.aggressive = !!def.aggressive;
    this.cover = def.cover || null;
    this.atCover = false;
    this.peek = 'down';
    this.peekT = 0.4;
    this.target = def.alertPos ? { x: def.alertPos.x, z: def.alertPos.z } : null;
    this.lastKnown = this.target;
    this.lastSeen = 99;
    this.sinceHit = 99;
    this.reactionT = 0.5;
    this.burstLeft = 0;
    this.burstPause = 0.4;
    this.fireCooldown = 0;
    this.flashT = 0;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = 1;
    this.crouch = 0;
    this.crouchT = 0;
    this.moving = false;
    this.walkPhase = 0;
    this.path = null;
    this.pathT = 0;
    this.pathGoal = null;
    this.deathT = 0;
    this.waypoints = def.waypoints || null;
    this.wp = 0;
    this.wait = 0;
    this.time = Math.random() * 10;

    this.model = buildEnemyModel(ctx.level.unitBox);
    ctx.scene.add(this.model.root);
    this._place();
  }

  get height() {
    return this.crouch > 0.5 ? H_CROUCH : H_STAND;
  }
  get eyeY() {
    return this.crouch > 0.5 ? EYE_CROUCH : EYE_STAND;
  }

  _place() {
    this.model.root.position.set(this.x, 0, this.z);
    this.model.root.rotation.y = this.yaw;
  }

  _set(state) {
    this.state = state;
    this.stateTime = 0;
  }

  // ---------- perception ----------

  _canSee() {
    const p = this.ctx.player.position;
    const dx = p.x - this.x;
    const dz = p.z - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist > VIEW_RANGE) return false;
    if (this.state !== 'combat') {
      const diff = wrap(Math.atan2(dx, dz) - this.yaw);
      if (Math.abs(diff) > FOV_HALF) return false;
    }
    const py = this.ctx.player.eyeY - 0.2;
    const ey = this.eyeY;
    const dy = py - ey;
    const len = Math.hypot(dist, dy);
    const hit = rayBoxes(this.x, ey, this.z, dx / len, dy / len, dz / len, len, this.ctx.level.colliders);
    return !(hit && hit.kind === 'wall' && hit.t < len - 0.3);
  }

  hear(x, z) {
    if (!this.alive || this.state === 'combat') return;
    this.target = { x, z };
    this.lastKnown = { x, z };
    this._set('investigate');
  }

  // ---------- damage ----------

  takeDamage(dmg, head, fromX, fromZ) {
    if (!this.alive) return;
    this.health -= dmg;
    this.sinceHit = 0;
    this.ctx.events.emit('enemy:hit', { enemy: this, head });
    if (this.state !== 'combat') {
      this.lastKnown = { x: fromX, z: fromZ };
      this.lastSeen = 0;
      this._enterCombat();
    }
    if (this.health <= 0) this._die();
  }

  _die() {
    this.alive = false;
    this.deathT = 0;
    this.ctx.audio.death({ x: this.x, y: 1, z: this.z });
    this.ctx.events.emit('enemy:died', { enemy: this });
  }

  _enterCombat() {
    if (this.state === 'combat') return;
    this._set('combat');
    this.reactionT = 0.5;
    this.manager.alertNear(this, 22);
  }

  // ---------- movement ----------

  _moveTo(tx, tz, speed, dt) {
    const colliders = this.ctx.level.colliders;
    let gx = tx;
    let gz = tz;
    if (!segmentClear(this.x, this.z, tx, tz, colliders, 0.32)) {
      this.pathT -= dt;
      if (!this.path || this.pathT <= 0 || !this.pathGoal || this.pathGoal.x !== tx || this.pathGoal.z !== tz) {
        this.path = this.ctx.nav.findPath(this.x, this.z, tx, tz);
        this.pathT = 0.6;
        this.pathGoal = { x: tx, z: tz };
      }
      while (this.path.length > 1 && Math.hypot(this.path[0].x - this.x, this.path[0].z - this.z) < 0.5) this.path.shift();
      if (this.path.length) {
        gx = this.path[0].x;
        gz = this.path[0].z;
      }
    } else {
      this.path = null;
    }
    const dx = gx - this.x;
    const dz = gz - this.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.05) {
      const step = Math.min(d, speed * dt);
      const pos = { x: this.x + (dx / d) * step, z: this.z + (dz / d) * step };
      resolveCircle(pos, 0.32, colliders);
      this.x = pos.x;
      this.z = pos.z;
      this.moving = true;
      this._turn(Math.atan2(dx, dz), dt, 9);
    }
    return Math.hypot(tx - this.x, tz - this.z) < 0.5;
  }

  _turn(targetYaw, dt, rate) {
    const diff = wrap(targetYaw - this.yaw);
    this.yaw = wrap(this.yaw + clamp(diff, -rate * dt, rate * dt));
  }

  _face(x, z, dt, rate = 6) {
    this._turn(Math.atan2(x - this.x, z - this.z), dt, rate);
  }

  // ---------- main update ----------

  update(dt) {
    if (!this.alive) {
      this._animDeath(dt);
      return;
    }
    this.time += dt;
    this.stateTime += dt;
    this.sinceHit += dt;
    this.fireCooldown -= dt;
    this.flashT -= dt;
    this.moving = false;

    const sees = this._canSee();
    if (sees) {
      const p = this.ctx.player.position;
      this.lastKnown = { x: p.x, z: p.z };
      this.lastSeen = 0;
    } else {
      this.lastSeen += dt;
    }

    switch (this.state) {
      case 'patrol': this._patrol(dt, sees); break;
      case 'suspicious': this._suspicious(dt, sees); break;
      case 'investigate': this._investigate(dt, sees); break;
      case 'search': this._search(dt, sees); break;
      case 'return': this._return(dt, sees); break;
      case 'combat': this._combat(dt, sees); break;
      default: break;
    }
    this._animate(dt);
  }

  _patrol(dt, sees) {
    if (sees) return this._set('suspicious');
    if (this.waypoints && this.waypoints.length) {
      if (this.wait > 0) {
        this.wait -= dt;
        return;
      }
      const w = this.waypoints[this.wp];
      if (this._moveTo(w.x, w.z, 1.6, dt)) {
        this.wp = (this.wp + 1) % this.waypoints.length;
        this.wait = 2;
      }
    } else {
      this.yaw += Math.sin(this.time * 0.5) * 0.15 * dt; // idle: slowly look around
    }
  }

  _suspicious(dt, sees) {
    if (this.lastKnown) this._face(this.lastKnown.x, this.lastKnown.z, dt, 6);
    if (sees && this.stateTime >= 0.45) this._enterCombat();
    else if (!sees && this.stateTime > 2) {
      this.target = this.lastKnown;
      this._set('investigate');
    }
  }

  _investigate(dt, sees) {
    if (sees && this.stateTime > 0.2) return this._enterCombat();
    const t = this.target || this.lastKnown;
    if (!t) return this._set('return');
    if (this._moveTo(t.x, t.z, this.aggressive ? 3.6 : 2.0, dt)) this._set('search');
  }

  _search(dt, sees) {
    if (sees) return this._enterCombat();
    this.yaw += Math.sin(this.stateTime * 1.5) * 1.2 * dt;
    if (this.stateTime > 5) this._set('return');
  }

  _return(dt, sees) {
    if (sees) return this._set('suspicious');
    if (this._moveTo(this.home.x, this.home.z, 1.8, dt)) this._set('patrol');
  }

  _combat(dt, sees) {
    const p = this.ctx.player.position;
    const dx = p.x - this.x;
    const dz = p.z - this.z;
    const dist = Math.hypot(dx, dz);
    this.reactionT -= dt;

    if (this.cover) {
      const cd = Math.hypot(this.cover.x - this.x, this.cover.z - this.z);
      if (!this.atCover && cd > 0.35) {
        this.crouchT = 0;
        this._moveTo(this.cover.x, this.cover.z, 3.8, dt);
      } else {
        this.atCover = true;
        this.peekT -= dt;
        if (this.peek === 'down') {
          this.crouchT = 1;
          if (this.peekT <= 0) {
            this.peek = 'up';
            this.peekT = 1.3 + Math.random() * 0.6;
          }
        } else {
          this.crouchT = 0;
          if (sees && this.reactionT <= 0) this._shootLogic(dt, dist);
          if (this.peekT <= 0 || this.sinceHit < 0.25) {
            this.peek = 'down';
            this.peekT = 1.1 + Math.random();
            this.burstLeft = 0;
          }
        }
        this._face(p.x, p.z, dt, 8);
      }
    } else {
      this.crouchT = 0;
      if (sees) {
        if (dist > 11) this._moveTo(p.x, p.z, 2.4, dt);
        else if (dist < 5.5) this._moveTo(this.x - dx, this.z - dz, 2.0, dt);
        else {
          this.strafeT -= dt;
          if (this.strafeT <= 0) {
            this.strafeDir *= -1;
            this.strafeT = 1.5 + Math.random() * 1.5;
          }
          this._moveTo(this.x - (dz / dist) * this.strafeDir * 2, this.z + (dx / dist) * this.strafeDir * 2, 1.6, dt);
        }
        this._face(p.x, p.z, dt, 8);
        if (this.reactionT <= 0) this._shootLogic(dt, dist);
      } else if (this.lastKnown && this.lastSeen > 0.8) {
        this._moveTo(this.lastKnown.x, this.lastKnown.z, 3.2, dt);
      }
    }

    if (this.lastSeen > 10) {
      this.target = this.lastKnown;
      this._set('search');
    }
  }

  _shootLogic(dt, dist) {
    if (this.burstLeft > 0) {
      if (this.fireCooldown <= 0) {
        this._fire(dist);
        this.burstLeft--;
        this.fireCooldown = 0.11;
        if (this.burstLeft === 0) this.burstPause = 0.8 + Math.random() * 0.8;
      }
    } else {
      this.burstPause -= dt;
      if (this.burstPause <= 0) this.burstLeft = 3;
    }
  }

  _fire(dist) {
    const ctx = this.ctx;
    const pl = ctx.player;
    const my = (this.crouch > 0.5 ? 0.8 : 1.3);
    const mx = this.x + Math.sin(this.yaw) * 0.7 + Math.cos(this.yaw) * 0.1;
    const mz = this.z + Math.cos(this.yaw) * 0.7 - Math.sin(this.yaw) * 0.1;

    let chance = clamp(0.55 - dist * 0.022, 0.1, 0.45);
    if (pl.moving) chance *= 0.75;
    const hits = Math.random() < chance;

    let tx = pl.position.x;
    let ty = pl.eyeY - 0.35;
    let tz = pl.position.z;
    if (!hits) {
      tx += (Math.random() - 0.5) * 2.4;
      ty = 0.2 + Math.random() * 1.4;
      tz += (Math.random() - 0.5) * 2.4;
    }
    const dx = tx - mx;
    const dy = ty - my;
    const dz = tz - mz;
    const len = Math.hypot(dx, dy, dz);
    const wall = rayBoxes(mx, my, mz, dx / len, dy / len, dz / len, len, ctx.level.colliders);
    const end = wall ? wall.t : len;
    ctx.tracers.tracer({ x: mx, y: my, z: mz }, { x: mx + (dx / len) * end, y: my + (dy / len) * end, z: mz + (dz / len) * end });
    this.flashT = 0.05;
    ctx.audio.enemyShot({ x: mx, y: my, z: mz });
    if (hits && !wall) pl.damage(DAMAGE, this.x, this.z);
  }

  // ---------- visuals ----------

  _animate(dt) {
    this.crouch += (this.crouchT - this.crouch) * Math.min(1, dt * 8);
    const m = this.model;
    m.body.scale.y = 1 - 0.38 * this.crouch;
    if (this.moving) {
      this.walkPhase += dt * 8;
      m.legL.rotation.x = Math.sin(this.walkPhase) * 0.7;
      m.legR.rotation.x = -Math.sin(this.walkPhase) * 0.7;
    } else {
      m.legL.rotation.x *= 0.8;
      m.legR.rotation.x *= 0.8;
    }
    m.flash.visible = this.flashT > 0;
    m.root.position.set(this.x, 0, this.z);
    m.root.rotation.y = this.yaw;
  }

  _animDeath(dt) {
    if (this.deathT < 1) {
      this.deathT = Math.min(1, this.deathT + dt * 2.5);
      this.model.root.rotation.x = this.deathT * Math.PI * 0.48;
      this.model.flash.visible = false;
    }
  }
}
