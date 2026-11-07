import * as THREE from 'three';

// Short-lived bullet streaks and impact sparks. Meshes are created once and reused.
export class Tracers {
  constructor(scene, unitBox) {
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.9, depthWrite: false });
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.95, depthWrite: false });
    this.streaks = [];
    this.sparks = [];
    this.nextStreak = 0;
    this.nextSpark = 0;
    for (let i = 0; i < 20; i++) {
      const m = new THREE.Mesh(unitBox, tracerMat);
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      this.streaks.push({ mesh: m, ttl: 0 });
    }
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(unitBox, sparkMat);
      m.visible = false;
      scene.add(m);
      this.sparks.push({ mesh: m, ttl: 0 });
    }
  }

  tracer(a, b) {
    const it = this.streaks[this.nextStreak];
    this.nextStreak = (this.nextStreak + 1) % this.streaks.length;
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (len < 0.01) return;
    it.mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    it.mesh.scale.set(0.012, 0.012, len);
    it.mesh.lookAt(b.x, b.y, b.z);
    it.mesh.visible = true;
    it.ttl = 0.07;
  }

  spark(p) {
    const it = this.sparks[this.nextSpark];
    this.nextSpark = (this.nextSpark + 1) % this.sparks.length;
    it.mesh.position.set(p.x, p.y, p.z);
    it.mesh.scale.set(0.07, 0.07, 0.07);
    it.mesh.visible = true;
    it.ttl = 0.09;
  }

  update(dt) {
    for (const it of this.streaks) {
      if (it.ttl > 0 && (it.ttl -= dt) <= 0) it.mesh.visible = false;
    }
    for (const it of this.sparks) {
      if (it.ttl > 0 && (it.ttl -= dt) <= 0) it.mesh.visible = false;
    }
  }
}
