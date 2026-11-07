import * as THREE from 'three';
import { signMaterial, screenMaterial, makeRng } from './Materials.js';
import { buildRifle } from '../weapons/RifleModel.js';

// Rotation.y values that make a flat sign face a given direction.
const FACE = { PZ: 0, NZ: Math.PI, PX: Math.PI / 2, NX: -Math.PI / 2 };

const SCREEN_GEO = new THREE.PlaneGeometry(0.57, 0.33);
const WHEEL_GEO = new THREE.CylinderGeometry(0.34, 0.34, 0.25, 16);

export function buildProps(level) {
  const rand = makeRng(1337);
  exterior(level, rand);
  reception(level, rand);
  corridors(level, rand);
  offices(level, rand);
  lab(level, rand);
  maintenance(level, rand);
  armory(level, rand);
  controlRoom(level);
  serverRoom(level, rand);
  echoChamber(level);
  yard(level);
}

// ======================= Small reusable props =======================

function sign(level, mat, w, h, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  level.group.add(m);
  return m;
}

function exitSign(level, x, y, z, ry) {
  const mat = signMaterial('EXIT', { w: 256, h: 96, bg: '#073d1d', fg: '#8dffb8', border: '#8dffb8' });
  sign(level, mat, 0.5, 0.19, x, y, z, ry);
}

function paper(level, rand, x, z) {
  const m = level.prim(level.mats.paper, 0.21, 0.004, 0.297, x, 0.016 + rand() * 0.004, z);
  m.rotation.y = rand() * Math.PI * 2;
}

function scatterPapers(level, rand, x1, x2, z1, z2, n) {
  for (let i = 0; i < n; i++) paper(level, rand, x1 + rand() * (x2 - x1), z1 + rand() * (z2 - z1));
}

// Seat faces local +z, so rotation.y = ry makes it face (sin ry, cos ry).
function chair(level, x, z, ry, fallen = false) {
  const M = level.mats;
  const g = new THREE.Group();
  level.prim(M.fabric, 0.5, 0.07, 0.5, 0, 0.46, 0, g);
  level.prim(M.fabric, 0.5, 0.5, 0.06, 0, 0.75, -0.23, g);
  level.prim(M.metalDark, 0.06, 0.4, 0.06, 0, 0.22, 0, g);
  level.prim(M.metalDark, 0.55, 0.04, 0.06, 0, 0.04, 0, g);
  level.prim(M.metalDark, 0.06, 0.04, 0.55, 0, 0.04, 0, g);
  g.position.set(x, fallen ? 0.28 : 0.01, z);
  g.rotation.set(0, ry, fallen ? Math.PI / 2 * 0.95 : 0);
  level.group.add(g);
  if (!fallen) level.addCollider(x - 0.25, x + 0.25, z - 0.25, z + 0.25, 0.95);
}

function desk(level, x, z, w, d, h = 0.75) {
  const M = level.mats;
  level.prim(M.laminate, w, 0.06, d, x, h - 0.03, z);
  if (w >= d) {
    level.prim(M.deskBody, 0.05, h - 0.06, d - 0.1, x - w / 2 + 0.05, (h - 0.06) / 2, z);
    level.prim(M.deskBody, 0.05, h - 0.06, d - 0.1, x + w / 2 - 0.05, (h - 0.06) / 2, z);
  } else {
    level.prim(M.deskBody, w - 0.1, h - 0.06, 0.05, x, (h - 0.06) / 2, z - d / 2 + 0.05);
    level.prim(M.deskBody, w - 0.1, h - 0.06, 0.05, x, (h - 0.06) / 2, z + d / 2 - 0.05);
  }
  level.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
}

// Monitor and keyboard. The screen faces local +z; y is the desk-top height.
function workstation(level, x, y, z, ry, screenMat) {
  const M = level.mats;
  const g = new THREE.Group();
  level.prim(M.plastic, 0.26, 0.03, 0.2, 0, 0.015, 0, g);
  level.prim(M.plastic, 0.05, 0.2, 0.05, 0, 0.13, 0, g);
  level.prim(M.plastic, 0.62, 0.38, 0.035, 0, 0.4, 0, g);
  const scr = new THREE.Mesh(SCREEN_GEO, screenMat);
  scr.position.set(0, 0.4, 0.019);
  g.add(scr);
  level.prim(M.plastic, 0.42, 0.02, 0.14, 0, 0.01, 0.35, g);
  g.position.set(x, y, z);
  g.rotation.y = ry;
  level.group.add(g);
  return scr;
}

