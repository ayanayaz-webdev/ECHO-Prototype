// Anything the player can press E on. Only the closest valid item in front of the player
// is ever reported, so the HUD shows one prompt at a time.
//
// item = { pos:{x,z}, radius, prompt: string | () => string, enabled: () => boolean,
//          onInteract(), holdTime (seconds, 0 = instant), progressLabel, info (prompt only, no action) }
export class Interaction {
  constructor() {
    this.items = [];
    this.active = null;
    this.hold = null;
  }

  add(item) {
    const it = { radius: 2.2, enabled: () => true, holdTime: 0, info: false, facing: 0.3, ...item };
    this.items.push(it);
    return it;
  }

  cancelHold() {
    this.hold = null;
  }

  update(dt, player, input) {
    const px = player.position.x;
    const pz = player.position.z;
    const fwd = player.forwardXZ();

    // An interaction already in progress keeps running while the player stays close.
    if (this.hold) {
      const h = this.hold;
      const d = Math.hypot(h.item.pos.x - px, h.item.pos.z - pz);
      if (d > h.item.radius * 1.5 || !h.item.enabled()) {
        this.hold = null;
      } else {
        h.t += dt;
        if (h.t >= h.item.holdTime) {
          this.hold = null;
          h.item.onInteract();
          return { prompt: null, progress: null, label: null };
        }
        return { prompt: null, progress: h.t / h.item.holdTime, label: h.item.progressLabel || '' };
      }
    }

    let best = null;
    let bestD = Infinity;
    for (const it of this.items) {
      if (!it.enabled()) continue;
      const dx = it.pos.x - px;
      const dz = it.pos.z - pz;
      const d = Math.hypot(dx, dz);
      if (d > it.radius) continue;
      if (d > 0.7 && (dx * fwd.x + dz * fwd.z) / d < it.facing) continue; // must roughly face it
      if (d < bestD) {
        best = it;
        bestD = d;
      }
    }
    this.active = best;

    if (best && !best.info && input.wasPressed('KeyE')) {
      if (best.holdTime > 0) {
        this.hold = { item: best, t: 0 };
        if (best.onStart) best.onStart();
      }
      else best.onInteract();
    }

    const prompt = best ? (typeof best.prompt === 'function' ? best.prompt() : best.prompt) : null;
    return { prompt, progress: null, label: null };
  }
}
