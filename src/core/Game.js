import * as THREE from 'three';
import { createRenderer } from './Renderer.js';
import { Input } from './Input.js';
import { Events } from './Events.js';
import { isTouch, quality } from './Device.js';
import { AdaptiveResolution } from './AdaptiveResolution.js';
import { TouchControls } from '../ui/TouchControls.js';
import { Gameplay } from './Gameplay.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { createMaterials } from '../world/Materials.js';
import { Level } from '../world/Level.js';
import { buildSkyline } from '../world/Skyline.js';
import { createAmbient, LightManager, LIGHT_SOURCES } from '../world/Lighting.js';
import { Player } from '../player/Player.js';
import { HUD } from '../ui/HUD.js';

// The Game class creates the big systems once and runs the frame loop.
// Mission and combat logic live in Gameplay.js and missions/Mission1.js.
export class Game {
  constructor() {
    const canvas = document.getElementById('game');
    const { renderer, scene, camera } = createRenderer(canvas);
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    this.events = new Events();
    this.audio = new AudioEngine();
    this.input = new Input(canvas);
    const mats = createMaterials(Math.min(quality.anisotropy, renderer.capabilities.getMaxAnisotropy()));

    buildSkyline(scene);
    this.ambient = createAmbient(scene);
    this.level = new Level(scene, mats);
    this.lights = new LightManager(scene, LIGHT_SOURCES, quality.lightPool);

    this.player = new Player(camera, this.input, this.level.colliders, this.events);
    this.player.setSpawn(0, 36, 0); // outside the facility, looking at the entrance
    this.lights.snap(this.player.position);

    this.hud = new HUD(this.level.zones);
    this.gameplay = new Gameplay({
      scene, camera, level: this.level, player: this.player, input: this.input,
      hud: this.hud, audio: this.audio, lights: this.lights, events: this.events,
    });

    this.clock = new THREE.Clock();
    this.time = 0;
    this.brightTest = false;

    // Touch devices: show the on-screen controls and keep the resolution adaptive.
    this.touchUI = null;
    this.adaptive = null;
    if (isTouch) {
      document.body.classList.add('touch');
      this.input.enableTouch();
      this.touchUI = new TouchControls(this.input);
      if (quality.adaptive) {
        this.adaptive = new AdaptiveResolution(renderer, {
          start: quality.pixelRatioStart, min: quality.pixelRatioMin, max: quality.pixelRatioMax,
        });
      }
      // Stop the browser from zooming or scrolling the page while playing.
      for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault());
    }

    // Pause automatically when the page is hidden (switching apps, locking the phone).
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.gameplay.state === 'playing') this.input.releaseLock();
    });

    this.input.onLockChange = (locked) => {
      const s = this.gameplay.state;
      this.hud.setLocked(locked, s === 'dead' || s === 'complete');
      if (locked) this.gameplay.begin();
    };
    document.getElementById('overlay').addEventListener('click', () => {
      this.audio.init(); // browsers only allow sound after a click or tap
      if (isTouch) this.goFullscreen();
      this.input.requestLock();
    });
  }

  // Phones: hide the browser bars and lock to landscape where the browser allows it.
  async goFullscreen() {
    try {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) await req.call(el, { navigationUI: 'hide' });
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
    } catch (e) {
      // Not supported (for example iPhone Safari). The game still works.
    }
  }

  start() {
    this.renderer.setAnimationLoop(() => this.frame());
  }

  frame() {
    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05); // cap so a lag spike cannot teleport the player
    if (this.adaptive && this.input.locked) this.adaptive.update(rawDt);
    if (this.touchUI) this.touchUI.sync();
    this.time += dt;
    const input = this.input;

    if (input.locked) this.handleDebugKeys();
    this.gameplay.update(dt, input.locked);

    this.level.update(dt, this.time);
    this.lights.update(dt, this.time, this.player.position);
    this.hud.update(dt, this.player, this.renderer, this.renderer.toneMappingExposure, this.level);

    this.renderer.render(this.scene, this.camera);
    input.endFrame();
  }

  // Keys that help you tune the look of the game while we build it.
  handleDebugKeys() {
    const input = this.input;
    if (input.wasPressed('KeyF')) this.player.toggleFlashlight();
    if (input.wasPressed('F3')) this.hud.toggleDebug();

    if (input.wasPressed('BracketRight')) {
      this.renderer.toneMappingExposure = Math.min(2.5, this.renderer.toneMappingExposure + 0.1);
    }
    if (input.wasPressed('BracketLeft')) {
      this.renderer.toneMappingExposure = Math.max(0.3, this.renderer.toneMappingExposure - 0.1);
    }
    if (input.wasPressed('KeyB')) {
      this.brightTest = !this.brightTest;
      this.ambient.intensity = this.brightTest ? 2.0 : 0.28;
    }
  }
}
