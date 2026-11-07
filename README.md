# ECHO - Mission 1: The Arrival

    npm install
    npm run dev

Click the screen to capture the mouse.

W A S D move | Mouse look | Left mouse fire | Right mouse aim | R reload | E interact
F flashlight | Esc pause | F3 debug info | [ and ] exposure | B brightness test

Project layout (src/):
  core/       Game loop, Gameplay wiring, Input, Renderer, Events
  missions/   MissionManager (objective engine) and Mission1 (the script)
  systems/    Interaction (E prompts), Doors, Ballistics (bullet maths)
  weapons/    Weapon (ammo state), WeaponSystem, WeaponView (first-person model), RifleModel
  enemies/    Enemy (AI), EnemyManager, EnemyModel, Nav (waypoint graph)
  effects/    Hologram, Tracers
  audio/      AudioEngine (procedural sound, no files)
  world/      Level, Props, Lighting, Materials, Skyline, Collision
  player/     Player (movement, health, recoil, flashlight)
  ui/         HUD
