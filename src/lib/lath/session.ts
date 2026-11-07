import { engineAudition, engineRewind, engineRun, primeAudio, pushProject, resumeAudio } from "./audio";
import {
  sendAudition,
  sendClear,
  sendCopy,
  sendInputsFx,
  sendLength,
  sendMute,
  sendPattern,
  sendPerform,
  sendQueue,
  sendRewind,
  sendScene,
  sendStep,
  sendSwing,
  sendTempo,
  sendTransport,
  sendDrumLock,
  sendFxLock,
} from "./midi";
import { persist, useLath } from "./store";
import type { Project, Scene, Step } from "./types";
import { clamp } from "./types";

function commit(project: Project) {
  useLath.setState({ project, hold: Date.now() + 900 });
  pushProject(project);
  schedulePersist(project);
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistPending: Project | null = null;
function schedulePersist(project: Project) {
  persistPending = project;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (persistPending) persist(persistPending);
    persistPending = null;
  }, 120);
}

function mirror(project: Project) {
  const scene = project.scenes[project.scene] ?? project.scenes[0];
  project.voice = scene.voice;
  project.mix = scene.mix;
  project.master = scene.master;
  project.delay = scene.delay;
  project.room = scene.room;
  project.drive = scene.drive;
  project.inSend = scene.inSend;
}

function editScene(mutate: (scene: Scene) => void) {
  const project = editProject((p) => {
    mutate(p.scenes[p.scene]);
    mirror(p);
  });
  sendScene(project.scene, project.scenes[project.scene]);
  return project;
}

export function current(): Project {
  return useLath.getState().project;
}

export function editProject(mutate: (project: Project) => void) {
  const project = structuredClone(current());
  mutate(project);
  commit(project);
  return project;
}

export async function togglePlay() {
  primeAudio();
  const s = useLath.getState();
  const running = !s.running;
  useLath.setState(running ? { running } : { running, pos: [0, 0, 0, 0, 0, 0] });
  await resumeAudio();
  const now = useLath.getState();
  if (now.connected) {
    sendTransport(running, now.ext);
    engineRun(false);
  } else {
    pushProject(now.project);
    engineRun(running);
  }
}

export async function rewind() {
  primeAudio();
  useLath.setState({ pos: [0, 0, 0, 0, 0, 0] });
  await resumeAudio();
  engineRewind();
  if (useLath.getState().connected) sendRewind();
}

export function setBpm(bpm: number) {
  const project = editProject((p) => {
    p.bpm = clamp(bpm, 40, 300);
  });
  sendTempo(project.bpm);
}

export function setSwing(swing: number) {
  const project = editProject((p) => {
    p.swing = clamp(swing, 0, 127);
  });
  sendSwing(project.swing);
}

export function setDrive(drive: number) {
  editScene((scene) => {
    scene.drive = clamp(drive, 0, 127);
  });
}

export function selectPattern(pat: number) {
  const project = editProject((p) => {
    p.pattern = pat & 7;
  });
  sendPattern(project.pattern);
  for (let t = 0; t < 6; t++) sendLength(t, project.trackLen[project.pattern][t]);
}

export function setTrackLen(tr: number, len: number) {
  const project = editProject((p) => {
    p.trackLen[p.pattern][tr] = clamp(len, 1, 32);
  });
  sendLength(tr, project.trackLen[project.pattern][tr]);
}

export function toggleMute(tr: number) {
  const project = editProject((p) => {
    p.mute[tr] = p.mute[tr] ? 0 : 1;
  });
  sendMute(tr, !!project.mute[tr]);
}

export function writeStep(tr: number, st: number, cell: Step, audition = false) {
  const pat = current().pattern;
  const project = editProject((p) => {
    p.steps[p.pattern][tr][st] = cell;
  });
  const written = project.steps[pat][tr][st];
  sendStep(pat, tr, st, written);
  if (audition && written.n) {
    engineAudition(tr, written.n, written.v || 100, written.l, written.f, written.a);
    sendAudition(tr, written);
  }
}

export function setVoice(i: number, key: "decay" | "tone" | "model" | "pitch" | "aux" | "sendD" | "sendR" | "pa" | "pb", value: number) {
  editScene((scene) => {
    scene.voice[i][key] = value;
  });
}

export function setDrumLock(track: number, step: number, index: number, value: number | null) {
  const pat = current().pattern;
  const project = editProject((p) => {
    const row = p.stepPar[pat][track][step];
    if (value == null) row[index] = null;
    else if (index === 2) row[index] = clamp(value, 0, 48);
    else if (index === 0) row[index] = clamp(value, 1, 127);
    else row[index] = clamp(value, 0, 127);
    p.locksFull = 1;
  });
  sendDrumLock(pat, track, step, project.stepPar[pat][track][step]);
}

