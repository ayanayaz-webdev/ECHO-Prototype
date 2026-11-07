import { segmentClear } from '../world/Collision.js';

// A tiny navigation graph: waypoints in doorways and room centres. Enemies walk in straight
// lines when the way is clear, and hop along these nodes when a wall is in the way.
const NODES = {
  ent: [0, 13], rec: [0, 3], recD: [0, -7.2], cA: [0, -12], cAB: [0, -20.5], cB: [0, -23.5],
  arm0: [0, -10], armIn: [4, -10], armEnd: [9, -10], mntIn: [-4, -10], mntEnd: [-9, -10],
  cBw: [-8, -23.5], cBe: [8, -23.5], cBe2: [14.5, -23.5], labD: [-14.5, -23.5],
  labIn: [-14.5, -29], labMid: [-14.5, -35],
  ctrlIn: [0, -29], ctrlMid: [0, -36], ctrlN: [0, -40.5],
  servIn: [14.5, -29], servA: [14.5, -31.5], servB: [13.0, -34], servC: [14.5, -38.5], servN: [14.5, -41],
  chamS: [14.5, -44.5], chE: [16, -48], chEast: [16, -53], chS: [16, -58], chN2: [8, -47], chN3: [2, -48],
  chW: [-3, -52], chPlatS: [8, -59], chExit: [-5, -58], yard: [-12, -58],
};

const EDGES = [
  ['ent', 'rec'], ['rec', 'recD'], ['recD', 'cA'], ['cA', 'arm0'], ['arm0', 'armIn'], ['armIn', 'armEnd'],
  ['arm0', 'mntIn'], ['mntIn', 'mntEnd'], ['cA', 'cAB'], ['cAB', 'cB'], ['cB', 'cBw'], ['cB', 'cBe'],
  ['cBe', 'cBe2'], ['cBw', 'labD'], ['labD', 'labIn'], ['labIn', 'labMid'], ['cB', 'ctrlIn'],
  ['ctrlIn', 'ctrlMid'], ['ctrlMid', 'ctrlN'], ['cBe2', 'servIn'], ['servIn', 'servA'], ['servA', 'servB'],
  ['servB', 'servC'], ['servC', 'servN'], ['servN', 'chamS'], ['chamS', 'chE'], ['chE', 'chEast'],
  ['chEast', 'chS'], ['chS', 'chPlatS'], ['chamS', 'chN2'], ['chN2', 'chN3'], ['chN3', 'chW'],
  ['chW', 'chExit'], ['chPlatS', 'chExit'], ['chExit', 'yard'],
];

export class Nav {
  constructor(colliders) {
    this.colliders = colliders;
    this.ids = Object.keys(NODES);
    this.pos = Object.fromEntries(this.ids.map((id) => [id, { x: NODES[id][0], z: NODES[id][1] }]));
    this.adj = Object.fromEntries(this.ids.map((id) => [id, []]));
    for (const [a, b] of EDGES) {
      const d = Math.hypot(this.pos[a].x - this.pos[b].x, this.pos[a].z - this.pos[b].z);
      this.adj[a].push([b, d]);
      this.adj[b].push([a, d]);
    }
  }

  _nearest(x, z) {
    let best = null;
    let bestD = Infinity;
    let any = null;
    let anyD = Infinity;
    for (const id of this.ids) {
      const p = this.pos[id];
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < anyD) {
        any = id;
        anyD = d;
      }
      if (d < bestD && segmentClear(x, z, p.x, p.z, this.colliders, 0.3)) {
        best = id;
        bestD = d;
      }
    }
    return best || any;
  }

  // Returns a list of {x,z} points to walk through, ending at the target.
  findPath(sx, sz, tx, tz) {
    const start = this._nearest(sx, sz);
    const goal = this._nearest(tx, tz);
    const dist = {};
    const prev = {};
    const open = new Set(this.ids);
    for (const id of this.ids) dist[id] = Infinity;
    dist[start] = 0;
    while (open.size) {
      let u = null;
      for (const id of open) if (u === null || dist[id] < dist[u]) u = id;
      open.delete(u);
      if (u === goal || dist[u] === Infinity) break;
      for (const [v, w] of this.adj[u]) {
        if (dist[u] + w < dist[v]) {
          dist[v] = dist[u] + w;
          prev[v] = u;
        }
      }
    }
    const path = [];
    for (let id = goal; id !== undefined; id = prev[id]) {
      path.unshift({ x: this.pos[id].x, z: this.pos[id].z });
      if (id === start) break;
    }
    path.push({ x: tx, z: tz });
    // Skip leading waypoints that are behind us: if the next one is directly reachable, go there.
    while (path.length >= 2 && segmentClear(sx, sz, path[1].x, path[1].z, this.colliders, 0.3)) path.shift();
    return path;
  }
}
