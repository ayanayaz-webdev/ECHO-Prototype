import * as THREE from 'three';
import { makeRng } from './Materials.js';

// Distant Veyra: a dark sky gradient, silhouette towers and lit windows.
// Everything here ignores fog and costs only a few draw calls.
export function buildSkyline(scene) {
  const rand = makeRng(2029);

  // Sky dome with a faint glow near the horizon.
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#02030a');
  grad.addColorStop(0.3, '#070c18');
  grad.addColorStop(0.5, '#1a2636');
  grad.addColorStop(1.0, '#1a2636');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(c);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(450, 24, 12),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  dome.renderOrder = -1;
  scene.add(dome);

  // Silhouette towers in a ring around the compound, all facing the centre.
  const COUNT = 80;
  const towers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x0a111b, fog: false }),
    COUNT
  );
  towers.frustumCulled = false;

  const windowPositions = [];
  const windowColors = [];
  const warm = new THREE.Color(0xffd9a0);
  const cool = new THREE.Color(0x9fd4ff);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < COUNT; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = 110 + rand() * 70;
    const w = 12 + rand() * 16;
    const d = 12 + rand() * 12;
    const h = 25 + rand() * 65;
    const bx = Math.sin(angle) * radius;
    const bz = Math.cos(angle) * radius;
    const facing = Math.atan2(bx, bz); // rotation that points the building's +z outward

    dummy.position.set(bx, h / 2, bz);
    dummy.rotation.set(0, facing, 0);
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    towers.setMatrixAt(i, dummy.matrix);

    // Scatter lit windows on the face that looks toward the player.
    const sin = Math.sin(facing);
    const cos = Math.cos(facing);
    for (let k = 0; k < 14; k++) {
      const u = (rand() - 0.5) * w * 0.85;
      const v = -(d / 2 + 0.3);
      windowPositions.push(bx + u * cos + v * sin, 2 + rand() * (h - 4), bz - u * sin + v * cos);
      const col = (rand() < 0.6 ? warm : cool).clone().multiplyScalar(0.4 + rand() * 0.6);
      windowColors.push(col.r, col.g, col.b);
    }
  }
  scene.add(towers);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(windowPositions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(windowColors, 3));
  const windows = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false })
  );
  windows.frustumCulled = false;
  scene.add(windows);
}
