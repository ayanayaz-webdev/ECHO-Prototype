import * as THREE from 'three';

import { isTouch, debugFromUrl } from '../core/Device.js';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3();

// Everything drawn on top of the 3D view lives here (plain HTML elements).
// The HUD only displays things; the mission and gameplay code tell it what to show.
export class HUD {
  constructor(zones) {
    this.zones = zones;
    this.el = {};
    for (const id of [
      'zone', 'debug', 'overlay', 'start', 'objective-title', 'objective-desc', 'objective-loc', 'marker', 'marker-dist',
      'subtitle', 'subtitle-speaker', 'subtitle-text', 'prompt', 'progress', 'progress-label', 'progress-fill',
      'panel', 'panel-title', 'panel-lines', 'health', 'health-fill', 'ammo', 'ammo-name', 'ammo-count', 'credential',
      'center-msg', 'hitmarker', 'vignette', 'lockdown-tint', 'title-card', 'title-main', 'title-sub',
      'btn-use', 'notify', 'crosshair', 'death', 'retry', 'complete', 'complete-title', 'complete-mission', 'complete-items', 'complete-ending',
      'complete-teaser', 'replay',
    ]) this.el[id] = $(id);

    this.currentZone = '';
    this.zoneTimer = null;
    this.debugOn = false;
    this.frames = 0;
    this.fpsTimer = 0;
    this.fps = 0;
    this.started = false;

    this.subQueue = [];
    this.subT = 0;
    this.subActive = false;
    this.panelLines = [];
    this.panelT = 0;
    this.panelShown = 0;
    this.panelLife = 0;
    this.timers = []; // dt-based timers so everything pauses with the game
    this.damageT = 0;
    this.hitT = 0;
    this.msgT = 0;
    this.notifyT = 0;
    this.objective = null;
    this.lastAmmo = '';
    this.lastHealth = -1;
    this.touch = isTouch;
    if (this.touch) this.el.start.textContent = 'Tap to enter the facility';
    if (debugFromUrl) this.toggleDebug(); // add ?debug=1 to the address to see FPS on a phone
  }

  // ---------- overlay / pause ----------

  // suppressOverlay: the death or mission-complete screen is showing, so do not show "Paused".
  setLocked(locked, suppressOverlay = false) {
    this.el.overlay.classList.toggle('hidden', locked || suppressOverlay);
    if (locked) this.started = true;
    else if (this.started) this.el.start.textContent = this.touch ? 'Paused. Tap to resume' : 'Paused. Click to resume';
  }

  toggleDebug() {
    this.debugOn = !this.debugOn;
    this.el.debug.hidden = !this.debugOn;
  }

  // ---------- objective ----------

  setObjective(stage) {
    this.objective = stage;
    this.el['objective-title'].textContent = stage.title;
    this.el['objective-desc'].textContent = stage.desc;
    this.el['objective-loc'].textContent = stage.location ? 'Location: ' + stage.location : '';
  }

  // Diamond marker over the objective plus the distance to it.
  updateMarker(camera, player) {
    const t = this.objective && this.objective.target;
    const m = this.el.marker;
    if (!t) {
      m.style.display = 'none';
      return;
    }
    const dist = Math.hypot(t.x - player.position.x, t.z - player.position.z);
    _v.set(t.x, t.y, t.z).project(camera);
    if (_v.z > 1 || dist < 2.5) {
      m.style.display = 'none';
      return;
    }
    const x = (_v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-_v.y * 0.5 + 0.5) * window.innerHeight;
    m.style.display = 'block';
    m.style.left = Math.max(30, Math.min(window.innerWidth - 30, x)) + 'px';
    m.style.top = Math.max(30, Math.min(window.innerHeight - 60, y)) + 'px';
    this.el['marker-dist'].textContent = Math.round(dist) + ' m';
  }

  // ---------- dialogue ----------

  say(speaker, text, duration = 4, enemy = false) {
    this.subQueue.push({ speaker, text, duration: Math.max(duration, 1.5 + text.length * 0.045), enemy });
  }

  clearSubtitles() {
    this.subQueue = [];
    this.subActive = false;
    this.el.subtitle.classList.remove('show');
  }