function securityCamera(level, x, y, z, targetX, targetZ) {
  const M = level.mats;
  const g = new THREE.Group();
  level.prim(M.white, 0.12, 0.12, 0.3, 0, 0, 0.15, g);
  level.prim(M.metalDark, 0.04, 0.12, 0.04, 0, 0.1, 0, g);
  level.prim(M.screenOff, 0.07, 0.07, 0.02, 0, 0, 0.31, g);
  g.position.set(x, y, z);
  g.rotation.order = 'YXZ';
  g.rotation.set(0.35, Math.atan2(targetX - x, targetZ - z), 0);
  level.group.add(g);
}

function ceilingCamera(level, x, y, z, tx, ty, tz) {
  const M = level.mats;
  const g = new THREE.Group();
  level.prim(M.white, 0.2, 0.2, 0.4, 0, 0, 0.2, g);
  level.prim(M.metalDark, 0.06, 0.3, 0.06, 0, 0.2, 0, g);
  level.prim(M.screenOff, 0.1, 0.1, 0.02, 0, 0, 0.41, g);
  g.position.set(x, y, z);
  g.lookAt(tx, ty, tz);
  level.group.add(g);
}

function vehicle(level, x, z, len, color, quarterTurn) {
  const M = level.mats;
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const g = new THREE.Group();
  level.prim(body, len, 0.75, 1.85, 0, 0.62, 0, g);
  level.prim(M.glassDark, len * 0.5, 0.62, 1.65, -len * 0.05, 1.28, 0, g);
  level.prim(body, len * 0.46, 0.05, 1.7, -len * 0.05, 1.62, 0, g);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(WHEEL_GEO, M.tire);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(sx * len * 0.32, 0.34, sz * 0.9);
      g.add(wheel);
    }
  }
  g.position.set(x, 0, z);
  if (quarterTurn) g.rotation.y = Math.PI / 2;
  level.group.add(g);
  const hx = quarterTurn ? 1.0 : len / 2 + 0.05;
  const hz = quarterTurn ? len / 2 + 0.05 : 1.0;
  level.addCollider(x - hx, x + hx, z - hz, z + hz, 1.7);
}

// ======================= Area 1: Exterior =======================

function exterior(level, rand) {
  const M = level.mats;

  // Dark glass band and mullions on the facade
  for (const cx of [-13, 13]) {
    level.prim(M.glassDark, 14, 2.4, 0.1, cx, 2.2, 10.2);
    for (let i = -3; i <= 3; i++) level.prim(M.metalDark, 0.1, 2.5, 0.14, cx + i * 2, 2.2, 10.26);
  }

  // Company sign above the entrance
  const apex = signMaterial('APEX DYNAMICS', { w: 1024, h: 136, bg: '#0a0f15', fg: '#d7e6f2' });
  sign(level, apex, 9, 1.2, 0, 5.0, 10.17, FACE.PZ);

  // Entrance canopy, frame and columns
  level.prim(M.barrier, 10, 0.25, 3.9, 0, 4.0, 12.1);
  level.solid(M.metal, 0.4, 4, 0.4, -4.6, 2.0, 13.7);
  level.solid(M.metal, 0.4, 4, 0.4, 4.6, 2.0, 13.7);
  level.prim(M.metalDark, 0.22, 3.4, 0.5, -2.12, 1.7, 10);
  level.prim(M.metalDark, 0.22, 3.4, 0.5, 2.12, 1.7, 10);
  level.prim(M.metalDark, 4.46, 0.2, 0.5, 0, 3.5, 10);

  // Light poles (some of them flicker)
  const poles = [[-14, 18, 1], [14, 18, 0], [-20, 32, 0.6], [20, 32, 0]];
  for (const [px, pz, amp] of poles) {
    level.cyl(0.07, 0.09, 7, px, 3.5, pz, M.metalDark, 8);
    level.glow(px + 0.3, 6.95, pz, 0.9, 0.12, 0.35, 0xe9f1ff, amp);
    level.addCollider(px - 0.15, px + 0.15, pz - 0.15, pz + 0.15);
  }

  // Concrete barriers (leaving a gap in front of the entrance)
  for (const bx of [-8.1, -5.5, 5.5, 8.1]) level.solid(M.barrier, 2.4, 0.9, 0.6, bx, 0.45, 16.5);
  level.solid(M.hazard, 2.0, 0.9, 0.12, -10, 0.45, 21);
  level.solid(M.hazard, 2.0, 0.9, 0.12, 10, 0.45, 24);

  // Guard booth
  level.solid(M.metal, 2.4, 2.6, 2.4, -9, 1.3, 13);
  level.prim(M.metalDark, 2.7, 0.15, 2.7, -9, 2.67, 13);
  level.prim(M.glassDark, 1.6, 0.8, 0.05, -9, 1.7, 14.22);

  // Abandoned vehicles
  vehicle(level, -13.5, 24, 4.5, 0x1b2230, false);
  vehicle(level, 14.5, 30, 4.8, 0x4a2020, true);

  // Puddles on the wet ground
  const puddles = [[-6, 20, 1.6], [7, 19, 1.2], [-16, 33, 2.2], [3, 28, 1.8], [18, 22, 1.0], [-2, 36, 1.4], [11, 36, 2.0]];
  puddles.forEach(([x, z, r], i) => {
    const p = new THREE.Mesh(new THREE.CircleGeometry(r, 24), M.puddle);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.012 + i * 0.0005, z);
    level.group.add(p);
  });

  scatterPapers(level, rand, -3, 3, 10.5, 14, 8);
}

