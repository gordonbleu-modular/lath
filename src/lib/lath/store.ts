import { create } from "zustand";
import { factoryProject } from "./factory";
import type { Project, Scene } from "./types";
import { clamp } from "./types";

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
  return project;
}
