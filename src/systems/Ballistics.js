// Bullet maths. Everything is a "ray": it starts at a point, travels in a direction, and we
// ask what it hits first. Walls are the collision boxes (with a height), enemies are cylinders.

// Returns { t, kind: 'wall' | 'floor' } for the nearest thing hit within maxT, or null.
export function rayBoxes(ox, oy, oz, dx, dy, dz, maxT, boxes) {
  let best = maxT;
  let kind = null;

  if (dy < -1e-6) {
    const t = -oy / dy;
    if (t > 0 && t < best) {
      best = t;
      kind = 'floor';
    }
  }

  const o = [ox, oy, oz];
  const d = [dx, dy, dz];
  for (const b of boxes) {
    if (b.off) continue;
    const mn = [b.minX, 0, b.minZ];
    const mx = [b.maxX, b.h === undefined ? 6 : b.h, b.maxZ];
    let t0 = 0;
    let t1 = best;
    let miss = false;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        if (o[i] < mn[i] || o[i] > mx[i]) {
          miss = true;
          break;
        }
      } else {
        let ta = (mn[i] - o[i]) / d[i];
        let tb = (mx[i] - o[i]) / d[i];
        if (ta > tb) [ta, tb] = [tb, ta];
        if (ta > t0) t0 = ta;
        if (tb < t1) t1 = tb;
        if (t0 > t1) {
          miss = true;
          break;
        }
      }
    }
    if (!miss && t0 > 1e-4 && t0 < best) {
      best = t0;
      kind = 'wall';
    }
  }
  return kind ? { t: best, kind } : null;
}

// Vertical cylinder (a standing person). Returns { t, y } or null.
export function rayCylinder(ox, oy, oz, dx, dy, dz, maxT, cx, cz, r, y0, y1) {
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return null;
  const fx = ox - cx;
  const fz = oz - cz;
  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t <= 0 || t > maxT) return null;
  const y = oy + dy * t;
  if (y < y0 || y > y1) return null;
  return { t, y };
}
