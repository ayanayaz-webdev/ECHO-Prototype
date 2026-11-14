// How much a touch drag turns the camera compared with the same mouse movement.
const TOUCH_LOOK = 2.2;

// Collects keyboard, mouse and touch input so the rest of the game can simply ask questions
// like input.getMove() or input.wasPressed('KeyF'). Touch controls feed the same values
// (see ui/TouchControls.js), so the game code does not care which device is used.
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
    this.touch = false;          // true on phones and tablets
    this.move = { x: 0, y: 0 };  // on-screen joystick: x = right, y = down, each -1..1

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

  enableTouch() {
    this.touch = true;
  }

  // Desktop: captures the mouse. Touch: there is no mouse to capture, so this just starts play.
  requestLock() {
    if (this.touch) this._setActive(true);
    else this.dom.requestPointerLock();
  }

  releaseLock() {
    if (this.touch) this._setActive(false);
    else if (document.exitPointerLock) document.exitPointerLock();
  }

  _setActive(on) {
    if (on === this.locked) return;
    this.locked = on;
    this.keys.clear();
    this.buttons.clear();
    this.move.x = 0;
    this.move.y = 0;
    this.mouseDX = 0;
    this.mouseDY = 0;
    if (this.onLockChange) this.onLockChange(on);
  }

  // Touch look: a finger drag counts like mouse movement.
  addLook(dx, dy) {
    if (!this.locked) return;
    this.mouseDX += dx * TOUCH_LOOK;
    this.mouseDY += dy * TOUCH_LOOK;
  }

  // Touch buttons act like a key press.
  press(code) {
    if (this.locked) this.pressed.add(code);
  }

  // Walking direction from WASD and/or the on-screen joystick: { forward, strafe }, each -1..1.
  getMove() {
    const f = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0) - this.move.y;
    const s = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) + this.move.x;
    return { forward: Math.max(-1, Math.min(1, f)), strafe: Math.max(-1, Math.min(1, s)) };
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