// ======================= Area 2: Reception =======================

function reception(level, rand) {
  const M = level.mats;

  // Reception desk with damaged screens
  level.prim(M.laminate, 5.2, 0.06, 1.4, -5.5, 1.13, -1.5);
  level.solid(M.deskBody, 5, 1.1, 1.2, -5.5, 0.55, -1.5);
  workstation(level, -6.8, 1.16, -1.5, 0, M.screenOff);
  workstation(level, -4.6, 1.16, -1.5, 0.3, screenMaterial('cracked'));

  // Security checkpoint arch
  level.solid(M.metal, 0.35, 2.4, 0.5, -1.3, 1.2, -4.2);
  level.solid(M.metal, 0.35, 2.4, 0.5, 1.3, 1.2, -4.2);
  level.prim(M.metal, 3.0, 0.3, 0.5, 0, 2.55, -4.2);
  level.prim(M.emRed, 0.2, 0.08, 0.08, 0, 2.38, -3.93);

  // Waiting area along the east wall
  for (const z of [0, 1.2, 2.4]) chair(level, 9.0, z, -Math.PI / 2);
  level.solid(M.laminate, 0.8, 0.4, 0.8, 7.8, 0.2, 1.2);
  chair(level, 3.5, 5.5, 0.8, true); // knocked over

  // Branding and signs
  const logo = signMaterial('APEX', { w: 1024, h: 256, bg: '#0c1218', fg: '#d7e6f2', sub: 'Research and Development, Veyra' });
  sign(level, logo, 4.4, 1.1, -6.8, 2.7, -5.83, FACE.PZ);
  const visitors = signMaterial('Visitors must\nsign in at reception', { w: 512, h: 200, border: '#7fb4d6', fg: '#c9d6e2' });
  sign(level, visitors, 2.6, 1.0, 6.5, 2.3, -5.83, FACE.PZ);
  exitSign(level, 0, 3.75, -5.83, FACE.PZ);

  // Lighting: flickering ceiling panels, one dead, plus red emergency beacons
  level.glow(-5, 4.47, 2, 1.4, 0.06, 0.6, 0xdfeeff, 1);
  level.glow(5, 4.47, 2, 1.4, 0.06, 0.6, 0xdfeeff, 0.6);
  level.glow(0, 4.47, 6, 1.4, 0.06, 0.6, 0xdfeeff, 0, true);
  level.glow(0, 4.47, -2, 1.4, 0.06, 0.6, 0xdfeeff, 0.3);
  level.glow(-9.85, 3.7, 2, 0.15, 0.25, 0.25, 0xff2a1f, 0.5);
  level.glow(9.85, 3.7, 2, 0.15, 0.25, 0.25, 0xff2a1f, 0.5);

  securityCamera(level, -9.6, 4.1, 9.6, 0, -3);
  scatterPapers(level, rand, -8, 0, -3.5, 2.5, 14);
}

// ======================= Area 3: Corridors =======================