  // Run a function after some seconds of gameplay (pauses with the game).
  later(seconds, fn) {
    this.timers.push({ t: seconds, fn });
  }

  // ---------- prompts ----------

  // Prompts that can be acted on start with "E" ("E — Recover Data", "Press E to collect weapon").
  // On a phone there is no E key: the wording drops the key and the USE button appears instead.
  showPrompt(text) {
    const p = this.el.prompt;
    const usable = !!text && /^(E — |Press E to )/.test(text);
    if (this.touch && text) {
      text = text.replace(/^E — /, '').replace(/^Press E to (.)/, (m, c) => c.toUpperCase());
    }
    if (this.touch) this.el['btn-use'].classList.toggle('show', usable);
    if (text) {
      if (p.textContent !== text) p.textContent = text;
      p.style.display = 'block';
    } else p.style.display = 'none';
  }

  setProgress(frac, label) {
    const pr = this.el.progress;
    if (frac === null || frac === undefined) {
      pr.style.display = 'none';
      return;
    }
    pr.style.display = 'block';
    this.el['progress-label'].textContent = label || '';
    this.el['progress-fill'].style.width = Math.round(frac * 100) + '%';
  }

  // Terminal-style panel; lines appear one by one.
  showPanel(title, lines) {
    this.el['panel-title'].textContent = title;
    this.el['panel-lines'].innerHTML = '';
    this.panelLines = lines;
    this.panelShown = 0;
    this.panelT = 0;
    this.panelLife = lines.length * 0.5 + 7;
    this.el.panel.style.display = 'block';
  }

  closePanel() {
    this.panelLife = 0;
    this.el.panel.style.display = 'none';
  }

  centerMessage(text, seconds = 3) {
    this.el['center-msg'].textContent = text;
    this.el['center-msg'].classList.add('show');
    this.msgT = seconds;
  }

  // Small pickup message above the ammo counter.
  notify(text, seconds = 3) {
    this.el.notify.textContent = text;
    this.el.notify.classList.add('show');
    this.notifyT = seconds;
  }

  // The hip crosshair fades out while aiming through the optic.
  setAds(on) {
    if (on !== this.adsOn) {
      this.adsOn = on;
      this.el.crosshair.classList.toggle('ads', on);
    }
  }

  showTitle(title, sub, seconds = 4) {
    this.el['title-main'].textContent = title;
    this.el['title-sub'].textContent = sub || '';
    this.el['title-card'].classList.add('show');
    this.later(seconds, () => this.el['title-card'].classList.remove('show'));
  }

  // ---------- status ----------

  setHealth(h, max) {
    const v = Math.round(h);
    if (v === this.lastHealth) return;
    this.lastHealth = v;
    this.el['health-fill'].style.width = Math.max(0, (h / max) * 100) + '%';
    this.el.health.classList.toggle('low', h / max < 0.3);
  }

  setWeapon(weapon) {
    const a = this.el.ammo;
    if (!weapon) {
      a.style.display = 'none';
      return;
    }
    const txt = weapon.def.name + '|' + weapon.mag + '|' + weapon.reserve + '|' + weapon.state;
    const tag = weapon.state === 'reloading' ? ' · reloading' : weapon.mag === 0 && weapon.reserve === 0 ? ' · no ammo' : '';
    if (txt === this.lastAmmo) return;
    this.lastAmmo = txt;
    a.style.display = 'flex';
    this.el['ammo-name'].textContent = weapon.def.name + tag;
    this.el['ammo-count'].textContent = weapon.mag + ' / ' + weapon.reserve;
    a.classList.toggle('reloading', weapon.state === 'reloading');
  }

  setCredential(on) {
    this.el.credential.style.display = on ? 'block' : 'none';
  }

  flashDamage() {
    this.el.vignette.style.opacity = '1';
    this.damageT = 0.35;
  }

  hitMarker(killed) {
    const h = this.el.hitmarker;
    h.classList.add('show');
    h.classList.toggle('kill', !!killed);
    this.hitT = 0.12;
  }

