import type { Project, Scene, Step } from "./types";

const Z: Step = { n: 0, v: 0, l: 0, f: 0, a: 0 };

function grid(): Step[][][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 6 }, () => Array.from({ length: 64 }, () => ({ ...Z }))),
  );
}

export function factoryProject(): Project {
  const steps = grid();
  const put = (p: number, t: number, s: number, n: number, v = 104, l = 0, f = 0, a = 0) => {
    steps[p][t][s] = { n, v, l, f, a };
  };
  put(0,0,0,36,120,28,0,0);
  put(0,0,6,36,72,18,0,0);
  put(0,0,8,36,116,26,0,0);
  put(0,0,10,40,48,10,0,0);
  put(0,0,14,36,88,16,0,0);
  put(0,1,0,62,46,6,0,0);
  put(0,1,1,68,96,4,0,0);
  put(0,1,3,72,78,8,0,0);
  put(0,1,5,68,96,4,0,0);
  put(0,1,7,70,90,10,2,90);
  put(0,1,8,62,46,6,0,0);
  put(0,1,9,68,96,4,0,0);
  put(0,1,11,72,78,8,0,0);
  put(0,1,13,68,96,4,0,0);
  put(0,1,15,76,110,6,1,3);
  put(0,2,4,52,122,20,3,80);
  put(0,2,11,48,42,8,0,0);
  put(0,2,12,50,118,22,2,70);
  put(0,3,0,74,96,14,0,0);
  put(0,3,3,67,80,14,0,0);
  put(0,3,6,79,110,14,3,60);
  put(0,3,9,71,70,14,0,0);
  put(0,4,0,36,112,22,0,0);
  put(0,4,3,43,100,16,0,0);
  put(0,4,6,34,108,18,0,0);
  put(0,4,8,36,110,14,0,0);
  put(0,4,11,39,96,12,7,36);
  put(0,4,14,41,100,10,0,0);
  put(0,5,0,67,92,16,0,0);
  put(0,5,2,70,84,12,0,0);
  put(0,5,3,74,108,18,0,0);
  put(0,5,5,72,76,10,0,0);
  put(1,0,0,36,120,30,0,0);
  put(1,0,3,36,60,12,0,0);
  put(1,0,8,36,114,24,0,0);
  put(1,0,11,43,70,14,5,30);
  put(1,0,14,36,90,16,0,0);
  put(1,1,1,80,88,4,0,0);
  put(1,1,3,80,88,4,0,0);
  put(1,1,5,80,88,4,0,0);
  put(1,1,6,66,70,12,4,70);
  put(1,1,7,80,88,4,0,0);
  put(1,1,9,80,88,4,0,0);
  put(1,1,11,80,88,4,0,0);
  put(1,1,13,80,88,4,0,0);
  put(1,1,14,86,120,8,1,4);
  put(1,2,4,54,120,18,0,0);
  put(1,2,10,49,100,16,3,100);
  put(1,2,13,46,50,8,0,0);
  put(1,3,0,64,100,16,7,90);
  put(1,3,2,71,100,16,7,90);
  put(1,3,4,76,100,16,7,90);
  put(1,3,7,69,100,16,7,90);
  put(1,4,0,36,104,18,0,0);
  put(1,4,4,41,104,14,0,0);
  put(1,4,7,39,104,12,0,0);
  put(1,4,9,34,104,16,0,0);
  put(1,4,12,43,104,10,0,0);
  put(1,5,0,76,90,12,0,0);
  put(1,5,3,79,90,12,0,0);
  put(1,5,5,74,90,12,0,0);
  put(1,5,8,81,90,12,0,0);
  put(1,5,10,72,90,12,0,0);
  put(2,0,0,33,124,32,0,0);
  put(2,0,16,33,116,32,0,0);
  put(2,0,24,35,70,18,0,0);
  put(2,1,0,62,40,20,0,0);
  put(2,1,2,70,60,14,2,40);
  put(2,1,6,70,60,14,2,40);
  put(2,1,10,70,60,14,2,40);
  put(2,1,14,70,60,14,2,40);
  put(2,1,18,70,60,14,2,40);
  put(2,1,22,70,60,14,2,40);
  put(2,2,8,48,120,28,3,110);
  put(2,2,24,45,108,24,2,80);
  put(2,3,0,67,90,20,0,0);
  put(2,3,6,72,80,16,7,40);
  put(2,3,12,64,100,18,0,0);
  put(2,4,0,36,100,28,0,0);
  put(2,4,8,36,100,20,0,0);
  put(2,4,12,43,100,16,7,20);
  put(2,4,20,34,100,24,0,0);
  put(2,4,28,39,100,18,7,48);
  put(2,5,0,62,86,18,0,0);
  put(2,5,5,65,86,18,0,0);
  put(2,5,9,69,86,18,0,0);
  put(2,5,14,67,86,18,0,0);
  put(2,5,18,74,86,18,0,0);
  return {
    bpm: 120,
    swing: 64,
    pattern: 0,
    trackLen: [
      [16,16,16,12,16,7],
      [16,15,14,9,13,11],
      [32,24,32,18,32,20],
      [16,16,16,16,16,16],
      [16,16,16,16,16,16],
      [16,16,16,16,16,16],
      [16,16,16,16,16,16],
      [16,16,16,16,16,16],
    ],
    mute: [0,0,0,0,0,0],
    voice: [
      { decay: 78, tone: 42, model: 0, pitch: 24, aux: 90, sendD: 0, sendR: 0 },
      { decay: 26, tone: 100, model: 0, pitch: 24, aux: 48, sendD: 0, sendR: 0 },
      { decay: 58, tone: 64, model: 0, pitch: 24, aux: 88, sendD: 0, sendR: 0 },
      { decay: 48, tone: 72, model: 0, pitch: 24, aux: 80, sendD: 0, sendR: 0 },
    ],
    mix: [
      { level: 110, pan: 64 },
      { level: 96, pan: 86 },
      { level: 104, pan: 42 },
      { level: 90, pan: 98 },
      { level: 100, pan: 48 },
      { level: 100, pan: 80 },
    ],
    master: 104,
    delay: { time: 2, fb: 62, mix: 36 },
    room: { size: 78, damp: 46, mix: 32 },
    drive: 22,
    inputsToFx: 0,
    inSend: [
      { d: 0, r: 0 },
      { d: 0, r: 0 },
    ],
    scene: 0,
    scenes: threeScenes(),
    morph: 0,
    knobX: 0,
    knobY: 2,
    song: [0, 1, 2],
    songAt: 0,
    pending: -1,
    steps,
  };
}

