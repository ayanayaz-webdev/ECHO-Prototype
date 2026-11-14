// Keeps the frame rate steady on phones: if the game runs slowly it renders fewer pixels
// (the picture gets slightly softer); if it has spare time it slowly sharpens again.
export class AdaptiveResolution {
  constructor(renderer, { start, min, max }) {
    this.renderer = renderer;
    this.ratio = Math.min(start, window.devicePixelRatio || 1);
    this.min = min;
    this.max = Math.min(max, window.devicePixelRatio || 1);
    this.acc = 0;
    this.frames = 0;
    this.cool = 3;
    this.apply();
  }

  apply() {
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  update(dt) {
    if (dt > 0.25) return; // ignore pauses (tab switches, menus)
    this.acc += dt;
    this.frames++;
    this.cool -= dt;
    if (this.acc < 1) return;
    const fps = this.frames / this.acc;
    this.acc = 0;
    this.frames = 0;
    if (fps < 40 && this.ratio > this.min) {
      this.ratio = Math.max(this.min, this.ratio - 0.15);
      this.cool = 3;
      this.apply();
    } else if (fps > 57 && this.cool <= 0 && this.ratio < this.max) {
      this.ratio = Math.min(this.max, this.ratio + 0.1);
      this.cool = 4;
      this.apply();
    }
  }
}
