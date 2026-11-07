import * as THREE from 'three';

let cached = null;
function mats() {
  if (!cached) {
    cached = {
      uniform: new THREE.MeshStandardMaterial({ color: 0x1b2027, roughness: 0.9 }),
      vest: new THREE.MeshStandardMaterial({ color: 0x252b33, roughness: 0.8 }),
      helmet: new THREE.MeshStandardMaterial({ color: 0x101316, roughness: 0.6 }),
      skin: new THREE.MeshStandardMaterial({ color: 0x7d6150, roughness: 0.9 }),
      gun: new THREE.MeshStandardMaterial({ color: 0x0e1013, roughness: 0.5, metalness: 0.4 }),
      flash: new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    };
  }
  return cached;
}

// Simple APEX security operator made of boxes. Faces +z. Feet are at y = 0.
export function buildEnemyModel(unit) {
  const m = mats();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const add = (parent, mat, sx, sy, sz, x, y, z) => {
    const p = new THREE.Mesh(unit, mat);
    p.scale.set(sx, sy, sz);
    p.position.set(x, y, z);
    parent.add(p);
    return p;
  };

  // Legs swing from the hip, so each one is a group whose pivot is at hip height.
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(-0.11, 0.9, 0);
  legR.position.set(0.11, 0.9, 0);
  add(legL, m.uniform, 0.15, 0.85, 0.17, 0, -0.43, 0);
  add(legR, m.uniform, 0.15, 0.85, 0.17, 0, -0.43, 0);
  add(legL, m.helmet, 0.16, 0.12, 0.24, 0, -0.84, 0.03); // boots
  add(legR, m.helmet, 0.16, 0.12, 0.24, 0, -0.84, 0.03);
  body.add(legL);
  body.add(legR);

  add(body, m.uniform, 0.4, 0.55, 0.22, 0, 1.2, 0);        // torso
  add(body, m.vest, 0.44, 0.38, 0.27, 0, 1.25, 0);         // tactical vest
  add(body, m.skin, 0.17, 0.2, 0.19, 0, 1.6, 0.01);        // head
  add(body, m.helmet, 0.22, 0.11, 0.24, 0, 1.72, 0.0);     // helmet
  add(body, m.helmet, 0.17, 0.08, 0.04, 0, 1.58, 0.1);     // face mask
  add(body, m.uniform, 0.09, 0.09, 0.45, -0.19, 1.3, 0.2); // left arm forward
  add(body, m.uniform, 0.09, 0.09, 0.35, 0.18, 1.28, 0.16); // right arm forward
  add(body, m.gun, 0.06, 0.1, 0.7, 0.04, 1.3, 0.42);       // rifle

  const flash = add(body, m.flash, 0.12, 0.12, 0.2, 0.04, 1.3, 0.85);
  flash.visible = false;

  return { root, body, legL, legR, flash };
}
