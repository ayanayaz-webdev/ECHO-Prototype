import * as THREE from 'three';
import { buildProps } from './Props.js';
import { flickerWave } from './Lighting.js';

const WALL_T = 0.3;   // wall thickness in metres
const WALL_H = 6.0;   // wall height (rooms have lower ceilings inside)

// Makes a texture repeat according to the real size of the box, so concrete panels
// stay the same size on a 2 m wall and a 20 m wall.
function scaleBoxUV(geometry, w, h, d, tile) {
  const uv = geometry.attributes.uv;
  for (let face = 0; face < 6; face++) {
    let su;
    let sv;
    if (face < 2) { su = d; sv = h; }
    else if (face < 4) { su = w; sv = d; }
    else { su = w; sv = h; }
    for (let i = 0; i < 4; i++) {
      const idx = face * 4 + i;
      uv.setXY(idx, (uv.getX(idx) * su) / tile, (uv.getY(idx) * sv) / tile);
    }
  }
  uv.needsUpdate = true;
}

// Door definition helper: at = centre along the wall, w = width, h = height.
const D = (at, w = 1.4, h = 2.5) => ({ at, w, h });

export class Level {
  constructor(scene, mats) {
    this.scene = scene;
    this.mats = mats;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.colliders = [];   // boxes the player cannot walk through
    this.zones = [];       // named areas, used for the on-screen location label
    this.flickers = [];    // glowing things that flicker
    this.leds = null;      // blinking server lights (filled in by Props.js)
    this.powerScreens = []; // screens that stay dark until power is restored
    this.powerPanels = [];  // ceiling lights that stay off until power is restored
    this.powered = false;
    this.rackMount = null;  // where the rifle model hangs in the armory
    this.rackGlow = null;   // pulsing highlight behind it
    this.breakerLight = null;
    this.ledTimer = 0;
    this.unitBox = new THREE.BoxGeometry(1, 1, 1);

    this._buildGround();
    this._buildRooms();
    this._buildWalls();
    buildProps(this);
  }

  // ---------- Small building helpers (also used by Props.js) ----------

  // h = how tall it is. Walls are full height; low props (desks, barriers) let bullets pass over.
  addCollider(minX, maxX, minZ, maxZ, h = 6) {
    const box = { minX, maxX, minZ, maxZ, h };
    this.colliders.push(box);
    return box;
  }