function corridors(level, rand) {
  const M = level.mats;

  // Ceiling panels
  // Third value: true = dead until emergency power is restored
  [[-9, 0, true], [-14, 1, false], [-19, 0.5, true]].forEach(([z, amp, p]) =>
    (p ? level.poweredGlow : level.glow).call(level, 0, 3.17, z, 0.6, 0.06, 1.4, 0xdfeeff, amp)
  );
  [[-19, 0, false], [-11, 0, false], [-4, 0.8, true], [4, 0, true], [11, 1, false], [19, 0, false]].forEach(([x, amp, p]) =>
    (p ? level.poweredGlow : level.glow).call(level, x, 3.17, -24, 1.4, 0.06, 0.6, 0xdfeeff, amp)
  );

  // Office door plates along Corridor A
  [[-18, 'Office 101', 'Office 103'], [-10, 'Maintenance', 'Security armory']].forEach(([z, west, east]) => {
    sign(level, signMaterial(west, { w: 384, h: 80, fg: '#c9d6e2' }), 0.95, 0.2, -1.84, 2.75, z, FACE.PX);
    sign(level, signMaterial(east, { w: 384, h: 80, fg: '#c9d6e2' }), 0.95, 0.2, 1.84, 2.75, z, FACE.NX);
  });

  // Plates above the three doors on the north wall of Corridor B
  sign(level, signMaterial('Research laboratory', { w: 512, h: 96 }), 1.8, 0.28, -14.5, 2.9, -25.84, FACE.PZ);
  sign(level, signMaterial('Security control', { w: 512, h: 96 }), 1.8, 0.28, 0, 2.9, -25.84, FACE.PZ);
  sign(level, signMaterial('Server room', { w: 512, h: 96 }), 1.8, 0.28, 14.5, 2.9, -25.84, FACE.PZ);
  sign(
    level,
    signMaterial('Authorised\npersonnel only', { w: 256, h: 160, bg: '#d9a600', fg: '#111111', border: '#111111' }),
    0.6, 0.38, 11.8, 1.6, -25.84, FACE.PZ
  );

  exitSign(level, -21.84, 2.75, -24, FACE.PX);
  exitSign(level, 21.84, 2.75, -24, FACE.NX);

  securityCamera(level, -1.8, 3.0, -7, 0, -20);
  securityCamera(level, -21.7, 3.0, -22.3, 0, -24);
  securityCamera(level, 21.7, 3.0, -22.3, 0, -24);

  // Extinguisher and a trolley someone left behind
  level.cyl(0.08, 0.08, 0.4, 1.78, 1.0, -15.5, level.mats.emRed, 12);
  level.solid(M.metal, 1.1, 0.9, 0.6, 7.5, 0.45, -25.4);
  level.prim(M.paper, 0.5, 0.03, 0.4, 7.4, 0.92, -25.4);
  // Low barrier: cover for the first firefight (bullets pass over it, crouched people are hidden behind it)
  level.solid(M.barrier, 0.6, 1.1, 1.55, 12, 0.55, -25.075);

  scatterPapers(level, rand, -2, 12, -25.5, -22.5, 14);
}

// ======================= Offices =======================

function offices(level, rand) {
  const M = level.mats;
  const defs = [
    { side: -1, z1: -22, z2: -14 },
    { side: -1, z1: -14, z2: -6 },
    { side: 1, z1: -22, z2: -14 },
    { side: 1, z1: -14, z2: -6 },
  ];
  const screens = [M.screenOff, screenMaterial('terminal'), screenMaterial('cracked'), screenMaterial('error')];

  defs.forEach((o, idx) => {
    if (idx === 1 || idx === 3) return; // these two rooms are the maintenance room and the armory
    const s = o.side;
    [o.z1 + 1.8, o.z2 - 1.8].forEach((zc, i) => {
      desk(level, s * 11.1, zc, 1.4, 2.4);
      workstation(level, s * 11.3, 0.75, zc, -s * Math.PI / 2, screens[Math.floor(rand() * 4)]);
      chair(level, s * 9.8, zc + (rand() - 0.5) * 0.5, s * Math.PI / 2 + (rand() - 0.5) * 0.6, idx === 1 && i === 0);
    });
    level.solid(M.cabinet, 0.9, 1.8, 0.5, s * 6.5, 0.9, o.z1 + 0.4);
    level.solid(M.cabinet, 0.9, 1.8, 0.5, s * 7.5, 0.9, o.z1 + 0.4);
    level.glow(s * 7, 3.17, (o.z1 + o.z2) / 2, 1.4, 0.06, 0.6, 0xdfeeff, idx === 0 ? 0.7 : 0, idx === 3);
    scatterPapers(level, rand, Math.min(s * 3, s * 9), Math.max(s * 3, s * 9), o.z1 + 1, o.z2 - 1, 8);
  });
}

// ======================= Area 4: Laboratory =======================

function tube(level, x, z, broken) {
  const M = level.mats;
  level.cyl(0.9, 0.9, 0.25, x, 0.135, z, M.metalDark, 20);
  level.cyl(0.8, 0.8, 2.3, x, 1.4, z, M.glass, 20);
  level.cyl(0.9, 0.9, 0.2, x, 2.65, z, M.metalDark, 20);
  if (!broken) level.cyl(0.62, 0.62, 2.0, x, 1.35, z, M.liquid, 16);
  level.addCollider(x - 0.9, x + 0.9, z - 0.9, z + 0.9, 2.7);
}

