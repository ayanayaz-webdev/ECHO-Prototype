import * as THREE from 'three';

function scanTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 32;
  const g = c.getContext('2d');
  for (let y = 0; y < 32; y++) {
    const v = y % 4 < 2 ? 255 : 120;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(0, y, 4, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 6);
  return t;
}

// The holographic recording of Daniel Cross shown in the ECHO chamber.
// A short scripted performance: materialise, walk, aim, crouch, look at the player, glitch away.
export class Hologram {
  constructor({ scene, unitBox, level, audio }) {
    this.audio = audio;
    this.level = level;
    this.beamMat = level.mats.beam;
    this.scan = scanTexture();
    this.mat = new THREE.MeshBasicMaterial({
      color: 0x8fdcff,
      map: this.scan,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const root = new THREE.Group();
    this.root = root;
    this.body = new THREE.Group();
    root.add(this.body);
    const add = (parent, sx, sy, sz, x, y, z) => {
      const p = new THREE.Mesh(unitBox, this.mat);
      p.scale.set(sx, sy, sz);
      p.position.set(x, y, z);
      p.frustumCulled = false;
      parent.add(p);
      return p;
    };
    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    this.legL.position.set(-0.11, 0.9, 0);
    this.legR.position.set(0.11, 0.9, 0);
    add(this.legL, 0.16, 0.88, 0.18, 0, -0.44, 0);
    add(this.legR, 0.16, 0.88, 0.18, 0, -0.44, 0);
    this.body.add(this.legL);
    this.body.add(this.legR);
    add(this.body, 0.42, 0.58, 0.24, 0, 1.2, 0);   // torso with vest
    add(this.body, 0.18, 0.22, 0.2, 0, 1.62, 0);   // head
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    this.armL.position.set(-0.26, 1.42, 0);
    this.armR.position.set(0.26, 1.42, 0);
    add(this.armL, 0.09, 0.5, 0.1, 0, -0.25, 0);
    add(this.armR, 0.09, 0.5, 0.1, 0, -0.25, 0);
    this.body.add(this.armL);
    this.body.add(this.armR);
    this.rifle = add(this.body, 0.06, 0.1, 0.7, 0.05, 1.3, 0.4);

    root.visible = false;
    scene.add(root);

    this.center = { x: 8, z: -53 };
    this.t = 0;
    this.playing = false;
    this.cues = [];
    this.lookAt = { x: 0, z: 0 };
    this.yaw = 0;
  }

  // cues: [{ t: seconds, fn }]
  play(cues = []) {
    this.t = 0;
    this.playing = true;
    this.cues = cues.map((c) => ({ ...c, done: false }));
    this.root.visible = true;
    this.audio.hologram();
  }

  stop() {
    this.playing = false;
    this.root.visible = false;
    this.beamMat.opacity = 0.05;
  }

  update(dt, playerPos) {
    if (!this.playing) return;
    this.t += dt;
    const t = this.t;
    this.scan.offset.y -= dt * 0.6;
    this.lookAt = playerPos;

    for (const c of this.cues) {
      if (!c.done && t >= c.t) {
        c.done = true;
        c.fn();
      }
    }

    const cx = this.center.x;
    const cz = this.center.z;
    let x = cx;
    let z = cz + 1.6;
    let walking = false;
    let aim = 0;
    let crouch = 0;
    let faceYaw = this.yaw;

    if (t < 1.2) {
      // materialise
    } else if (t < 4.4) {
      const a = ((t - 1.2) / 3.2) * Math.PI * 1.3;
      x = cx + Math.sin(a) * 1.6;
      z = cz + Math.cos(a) * 1.6;
      faceYaw = Math.atan2(Math.cos(a), -Math.sin(a));
      walking = true;
    } else {
      const a = Math.PI * 1.3;
      x = cx + Math.sin(a) * 1.6;
      z = cz + Math.cos(a) * 1.6;
      if (t < 6.2) {
        faceYaw = Math.atan2(cx + 6 - x, cz - 6 - z);
        aim = Math.min(1, (t - 4.4) / 0.4);
        crouch = t > 5.0 && t < 5.9 ? 1 : 0;
      } else {
        faceYaw = Math.atan2(playerPos.x - x, playerPos.z - z);
      }
    }
    this.yaw += (((faceYaw - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 10);

    // Glitch: flicker, jitter and a brighter beam while the recording runs.
    let visible = true;
    let jitter = 0;
    if (t < 1.2) visible = Math.random() < t / 1.2;
    if (t > 6.2) jitter = Math.min(1, (t - 6.2) / 2);
    if (t > 7.0 && Math.random() < 0.3) visible = false;
    if (t > 8.4) {
      this.stop();
      this.audio.glitch();
      this.level.mats.beam.opacity = 0.05;
      this.cues.forEach((c) => {
        if (c.end) c.end();
      });
      return;
    }
    if (t > 6.2 && !this._glitched) {
      this._glitched = true;
      this.audio.glitch();
    }
    this.root.visible = visible;
    this.mat.opacity = 0.45 + Math.sin(t * 40) * 0.08 * (1 + jitter);
    this.beamMat.opacity = 0.14 + Math.sin(t * 8) * 0.03;

    this.root.position.set(x + (Math.random() - 0.5) * 0.25 * jitter, 0.3, z);
    this.root.rotation.y = this.yaw;
    this.root.scale.set(1 + (Math.random() - 0.5) * 0.3 * jitter, t < 1.2 ? 0.2 + 0.8 * (t / 1.2) : 1, 1);
    this.body.scale.y = 1 - 0.38 * crouch;
    const swing = walking ? Math.sin(t * 8) * 0.7 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -aim * 1.35 + (walking ? -swing * 0.4 : 0);
    this.armR.rotation.x = -aim * 1.3 + (walking ? swing * 0.4 : 0);
  }

  reset() {
    this._glitched = false;
    this.stop();
  }
}
