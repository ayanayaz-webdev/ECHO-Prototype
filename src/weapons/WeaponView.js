import * as THREE from 'three';
import { buildRifle } from './RifleModel.js';

function flashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,245,210,1)');
  grad.addColorStop(0.4, 'rgba(255,170,60,0.7)');
  grad.addColorStop(1, 'rgba(255,120,20,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// The weapon, gloves and sleeves you see in first person. It is attached to the camera.
export class WeaponView {
  constructor(unit) {
    this.root = new THREE.Group();
    const { group, mag } = buildRifle(unit);
    this.rifle = group;
    this.mag = mag;
    this.root.add(group);

    const glove = new THREE.MeshStandardMaterial({ color: 0x0d0f11, roughness: 0.8 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x1c2128, roughness: 0.9 });
    const box = (mat, sx, sy, sz, x, y, z) => {
      const p = new THREE.Mesh(unit, mat);
      p.scale.set(sx, sy, sz);
      p.position.set(x, y, z);
      p.frustumCulled = false;
      group.add(p);
    };
    // A limb is a box stretched between two points.
    const limb = (mat, th, from, to) => {
      const p = new THREE.Mesh(unit, mat);
      const len = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
      p.position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);
      p.scale.set(th, th, len);
      p.lookAt(to[0], to[1], to[2]);
      p.frustumCulled = false;
      group.add(p);
    };
    box(glove, 0.075, 0.055, 0.11, -0.015, -0.05, -0.3);   // left hand under the handguard
    box(glove, 0.06, 0.03, 0.08, -0.045, -0.02, -0.3);     // left fingers
    limb(sleeve, 0.075, [-0.02, -0.06, -0.26], [-0.2, -0.32, 0.3]);
    box(glove, 0.06, 0.085, 0.085, 0.0, -0.12, 0.1);        // right hand on the grip
    limb(sleeve, 0.075, [0.0, -0.13, 0.13], [0.14, -0.34, 0.6]);

    this.flashMat = new THREE.MeshBasicMaterial({
      map: flashTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), this.flashMat);
    this.flash.position.set(0, 0.01, -0.8);
    this.flash.visible = false;
    group.add(this.flash);
  }

  // s = { ads, kick, reload, swayX, swayY, bobY, equip, flash }
  update(s) {
    const L = THREE.MathUtils.lerp;
    const x = L(0.16, 0.0, s.ads) + s.swayX;
    let y = L(-0.17, -0.112, s.ads) + s.swayY + s.bobY * (1 - s.ads * 0.8);
    const z = L(-0.38, -0.3, s.ads) + s.kick * 0.035;
    let rx = s.kick * 0.06;
    let rz = -s.swayX * 1.5;

    if (s.reload >= 0) {
      const dip = Math.sin(Math.PI * s.reload);
      y -= dip * 0.11;
      rx -= dip * 0.45;
      rz += dip * 0.25;
      const r = s.reload;
      this.mag.position.y = -0.12 - (r > 0.25 && r < 0.55 ? Math.sin(((r - 0.25) / 0.3) * Math.PI) * 0.12 : 0);
    } else {
      this.mag.position.y = -0.12;
    }
    y -= (1 - s.equip) * 0.3;

    this.root.position.set(x, y, z);
    this.root.rotation.set(rx, 0.02 * (1 - s.ads), rz);

    this.flash.visible = s.flash > 0;
    if (this.flash.visible) {
      this.flash.rotation.z = Math.random() * Math.PI * 2;
      const k = 0.8 + Math.random() * 0.5;
      this.flash.scale.set(k, k, k);
    }
  }
}
