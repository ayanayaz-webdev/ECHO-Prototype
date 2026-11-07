import * as THREE from 'three';

// Sliding security doors placed into existing doorways. A closed door has a collision box;
// an open one switches that box off. Locked doors show a red light, unlocked ones green.
export class DoorManager {
  constructor(level, audio) {
    this.level = level;
    this.audio = audio;
    this.doors = new Map();
  }

  // alongX: the wall runs along the x axis (door sits at x = at, z = fixed).
  add({ id, alongX, fixed, at, w, h = 2.5, locked = false, lockedMsg = 'Locked' }) {
    const L = this.level;
    const cx = alongX ? at : fixed;
    const cz = alongX ? fixed : at;
    const group = new THREE.Group();
    group.position.set(cx, 0, cz);
    L.prim(L.mats.metal, alongX ? w : 0.12, h, alongX ? 0.12 : w, 0, h / 2, 0, group);

    const statusMat = new THREE.MeshBasicMaterial({ color: locked ? 0xff2a1f : 0x35ff8a });
    const light = new THREE.Mesh(L.unitBox, statusMat);
    light.scale.set(alongX ? 0.14 : 0.24, 0.12, alongX ? 0.24 : 0.14);
    light.position.set(alongX ? w / 2 - 0.2 : 0, h - 0.35, alongX ? 0 : w / 2 - 0.2);
    group.add(light);
    L.group.add(group);

    const collider = L.addCollider(
      cx - (alongX ? w / 2 : 0.1), cx + (alongX ? w / 2 : 0.1),
      cz - (alongX ? 0.1 : w / 2), cz + (alongX ? 0.1 : w / 2),
      h
    );
    const door = { id, alongX, cx, cz, w, group, collider, statusMat, locked, lockedMsg, hold: false, t: 0, target: 0, lastTarget: 0 };
    this.doors.set(id, door);
    return door;
  }

  get(id) {
    return this.doors.get(id);
  }

  _status(d) {
    d.statusMat.color.setHex(d.locked ? 0xff2a1f : 0x35ff8a);
  }

  lock(id) {
    const d = this.doors.get(id);
    d.locked = true;
    d.hold = false;
    this._status(d);
  }

  // open = true also holds it open (used for scripted events).
  unlock(id, open = false) {
    const d = this.doors.get(id);
    d.locked = false;
    d.hold = open;
    this._status(d);
  }

  update(dt, actors) {
    for (const d of this.doors.values()) {
      let near = false;
      let far = true;
      for (const a of actors) {
        const dist = Math.hypot(a.x - d.cx, a.z - d.cz);
        if (dist < 2.6) near = true;
        if (dist < 3.6) far = false;
      }
      if (d.locked) d.target = 0;
      else if (near || d.hold) d.target = 1;
      else if (far) d.target = 0;

      if (d.target !== d.lastTarget) {
        this.audio.door();
        d.lastTarget = d.target;
      }
      const dir = Math.sign(d.target - d.t);
      d.t = Math.max(0, Math.min(1, d.t + dir * dt * 2));
      d.collider.off = d.t > 0.2;
      const slide = d.t * (d.w + 0.05);
      if (d.alongX) d.group.position.x = d.cx + slide;
      else d.group.position.z = d.cz + slide;
    }
  }
}
