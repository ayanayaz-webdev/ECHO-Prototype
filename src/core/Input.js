// Collects keyboard and mouse input so the rest of the game can simply ask questions
// like input.isDown('KeyW') or input.wasPressed('KeyF').
export class Input {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();      // keys currently held
    this.pressed = new Set();   // keys pressed during this frame only
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;        // true while the mouse is captured by the game
    this.buttons = new Set();   // mouse buttons currently held (0 = left, 2 = right)
    this.onLockChange = null;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'F3') e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // Some browsers send one huge value when the pointer lock starts; ignore it.
      if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    document.addEventListener('mousedown', (e) => {
      if (this.locked) this.buttons.add(e.button);
    });
    document.addEventListener('mouseup', (e) => this.buttons.delete(e.button));
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      this.keys.clear();
      this.buttons.clear();
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  requestLock() {
    this.dom.requestPointerLock();
  }

  isDown(code) {
    return this.keys.has(code);
  }

  mouseDown(button) {
    return this.buttons.has(button);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Call once at the end of every frame.
  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
