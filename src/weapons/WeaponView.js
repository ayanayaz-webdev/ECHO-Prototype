import * as THREE from 'three';
import { M4 } from './m4Config.js';
import { makeM4, modelToWeapon } from './WeaponAsset.js';

const L = THREE.MathUtils.lerp;

function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  for (const [at, col] of stops) grad.addColorStop(at, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// What the player sees in first person: YOUR uploaded rifle model, gloved hands and sleeves.
// Everything hangs off the camera, so it follows mouse look automatically.
//
//   root  - moved around each frame (hip position, ADS, sway, recoil...)
//    └ rig - holds the rifle model and the hands (barrel along -Z)
export class WeaponView {
  constructor(unit) {
    this.unit = unit;
    this.root = new THREE.Group();
    this.rig = new THREE.Group();
    this.root.add(this.rig);
    this.root.visible = false;
    this.ready = false;
    this.time = 0;
    this.mag = null;
    this.muzzleMarker = null;
    this.hip = new THREE.Vector3(...M4.hip);
    this.adsPos = new THREE.Vector3();

    this._buildHands();
    this._buildFlash();
  }

  // Simple tactical gloves and sleeves. They sit under the handguard and around the grip,
  // and the forearms leave the bottom of the screen so the rifle itself stays uncovered.
  _buildHands() {
    const glove = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.85 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x1c2128, roughness: 0.9 });
    const box = (mat, sx, sy, sz, x, y, z) => {
      const p = new THREE.Mesh(this.unit, mat);
      p.scale.set(sx, sy, sz);
      p.position.set(x, y, z);
      p.frustumCulled = false;
      this.rig.add(p);
    };
    const limb = (mat, th, from, to) => {
      const p = new THREE.Mesh(this.unit, mat);
      const len = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
      p.position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);
      p.scale.set(th, th, len);
      p.lookAt(to[0], to[1], to[2]);
      p.frustumCulled = false;
      this.rig.add(p);
    };
    box(glove, 0.072, 0.05, 0.1, 0.0, 0.178, -0.12);      // left hand under the handguard
    limb(sleeve, 0.065, [-0.005, 0.15, -0.09], [-0.22, -0.1, 0.3]);
    box(glove, 0.062, 0.075, 0.07, 0.0, 0.125, 0.205);    // right hand on the grip
    limb(sleeve, 0.065, [0.01, 0.1, 0.23], [0.17, -0.1, 0.66]);
  }

  // Lightweight muzzle flash: two additive quads, no dynamic light.
  _buildFlash() {
    const tex = radialTexture([
      [0, 'rgba(255,248,215,1)'],
      [0.35, 'rgba(255,175,70,0.75)'],
      [1, 'rgba(255,120,20,0)'],
    ]);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    this.flashFront = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), mat);   // faces the player
    this.flashSide = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.06), mat);     // streak along the barrel
    this.flashSide.rotation.y = Math.PI / 2;
    for (const f of [this.flashFront, this.flashSide]) {
      f.visible = false;
      f.frustumCulled = false;
      this.rig.add(f);
    }

    // Red dot shown inside the optic while aiming.
    const dotTex = radialTexture([[0, 'rgba(255,60,40,1)'], [0.4, 'rgba(255,40,30,0.8)'], [1, 'rgba(255,30,20,0)']]);
    this.dotMat = new THREE.MeshBasicMaterial({
      map: dotTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false, fog: false,
    });
    this.dot = new THREE.Mesh(new THREE.PlaneGeometry(0.0065, 0.0065), this.dotMat);
    this.dot.frustumCulled = false;
    this.rig.add(this.dot);
  }

  // Called once the GLB has loaded. Adds an instance of the uploaded model.
  attach() {
    if (this.ready) return true;
    const inst = makeM4();
    if (!inst) return false;
    inst.rig.traverse((o) => {
      o.frustumCulled = false; // the gun is always right in front of the camera
    });
    this.rig.add(inst.rig);
    this.mag = inst.mag;
    this.muzzleMarker = inst.muzzle;

    const muzzle = modelToWeapon(M4.muzzle);
    this.flashFront.position.set(muzzle.x, muzzle.y, muzzle.z - 0.04);
    this.flashSide.position.set(muzzle.x, muzzle.y, muzzle.z - 0.12);

    // ADS: slide the weapon so the optic's rear lens sits on the camera's centre line.
    const sight = modelToWeapon(M4.sight);
    this.adsPos.set(-sight.x, -sight.y, -sight.z - M4.adsEyeRelief);
    this.dot.position.set(sight.x, sight.y, sight.z - M4.reticle);

    this.ready = true;
    return true;
  }

  muzzleWorld(out) {
    if (this.muzzleMarker) return this.muzzleMarker.getWorldPosition(out);
    return null;
  }

  // s = { dt, ads, kick, reload (-1 = not reloading), swayX, swayY, bobX, bobY, equip, flash, lower }
  update(s) {
    this.time += s.dt;
    const t = this.time;
    const a = s.ads;
    const calm = 1 - 0.65 * a; // movement is reduced while aiming
    const hip = this.hip;
    const ads = this.adsPos;

    let x = L(hip.x, ads.x, a) + s.swayX * calm + s.bobX * (1 - a * 0.8) + Math.sin(t * 0.9) * 0.0012 * calm;
    let y = L(hip.y, ads.y, a) + s.swayY * calm + s.bobY * (1 - a * 0.8) + Math.sin(t * 1.6) * 0.0018 * calm;
    let z = L(hip.z, ads.z, a) + s.kick * 0.032 * (1 - 0.55 * a);
    let rx = s.kick * 0.055 * (1 - 0.55 * a);
    let rz = -s.swayX * 1.5 * calm;
    const ry = M4.hipYaw * (1 - a);

    if (s.reload >= 0) {
      const dip = Math.sin(Math.PI * s.reload);
      y -= dip * 0.1;
      rx -= dip * 0.4;
      rz += dip * 0.22;
    }
    // Pull the weapon back and tilt it up when a wall is right in front of the player.
    y -= s.lower * 0.1;
    z += s.lower * 0.2;
    rx += s.lower * 0.45;
    y -= (1 - s.equip) * 0.3;

    this.root.position.set(x, y, z);
    this.root.rotation.set(rx, ry, rz);

    if (this.mag) {
      const r = s.reload;
      let d = 0;
      if (r >= 0.2 && r < 0.45) d = (r - 0.2) / 0.25;
      else if (r >= 0.45 && r < 0.6) d = 1;
      else if (r >= 0.6 && r < 0.8) d = 1 - (r - 0.6) / 0.2;
      this.mag.position.y = -d * M4.magDrop;
    }

    const flashing = s.flash > 0;
    this.flashFront.visible = flashing;
    this.flashSide.visible = flashing;
    if (flashing) {
      this.flashFront.rotation.z = Math.random() * Math.PI * 2;
      const k = 0.8 + Math.random() * 0.5;
      this.flashFront.scale.set(k, k, k);
      this.flashSide.scale.set(0.8 + Math.random() * 0.5, 1, 1);
    }

    this.dotMat.opacity = a * a;
  }
}