function lab(level, rand) {
  const M = level.mats;
  const screens = [screenMaterial('terminal'), M.screenOff, screenMaterial('error')];

  // Benches with terminals and equipment
  for (const bx of [-18.2, -10.8]) {
    const dir = bx < -14.5 ? 1 : -1; // monitors face the central aisle
    level.solid(M.benchBody, 1.3, 0.9, 5.5, bx, 0.45, -32.5);
    level.prim(M.benchTop, 1.4, 0.06, 5.6, bx, 0.93, -32.5);
    [-34.3, -32.5, -30.7].forEach((z, i) =>
      workstation(level, bx - dir * 0.3, 0.96, z, dir * Math.PI / 2, screens[(i + (dir > 0 ? 0 : 1)) % 3])
    );
    level.cyl(0.25, 0.25, 0.3, bx, 1.11, -35, M.metal, 16);         // centrifuge
    for (let k = 0; k < 3; k++) level.cyl(0.05, 0.07, 0.2, bx + (k - 1) * 0.3, 1.06, -29.9, M.glass, 10);
  }

  // Classified folder on a bench
  const folder = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.4),
    signMaterial('CLASSIFIED\nPROJECT ECHO\nPHASE 3', { w: 256, h: 340, bg: '#d8d2c2', fg: '#8a1b14', border: '#8a1b14' })
  );
  folder.rotation.x = -Math.PI / 2;
  folder.position.set(-10.8, 0.964, -31.2);
  level.group.add(folder);

  // Glass chambers along the north wall. The middle one is empty and broken.
  tube(level, -19.5, -40.7, false);
  tube(level, -16.5, -40.7, true);
  tube(level, -13.5, -40.7, false);
  const stain = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.3), M.blood);
  stain.rotation.x = -Math.PI / 2;
  stain.position.set(-16.2, 0.016, -38.9);
  level.group.add(stain);

  // Medical monitor and gurney
  level.cyl(0.03, 0.03, 1.5, -11, 0.76, -40.9, M.metalDark, 8);
  level.prim(M.plastic, 0.5, 0.35, 0.06, -11, 1.6, -40.9);
  sign(level, new THREE.MeshBasicMaterial({ map: screenMaterial('ecg').map, color: 0xb0b0b0 }), 0.45, 0.28, -11, 1.6, -40.86, FACE.PZ);
  level.addCollider(-11.2, -10.8, -41.1, -40.7, 1.7);
  level.solid(M.white, 0.9, 0.55, 2.0, -8.4, 0.55, -37);

  // Open equipment cabinets on the west wall
  for (const z of [-28.9, -30.5]) {
    level.solid(M.cabinet, 0.6, 1.9, 0.9, -21.55, 0.96, z);
    const door = level.prim(M.cabinet, 0.45, 1.8, 0.03, -21.1, 0.96, z + 0.5);
    door.rotation.y = 0.7;
  }

  const warning = signMaterial('PROJECT ECHO\nRESTRICTED AREA', { w: 512, h: 200, bg: '#180b0b', fg: '#ff6a5a', border: '#ff6a5a' });
  sign(level, warning, 2.4, 0.95, -21.84, 2.5, -35, FACE.PX);

  [[-18, -30, 0], [-11, -30, 0], [-18, -36, 1], [-11, -36, 0]].forEach(([x, z, amp], i) =>
    level.glow(x, 3.77, z, 1.4, 0.06, 0.6, 0xe6f0ff, amp, i === 3)
  );
  scatterPapers(level, rand, -20, -8, -29, -37, 10);
}

// ======================= Area 5: Security control room =======================

function controlRoom(level) {
  const M = level.mats;

  // Wall of CCTV monitors on the west wall
  let n = 0;
  for (const z of [-40.2, -37.9, -35.6, -33.3, -31.0]) {
    for (const y of [2.5, 1.3]) {
      level.prim(M.metalDark, 0.06, 1.2, 2.1, -6.78, y, z);
      const scr = sign(level, screenMaterial('cctv' + (n++ % 4)), 1.95, 1.05, -6.74, y, z, FACE.PX);
      level.powerScreen(scr, scr.material);
    }
  }

  // Two consoles with operators' chairs
  [-3.6, 3.6].forEach((cx, ci) => {
    desk(level, cx, -33, 4, 1.1, 0.9);
    [-1.2, 0, 1.2].forEach((dx, i) => {
      const scr = workstation(level, cx + dx, 0.9, -33, 0, screenMaterial(['terminal', 'error', 'cracked'][(i + ci) % 3]));
      level.powerScreen(scr, scr.material);
    });
    chair(level, cx - 0.8, -31.6, Math.PI);
    chair(level, cx + 0.8, -31.6, Math.PI);
  });

  // Emergency control panel on the east wall
  level.prim(M.metalDark, 0.1, 1.1, 2.4, 6.8, 1.5, -34);
  [-0.8, -0.3, 0.3, 0.8].forEach((dz, i) => level.prim(i % 2 ? M.emGreen : M.emRed, 0.05, 0.12, 0.12, 6.73, 1.3, -34 + dz));
  sign(level, signMaterial('Emergency lockdown', { w: 512, h: 96, bg: '#2a0b0b', fg: '#ff7a6a' }), 1.8, 0.34, 6.72, 2.4, -34, FACE.NX);

  // Plate on the locked door to the ECHO chamber
  sign(level, signMaterial('ECHO chamber\naccess restricted', { w: 512, h: 160, bg: '#180b0b', fg: '#ff6a5a', border: '#ff6a5a' }), 2.0, 0.55, 0, 2.95, -41.84, FACE.PZ);

  [[-3, -30, 0], [3, -30, 0], [-3, -38, 0.6], [3, -38, 0]].forEach(([x, z, amp]) =>
    level.poweredGlow(x, 3.37, z, 1.4, 0.06, 0.6, 0xbcd4ff, amp)
  );
}

