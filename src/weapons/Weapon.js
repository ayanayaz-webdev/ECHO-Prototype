// Pure weapon state: ammunition, fire rate and reloading. No graphics in here.
export const RIFLE_M4A1 = {
  id: 'm4a1',
  name: 'M4A1',
  magSize: 30,
  startReserve: 90,
  rpm: 700,
  damage: 28,
  reload: 2.0,
  reloadEmpty: 2.5,
  recoilPitch: 0.0115,
  recoilYaw: 0.004,
  spreadHip: 0.02,
  spreadAds: 0.004,
  range: 120,
};

export class Weapon {
  constructor(def) {
    this.def = def;
    this.mag = def.magSize;
    this.reserve = def.startReserve;
    this.state = 'ready'; // 'ready' | 'reloading'
    this.cooldown = 0;
    this.reloadTime = 0;
    this.reloadTotal = 1;
  }

  canFire() {
    return this.state === 'ready' && this.cooldown <= 0 && this.mag > 0;
  }

  fire() {
    if (!this.canFire()) return false;
    this.mag--;
    this.cooldown = 60 / this.def.rpm;
    return true;
  }

  startReload() {
    if (this.state !== 'ready' || this.mag >= this.def.magSize || this.reserve <= 0) return false;
    this.state = 'reloading';
    this.reloadTotal = this.mag === 0 ? this.def.reloadEmpty : this.def.reload;
    this.reloadTime = this.reloadTotal;
    return true;
  }

  get reloadProgress() {
    return this.state === 'reloading' ? 1 - this.reloadTime / this.reloadTotal : -1;
  }

  addAmmo(n) {
    this.reserve += n;
  }

  update(dt) {
    this.cooldown -= dt;
    if (this.state === 'reloading') {
      this.reloadTime -= dt;
      if (this.reloadTime <= 0) {
        const take = Math.min(this.def.magSize - this.mag, this.reserve);
        this.mag += take;
        this.reserve -= take;
        this.state = 'ready';
      }
    }
  }
}
