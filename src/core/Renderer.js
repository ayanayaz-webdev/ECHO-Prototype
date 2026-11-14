import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { quality } from './Device.js';

// Creates the renderer, scene and camera. Everything visual hangs off these three objects.
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: quality.antialias,
    powerPreference: 'high-performance',
  });
  // Capped pixel ratio keeps integrated graphics (UHD 620) and phones comfortable.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatioStart));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03050a);
  scene.fog = new THREE.FogExp2(0x070b13, 0.016);

  // A very faint environment map gives glass, metal and wet ground something to reflect.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.1;
  pmrem.dispose();

  // 60 degrees vertical is roughly a 90 degree horizontal field of view on a 16:9 screen.
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.05,
    600
  );
  scene.add(camera); // camera must live in the scene so the flashlight attached to it works

  // Phones sometimes drop the graphics context (low memory, app switching). Tell the player.
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    const box = document.getElementById('error');
    if (box) {
      box.hidden = false;
      box.textContent = 'The graphics context was lost (the device ran out of graphics memory). Please reload the page.';
    }
  });

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  return { renderer, scene, camera };
}