  setLockdown(on) {
    this.el['lockdown-tint'].classList.toggle('on', on);
  }

  // ---------- end screens ----------

  showDeath(onRetry) {
    this.el.death.classList.remove('hidden');
    this.el.retry.onclick = onRetry;
  }

  hideDeath() {
    this.el.death.classList.add('hidden');
  }

  // data = { mission, items:[..], ending:[{text, delay}], teaser }
  showComplete(data) {
    this.el['complete-mission'].textContent = data.mission;
    this.el['complete-items'].innerHTML = 'Recovered data:<br>' + data.items.map((i) => '- ' + i).join('<br>');
    this.el['complete-ending'].textContent = '';
    this.el['complete-teaser'].textContent = 'Next mission: ' + data.teaser;
    this.el['complete-teaser'].classList.remove('show');
    this.el.replay.hidden = true;
    this.el.replay.onclick = () => location.reload();
    this.el.complete.classList.remove('hidden');
    let t = 1.5;
    data.ending.forEach((line) => {
      this.later(t, () => (this.el['complete-ending'].textContent = line.text));
      t += line.hold;
    });
    this.later(t, () => this.el['complete-teaser'].classList.add('show'));
    this.later(t + 1.5, () => (this.el.replay.hidden = false));
  }

  // ---------- per-frame ----------

  // Gameplay-time updates (dialogue, panels, timers). Paused when the game is paused.
  tick(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) {
        this.timers.splice(i, 1);
        tm.fn();
      }
    }

    // Subtitles play one after another.
    if (this.subActive) {
      this.subT -= dt;
      if (this.subT <= 0) {
        this.subActive = false;
        this.el.subtitle.classList.remove('show');
        this.subGap = 0.3;
      }
    } else if (this.subQueue.length) {
      this.subGap = (this.subGap || 0) - dt;
      if (this.subGap <= 0) {
        const s = this.subQueue.shift();
        this.el['subtitle-speaker'].textContent = s.speaker;
        this.el['subtitle-text'].textContent = s.text;
        this.el.subtitle.classList.toggle('enemy', s.enemy);
        this.el.subtitle.classList.add('show');
        this.subT = s.duration;
        this.subActive = true;
      }
    }

    if (this.panelLife > 0) {
      this.panelLife -= dt;
      this.panelT += dt;
      while (this.panelShown < this.panelLines.length && this.panelT > this.panelShown * 0.5) {
        const d = document.createElement('div');
        d.textContent = this.panelLines[this.panelShown++];
        this.el['panel-lines'].appendChild(d);
      }
      if (this.panelLife <= 0) this.el.panel.style.display = 'none';
    }

    if (this.msgT > 0 && (this.msgT -= dt) <= 0) this.el['center-msg'].classList.remove('show');
    if (this.notifyT > 0 && (this.notifyT -= dt) <= 0) this.el.notify.classList.remove('show');
    if (this.damageT > 0 && (this.damageT -= dt) <= 0) this.el.vignette.style.opacity = '0';
    if (this.hitT > 0 && (this.hitT -= dt) <= 0) this.el.hitmarker.classList.remove('show');
  }

  // Always runs (even when paused): location label and FPS readout.
  update(dt, player, renderer, exposure, level) {
    const name = level.zoneAt(player.position.x, player.position.z);
    if (name && name !== this.currentZone) {
      this.currentZone = name;
      this.el.zone.textContent = name;
      this.el.zone.classList.add('show');
      clearTimeout(this.zoneTimer);
      this.zoneTimer = setTimeout(() => this.el.zone.classList.remove('show'), 3000);
    }

    this.frames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.frames / this.fpsTimer);
      this.frames = 0;
      this.fpsTimer = 0;
      if (this.debugOn) {
        const p = player.position;
        const info = renderer.info;
        this.el.debug.textContent =
          `${this.fps} fps\n` +
          `x ${p.x.toFixed(1)}  z ${p.z.toFixed(1)}\n` +
          `draw calls ${info.render.calls}\n` +
          `triangles ${info.render.triangles}\n` +
          `exposure ${exposure.toFixed(1)}`;
      }
    }
  }
}
