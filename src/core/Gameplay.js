import { Tracers } from '../effects/Tracers.js';
import { Hologram } from '../effects/Hologram.js';
import { Nav } from '../enemies/Nav.js';
import { EnemyManager } from '../enemies/EnemyManager.js';
import { WeaponSystem } from '../weapons/WeaponSystem.js';
import { DoorManager } from '../systems/Doors.js';
import { Interaction } from '../systems/Interaction.js';
import { createMission1 } from '../missions/Mission1.js';

// Creates the gameplay systems (weapons, enemies, doors, interaction, mission) and updates
// them each frame. Game.js only has to create this once and call update().
export class Gameplay {
  constructor({ scene, camera, level, player, input, hud, audio, lights, events }) {
    Object.assign(this, { camera, level, player, input, hud, audio, events });
    this.state = 'menu'; // 'menu' | 'playing' | 'dead' | 'complete'

    this.tracers = new Tracers(scene, level.unitBox);
    this.nav = new Nav(level.colliders);
    this.enemies = new EnemyManager({ scene, level, player, audio, events, tracers: this.tracers, nav: this.nav });
    this.weapons = new WeaponSystem({ camera, player, input, events, audio, enemies: this.enemies, level, tracers: this.tracers });
    this.doors = new DoorManager(level, audio);
    this.interaction = new Interaction();
    this.hologram = new Hologram({ scene, unitBox: level.unitBox, level, audio });

    this.mission = createMission1({
      events, hud, audio, level, player, weapons: this.weapons, enemies: this.enemies, lights,
      doors: this.doors, interaction: this.interaction, hologram: this.hologram,
      onComplete: () => this._onComplete(),
    });

    events.on('objective:changed', ({ stage }) => hud.setObjective(stage));
    events.on('objective:completed', () => audio.beep(900));
    events.on('player:damaged', () => {
      hud.flashDamage();
      audio.hurt();
    });
    events.on('player:hitmarker', ({ killed }) => hud.hitMarker(killed));
    events.on('player:step', () => audio.step());
    events.on('player:died', () => this._onDeath());
  }

  // Called the first time the player clicks into the game.
  begin() {
    if (this.state !== 'menu') return;
    this.state = 'playing';
    this.mission.begin();
  }

  _onDeath() {
    this.state = 'dead';
    this.weapons.view.root.visible = false;
    if (document.exitPointerLock) document.exitPointerLock();
    this.hud.showDeath(() => this.retry());
  }

  retry() {
    this.hud.hideDeath();
    this.mission.retry();
    if (this.weapons.weapon) this.weapons.view.root.visible = true;
    this.state = 'playing';
    this.input.requestLock();
  }

  _onComplete() {
    this.state = 'complete';
    if (document.exitPointerLock) document.exitPointerLock();
  }

  update(dt, active) {
    const hud = this.hud;
    if (this.state === 'complete') {
      hud.tick(dt); // keeps the ending sequence running
      return;
    }
    if (this.state !== 'playing' || !active) return;

    const { player, input } = this;
    player.update(dt);
    this.weapons.update(dt);
    this.enemies.update(dt);

    const actors = [{ x: player.position.x, z: player.position.z }];
    for (const e of this.enemies.list) if (e.alive) actors.push({ x: e.x, z: e.z });
    this.doors.update(dt, actors);

    const ui = this.interaction.update(dt, player, input);
    hud.showPrompt(ui.prompt);
    hud.setProgress(ui.progress, ui.label);

    this.mission.update(dt);
    this.tracers.update(dt);
    this.hologram.update(dt, player.position);

    hud.tick(dt);
    hud.setHealth(player.health, player.maxHealth);
    hud.setWeapon(this.weapons.weapon);
    if (this.camera.projectionMatrix) hud.updateMarker(this.camera, player);
    this.audio.setListener(player.position, player.yaw, player.pitch);
  }
}
