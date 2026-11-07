import * as THREE from 'three';
import { resolveCircle } from '../world/Collision.js';

const WALK_SPEED = 3.2;                 // metres per second
const RADIUS = 0.35;                    // body width used for collision
const EYE_HEIGHT = 1.7;                 // metres above the floor
const MOUSE_SENS = 0.0022;              // radians per mouse pixel
const MAX_PITCH = THREE.MathUtils.degToRad(85);
const BASE_FOV = 60;
const ADS_FOV = 46;
const REGEN_DELAY = 5;                  // seconds without damage before health returns
const REGEN_RATE = 10;                  // health per second

export class Player {
  constructor(camera, input, colliders, events) {
    this.camera = camera;
    this.input = input;
    this.colliders = colliders;
    this.events = events;

    this.position = new THREE.Vector3(); // position of the player's feet
    this.yaw = 0;
    this.pitch = 0;
    this.bobTime = 0;
    this.bobBlend = 0;
    this.eyeY = EYE_HEIGHT;
    this.moving = false;
    this.stepDist = 0;

    this.maxHealth = 100;
    this.health = 100;
    this.alive = true;
    this.sinceHit = 99;

    this.recoilDebt = 0;
    this.firing = false;
    this.ads = false;

    camera.rotation.order = 'YXZ'; // turn left/right first, then look up/down

    // Flashlight: a spotlight parented to the camera so it follows where we look.
    this.flashlightOn = true;
    this.flashlightIntensity = 70;
    this.flashlight = new THREE.SpotLight(
      0xdfe9ff,
      this.flashlightIntensity,
      30,
      THREE.MathUtils.degToRad(28),
      0.7,
      1.5
    );
    this.flashlight.position.set(0.12, -0.12, 0);
    this.flashlight.target.position.set(0, 0, -5);
    camera.add(this.flashlight);
    camera.add(this.flashlight.target);
  }

  setSpawn(x, z, yaw = 0) {
    this.position.set(x, 0, z);
    this.yaw = yaw;
    this.pitch = 0;
    this.recoilDebt = 0;
    this.applyCamera(0);
  }

  // Used after dying: back to a checkpoint with full health.
  respawn(x, z, yaw) {
    this.health = this.maxHealth;
    this.alive = true;
    this.sinceHit = 99;
    this.setSpawn(x, z, yaw);
  }

  forwardXZ() {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  setAds(on) {
    this.ads = on;
  }

  addRecoil(pitch, yaw) {
    this.pitch = Math.min(MAX_PITCH, this.pitch + pitch);
    this.yaw += yaw;
    this.recoilDebt += pitch;
    this.firing = true;
  }

  damage(amount, fromX, fromZ) {
    if (!this.alive) return;
    this.health = Math.max(0, this.health - amount);
    this.sinceHit = 0;
    if (this.events) this.events.emit('player:damaged', { amount, fromX, fromZ });
    if (this.health <= 0) {
      this.alive = false;
      if (this.events) this.events.emit('player:died', {});
    }
  }

  toggleFlashlight() {
    this.flashlightOn = !this.flashlightOn;
    // Intensity is changed instead of hiding the light, so the renderer never recompiles shaders.
    this.flashlight.intensity = this.flashlightOn ? this.flashlightIntensity : 0;
  }

  update(dt) {
    const input = this.input;

    // Mouse look (slower while aiming down sights)
    const sens = MOUSE_SENS * (this.ads ? 0.65 : 1);
    this.yaw -= input.mouseDX * sens;
    this.pitch -= input.mouseDY * sens;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));

    // The camera settles back down after a burst of fire.
    if (!this.firing && this.recoilDebt > 0) {
      const r = this.recoilDebt * Math.min(1, dt * 5);
      this.pitch -= r;
      this.recoilDebt -= r;
    }
    this.firing = false;

    // Health slowly returns when nobody has hurt you for a while.
    this.sinceHit += dt;
    if (this.alive && this.sinceHit > REGEN_DELAY && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + REGEN_RATE * dt);
    }

    // Keyboard movement
    const forward = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
    const strafe = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
    let moving = false;

    if (forward !== 0 || strafe !== 0) {
      const len = Math.hypot(forward, strafe); // keeps diagonal speed equal to straight speed
      const f = forward / len;
      const s = strafe / len;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      const speed = WALK_SPEED * (this.ads ? 0.6 : 1);

      this.position.x += (-sin * f + cos * s) * speed * dt;
      this.position.z += (-cos * f - sin * s) * speed * dt;
      resolveCircle(this.position, RADIUS, this.colliders);
      moving = true;

      this.stepDist += speed * dt;
      if (this.stepDist > 1.7) {
        this.stepDist = 0;
        if (this.events) this.events.emit('player:step', {});
      }
    }
    this.moving = moving;

    // Field of view narrows while aiming
    const targetFov = this.ads ? ADS_FOV : BASE_FOV;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 12);
      this.camera.updateProjectionMatrix();
    }

    this.applyCamera(dt, moving);
  }

  applyCamera(dt, moving = false) {
    // Subtle walking bob. It fades in and out so stopping never feels abrupt.
    this.bobBlend += ((moving ? 1 : 0) - this.bobBlend) * Math.min(1, dt * 8);
    if (moving) this.bobTime += dt * WALK_SPEED * 1.9;
    const bobY = Math.sin(this.bobTime * 2) * 0.018 * this.bobBlend;
    const bobX = Math.cos(this.bobTime) * 0.012 * this.bobBlend;

    const cam = this.camera;
    cam.position.set(this.position.x, EYE_HEIGHT + bobY, this.position.z);
    cam.rotation.set(this.pitch, this.yaw, 0);
    cam.translateX(bobX);
  }
}
