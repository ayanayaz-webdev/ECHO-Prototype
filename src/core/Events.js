// A tiny event bus. Systems announce things ("power:restored") and other systems react,
// so the mission script never has to reach into weapons, enemies or the HUD directly.
export class Events {
  constructor() {
    this.map = new Map();
  }

  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, new Set());
    this.map.get(name).add(fn);
    return () => this.map.get(name).delete(fn);
  }

  emit(name, data) {
    const set = this.map.get(name);
    if (set) for (const fn of [...set]) fn(data);
  }
}
