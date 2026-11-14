// On-screen controls for phones and tablets. They do nothing except feed the Input object,
// so the rest of the game works exactly as it does with keyboard and mouse.
//
//   left side  : drag anywhere to walk (floating joystick)
//   right side : drag anywhere to look around
//   buttons    : FIRE (hold), AIM (toggle), RELOAD, USE (only shown next to something usable),
//                flashlight, pause
const JOY_RADIUS = 56;   // how far the thumb moves the stick, in pixels
const JOY_DEAD = 0.15;   // ignore tiny movements

export class TouchControls {
  constructor(input, doc = document) {
    this.input = input;
    const $ = (id) => doc.getElementById(id);
    this.el = {
      root: $('touch'),
      joyZone: $('joy-zone'), joyBase: $('joy-base'), joyKnob: $('joy-knob'),
      lookZone: $('look-zone'),
      fire: $('btn-fire'), ads: $('btn-ads'), reload: $('btn-reload'),
      use: $('btn-use'), flash: $('btn-flash'), pause: $('btn-pause'),
    };
    this.joy = { id: null, ox: 0, oy: 0 };
    this.look = { id: null, x: 0, y: 0 };
    this.adsOn = false;
    this._bindJoystick();
    this._bindLook();
    this._bindButtons();
  }

  _bindJoystick() {
    const { joyZone: zone, joyBase: base, joyKnob: knob } = this.el;
    const input = this.input;

    zone.addEventListener('pointerdown', (e) => {
      if (this.joy.id !== null || !input.locked) return;
      e.preventDefault();
      this.joy.id = e.pointerId;
      this.joy.ox = e.clientX;
      this.joy.oy = e.clientY;
      if (zone.setPointerCapture) zone.setPointerCapture(e.pointerId);
      base.style.left = e.clientX + 'px';
      base.style.top = e.clientY + 'px';
      knob.style.transform = 'translate(0px, 0px)';
      base.classList.add('on');
    });

    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joy.id) return;
      let dx = e.clientX - this.joy.ox;
      let dy = e.clientY - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > JOY_RADIUS) {
        dx *= JOY_RADIUS / d;
        dy *= JOY_RADIUS / d;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      let mx = dx / JOY_RADIUS;
      let my = dy / JOY_RADIUS;
      const mag = Math.hypot(mx, my);
      if (mag < JOY_DEAD) {
        mx = 0;
        my = 0;
      } else {
        const k = (mag - JOY_DEAD) / (1 - JOY_DEAD) / mag; // smooth start after the dead zone
        mx *= k;
        my *= k;
      }
      input.move.x = mx;
      input.move.y = my;
    });

    const end = (e) => {
      if (e.pointerId !== this.joy.id) return;
      this.joy.id = null;
      input.move.x = 0;
      input.move.y = 0;
      base.classList.remove('on');
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  _bindLook() {
    const zone = this.el.lookZone;
    const input = this.input;

    zone.addEventListener('pointerdown', (e) => {
      if (this.look.id !== null || !input.locked) return;
      e.preventDefault();
      this.look.id = e.pointerId;
      this.look.x = e.clientX;
      this.look.y = e.clientY;
      if (zone.setPointerCapture) zone.setPointerCapture(e.pointerId);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.look.id) return;
      input.addLook(e.clientX - this.look.x, e.clientY - this.look.y);
      this.look.x = e.clientX;
      this.look.y = e.clientY;
    });
    const end = (e) => {
      if (e.pointerId === this.look.id) this.look.id = null;
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  _bindButtons() {
    const input = this.input;
    const bind = (el, down, up) => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
        el.classList.add('down');
        down();
      });
      const end = () => {
        el.classList.remove('down');
        if (up) up();
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    };

    // Fire is "held" like the left mouse button.
    bind(this.el.fire, () => input.locked && input.buttons.add(0), () => input.buttons.delete(0));
    // Aim toggles, which is easier than holding it with a thumb that is also looking around.
    bind(this.el.ads, () => {
      if (!input.locked) return;
      if (input.buttons.has(2)) input.buttons.delete(2);
      else input.buttons.add(2);
    });
    bind(this.el.reload, () => input.press('KeyR'));
    bind(this.el.use, () => input.press('KeyE'));
    bind(this.el.flash, () => input.press('KeyF'));
    bind(this.el.pause, () => input.releaseLock());
  }

  // Called every frame: shows the controls only while playing and keeps the AIM button in step.
  sync() {
    const on = this.input.locked;
    if (on !== this.shown) {
      this.shown = on;
      this.el.root.classList.toggle('active', on);
      if (!on) {
        this.joy.id = null;
        this.look.id = null;
        this.el.joyBase.classList.remove('on');
      }
    }
    const ads = this.input.buttons.has(2);
    if (ads !== this.adsOn) {
      this.adsOn = ads;
      this.el.ads.classList.toggle('on', ads);
    }
  }
}
