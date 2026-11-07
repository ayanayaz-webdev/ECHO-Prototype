import { Weapon, RIFLE_M4A1 } from './Weapon.js';
import { WeaponView } from './WeaponView.js';
import { rayBoxes, rayCylinder } from '../systems/Ballistics.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Player weapon inventory, shooting, reloading and the first-person view.
export class WeaponSystem {
  constructor({ camera, player, input, events, audio, enemies, level, tracers }) {
    Object.assign(this, { camera, player, input, events, audio, enemies, level, tracers });
    this.weapon = null;
    this.view = new WeaponView(level.unitBox);
    this.view.root.visible = false;
    camera.add(this.view.root);

    this.kick = 0;
    this.ads = 0;
    this.flash = 0;
    this.equip = 1;
    this.swayX = 0;
    this.swayY = 0;
    this.emptyClicked = false;
  }

  get hasWeapon() {
    return !!this.weapon;
  }

  give(def = RIFLE_M4A1) {
    this.weapon = new Weapon(def);
    this.view.root.visible = true;
    this.equip = 0;
    this.events.emit('weapon:acquired', { id: def.id, name: def.name });
  }

  addAmmo(n) {
    if (this.weapon) this.weapon.addAmmo(n);
  }

  update(dt) {
    const w = this.weapon;
    if (!w) return;
    const input = this.input;
    w.update(dt);

    if (input.wasPressed('KeyR') && w.startReload()) this.audio.reload();

    const wantAds = input.mouseDown(2) && w.state !== 'reloading';
    this.ads += ((wantAds ? 1 : 0) - this.ads) * Math.min(1, dt * 10);
    this.player.setAds(wantAds);

    const trigger = input.mouseDown(0);
    if (trigger) {
      if (w.mag === 0 && w.state === 'ready') {
        if (!this.emptyClicked) {
          this.audio.empty();
          this.emptyClicked = true;
        }
        if (w.startReload()) this.audio.reload(); // empty magazine: reload automatically
      } else if (w.fire()) {
        this.shoot();
      }
    } else {
      this.emptyClicked = false;
    }

    this.kick = Math.max(0, this.kick - dt * 9);
    this.flash = Math.max(0, this.flash - dt);
    this.equip = Math.min(1, this.equip + dt * 2.2);
    this.swayX += (clamp(-input.mouseDX * 0.00025, -0.03, 0.03) - this.swayX) * Math.min(1, dt * 8);
    this.swayY += (clamp(input.mouseDY * 0.00025, -0.03, 0.03) - this.swayY) * Math.min(1, dt * 8);

    this.view.update({
      ads: this.ads,
      kick: this.kick,
      reload: w.reloadProgress,
      swayX: this.swayX,
      swayY: this.swayY,
      bobY: Math.sin(this.player.bobTime * 2) * 0.006 * this.player.bobBlend,
      equip: this.equip,
      flash: this.flash,
    });
  }

  shoot() {
    const w = this.weapon;
    const def = w.def;
    const p = this.player;
    const spread = def.spreadHip + (def.spreadAds - def.spreadHip) * this.ads;
    const yaw = p.yaw + (Math.random() - 0.5) * 2 * spread;
    const pitch = p.pitch + (Math.random() - 0.5) * 2 * spread;
    const cp = Math.cos(pitch);
    const dx = -Math.sin(yaw) * cp;
    const dy = Math.sin(pitch);
    const dz = -Math.cos(yaw) * cp;
    const o = { x: p.position.x, y: p.eyeY, z: p.position.z };

    const wall = rayBoxes(o.x, o.y, o.z, dx, dy, dz, def.range, this.level.colliders);
    const maxT = wall ? wall.t : def.range;

    let hit = null;
    let hitT = maxT;
    for (const e of this.enemies.list) {
      if (!e.alive) continue;
      const r = rayCylinder(o.x, o.y, o.z, dx, dy, dz, hitT, e.x, e.z, 0.32, 0, e.height);
      if (r) {
        hit = { enemy: e, y: r.y };
        hitT = r.t;
      }
    }

    // Tracer starts at the muzzle (slightly right of and below the camera).
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    const start = { x: o.x + dx * 0.7 + rx * 0.12, y: o.y + dy * 0.7 - 0.1, z: o.z + dz * 0.7 + rz * 0.12 };
    const end = { x: o.x + dx * hitT, y: o.y + dy * hitT, z: o.z + dz * hitT };
    this.tracers.tracer(start, end);

    if (hit) {
      const head = hit.y > hit.enemy.height - 0.28;
      hit.enemy.takeDamage(def.damage * (head ? 2 : 1), head, o.x, o.z);
      this.events.emit('player:hitmarker', { head, killed: !hit.enemy.alive });
      this.audio.hit();
    } else if (wall) {
      this.tracers.spark(end);
    }

    p.addRecoil(def.recoilPitch * (1 + Math.random() * 0.3), (Math.random() - 0.5) * 2 * def.recoilYaw);
    this.kick = 1;
    this.flash = 0.05;
    this.audio.shot();
    this.events.emit('player:shot', { x: o.x, z: o.z });
  }
}
