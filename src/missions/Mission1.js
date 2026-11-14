import { MissionManager } from './MissionManager.js';

// Mission 1: THE ARRIVAL.
// This file is the "script": it lists the objectives, places the interactable things, and reacts
// to what the player does. It talks to the other systems through the ctx object and the event bus.
export function createMission1(ctx) {
  const { events, hud, audio, level, doors, interaction, player, weapons, enemies, lights, hologram } = ctx;

  const S = {
    powered: false,
    encounterStarted: false,
    encounterCleared: false,
    ammoTaken: false,
    credential: false,
    logs: new Set(),
    holoPlayed: false,
    lockdown: false,
    escapeSpawned: false,
    extracted: false,
    lastZone: '',
    snap: null,
  };

  const later = (t, fn) => hud.later(t, fn);
  const daniel = (text, dur) => hud.say('DANIEL', text, dur || 4);
  const radio = (text) => {
    hud.say('APEX SECURITY (RADIO)', text, 3.5, true);
    audio.radio();
  };
  const dist = (x, z) => Math.hypot(player.position.x - x, player.position.z - z);

  // ---------------------------------------------------------------- objectives
  const stages = [
    {
      id: 'enter', title: 'Enter the facility', desc: 'Approach the main entrance and go inside.',
      location: 'Main entrance', target: { x: 0, y: 1.6, z: 10 },
      on: 'zone:enter', if: (n) => n === 'Main reception',
      onComplete() {
        daniel("Power's unstable. Security access is locked. I need to find a way into the system.");
      },
    },
    {
      id: 'power', title: 'Restore facility power',
      desc: 'Find the maintenance room off the main corridor and restore emergency power.',
      location: 'Maintenance room, west of the corridor', target: { x: -11.3, y: 1.5, z: -10 },
      on: 'power:restored', cp: { x: 0, z: 2, yaw: 0 },
    },
    {
      id: 'armory', title: 'Access the security armory',
      desc: 'The armory door has power again. Find a weapon inside.',
      location: 'Security armory, east of the corridor', target: { x: 11.4, y: 1.5, z: -10 },
      on: 'weapon:acquired',
    },
    {
      id: 'investigate', title: 'Investigate the security control room',
      desc: 'Head for the control room off the cross corridor. You are no longer alone in here.',
      location: 'Security control room', target: { x: 0, y: 1.6, z: -26 },
      on: 'encounter:cleared', cp: { x: 0, z: -13, yaw: 0 },
      onStart() {
        later(4, () => audio.footsteps({ x: 14.5, y: 1, z: -31 }));
        later(5.5, () => radio('...east corridor, sector two. Anything on the cameras?'));
        later(9.5, () => radio('Negative. But power just cycled. Someone is in the building.'));
      },
      onRetry() {
        S.encounterStarted = false;
        doors.lock('server');
      },
    },
    {
      id: 'secure', title: 'Secure the security control room',
      desc: 'Enter the control room and access the main security terminal.',
      location: 'Security control room', target: { x: -3.6, y: 1.5, z: -33 },
      on: 'terminal:accessed',
      onStart() {
        daniel('Control room. If anything was logged, it will be on that terminal.');
      },
    },
    {
      id: 'research', title: 'Access the research wing',
      desc: 'Your new credential opens the research laboratory.',
      location: 'Research laboratory', target: { x: -14.5, y: 1.6, z: -26 },
      on: 'zone:enter', if: (n) => n === 'Research laboratory',
    },
    {
      id: 'logs', title: 'Search the laboratory',
      desc: 'Look for research logs that explain Project ECHO.',
      location: 'Research laboratory', target: { x: -10.8, y: 1.2, z: -31.2 },
      on: 'log:read',
      onStart() {
        daniel('Whatever they were building, they left in a hurry.');
      },
      onComplete() {
        daniel('They never shut it down. ECHO was still running when the facility emptied.');
      },
    },
    {
      id: 'data', title: 'Recover the ECHO data',
      desc: 'Retrieve the data archive from the terminal in the server room.',
      location: 'Server room, east of the cross corridor', target: { x: 14.5, y: 1.5, z: -34 },
      on: 'data:recovered',
    },
    {
      id: 'chamber', title: 'Investigate the ECHO testing chamber',
      desc: 'The chamber door is unlocked. Find out what the system has been hiding.',
      location: 'ECHO testing chamber', target: { x: 8, y: 1.2, z: -53 },
      on: 'holo:finished', cp: { x: 14.5, z: -40, yaw: 0 },
      onComplete() {
        lights.setScale('chamber', 0.7);
      },
      onRetry() {
        S.holoPlayed = false;
        hologram.reset();
        lights.setScale('chamber', 0.4);
      },
    },
    {
      id: 'recording', title: 'Recover the original recording',
      desc: 'Pull the source recording from the main chamber console.',
      location: 'Chamber console, east wall', target: { x: 20.2, y: 1.4, z: -50 },
      on: 'recording:recovered',
      onStart() {
        daniel('That thing moved like me. It knew where I was standing. The original has to be on the main console.');
      },
    },
    {
      id: 'escape', title: 'Escape through the service exit',
      desc: 'Lockdown is active. Reach the extraction point behind the building.',
      location: 'Service yard, west of the chamber', target: { x: -16, y: 1.2, z: -62 },
      on: 'extraction:reached', cp: { x: 17.5, z: -50, yaw: Math.PI / 2 },
      onStart() {
        startLockdown();
      },
      onRetry() {
        S.escapeSpawned = false;
        later(2.5, spawnEscapeEnemies);
      },
    },
  ];

  const manager = new MissionManager(events, stages);
  const stageId = () => (manager.current ? manager.current.id : '');

  // Remember ammunition at each checkpoint so a restart is fair.
  events.on('objective:changed', ({ stage }) => {
    if (stage.cp) {
      const w = weapons.weapon;
      S.snap = w ? { mag: w.mag, reserve: w.reserve } : null;
    }
  });

  // ---------------------------------------------------------------- doors
  doors.add({ id: 'armory', alongX: false, fixed: 2, at: -10, w: 1.4, h: 2.4, locked: true, lockedMsg: 'Door locked: no power' });
  doors.add({ id: 'lab', alongX: true, fixed: -26, at: -14.5, w: 2.2, h: 2.6, locked: true, lockedMsg: 'Locked: Level 4 access required' });
  doors.add({ id: 'server', alongX: true, fixed: -26, at: 14.5, w: 2.2, h: 2.6, locked: true, lockedMsg: 'Locked: Level 4 access required' });
  doors.add({ id: 'chamberCtrl', alongX: true, fixed: -42, at: 0, w: 2.4, h: 2.6, locked: true, lockedMsg: 'Locked: chamber sealed' });
  doors.add({ id: 'chamberServer', alongX: true, fixed: -42, at: 14.5, w: 2.4, h: 2.6, locked: true, lockedMsg: 'Locked: chamber sealed' });
  doors.add({ id: 'exit', alongX: false, fixed: -8, at: -58, w: 2.4, h: 2.8, locked: true, lockedMsg: 'Emergency exit: sealed' });

  // A locked door only shows its prompt when you are standing next to it.
  for (const d of doors.doors.values()) {
    interaction.add({
      pos: { x: d.cx, z: d.cz }, radius: 2.0, facing: -1, info: true,
      prompt: () => d.lockedMsg, enabled: () => d.locked,
    });
  }

  // ---------------------------------------------------------------- interactables
  interaction.add({
    pos: { x: -11.0, z: -10 }, radius: 2.4, prompt: 'E — Restore Power',
    enabled: () => stageId() === 'power', onInteract: restorePower,
  });
  interaction.add({
    pos: { x: 11.0, z: -10 }, radius: 2.4, prompt: 'Press E to collect weapon',
    enabled: () => stageId() === 'armory', onInteract: collectWeapon,
  });
  interaction.add({
    pos: { x: 6.5, z: -7.2 }, radius: 2.4, prompt: 'E — Take Ammunition',
    enabled: () => weapons.hasWeapon && !S.ammoTaken,
    onInteract() {
      S.ammoTaken = true;
      weapons.addAmmo(60);
      audio.pickup();
      hud.notify('+60 rounds');
    },
  });
  interaction.add({
    pos: { x: -3.6, z: -33 }, radius: 2.8, prompt: 'E — Access Security Terminal',
    enabled: () => stageId() === 'secure', onInteract: accessSecurityTerminal,
  });

  const LOGS = [
    { pos: { x: -10.8, z: -31.2 }, title: 'RESEARCH LOG: PROJECT ECHO', lines: [
      'Project ECHO was designed to capture and reconstruct tactical decision-making.', '',
      'The system records movement, reactions, combat decisions, and environmental interactions.', '',
      'All testing has been suspended pending investigation.'] },
    { pos: { x: -17.6, z: -32.5 }, title: 'TEST LOG 114', lines: [
      'Subject replay stable. Behavioural drift: 0.2%.',
      'Chamber reports activity outside scheduled sessions.',
      'Recommend shutdown of the playback core.', 'Request denied.'] },
    { pos: { x: -14.8, z: -38.8 }, title: 'CONTAINMENT TUBE 02', lines: [
      'Status: vacated. No record of authorised release.',
      'The recording index kept updating after the shutdown.',
      'New entries carry dates that have not happened yet.'] },
  ];
  LOGS.forEach((log, i) => {
    interaction.add({
      pos: log.pos, radius: 2.2, prompt: 'E — Read Research Log',
      enabled: () => manager.isAtOrAfter('logs'),
      onInteract() {
        audio.beep();
        hud.showPanel(log.title, log.lines);
        S.logs.add(i);
        events.emit('log:read', { id: i });
      },
    });
  });

  interaction.add({
    pos: { x: 14.5, z: -34 }, radius: 2.8, prompt: 'E — Recover Data',
    enabled: () => stageId() === 'data', holdTime: 4, progressLabel: 'Recovering archive',
    onStart: () => audio.beep(700), onInteract: recoverData,
  });
  interaction.add({
    pos: { x: 20.2, z: -50 }, radius: 2.4, prompt: 'E — Recover Recording',
    enabled: () => stageId() === 'recording', holdTime: 2.5, progressLabel: 'Copying recording',
    onStart: () => audio.beep(700),
    onInteract() {
      audio.beep(1100);
      hud.showPanel('ECHO CONSOLE', ['RECORDING EXTRACTED', 'SOURCE: CROSS, D.', 'WARNING: PLAYBACK CORE UNSTABLE']);
      events.emit('recording:recovered');
    },
  });

  // ---------------------------------------------------------------- story events
  function restorePower() {
    if (S.powered) return;
    S.powered = true;
    audio.electric();
    later(0.7, () => {
      level.powerOn();
      // Controlled lighting changes: some rooms brighten, others stay dim.
      lights.setScale('reception', 0.8);
      lights.setScale('corridorA', 0.9);
      lights.setScale('corridorB1', 0.85);
      lights.setScale('corridorB2', 0.85);
      lights.setScale('corridorB3', 0.85);
      lights.setScale('control', 1.0);
      lights.setScale('lab', 0.55);
      lights.setScale('maintenance', 0.9);
      lights.setScale('armory', 1.0);
      events.emit('power:restored');
    });
    later(1.4, () => {
      doors.unlock('armory');
      audio.beep(660);
    });
    later(2.2, () => audio.thump()); // something heavy shifts deeper in the building
    later(3.0, () => daniel('Emergency grid is up. The armory door should have power again.'));
  }

  function collectWeapon() {
    S.armed = true;
    level.rackMount.visible = false; // the rifle comes off the rack
    level.rackGlow.visible = false;
    audio.pickup();
    hud.notify('Collected: M4A1 carbine (30 / 90)', 4);
    daniel('M4A1. Still in working order. Not what I expected to find in an abandoned building.');
    weapons.give(); // announces weapon:acquired, which advances the objective
  }

  function startEncounter() {
    S.encounterStarted = true;
    doors.unlock('server', true);
    hud.say('APEX SECURITY', 'Contact! Intruder in the east corridor!', 2.5, true);
    later(0.5, () => {
      const alert = { x: player.position.x, z: player.position.z };
      enemies.spawn({ id: 'e1', group: 'enc1', x: 14.5, z: -28.0, yaw: Math.PI, state: 'investigate', aggressive: true, alertPos: alert, cover: { x: 12.9, z: -25.1 } });
      enemies.spawn({ id: 'e2', group: 'enc1', x: 13.6, z: -29.2, yaw: Math.PI, state: 'investigate', aggressive: true, alertPos: alert, cover: { x: 8.6, z: -25.45 } });
      enemies.spawn({ id: 'e3', group: 'enc1', x: 15.4, z: -29.2, yaw: Math.PI, state: 'investigate', aggressive: true, alertPos: alert });
    });
    later(2.5, () => hud.say('APEX SECURITY', 'Drop your weapon!', 2, true));
  }

  events.on('enemy:died', ({ enemy }) => {
    if (enemy.group === 'enc1' && !S.encounterCleared && enemies.alive('enc1').length === 0) {
      S.encounterCleared = true;
      later(1.5, () => {
        daniel('APEX security. Armed, active, and not expecting visitors.');
        doors.lock('server');
        events.emit('encounter:cleared');
      });
    }
  });

  function accessSecurityTerminal() {
    audio.beep();
    for (let i = 1; i <= 6; i++) later(i * 0.4, () => audio.typing());
    hud.showPanel('APEX SECURITY TERMINAL: MAIN CONSOLE', [
      'FACILITY STATUS: LOCKDOWN (INITIATED 21 DAYS AGO)',
      'RESEARCH WING ACCESS: RESTRICTED, LEVEL 4',
      'PROJECT DESIGNATION: ECHO',
      'RESEARCH TEAM: 14 PERSONNEL. STATUS: UNACCOUNTED',
      'FINAL TESTING LOCATION: ECHO CHAMBER, EAST WING',
      '',
      'LEGACY CREDENTIAL ISSUED: SECURITY LEVEL 4',
    ]);
    S.credential = true;
    hud.setCredential(true);
    doors.unlock('lab');
    doors.unlock('server');
    later(4, () => daniel('Fourteen people missing, and a project called ECHO. Whatever happened, it started in the research wing.'));
    events.emit('terminal:accessed');
  }

  function recoverData() {
    audio.beep(1100);
    hud.showPanel('ECHO DATA CORE: ARCHIVE RECOVERED', [
      'ECHO_RESEARCH_ARCHIVE.dat copied',
      '3,412 behavioural simulations found',
      'CLASSIFIED TESTING CHAMBER: ONLINE',
      'RECORDING INDEX: CROSS, D.',
      'FILE DATE: UNREADABLE',
    ]);
    doors.unlock('chamberServer');
    later(2, () => daniel('My name? Why is my name in their archive?'));
    later(7, () => daniel('The chamber door is open. There is only one way to find out.'));
    events.emit('data:recovered');
  }

  function playHologram() {
    S.holoPlayed = true;
    lights.setScale('chamber', 1.3);
    hologram.play([
      { t: 0.2, fn: () => audio.glitch() },
      { t: 1.0, fn: () => hud.centerMessage('RECORDING IDENTIFIED: DANIEL CROSS.', 5) },
      { t: 3.0, fn: () => daniel("That's impossible...", 3) },
      { t: 8.3, fn: () => events.emit('holo:finished') },
    ]);
  }

  function startLockdown() {
    S.lockdown = true;
    lights.setLockdown(true);
    hud.setLockdown(true);
    audio.alarm(true);
    hud.say('FACILITY SYSTEM', 'Security lockdown initiated. All exits sealed.', 3.5, true);
    audio.radio();
    daniel("Lockdown. There's an emergency exit on the west wall. Move!");
    later(1.5, () => {
      doors.unlock('exit', true);
      hud.centerMessage('Emergency exit unlocked', 2.5);
    });
    later(3, spawnEscapeEnemies);
  }

  function spawnEscapeEnemies() {
    if (S.escapeSpawned) return;
    S.escapeSpawned = true;
    const alert = { x: player.position.x, z: player.position.z };
    enemies.spawn({ id: 'x1', group: 'escape', x: 14.5, z: -44.8, yaw: Math.PI, state: 'investigate', aggressive: true, alertPos: alert });
    enemies.spawn({ id: 'x2', group: 'escape', x: 16.2, z: -45.6, yaw: Math.PI, state: 'investigate', aggressive: true, alertPos: alert });
    hud.say('APEX SECURITY', "There he is! Don't let him reach the exit!", 3, true);
  }

  function finish() {
    audio.alarm(false);
    lights.setLockdown(false);
    hud.setLockdown(false);
    hud.clearSubtitles();
    if (ctx.onComplete) ctx.onComplete();
    hud.showComplete({
      mission: 'THE ARRIVAL',
      items: ['ECHO research archive', 'Daniel Cross recording', 'Security access credentials'],
      ending: [
        { text: 'Daniel: "This wasn\'t a recording of something that happened."', hold: 5 },
        { text: 'Daniel: "It was a recording of something that hasn\'t happened yet."', hold: 5 },
      ],
      teaser: 'DOUBLE EXPOSURE',
    });
  }
  events.on('mission:complete', finish);

  // ---------------------------------------------------------------- public API
  return {
    manager,
    state: S,

    begin() {
      hud.showTitle('THE ARRIVAL', 'Mission 1', 4.5);
      later(2.5, () =>
        daniel('APEX Dynamics. Three weeks since the evacuation. No personnel, no official records... and somehow the security network is still online.', 7)
      );
      manager.start();
    },

    // Called every gameplay frame: position-based triggers.
    update() {
      const p = player.position;
      const zone = level.zoneAt(p.x, p.z);
      if (zone !== S.lastZone) {
        S.lastZone = zone;
        if (zone) events.emit('zone:enter', zone);
      }
      const id = stageId();
      if (id === 'investigate' && !S.encounterStarted && p.z < -20.8 && p.z > -26.3) startEncounter();
      if (id === 'chamber' && !S.holoPlayed && dist(8, -53) < 4.5) playHologram();
      if (id === 'escape' && !S.extracted && dist(-16, -62) < 3) {
        S.extracted = true;
        events.emit('extraction:reached');
      }
    },

    // After dying: back to the last checkpoint.
    retry() {
      const idx = manager.checkpointIndex;
      const stage = stages[idx];
      enemies.clear();
      hud.timers.length = 0;
      hud.clearSubtitles();
      hud.closePanel();
      hologram.reset();
      interaction.cancelHold();
      player.respawn(stage.cp.x, stage.cp.z, stage.cp.yaw);
      const w = weapons.weapon;
      if (w && S.snap) {
        w.mag = S.snap.mag;
        w.reserve = S.snap.reserve;
        w.state = 'ready';
      }
      manager.restoreTo(idx);
      if (stage.onRetry) stage.onRetry();
    },
  };
}
