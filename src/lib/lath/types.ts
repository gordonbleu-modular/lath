/** One cell in the tracker. A zero note is a rest. */
export type Step = {
  n: number;
  v: number;
  l: number;
  f: number;
  a: number;
};

export type Voice = {
  decay: number;
  tone: number;
  model: number;
  pitch: number;
  aux: number;
  sendD: number;
  sendR: number;
};

export type MixCh = { level: number; pan: number };
export type Send = { d: number; r: number };

/** One stored sound. The main knob blends three of these. */
export type Scene = {
  voice: Voice[];
  mix: MixCh[];
  master: number;
  delay: { time: number; fb: number; mix: number };
  room: { size: number; damp: number; mix: number };
  drive: number;
  inSend: Send[];
};

/** What the small knobs can take over. Swing is 0, drive is 2. */
export const KNOB_TARGETS = [
  "Swing",
  "Tempo",
  "Drive",
  "Delay send",
  "Delay feedback",
  "Room send",
  "Room size",
  "Master",
  "Audio in 1 level",
  "Audio in 2 level",
  "Audio in 1 delay send",
  "Audio in 2 delay send",
  "Audio in 1 room send",
  "Audio in 2 room send",
] as const;

/**
 * Project the card and the editor both understand.
 * Steps are [pattern 0-7][track 0-5][step 0-63].
 */
export type Project = {
  bpm: number;
  swing: number;
  pattern: number;
  trackLen: number[][];
  mute: number[];
  voice: Voice[];
  mix: MixCh[];
  master: number;
  delay: { time: number; fb: number; mix: number };
  room: { size: number; damp: number; mix: number };
  drive: number;
  inputsToFx: number;
  inSend: Send[];
  scene: number;
  scenes: Scene[];
  morph: number;
  knobX: number;
  knobY: number;
  song: number[];
  songAt: number;
  pending: number;
  steps: Step[][][];
};

export const TRACKS = [
  { id: "K", name: "Pipe", role: "Kick", kind: "drum" as const },
  { id: "H", name: "Shard", role: "Hat", kind: "drum" as const },
  { id: "S", name: "Wire", role: "Snare", kind: "drum" as const },
  { id: "P", name: "Glass", role: "Perc", kind: "drum" as const },
  { id: "1", name: "CV 1", role: "Pitch + gate", kind: "cv" as const },
  { id: "2", name: "CV 2", role: "Pitch + gate", kind: "cv" as const },
];

export const FX = [
  { id: 0, name: "—", hint: "Nothing on this step." },
  { id: 1, name: "R", hint: "Retrigger. Value is how many hits fit in the step (2–8)." },
  { id: 2, name: "D", hint: "Extra delay send for this hit." },
  { id: 3, name: "B", hint: "Extra room send for this hit." },
  { id: 4, name: "C", hint: "Crush. Sample-holds and bites the hit." },
  { id: 5, name: "P", hint: "Pitch offset. 24 is no change, 0 is down two octaves, 48 is up two." },
  { id: 6, name: "?", hint: "Probability. The hit plays when a dice roll lands under this value." },
  { id: 7, name: "G", hint: "On drums, tone for this hit. On CV, glide time into the note." },
  { id: 8, name: "K", hint: "Choke. Silences this track for the next N steps." },
];

export const MODELS = ["Glass", "Wood", "Zap", "Tom"];
export const DELAY_TIMES = ["1/16", "1/8", "3/16", "1/4", "3/8", "1/2", "3/4", "1 bar"];
export const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function noteName(n: number): string {
  if (!n) return "·";
  const oct = Math.floor(n / 12) - 1;
  return NAMES[n % 12] + oct;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n | 0));
}

export const PROTO = 1;
export const CMD = {
  hello: 0x01,
  helloAck: 0x02,
  transport: 0x20,
  tempo: 0x21,
  swing: 0x22,
  pattern: 0x23,
  trackLen: 0x24,
  rewind: 0x26,
  step: 0x30,
  voice: 0x31,
  mix: 0x32,
  fx: 0x33,
  mute: 0x34,
  trig: 0x35,
  clearTrack: 0x36,
  copyPattern: 0x37,
  scene: 0x38,
  perform: 0x39,
  queue: 0x3b,
  playhead: 0x40,
  panel: 0x41,
  save: 0x50,
  saved: 0x52,
  globals: 0x61,
  chunk: 0x63,
  lengths: 0x64,
} as const;
