import * as THREE from 'three';

// All textures are drawn with code for now, so the project needs no image files.
// Later milestones can swap these for real compressed textures without changing the level code.

export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(42);

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, aniso = 4) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function fillNoise(ctx, size, [r, g, b], variance) {
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < size * size; i++) {
    const n = (rng() - 0.5) * variance;
    d[i * 4] = r + n;
    d[i * 4 + 1] = g + n;
    d[i * 4 + 2] = b + n * 1.05;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function concreteCanvas(base) {
  const S = 256;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  fillNoise(g, S, base, 34);
  for (let i = 0; i < 30; i++) {
    g.fillStyle = `rgba(0,0,0,${0.02 + rng() * 0.04})`;
    g.beginPath();
    g.arc(rng() * S, rng() * S, 15 + rng() * 60, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(0,0,0,0.35)'; // panel seams
  g.fillRect(0, 0, S, 2);
  g.fillRect(0, 0, 2, S);
  return c;
}

function tileCanvas(base, grout, variance, tiles = 2) {
  const S = 256;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  fillNoise(g, S, base, variance);
  const step = S / tiles;
  for (let x = 0; x < tiles; x++) {
    for (let y = 0; y < tiles; y++) {
      g.fillStyle = `rgba(0,0,0,${rng() * 0.08})`;
      g.fillRect(x * step + 2, y * step + 2, step - 2, step - 2);
    }
  }
  g.fillStyle = grout;
  for (let i = 0; i < tiles; i++) {
    g.fillRect(i * step, 0, 2, S);
    g.fillRect(0, i * step, S, 2);
  }
  return c;
}

function asphaltCanvas() {
  const S = 256;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  fillNoise(g, S, [52, 54, 58], 46);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(255,255,255,${0.03 + rng() * 0.06})`;
    g.fillRect(rng() * S, rng() * S, 1 + rng() * 2, 1 + rng() * 2);
  }
  return c;
}

function hazardCanvas() {
  const S = 128;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  g.fillStyle = '#d9a600';
  g.fillRect(0, 0, S, S);
  g.strokeStyle = '#0b0b0b';
  g.lineWidth = 22;
  for (let i = -S; i < S * 2; i += 44) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + S, S);
    g.stroke();
  }
  return c;
}

function bloodCanvas() {
  const S = 128;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    g.fillStyle = `rgba(${55 + rng() * 25},4,4,${0.3 + rng() * 0.4})`;
    g.beginPath();
    g.arc(30 + rng() * 70, 30 + rng() * 70, 6 + rng() * 20, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(50,3,3,0.5)';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(20, 100);
  g.quadraticCurveTo(60, 60, 110, 40);
  g.stroke();
  return c;
}

// ---- Signs and screens (cached, so each unique one is only drawn once) ----

const signCache = new Map();

export function signMaterial(text, opts = {}) {
  const { w = 512, h = 128, bg = '#0c1218', fg = '#d6e4ef', border = null, sub = null } = opts;
  const key = [text, w, h, bg, fg, border, sub].join('|');
  if (signCache.has(key)) return signCache.get(key);

  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (border) {
    g.strokeStyle = border;
    g.lineWidth = Math.max(3, h * 0.03);
    g.strokeRect(g.lineWidth, g.lineWidth, w - g.lineWidth * 2, h - g.lineWidth * 2);
  }

  const lines = text.split('\n');
  const subH = sub ? h * 0.22 : 0;
  const usable = h - subH;
  const longest = Math.max(...lines.map((l) => l.length));
  const size = Math.min((usable / lines.length) * 0.62, (w * 0.9) / (longest * 0.6));
  g.fillStyle = fg;
  g.font = `bold ${size}px Bahnschrift, "Segoe UI", Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, w / 2, (usable / lines.length) * (i + 0.5)));
  if (sub) {
    g.font = `${subH * 0.55}px Bahnschrift, "Segoe UI", Arial, sans-serif`;
    g.fillStyle = 'rgba(214,228,239,0.6)';
    g.fillText(sub, w / 2, h - subH / 2);
  }

  const mat = new THREE.MeshBasicMaterial({ map: toTexture(c), color: 0xcccccc });
  signCache.set(key, mat);
  return mat;
}

const screenCache = new Map();

function scanlines(g, w, h) {
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
}

export function screenMaterial(kind) {
  if (screenCache.has(kind)) return screenCache.get(kind);

  const W = 256;
  const H = 160;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#04080b';
  g.fillRect(0, 0, W, H);

  if (kind.startsWith('cctv')) {
    const n = Number(kind.slice(4));
    g.fillStyle = '#0c1a1a';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(120,200,190,0.35)';
    g.lineWidth = 2;
    if (n === 0) {
      // corridor perspective
      for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(W / 2 + (x ? 30 : -30), H / 2 + (y ? 20 : -20));
        g.stroke();
      }
      g.strokeRect(W / 2 - 30, H / 2 - 20, 60, 40);
    } else if (n === 1) {
      g.strokeRect(30, 40, 90, 70);
      g.strokeRect(140, 60, 80, 60);
    } else if (n === 2) {
      for (let i = 0; i < 2500; i++) {
        g.fillStyle = `rgba(200,230,225,${rng() * 0.5})`;
        g.fillRect(rng() * W, rng() * H, 2, 2);
      }
    } else {
      g.fillStyle = 'rgba(200,230,225,0.8)';
      g.font = 'bold 22px monospace';
      g.textAlign = 'center';
      g.fillText('NO SIGNAL', W / 2, H / 2);
    }
    g.textAlign = 'left';
    g.fillStyle = 'rgba(200,230,225,0.85)';
    g.font = '14px monospace';
    g.fillText(`CAM 0${n + 1}`, 10, 20);
    g.fillText(`03:1${n}:0${n + 4}`, 10, H - 10);
    g.fillStyle = '#ff3b30';
    g.beginPath();
    g.arc(W - 20, 18, 5, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'terminal') {
    g.fillStyle = '#071410';
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(90,255,160,0.7)';
    for (let i = 0; i < 11; i++) g.fillRect(12, 14 + i * 13, 40 + rng() * 170, 5);
  } else if (kind === 'error') {
    g.fillStyle = '#0b2a52';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#e8f0ff';
    g.font = 'bold 15px monospace';
    g.fillText('SYSTEM FAILURE', 14, 34);
    g.font = '11px monospace';
    g.fillText('0x000000ED  UNMOUNTABLE_VOLUME', 14, 56);
    g.fillText('Memory dump incomplete', 14, 72);
  } else if (kind === 'cracked') {
    g.fillStyle = '#050607';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(220,230,240,0.55)';
    g.lineWidth = 1.5;
    const cx = 60 + rng() * 140;
    const cy = 30 + rng() * 100;
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.moveTo(cx, cy);
      let x = cx;
      let y = cy;
      for (let k = 0; k < 4; k++) {
        x += Math.cos(i * 0.7 + rng()) * 40;
        y += Math.sin(i * 0.7 + rng()) * 30;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  } else if (kind === 'ecg') {
    g.fillStyle = '#020a06';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#37ff8a';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, H / 2);
    g.lineTo(60, H / 2);
    g.lineTo(68, H / 2 - 30);
    g.lineTo(78, H / 2 + 24);
    g.lineTo(86, H / 2);
    g.lineTo(W, H / 2); // the line goes flat
    g.stroke();
    g.fillStyle = '#37ff8a';
    g.font = '13px monospace';
    g.fillText('HR --   SpO2 --', 12, 22);
  } else if (kind === 'echo') {
    g.fillStyle = '#041117';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(120,220,255,0.18)';
    g.lineWidth = 1;
    for (let x = 0; x < W; x += 16) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    for (let y = 0; y < H; y += 16) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    g.fillStyle = '#9fe8ff';
    g.font = 'bold 22px monospace';
    g.textAlign = 'center';
    g.fillText('ECHO CORE', W / 2, H / 2 - 6);
    g.font = '14px monospace';
    g.fillText('STANDBY', W / 2, H / 2 + 18);
  }

  scanlines(g, W, H);
  const mat = new THREE.MeshBasicMaterial({ map: toTexture(c), color: 0xb0b0b0 });
  screenCache.set(kind, mat);
  return mat;
}

// ---- Material library used by the level ----

export function createMaterials(aniso = 4) {
  const std = (p) => new THREE.MeshStandardMaterial(p);
  const basic = (color) => new THREE.MeshBasicMaterial({ color });
  const M = {};

  M.wall = std({ map: toTexture(concreteCanvas([150, 152, 154]), aniso), roughness: 0.92 });
  M.facade = std({ map: toTexture(concreteCanvas([112, 118, 126]), aniso), roughness: 0.85 });
  M.barrier = std({ map: toTexture(concreteCanvas([132, 134, 136]), aniso), roughness: 0.9 });
  M.pavement = std({ map: toTexture(concreteCanvas([96, 100, 106]), aniso), roughness: 0.4 });
  M.fence = std({ color: 0x1a1d22, roughness: 0.7, metalness: 0.3 });

  M.floorLight = std({ map: toTexture(tileCanvas([176, 178, 180], 'rgba(40,40,40,0.45)', 16), aniso), roughness: 0.42 });
  M.floorDark = std({ map: toTexture(tileCanvas([58, 62, 68], 'rgba(0,0,0,0.6)', 14), aniso), roughness: 0.32 });
  M.asphalt = std({ map: toTexture(asphaltCanvas(), aniso), roughness: 0.3 });
  M.ceiling = std({ map: toTexture(tileCanvas([186, 188, 190], 'rgba(60,60,60,0.9)', 14), aniso), roughness: 0.95 });
  M.ceilingDark = std({ color: 0x14181d, roughness: 0.8, metalness: 0.2 });

  M.metal = std({ color: 0x39414a, roughness: 0.5, metalness: 0.4 });
  M.metalDark = std({ color: 0x15181d, roughness: 0.45, metalness: 0.4 });
  M.plastic = std({ color: 0x1d2227, roughness: 0.55 });
  M.fabric = std({ color: 0x1c2128, roughness: 0.95 });
  M.laminate = std({ color: 0x6b5a48, roughness: 0.55 });
  M.deskBody = std({ color: 0x2d3238, roughness: 0.6 });
  M.benchBody = std({ color: 0x8a949c, roughness: 0.5, metalness: 0.2 });
  M.benchTop = std({ color: 0x1a2128, roughness: 0.25 });
  M.cabinet = std({ color: 0x5b646d, roughness: 0.55, metalness: 0.3 });
  M.white = std({ color: 0xd5dade, roughness: 0.5 });
  M.rack = std({ color: 0x0f1216, roughness: 0.5, metalness: 0.4 });
  M.cable = std({ color: 0x0a0b0d, roughness: 0.8 });
  M.tire = std({ color: 0x0c0c0d, roughness: 0.9 });
  M.paper = std({ color: 0xcfcabb, roughness: 1, side: THREE.DoubleSide });
  M.hazard = std({ map: toTexture(hazardCanvas(), aniso), roughness: 0.7 });

  M.glass = new THREE.MeshStandardMaterial({
    color: 0x7fa8c4,
    roughness: 0.05,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  M.glassDark = std({ color: 0x0b1118, roughness: 0.08, metalness: 0.3 });
  M.liquid = new THREE.MeshBasicMaterial({
    color: 0x2b7f86,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  M.puddle = std({ color: 0x04070b, roughness: 0.03 });
  M.platformTop = std({ color: 0x0b1118, roughness: 0.3, emissive: 0x0a2438 });
  M.beam = new THREE.MeshBasicMaterial({
    color: 0x6fb8ff,
    transparent: true,
    opacity: 0.05,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  M.blood = new THREE.MeshStandardMaterial({
    map: toTexture(bloodCanvas(), aniso),
    transparent: true,
    roughness: 0.3,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

  M.screenOff = std({ color: 0x050607, roughness: 0.15, metalness: 0.2 });
  M.emRed = basic(0xff2a1f);
  M.emGreen = basic(0x34ff8a);
  M.emCyan = basic(0x9fe8ff);

  return M;
}