// ======================= Area 6: Server room =======================

function serverRoom(level, rand) {
  const M = level.mats;
  const cols = [
    { x: 9.5, face: 1 },
    { x: 11.7, face: -1 },
    { x: 17.3, face: 1 },
    { x: 19.5, face: -1 },
  ];
  const rows = 12;
  const racks = new THREE.InstancedMesh(level.unitBox, M.rack, cols.length * rows);
  const ledsPerRack = 14;
  const ledCount = cols.length * rows * ledsPerRack;
  const leds = new THREE.InstancedMesh(level.unitBox, new THREE.MeshBasicMaterial({ color: 0xffffff }), ledCount);
  racks.frustumCulled = false;
  leds.frustumCulled = false;

  const palette = [0x2bd0ff, 0x35ff8a, 0x35ff8a, 0xff2a2a, 0xffb02e].map((c) => new THREE.Color(c));
  const base = [];
  const dummy = new THREE.Object3D();
  let r = 0;
  let l = 0;

  for (const col of cols) {
    for (let i = 0; i < rows; i++) {
      const z = -28.5 - i;
      dummy.position.set(col.x, 1.1, z);
      dummy.scale.set(1.0, 2.2, 0.9);
      dummy.updateMatrix();
      racks.setMatrixAt(r++, dummy.matrix);

      for (let k = 0; k < ledsPerRack; k++) {
        dummy.position.set(col.x + col.face * 0.51, 0.4 + rand() * 1.6, z + (rand() - 0.5) * 0.6);
        dummy.scale.set(0.02, 0.035, 0.07);
        dummy.updateMatrix();
        leds.setMatrixAt(l, dummy.matrix);
        const color = palette[Math.floor(rand() * palette.length)];
        base.push(color);
        leds.setColorAt(l, color);
        l++;
      }
    }
    level.addCollider(col.x - 0.5, col.x + 0.5, -39.95, -28.05, 2.2);
    level.prim(M.metalDark, 0.45, 0.08, 12.2, col.x, 2.6, -34); // cable tray overhead
  }
  level.group.add(racks);
  level.group.add(leds);
  level.leds = { mesh: leds, base, count: ledCount, dim: new THREE.Color(0x0a0d10) };

  // Cooling unit
  level.solid(M.metal, 1.2, 2.1, 3, 21.3, 1.05, -39);
  level.glow(20.68, 1.9, -37.7, 0.04, 0.08, 0.08, 0x35ff8a);
  sign(level, signMaterial('HIGH VOLTAGE', { w: 256, h: 96, bg: '#d9a600', fg: '#111111', border: '#111111' }), 0.7, 0.26, 21.84, 1.6, -34, FACE.NX);

  // Central data terminal
  desk(level, 14.5, -34, 1.8, 1.0, 0.9);
  level.prim(M.metalDark, 0.95, 0.6, 0.05, 14.5, 1.45, -34.35);
  const termScr = sign(level, screenMaterial('echo'), 0.85, 0.53, 14.5, 1.45, -34.32, FACE.PZ);
  level.powerScreen(termScr, termScr.material);

  // Emergency lighting, mostly dead overhead lights
  level.glow(7.3, 3.1, -27, 0.2, 0.2, 0.2, 0xff2a1f, 0.3);
  level.glow(21.7, 3.1, -41, 0.2, 0.2, 0.2, 0xff2a1f, 0.3);
  level.glow(14.5, 3.57, -30, 1.4, 0.06, 0.6, 0xbcd4ff, 0, true);
  level.glow(14.5, 3.57, -38, 1.4, 0.06, 0.6, 0xbcd4ff, 1);
}