export function setFxLock(step: number, index: number, value: number | null) {
  const pat = current().pattern;
  const project = editProject((p) => {
    const row = p.fxPar[pat][step];
    if (value == null) row[index] = null;
    else row[index] = index === 0 ? clamp(value, 0, 7) : clamp(value, 0, 127);
    p.locksFull = 1;
  });
  sendFxLock(pat, step, project.fxPar[pat][step]);
}

export function setMix(i: number, key: "level" | "pan", value: number) {
  editScene((scene) => {
    scene.mix[i][key] = clamp(value, 0, 127);
  });
}

export function setMaster(level: number) {
  editScene((scene) => {
    scene.master = clamp(level, 0, 127);
  });
}

export function setDelay(key: "time" | "fb" | "mix", value: number) {
  editScene((scene) => {
    scene.delay[key] = value;
  });
}

export function setRoom(key: "size" | "damp" | "mix", value: number) {
  editScene((scene) => {
    scene.room[key] = value;
  });
}

export function setInputsFx(on: boolean) {
  editProject((p) => {
    p.inputsToFx = on ? 1 : 0;
  });
  sendInputsFx(on);
}

export function setInSend(ch: number, key: "d" | "r", value: number) {
  editScene((scene) => {
    scene.inSend[ch][key] = clamp(value, 0, 127);
  });
}

export function setScene(index: number) {
  const connected = useLath.getState().connected;
  editProject((p) => {
    p.scene = index & 3;
    if (p.scene > 2) p.scene = 2;
    if (!connected) p.morph = p.scene === 0 ? 0 : p.scene === 1 ? 64 : 127;
    mirror(p);
  });
}

export function setMorph(morph: number) {
  editProject((p) => {
    p.morph = clamp(morph, 0, 127);
  });
}

export function setKnob(which: "knobX" | "knobY", id: number) {
  const project = editProject((p) => {
    p[which] = clamp(id, 0, 13);
  });
  sendPerform(project);
}

export function setSongStep(index: number, pat: number) {
  const project = editProject((p) => {
    p.song[index] = pat & 7;
  });
  sendPerform(project);
}

export function addSongStep() {
  const project = editProject((p) => {
    if (p.song.length >= 16) return;
    p.song.push(p.song[p.song.length - 1] ?? 0);
  });
  sendPerform(project);
}

export function removeSongStep(index: number) {
  const project = editProject((p) => {
    if (p.song.length <= 1) return;
    p.song.splice(index, 1);
    if (p.songAt >= p.song.length) p.songAt = p.song.length - 1;
    if (p.pending >= p.song.length) p.pending = -1;
  });
  sendPerform(project);
}

export function queueNext() {
  if (useLath.getState().connected) {
    sendQueue();
    return;
  }
  editProject((p) => {
    const len = p.song.length || 1;
    const base = p.pending >= 0 ? p.pending : p.songAt;
    p.pending = (base + 1) % len;
  });
}

export function setExt(ext: boolean) {
  useLath.setState({ ext });
  const s = useLath.getState();
  if (s.connected) {
    sendTransport(s.running, ext);
    sendPerform(s.project);
  }
}

export function clearPattern() {
  const pat = current().pattern;
  editProject((p) => {
    for (let t = 0; t < 6; t++) {
      for (let s = 0; s < 64; s++) p.steps[p.pattern][t][s] = { n: 0, v: 0, l: 0, f: 0, a: 0 };
    }
    for (let t = 0; t < 4; t++) {
      for (let s = 0; s < 32; s++) p.stepPar[p.pattern][t][s] = Array.from({ length: 10 }, () => null);
    }
    for (let s = 0; s < 32; s++) p.fxPar[p.pattern][s] = Array.from({ length: 7 }, () => null);
  });
  for (let t = 0; t < 6; t++) sendClear(pat, t);
}

export function copyPattern(dst: number) {
  const src = current().pattern;
  if (dst === src) return;
  editProject((p) => {
    p.steps[dst] = structuredClone(p.steps[src]);
    p.trackLen[dst] = structuredClone(p.trackLen[src]);
    p.stepPar[dst] = structuredClone(p.stepPar[src]);
    p.fxPar[dst] = structuredClone(p.fxPar[src]);
  });
  sendCopy(dst, src);
}