  // A box made from a shared unit cube. y is the CENTRE height.
  prim(mat, sx, sy, sz, x, y, z, parent = this.group) {
    const m = new THREE.Mesh(this.unitBox, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // Same as prim, but the player cannot walk through it.
  solid(mat, sx, sy, sz, x, y, z) {
    const m = this.prim(mat, sx, sy, sz, x, y, z);
    this.addCollider(x - sx / 2, x + sx / 2, z - sz / 2, z + sz / 2, y + sy / 2);
    return m;
  }

  cyl(rTop, rBottom, h, x, y, z, mat, segments = 16) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), mat);
    m.position.set(x, y, z);
    this.group.add(m);
    return m;
  }

  // Self-lit box (ceiling light panels, LEDs, beacons). amp > 0 makes it flicker.
  glow(x, y, z, sx, sy, sz, color, amp = 0, off = false) {
    const mat = new THREE.MeshBasicMaterial({ color: off ? 0x14171b : color });
    const m = this.prim(mat, sx, sy, sz, x, y, z);
    if (amp > 0 && !off) {
      this.flickers.push({ mat, base: new THREE.Color(color), phase: Math.random() * 100, amp });
    }
    return m;
  }

  // A ceiling light that is dead until emergency power is restored.
  poweredGlow(x, y, z, sx, sy, sz, color, amp = 0) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x14171b });
    const m = this.prim(mat, sx, sy, sz, x, y, z);
    this.powerPanels.push({ mat, color, amp });
    return m;
  }

  // A screen that shows nothing until power is restored.
  powerScreen(mesh, onMaterial) {
    mesh.material = this.mats.screenOff;
    this.powerScreens.push({ mesh, onMaterial });
  }

  powerOn() {
    if (this.powered) return;
    this.powered = true;
    for (const s of this.powerScreens) s.mesh.material = s.onMaterial;
    for (const p of this.powerPanels) {
      p.mat.color.setHex(p.color);
      if (p.amp > 0) this.flickers.push({ mat: p.mat, base: new THREE.Color(p.color), phase: Math.random() * 100, amp: p.amp });
    }
    if (this.breakerLight) this.breakerLight.material.color.setHex(0x35ff8a);
  }

  zoneAt(x, z) {
    for (const zone of this.zones) {
      if (x >= zone.x1 && x <= zone.x2 && z >= zone.z1 && z <= zone.z2) return zone.name;
    }
    return '';
  }

  floor(x1, z1, x2, z2, mat, tile = 1.6, y = 0.01) {
    const w = x2 - x1;
    const d = z2 - z1;
    const geo = new THREE.PlaneGeometry(w, d);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * d) / tile);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    this.group.add(m);
    return m;
  }

  ceiling(x1, z1, x2, z2, y, mat, tile = 1.2) {
    const m = this.floor(x1, z1, x2, z2, mat, tile, y);
    m.rotation.x = Math.PI / 2; // faces downward
    return m;
  }

  // ---------- Ground and rooms ----------

  _buildGround() {
    const M = this.mats;
    this.floor(-200, -200, 200, 200, M.asphalt, 6, 0);
    this.floor(-12, 10, 12, 30, M.pavement, 3, 0.006); // concrete plaza in front of the entrance
    this.floor(-24, -70, -8, -42, M.pavement, 3, 0.006); // service yard behind the building
  }

  _buildRooms() {
    const M = this.mats;
    const rooms = [
      { name: 'Main reception',        x1: -10, x2: 10,  z1: -6,  z2: 10,  h: 4.5, floor: M.floorDark,  ceil: M.ceiling },
      { name: 'Office corridor',       x1: -2,  x2: 2,   z1: -22, z2: -6,  h: 3.2, floor: M.floorLight, ceil: M.ceiling },
      { name: 'Office corridor',       x1: -22, x2: 22,  z1: -26, z2: -22, h: 3.2, floor: M.floorLight, ceil: M.ceiling },
      { name: 'Administration office', x1: -12, x2: -2,  z1: -22, z2: -14, h: 3.2, floor: M.floorLight, ceil: M.ceiling },
      { name: 'Maintenance room',      x1: -12, x2: -2,  z1: -14, z2: -6,  h: 3.2, floor: M.floorLight, ceil: M.ceiling },
      { name: 'Administration office', x1: 2,   x2: 12,  z1: -22, z2: -14, h: 3.2, floor: M.floorLight, ceil: M.ceiling },
      { name: 'Security armory',       x1: 2,   x2: 12,  z1: -14, z2: -6,  h: 3.2, floor: M.floorLight, ceil: M.ceiling },
      { name: 'Research laboratory',   x1: -22, x2: -7,  z1: -42, z2: -26, h: 3.8, floor: M.floorLight, ceil: M.ceiling },
      { name: 'Security control room', x1: -7,  x2: 7,   z1: -42, z2: -26, h: 3.4, floor: M.floorDark,  ceil: M.ceiling },
      { name: 'Server room',           x1: 7,   x2: 22,  z1: -42, z2: -26, h: 3.6, floor: M.floorDark,  ceil: M.ceilingDark },
      { name: 'ECHO testing chamber',  x1: -8,  x2: 22,  z1: -64, z2: -42, h: 6.0, floor: M.floorDark,  ceil: M.ceilingDark },
    ];

    for (const r of rooms) {
      this.floor(r.x1, r.z1, r.x2, r.z2, r.floor, 1.6);
      this.ceiling(r.x1, r.z1, r.x2, r.z2, r.h, r.ceil, 1.2);
      this.zones.push({ name: r.name, x1: r.x1, x2: r.x2, z1: r.z1, z2: r.z2 });
    }
    this.zones.push({ name: 'Exterior entrance', x1: -26, x2: 26, z1: 10, z2: 44 });
    this.zones.push({ name: 'Service yard', x1: -24, x2: -8, z1: -70, z2: -42 });
  }

  // ---------- Walls ----------

  _buildWalls() {
    const M = this.mats;
    const T = WALL_T;
    const wallX = (z, x1, x2, doors, mat = M.wall, h = WALL_H) =>
      this._wall(true, z, x1 - T / 2, x2 + T / 2, doors, mat, h);
    const wallZ = (x, z1, z2, doors, mat = M.wall, h = WALL_H) =>
      this._wall(false, x, z1 - T / 2, z2 + T / 2, doors, mat, h);

    // Building front (facade) with the main entrance
    wallX(10, -22, 22, [D(0, 4, 3.4)], M.facade);

    // Courtyard boundary (low dark fence)
    wallX(10, 22, 26, [], M.fence, 3.5);
    wallX(10, -26, -22, [], M.fence, 3.5);
    wallZ(-26, 10, 44, [], M.fence, 3.5);
    wallZ(26, 10, 44, [], M.fence, 3.5);
    wallX(44, -26, 26, [], M.fence, 3.5);

    // Outer walls of the building
    wallZ(-22, -42, 10, [], M.facade);
    wallZ(22, -64, 10, [], M.facade);
    wallX(-64, -8, 22, []);
    wallZ(-8, -64, -42, [D(-58, 2.4, 2.8)]); // emergency service exit (door added by Mission 1)

    // Service yard boundary (low dark fence)
    wallZ(-24, -70, -42, [], M.fence, 3.5);
    wallX(-70, -24, -8, [], M.fence, 3.5);
    wallZ(-8, -70, -64, [], M.fence, 3.5);
    wallX(-42, -24, -22, [], M.fence, 3.5);

    // Reception
    wallZ(-10, -6, 10, []);
    wallZ(10, -6, 10, []);
    wallX(-6, -12, 12, [D(0, 4, 3.2)]);

    // Corridor A (reception to the cross corridor), with office doors
    wallZ(-2, -22, -6, [D(-18, 1.4, 2.4), D(-10, 1.4, 2.4)]);
    wallZ(2, -22, -6, [D(-18, 1.4, 2.4), D(-10, 1.4, 2.4)]);

    // Office blocks
    wallZ(-12, -22, -6, []);
    wallZ(12, -22, -6, []);
    wallX(-14, -12, -2, []);
    wallX(-14, 2, 12, []);

    // Cross corridor (Corridor B)
    wallX(-22, -22, 22, [D(0, 4, 3.2)]);
    wallX(-26, -22, 22, [D(-14.5, 2.2, 2.6), D(0, 2.2, 2.6), D(14.5, 2.2, 2.6)]);

    // Laboratory / control room / server room dividers
    wallZ(-7, -42, -26, []);
    wallZ(7, -42, -26, []);

    // Wall between the three rooms and the ECHO chamber
    wallX(-42, -22, 22, [D(0, 2.4, 2.6), D(14.5, 2.4, 2.6)]);
  }

  // Builds one straight wall with door openings.
  _wall(alongX, fixed, from, to, doors, mat, height) {
    const ds = doors.map((d) => ({ a: d.at - d.w / 2, b: d.at + d.w / 2, h: d.h })).sort((p, q) => p.a - q.a);
    let cursor = from;
    for (const d of ds) {
      this._wallPiece(alongX, fixed, cursor, d.a, 0, height, true, mat);
      this._wallPiece(alongX, fixed, d.a, d.b, d.h, height, false, mat); // header above the door
      cursor = d.b;
    }
    this._wallPiece(alongX, fixed, cursor, to, 0, height, true, mat);
  }

  _wallPiece(alongX, fixed, a, b, y0, y1, collide, mat) {
    const len = b - a;
    const h = y1 - y0;
    if (len < 0.01 || h < 0.01) return;
    const mid = (a + b) / 2;
    const cy = (y0 + y1) / 2;
    const w = alongX ? len : WALL_T;
    const d = alongX ? WALL_T : len;
    const x = alongX ? mid : fixed;
    const z = alongX ? fixed : mid;

    const geo = new THREE.BoxGeometry(w, h, d);
    scaleBoxUV(geo, w, h, d, 3);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, cy, z);
    this.group.add(mesh);

    if (collide) this.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  }

  // ---------- Per-frame effects ----------

  update(dt, t) {
    if (this.rackGlow && this.rackGlow.visible) this.rackGlow.material.opacity = 0.17 + 0.1 * Math.sin(t * 3);
    for (const f of this.flickers) {
      const k = 1 - f.amp * flickerWave(t, f.phase);
      f.mat.color.copy(f.base).multiplyScalar(0.12 + 0.88 * k);
    }

    // Blink a few server LEDs now and then.
    if (this.leds) {
      this.ledTimer -= dt;
      if (this.ledTimer <= 0) {
        this.ledTimer = 0.12;
        const { mesh, base, count } = this.leds;
        for (let n = 0; n < 6; n++) {
          const i = Math.floor(Math.random() * count);
          const on = Math.random() < 0.7;
          mesh.setColorAt(i, on ? base[i] : this.leds.dim);
        }
        mesh.instanceColor.needsUpdate = true;
      }
    }
  }
}
