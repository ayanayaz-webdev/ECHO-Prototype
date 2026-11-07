// Runs a list of objective stages. It knows nothing about the HUD, the level or enemies:
// it only listens for events and announces "objective:changed" / "mission:complete".
//
// A stage looks like:
//   { id, title, desc, location, target:{x,y,z}, cp:{x,z,yaw},
//     on: 'event:name', if: (data) => boolean,   // completion condition
//     onStart(), onRetry(), onComplete() }
export class MissionManager {
  constructor(events, stages) {
    this.events = events;
    this.stages = stages;
    this.index = -1;
    this.finished = false;
    this.checkpointIndex = 0;
    this._off = null;
  }

  get current() {
    return this.stages[this.index] || null;
  }

  indexOf(id) {
    return this.stages.findIndex((s) => s.id === id);
  }

  isAtOrAfter(id) {
    return this.index >= this.indexOf(id);
  }

  start() {
    this._enter(0);
  }

  // Used after dying: go back to a stage without re-running its onStart().
  restoreTo(index) {
    this._enter(index, false);
  }

  _enter(i, runStart = true) {
    if (this._off) this._off();
    this.index = i;
    const s = this.stages[i];
    if (s.cp) this.checkpointIndex = i;
    if (s.on) {
      this._off = this.events.on(s.on, (d) => {
        if (this.current === s && (!s.if || s.if(d))) this.completeStage(s.id);
      });
    }
    this.events.emit('objective:changed', { stage: s, index: i, total: this.stages.length });
    if (runStart && s.onStart) s.onStart();
  }

  completeStage(id) {
    const s = this.current;
    if (!s || s.id !== id || this.finished) return false;
    if (this._off) {
      this._off();
      this._off = null;
    }
    if (s.onComplete) s.onComplete();
    this.events.emit('objective:completed', { stage: s, index: this.index });
    if (this.index + 1 >= this.stages.length) {
      this.finished = true;
      this.events.emit('mission:complete', {});
    } else {
      this._enter(this.index + 1);
    }
    return true;
  }
}
