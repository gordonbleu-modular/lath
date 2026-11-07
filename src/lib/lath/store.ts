import { create } from "zustand";
import { factoryProject } from "./factory";
import type { Project, Scene } from "./types";
import { clamp, drumFromNib, emptyDrumLocks, emptyFxLocks, fxFromNib } from "./types";

const KEY = "lath.project.v1";

export type LathState = {
  project: Project;
  pos: number[];
  running: boolean;
  ext: boolean;
  connected: boolean;
  status: string;
  selT: number;
  selS: number;
  octave: number;
  hardwareClock: boolean;
  hold: number;
  kitEdit: boolean;
  set: (partial: Partial<LathState>) => void;
};

export const useLath = create<LathState>((set) => ({
  project: factoryProject(),
  pos: [0, 0, 0, 0, 0, 0],
  running: false,
  ext: false,
  connected: false,
  status: "Preview plays here. Connect the card when you have one.",
  selT: 0,
  selS: 0,
  octave: 2,
  hardwareClock: false,
  hold: 0,
  kitEdit: false,
  set: (partial) => set(partial),
}));

export function loadStored(): Project | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Project;
    if (!parsed?.steps || parsed.steps.length !== 8) return null;
    if (!parsed.inSend || parsed.inSend.length !== 2) {
      const full = parsed.inputsToFx ? 96 : 0;
      parsed.inSend = [
        { d: full, r: full },
        { d: full, r: full },
      ];
    }
    return normalize(parsed);
  } catch {
    return null;
  }
}

export function persist(project: Project) {
  try {
    localStorage.setItem(KEY, JSON.stringify(project));
  } catch {
    /* private mode */
  }
}

function legacyScene(project: Project): Scene {
  return {
    voice: project.voice,
    mix: project.mix,
    master: project.master ?? 104,
    delay: project.delay,
    room: project.room,
    drive: project.drive ?? 0,
    inSend: project.inSend,
  };
}

export function normalize(project: Project): Project {
  if (!project.scenes || project.scenes.length !== 3) {
    const a = legacyScene(project);
    project.scenes = [structuredClone(a), structuredClone(a), structuredClone(a)];
  }
  if (project.scene == null) project.scene = 0;
  if (project.morph == null) project.morph = 0;
  if (project.knobX == null) project.knobX = 0;
  if (project.knobY == null) project.knobY = 2;
  if (!project.song?.length) project.song = [0, 1, 2];
  if (project.songAt == null) project.songAt = 0;
  if (project.pending == null) project.pending = -1;
  for (const row of project.trackLen) {
    for (let t = 0; t < row.length; t++) row[t] = clamp(row[t], 1, 32);
  }
  for (const scene of project.scenes) {
    for (const v of scene.voice) {
      if (v.sendD == null) v.sendD = 0;
      if (v.sendR == null) v.sendR = 0;
      if (v.pa == null) v.pa = 0;
      if (v.pb == null) v.pb = 0;
    }
  }
  for (const v of project.voice || []) {
    if (v.pa == null) v.pa = 0;
    if (v.pb == null) v.pb = 0;
  }
  if (!project.stepPar || project.stepPar.length !== 8) project.stepPar = emptyDrumLocks();
  if (!project.fxPar || project.fxPar.length !== 8) project.fxPar = emptyFxLocks();
  for (let p = 0; p < 8; p++) {
    if (!project.stepPar[p] || project.stepPar[p].length !== 4) project.stepPar[p] = emptyDrumLocks()[p];
    for (let t = 0; t < 4; t++) {
      if (!project.stepPar[p][t] || project.stepPar[p][t].length < 32) project.stepPar[p][t] = emptyDrumLocks()[p][t];
      for (let s = 0; s < 32; s++) {
        const row = project.stepPar[p][t][s];
        if (!row || row.length !== 10) project.stepPar[p][t][s] = Array.from({ length: 10 }, () => null);
        else for (let k = 0; k < 10; k++) if (row[k] == null || row[k]! < 0) row[k] = null;
      }
    }
    if (!project.fxPar[p] || project.fxPar[p].length < 32) project.fxPar[p] = emptyFxLocks()[p];
    for (let s = 0; s < 32; s++) {
      const row = project.fxPar[p][s];
      if (!row || row.length !== 7) project.fxPar[p][s] = Array.from({ length: 7 }, () => null);
      else for (let k = 0; k < 7; k++) if (row[k] == null || row[k]! < 0) row[k] = null;
    }
  }
  if (!project.returns) {
    for (const scene of project.scenes) {
      const empty = scene.voice.every((v) => !v.sendD && !v.sendR);
      if (empty) {
        const d = scene.delay.mix;
        const r = scene.room.mix;
        for (const v of scene.voice) {
          v.sendD = d;
          v.sendR = r;
        }
        scene.delay.mix = 100;
        scene.room.mix = 100;
      }
    }
    project.returns = 1;
  }
  if (!project.locksFull) {
    for (const pat of project.stepPar) {
      for (const tr of pat) {
        for (const row of tr) {
          for (let i = 0; i < row.length; i++) if (row[i] != null) row[i] = drumFromNib(i, row[i] as number);
        }
      }
    }
    for (const pat of project.fxPar) {
      for (const row of pat) {
        for (let i = 0; i < row.length; i++) if (row[i] != null) row[i] = fxFromNib(i, row[i] as number);
      }
    }
    project.locksFull = 1;
  }
  return project;
}
