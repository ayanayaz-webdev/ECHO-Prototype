import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { M4 } from './m4Config.js';

let promise = null;
let cached = null;

// Loads the uploaded weapon model exactly once. Everything else (first-person view, the rifle
// on the armory rack) uses clones that share the same geometry, textures and materials.
export function loadM4(scene) {
  if (!promise) {
    const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
    promise = new GLTFLoader().loadAsync(base + M4.file).then((gltf) => {
      cached = gltf.scene;
      const env = scene && scene.environment;
      const seen = new Set();
      cached.traverse((o) => {
        if (!o.isMesh || seen.has(o.material)) return;
        const m = o.material;
        seen.add(m);
        for (const k of ['map', 'normalMap', 'metalnessMap', 'roughnessMap']) {
          if (m[k]) m[k].anisotropy = 4;
        }
        if (env) {
          m.envMap = env; // lets the dark metal reflect a little light
          m.envMapIntensity = M4.envIntensity;
        }
        m.needsUpdate = true;
      });
      return cached;
    });
  }
  return promise;
}

// Returns a ready-to-use instance, or null if the model has not finished loading.
//   rig    - parent group (rotates/scales the model so the barrel points -Z)
//   mag    - the magazine mesh (moved during reloads)
//   muzzle - marker at the muzzle (used for the muzzle flash and tracer start)
export function makeM4() {
  if (!cached) return null;
  const model = cached.clone(true);
  let mag = null;
  model.traverse((o) => {
    if (o.isMesh && o.material && o.material.name === 'Magazin') mag = o;
  });
  const muzzle = new THREE.Object3D();
  muzzle.position.set(...M4.muzzle);
  model.add(muzzle);

  const rig = new THREE.Group();
  rig.rotation.y = M4.yaw;
  rig.scale.setScalar(M4.scale);
  rig.add(model);
  return { rig, model, mag, muzzle };
}

// Converts a point in model units to the weapon's own space (barrel along -Z, metres).
export function modelToWeapon(p) {
  const s = M4.scale;
  const c = Math.cos(M4.yaw);
  const n = Math.sin(M4.yaw);
  return new THREE.Vector3(s * (p[0] * c + p[2] * n), s * p[1], s * (-p[0] * n + p[2] * c));
}