function threeScenes(): Scene[] {
  const a: Scene = {
    voice: [
      { decay: 78, tone: 42, model: 0, pitch: 24, aux: 90, sendD: 0, sendR: 0 },
      { decay: 26, tone: 100, model: 0, pitch: 24, aux: 48, sendD: 0, sendR: 0 },
      { decay: 58, tone: 64, model: 0, pitch: 24, aux: 88, sendD: 0, sendR: 0 },
      { decay: 48, tone: 72, model: 0, pitch: 24, aux: 80, sendD: 0, sendR: 0 },
    ],
    mix: [
      { level: 110, pan: 64 },
      { level: 96, pan: 86 },
      { level: 104, pan: 42 },
      { level: 90, pan: 98 },
      { level: 100, pan: 48 },
      { level: 100, pan: 80 },
    ],
    master: 104,
    delay: { time: 2, fb: 62, mix: 36 },
    room: { size: 78, damp: 46, mix: 32 },
    drive: 22,
    inSend: [
      { d: 0, r: 0 },
      { d: 0, r: 0 },
    ],
  };
  const b = structuredClone(a);
  const c = structuredClone(a);
  for (const v of b.voice) {
    v.decay = Math.max(1, Math.round(v.decay * 0.55));
    v.tone = Math.min(127, v.tone + 28);
  }
  b.delay.mix = 84;
  b.drive = 58;
  b.room.mix = 18;
  for (const v of c.voice) {
    v.decay = Math.min(127, v.decay + 36);
    v.tone = Math.max(0, v.tone - 18);
  }
  c.room.size = 112;
  c.room.mix = 78;
  c.drive = 6;
  c.delay.fb = 96;
  c.inSend = [
    { d: 70, r: 50 },
    { d: 40, r: 80 },
  ];
  return [a, b, c];
}
