// Simple, fast collision for a walking player.
// The player is a circle on the floor (x/z). Walls and props are axis-aligned boxes:
// { minX, maxX, minZ, maxZ }. If the circle overlaps a box we push it back out,
// which also makes the player slide smoothly along walls.
export function resolveCircle(pos, radius, boxes) {
  const r2 = radius * radius;

  for (let iter = 0; iter < 3; iter++) {
    let moved = false;

    for (const b of boxes) {
      if (b.off) continue; // open doors are switched off
      // Closest point on the box to the circle centre.
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r2) continue;

      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        const push = (radius - d) / d;
        pos.x += dx * push;
        pos.z += dz * push;
      } else {
        // Centre is inside the box: leave through the nearest side.
        const l = pos.x - b.minX;
        const r = b.maxX - pos.x;
        const t = pos.z - b.minZ;
        const bt = b.maxZ - pos.z;
        const m = Math.min(l, r, t, bt);
        if (m === l) pos.x = b.minX - radius;
        else if (m === r) pos.x = b.maxX + radius;
        else if (m === t) pos.z = b.minZ - radius;
        else pos.z = b.maxZ + radius;
      }
      moved = true;
    }

    if (!moved) break;
  }
}

// Is the straight line between two floor points free of walls? Boxes are padded by the
// body radius so a character can actually walk the line.
export function segmentClear(ax, az, bx, bz, boxes, pad = 0.3) {
  const o = [ax, az];
  const d = [bx - ax, bz - az];
  for (const b of boxes) {
    if (b.off) continue;
    const mn = [b.minX - pad, b.minZ - pad];
    const mx = [b.maxX + pad, b.maxZ + pad];
    let t0 = 0;
    let t1 = 1;
    let hit = true;
    for (let i = 0; i < 2; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        if (o[i] < mn[i] || o[i] > mx[i]) {
          hit = false;
          break;
        }
      } else {
        let ta = (mn[i] - o[i]) / d[i];
        let tb = (mx[i] - o[i]) / d[i];
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) {
          hit = false;
          break;
        }
      }
    }
    if (hit) return false;
  }
  return true;
}
