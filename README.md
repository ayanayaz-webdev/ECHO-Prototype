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

Weapon model
  public/models/M4Colt.glb is an optimised copy of the uploaded M4Colt.glb (geometry, UVs and
  materials unchanged, embedded 4K textures resized to 1-2K: 127 MB -> 3.5 MB).
  src/weapons/m4Config.js holds every number that places the model in the game (scale, rotation,
  hip position, ADS eye relief, muzzle and sight anchors).

Mobile (phones and tablets, landscape)
  Touch controls appear automatically on touch devices (src/core/Device.js decides).
  Left thumb walks, right thumb looks, Fire (hold), Aim (tap), Reload, Use (appears only next to
  something usable), Light, and II to pause. The game pauses when you switch apps.
  Phones start at a lower resolution with no anti-aliasing and 4 real-time lights, and the
  resolution adapts to hold the frame rate.
  Test on a desktop by adding ?touch=1 to the address. Add ?debug=1 to see FPS on screen.
  Phone on the same Wi-Fi: run "npm run dev", then open the "Network" address Vite prints.
