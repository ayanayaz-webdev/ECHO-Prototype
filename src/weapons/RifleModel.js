import * as THREE from 'three';

let cached = null;
function mats() {
  if (!cached) {
    cached = {
      metal: new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.4, metalness: 0.6 }),
      poly: new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.65, metalness: 0.1 }),
    };
  }
  return cached;
}

// M4A1-style rifle built from simple shapes. Barrel points down -z (away from the camera).
// Used for the first-person weapon and for the rifle on the armory rack.
export function buildRifle(unit) {
  const m = mats();
  const g = new THREE.Group();
  const add = (mat, sx, sy, sz, x, y, z, rx = 0) => {
    const p = new THREE.Mesh(unit, mat);
    p.scale.set(sx, sy, sz);
    p.position.set(x, y, z);
    p.rotation.x = rx;
    p.frustumCulled = false;
    g.add(p);
    return p;
  };
  add(m.metal, 0.06, 0.09, 0.34, 0, 0, 0);          // receiver
  add(m.metal, 0.06, 0.025, 0.3, 0, 0.06, -0.02);   // top rail
  add(m.poly, 0.058, 0.07, 0.3, 0, -0.002, -0.31);  // handguard
  add(m.metal, 0.022, 0.022, 0.26, 0, 0.01, -0.58); // barrel
  add(m.metal, 0.036, 0.036, 0.07, 0, 0.01, -0.72); // flash hider
  add(m.metal, 0.012, 0.06, 0.012, 0, 0.065, -0.62); // front sight
  add(m.poly, 0.05, 0.1, 0.2, 0, -0.02, 0.27);      // stock
  add(m.poly, 0.045, 0.11, 0.05, 0, -0.095, 0.1, 0.3); // pistol grip
  const mag = add(m.poly, 0.04, 0.15, 0.07, 0, -0.12, -0.05, 0.12); // magazine
  add(m.metal, 0.04, 0.045, 0.09, 0, 0.105, -0.04); // optic
  return { group: g, mag };
}