// ======================= Area 7: ECHO testing chamber =======================

function echoChamber(level) {
  const M = level.mats;
  const cx = 8;
  const cz = -53;

  // Holographic projection platform (walkable). Colliders only on the emitter pillars.
  level.cyl(3.0, 3.1, 0.3, cx, 0.16, cz, M.metalDark, 48);
  level.cyl(2.9, 2.9, 0.02, cx, 0.32, cz, M.platformTop, 48);
  for (const [radius, y] of [[2.5, 0.34], [1.3, 0.34]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.045, 8, 64), M.emCyan);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(cx, y, cz);
    level.group.add(ring);
  }
  const overhead = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.06, 8, 64), M.emCyan);
  overhead.rotation.x = Math.PI / 2;
  overhead.position.set(cx, 5.7, cz);
  level.group.add(overhead);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 5, 32, 1, true), M.beam);
  beam.position.set(cx, 2.8, cz);
  level.group.add(beam);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const px = cx + Math.cos(a) * 3.8;
    const pz = cz + Math.sin(a) * 3.8;
    level.solid(M.metalDark, 0.3, 3.2, 0.3, px, 1.6, pz);
    level.glow(px, 3.3, pz, 0.18, 0.18, 0.18, 0x9fe8ff);
  }

  // Observation windows (visible on the chamber side of the wall)
  for (const wx of [-4.2, 4.2]) {
    level.prim(M.metalDark, 3.8, 1.8, 0.08, wx, 2.1, -42.2);
    level.prim(M.glassDark, 3.6, 1.6, 0.06, wx, 2.1, -42.25);
  }

  // Ceiling cameras watching the platform
  for (const [x, z] of [[-5, -45], [19, -45], [-5, -61], [19, -61]]) ceilingCamera(level, x, 5.7, z, cx, 0.3, cz);

  // Monitoring consoles and the main wall screen on the east side
  [-46, -50, -54].forEach((z, i) => {
    desk(level, 20.7, z, 1.1, 3.0, 0.95);
    workstation(level, 20.9, 0.95, z - 0.7, -Math.PI / 2, screenMaterial(['terminal', 'error', 'cracked'][i]));
    workstation(level, 20.9, 0.95, z + 0.7, -Math.PI / 2, screenMaterial('terminal'));
    chair(level, 19.5, z, Math.PI / 2);
  });
  level.prim(M.metalDark, 0.08, 1.8, 4.2, 21.78, 3.0, -50);
  const wallScr = sign(level, screenMaterial('echo'), 4.0, 1.6, 21.72, 3.0, -50, FACE.NX);
  level.powerScreen(wallScr, wallScr.material);

  // Emergency generator
  level.solid(M.metal, 2.4, 1.8, 1.6, 20.5, 0.9, -62.6);
  sign(level, M.hazard, 2.4, 0.4, 20.5, 1.2, -61.78, FACE.PZ);
  level.glow(19.6, 1.6, -61.77, 0.1, 0.1, 0.05, 0x35ff8a);
  level.glow(19.9, 1.6, -61.77, 0.1, 0.1, 0.05, 0xff2a1f, 0.5);

  // Cabinets along the north wall, gas cylinders by the west wall
  for (const x of [-6, -4.9, -3.8, 2, 3.1, 4.2]) level.solid(M.cabinet, 1.0, 2.0, 0.6, x, 1.0, -63.5);
  for (const z of [-45, -45.4, -46]) {
    level.cyl(0.13, 0.13, 1.4, -7.4, 0.7, z, M.metal, 10);
    level.addCollider(-7.55, -7.25, z - 0.15, z + 0.15, 1.4);
  }

  // Cables from the platform to the consoles
  level.prim(M.cable, 8.4, 0.03, 0.14, 15.3, 0.03, -50.7);
  level.prim(M.cable, 8.4, 0.03, 0.14, 15.3, 0.03, -54);

  // Dim ceiling panels, one flickering
  [[0, -48, 0], [16, -48, 1], [0, -58, 0], [16, -58, 0]].forEach(([x, z, amp], i) =>
    level.glow(x, 5.97, z, 1.6, 0.06, 0.7, 0xbcd4ff, amp, i === 2)
  );
}

// ======================= Maintenance room: restore emergency power =======================

