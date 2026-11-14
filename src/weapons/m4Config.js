// Everything that describes how YOUR uploaded model (M4Colt.glb) is placed in the game.
// Measurements were taken from the model itself:
//   - as modelled, the barrel points toward +X, up is +Y, the gun's right side faces +Z
//   - it is 4.96 model units long (a real M4 is about 0.84 m, hence scale 0.17)
// The game wants the barrel pointing forward (-Z), so the model is turned 90 degrees on a
// parent group. The original file is never edited.
export const M4 = {
  file: 'models/M4Colt.glb',      // optimised copy of the upload (textures resized 4K -> 1-2K)
  scale: 0.17,                    // model units -> metres
  yaw: Math.PI / 2,               // rotates barrel from +X to -Z
  muzzle: [2.4816, 1.326, 0],     // muzzle centre, in model units
  sight: [-0.7369, 1.733, 0],     // centre of the optic's rear lens, in model units
  reticle: 0.065,                 // how far in front of the rear lens the red dot floats (metres)
  hip: [0.19, -0.385, -0.55],     // where the weapon sits relative to the camera when not aiming
  hipYaw: 0.04,                   // slight turn toward the screen centre
  adsEyeRelief: 0.12,             // distance from the camera to the optic lens when aiming (metres; smaller = bigger view through the sight)
  magDrop: 1.1,                   // how far the magazine drops during a reload (model units)
  envIntensity: 0.6,              // how much the metal parts reflect the environment
  rack: { pos: [11.68, 1.13, -10], yaw: -Math.PI / 2 }, // the rifle hanging in the armory
};