function maintenance(level, rand) {
  const M = level.mats;

  // Main breaker cabinet on the west wall, directly facing the door
  level.prim(M.metalDark, 0.18, 1.9, 1.5, -11.76, 1.15, -10);
  level.prim(M.metal, 0.06, 1.6, 1.3, -11.64, 1.15, -10);
  level.breakerLight = level.glow(-11.6, 1.8, -10, 0.05, 0.1, 0.1, 0xff2a1f);
  for (let i = 0; i < 3; i++) level.prim(M.hazard, 0.06, 0.3, 0.08, -11.6, 1.2, -10.4 + i * 0.4);
  const sgn = signMaterial('MAIN BREAKER\nEMERGENCY GRID', { w: 512, h: 160, bg: '#2a0b0b', fg: '#ff7a6a', border: '#ff7a6a' });
  sign(level, sgn, 1.2, 0.38, -11.62, 2.35, -10, FACE.PX);

  // Generator, workbench, barrels
  level.solid(M.metal, 1.4, 1.3, 1.2, -10.9, 0.65, -7.0);
  level.prim(M.hazard, 1.2, 0.2, 0.02, -10.9, 0.45, -6.38);
  level.solid(M.metal, 2.4, 0.9, 0.7, -7, 0.45, -13.45);
  for (const [x, z] of [[-3.2, -13], [-3.9, -13.2], [-3.4, -12.3]]) {
    level.cyl(0.3, 0.3, 0.9, x, 0.45, z, M.metalDark, 12);
    level.addCollider(x - 0.3, x + 0.3, z - 0.3, z + 0.3, 0.9);
  }

  level.poweredGlow(-7, 3.17, -10, 1.4, 0.06, 0.6, 0xffc9a0, 0.5);
  level.glow(-2.3, 3.0, -6.4, 0.2, 0.2, 0.2, 0xff2a1f, 0.6);
  scatterPapers(level, rand, -10, -4, -13, -7, 8);
}

// ======================= Security armory =======================

function armory(level, rand) {
  const M = level.mats;
  const ammo = new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 0.8 });

  // Weapon lockers along the north wall
  for (const x of [4.2, 6.1, 8.0, 9.9]) level.solid(M.cabinet, 0.8, 1.95, 0.5, x, 0.98, -13.55);

  // Weapon rack on the east wall with a rifle hanging on it
  level.prim(M.metalDark, 0.1, 1.1, 1.6, 11.8, 1.3, -10);
  const rifle = buildRifle(level.unitBox).group;
  rifle.position.set(11.62, 1.35, -9.8);
  level.group.add(rifle);
  level.rackRifle = rifle;

  // Bench with ammunition crates
  level.solid(M.metal, 2.4, 0.9, 0.8, 6.5, 0.45, -7.2);
  for (const dx of [-0.8, -0.35, 0.1, 0.55]) level.prim(ammo, 0.3, 0.2, 0.2, 6.5 + dx, 1.0, -7.2);

  // Tactical equipment on stands
  for (const x of [10.2, 11.2]) {
    level.cyl(0.03, 0.03, 1.4, x, 0.7, -7.2, M.metalDark, 8);
    level.prim(M.fabric, 0.45, 0.5, 0.2, x, 1.2, -7.2);
    level.prim(M.metalDark, 0.22, 0.15, 0.26, x, 1.55, -7.2);
    level.addCollider(x - 0.3, x + 0.3, -7.4, -7.0, 1.6);
  }

  sign(level, signMaterial('SECURITY ARMORY', { w: 512, h: 96, border: '#7fb4d6' }), 1.9, 0.36, 7, 2.5, -6.17, FACE.NZ);
  level.poweredGlow(7, 3.17, -10, 1.4, 0.06, 0.6, 0xdfeeff, 0);
  scatterPapers(level, rand, 3, 10, -12, -9, 4);
}

// ======================= Service yard (extraction) =======================

function yard(level) {
  const M = level.mats;
  level.solid(M.metal, 2.0, 1.3, 1.0, -21.5, 0.65, -50);
  level.solid(M.metal, 2.0, 1.3, 1.0, -21.5, 0.65, -52.2);
  level.prim(M.laminate, 1.2, 0.12, 1.0, -12, 0.06, -47);
  level.cyl(0.07, 0.09, 6, -12, 3, -48, M.metalDark, 8);
  level.glow(-11.7, 5.95, -48, 0.9, 0.12, 0.35, 0xe9f1ff);
  level.addCollider(-12.15, -11.85, -48.15, -47.85);
  vehicle(level, -20, -67, 4.8, 0x14181f, false);

  // Extraction point marking
  for (const [x, z, sx, sz] of [[-16, -63.6, 3.4, 0.12], [-16, -60.4, 3.4, 0.12], [-17.6, -62, 0.12, 3.2], [-14.4, -62, 0.12, 3.2]]) {
    level.prim(M.emGreen, sx, 0.01, sz, x, 0.02, z);
  }
  level.glow(-16, 0.7, -62, 0.08, 1.4, 0.08, 0x35ff8a);
}
