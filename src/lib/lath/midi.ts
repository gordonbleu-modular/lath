import { CMD, drumToNib, fxFromNib, fxToNib, drumFromNib } from "./types";
import type { Project, Scene, Step } from "./types";
import { persist, useLath } from "./store";
import { engineMonitor, engineRun, pushProject } from "./audio";

type MidiOut = MIDIOutput;
type MidiIn = MIDIInput;

let output: MidiOut | null = null;
let input: MidiIn | null = null;
let access: MIDIAccess | null = null;
let applying = false;

function send(bytes: number[]) {
  if (!output) return;
  const msg = [0xf0, 0x7d, ...bytes, 0xf7];
  output.send(msg);
}

export function midiConnected() {
  return !!output;
}

export function sendStep(pat: number, tr: number, st: number, cell: Step) {
  send([CMD.step, pat, tr, st, cell.n & 127, cell.v & 127, cell.l & 63, cell.f & 15, cell.a & 127]);
}

export function sendTempo(bpm: number) {
  send([CMD.tempo, bpm & 127, (bpm >> 7) & 127]);
}

export function sendSwing(swing: number) {
  send([CMD.swing, swing & 127]);
}

export function sendPattern(pat: number) {
  send([CMD.pattern, pat & 7]);
}

export function sendLength(tr: number, len: number) {
  send([CMD.trackLen, tr, len & 127]);
}

export function sendVoice(i: number, v: Project["voice"][number]) {
  send([CMD.voice, i, v.decay, v.tone, v.model, v.pitch, v.aux]);
}

export function sendMix(i: number, level: number, pan: number) {
  send([CMD.mix, i, level & 127, pan & 127]);
}

export function sendMaster(level: number) {
  send([CMD.mix, 6, level & 127, 0]);
}

export function sendDelay(time: number, fb: number, mix: number) {
  send([CMD.fx, 0, time & 7, fb & 127, mix & 127]);
}

export function sendRoom(size: number, damp: number, mix: number) {
  send([CMD.fx, 1, size & 127, damp & 127, mix & 127]);
}

export function sendDrive(drive: number) {
  send([CMD.fx, 2, drive & 127, 0, 0]);
}

export function sendInputsFx(on: boolean) {
  send([CMD.fx, 3, on ? 1 : 0, 0, 0]);
}

export function sendInSend(ch: number, delay: number, room: number) {
  send([CMD.fx, 4, ch & 1, delay & 127, room & 127]);
}

function sceneBytes(scene: Scene): number[] {
  const bytes: number[] = [];
  for (const v of scene.voice) bytes.push(v.decay & 127, v.tone & 127, v.model & 3, v.pitch & 127, v.aux & 127);
  for (const c of scene.mix) bytes.push(c.level & 127, c.pan & 127);
  bytes.push(scene.master & 127, scene.delay.time & 7, scene.delay.fb & 127, scene.delay.mix & 127);
  bytes.push(scene.room.size & 127, scene.room.damp & 127, scene.room.mix & 127, scene.drive & 127);
  for (const s of scene.inSend) bytes.push(s.d & 127, s.r & 127);
  for (const v of scene.voice) bytes.push((v.sendD || 0) & 127, (v.sendR || 0) & 127);
  for (const v of scene.voice) bytes.push((v.pa || 0) & 127, (v.pb || 0) & 127);
  return bytes;
}

export function sendScene(bank: number, scene: Scene) {
  send([CMD.scene, bank & 3, ...sceneBytes(scene)]);
}

export function sendPerform(project: Project) {
  const song = project.song.slice(0, 16);
  while (song.length < 16) song.push(0);
  send([
    CMD.perform,
    project.knobX & 15,
    project.knobY & 15,
    Math.max(1, Math.min(16, project.song.length)),
    Math.max(0, Math.min(15, project.songAt)),
    useLath.getState().ext ? 1 : 0,
    ...song.map((n) => n & 7),
  ]);
}

export function sendQueue() {
  send([CMD.queue]);
}

function readScene(d: number[], i: number): { scene: Scene; next: number } {
  const voice = [];
  for (let v = 0; v < 4; v++) {
    voice.push({
      decay: d[i++],
      tone: d[i++],
      model: d[i++] & 3,
      pitch: d[i++],
      aux: d[i++],
      sendD: 0,
      sendR: 0,
      pa: 0,
      pb: 0,
    });
  }
  const mix = [];
  for (let c = 0; c < 6; c++) mix.push({ level: d[i++], pan: d[i++] });
  const scene: Scene = {
    voice,
    mix,
    master: d[i++],
    delay: { time: d[i++] & 7, fb: d[i++], mix: d[i++] },
    room: { size: d[i++], damp: d[i++], mix: d[i++] },
    drive: d[i++],
    inSend: [
      { d: d[i++], r: d[i++] },
      { d: d[i++], r: d[i++] },
    ],
  };
  for (let v = 0; v < 4; v++) {
    voice[v].sendD = i < d.length ? d[i++] : 0;
    voice[v].sendR = i < d.length ? d[i++] : 0;
  }
  for (let v = 0; v < 4; v++) {
    voice[v].pa = i < d.length ? d[i++] : 0;
    voice[v].pb = i < d.length ? d[i++] : 0;
  }
  return { scene, next: i };
}

export function sendMute(tr: number, on: boolean) {
  send([CMD.mute, tr, on ? 1 : 0]);
}

export function sendTransport(running: boolean, ext: boolean) {
  send([CMD.transport, running ? 1 : 0, ext ? 1 : 0]);
}

export function sendRewind() {
  send([CMD.rewind]);
}

export function sendClear(pat: number, tr: number) {
  send([CMD.clearTrack, pat, tr]);
}

export function sendCopy(dst: number, src: number) {
  send([CMD.copyPattern, dst, src]);
}

export function sendDrumLock(pat: number, tr: number, step: number, row: (number | null)[]) {
  let lo = 0;
  let hi = 0;
  const nibs: number[] = [];
  for (let i = 0; i < 10; i++) {
    const n = row[i];
    if (n == null) nibs.push(0);
    else {
      if (i < 7) lo |= 1 << i;
      else hi |= 1 << (i - 7);
      nibs.push(drumToNib(i, n));
    }
  }
  send([CMD.lock, pat & 7, tr & 3, step & 31, lo & 127, hi & 7, ...nibs]);
}

export function sendFxLock(pat: number, step: number, row: (number | null)[]) {
  let mask = 0;
  const nibs: number[] = [];
  for (let i = 0; i < 7; i++) {
    const n = row[i];
    if (n == null) nibs.push(0);
    else {
      mask |= 1 << i;
      nibs.push(fxToNib(i, n));
    }
  }
  send([CMD.lock, pat & 7, 0x40, step & 31, mask & 127, ...nibs]);
}

export function sendSave() {
  send([CMD.save]);
}

export function sendAudition(tr: number, cell: Step) {
  send([CMD.trig, tr, cell.n, cell.v, cell.l, cell.f, cell.a]);
}

function applyRemote(project: Project) {
  applying = true;
  useLath.setState({ project });
  persist(project);
  pushProject(project);
  applying = false;
}

export function isApplyingRemote() {
  return applying;
}

let sysexOpen = false;
const sysexBytes: number[] = [];

function onMidi(data: Uint8Array) {
  for (const b of data) {
    if (b === 0xf0) {
      sysexOpen = true;
      sysexBytes.length = 0;
      continue;
    }
    if (!sysexOpen) continue;
    if (b === 0xf7) {
      sysexOpen = false;
      if (sysexBytes[0] === 0x7d) handle(sysexBytes.slice(1));
      sysexBytes.length = 0;
    } else if (sysexBytes.length < 96) {
      sysexBytes.push(b);
    }
  }
}

function handle(d: number[]) {
  if (!d.length) return;
  const s = useLath.getState();
  const project = structuredClone(s.project);
  if (d[0] === CMD.helloAck) {
    useLath.setState({ status: `Card firmware ${d[2]}.${d[3]}.${d[4]}` });
    return;
  }
  if (d[0] === CMD.globals && d.length >= 60) {
    let i = 1;
    project.bpm = d[i++] | (d[i++] << 7);
    project.swing = d[i++];
    project.pattern = d[i++] & 7;
    const running = !!d[i++];
    i++; // panel owns
    i++; // switch
    for (let t = 0; t < 6; t++) project.trackLen[project.pattern][t] = clampLen(d[i++]);
    for (let t = 0; t < 6; t++) project.mute[t] = d[i++] ? 1 : 0;
    for (let v = 0; v < 4; v++) {
      project.voice[v] = {
        decay: d[i++],
        tone: d[i++],
        model: d[i++] & 3,
        pitch: d[i++],
        aux: d[i++],
        sendD: project.voice[v]?.sendD || 0,
        sendR: project.voice[v]?.sendR || 0,
        pa: project.voice[v]?.pa || 0,
        pb: project.voice[v]?.pb || 0,
      };
    }
    for (let c = 0; c < 6; c++) project.mix[c] = { level: d[i++], pan: d[i++] };
    project.master = d[i++];
    project.delay = { time: d[i++] & 7, fb: d[i++], mix: d[i++] };
    project.room = { size: d[i++], damp: d[i++], mix: d[i++] };
    project.drive = d[i++];
    project.inputsToFx = d[i++] ? 1 : 0;
    if (d.length >= i + 4) {
      project.inSend = [
        { d: d[i++], r: d[i++] },
        { d: d[i++], r: d[i++] },
      ];
    }
    applyRemote(project);
    useLath.setState({ running, status: running ? "Card is playing" : "Card connected" });
    return;
  }
  if (d[0] === CMD.scene && d.length >= 46) {
    const bank = d[1] & 3;
    if (bank > 2) return;
    const { scene } = readScene(d, 2);
    if (!project.scenes || project.scenes.length !== 3) return;
    project.scenes[bank] = scene;
    if (project.scene === bank) {
      project.voice = scene.voice;
      project.mix = scene.mix;
      project.master = scene.master;
      project.delay = scene.delay;
      project.room = scene.room;
      project.drive = scene.drive;
      project.inSend = scene.inSend;
    }
    applyRemote(project);
    return;
  }
  if (d[0] === CMD.perform && d.length >= 22) {
    project.knobX = d[1] & 15;
    project.knobY = d[2] & 15;
    const len = Math.max(1, Math.min(16, d[3]));
    project.songAt = Math.min(len - 1, d[4]);
    const song = [];
    for (let s = 0; s < len; s++) song.push(d[6 + s] & 7);
    project.song = song;
    applyRemote(project);
    useLath.setState({ ext: !!d[5] });
    return;
  }
  if (d[0] === CMD.lengths && d.length >= 49) {
    let i = 1;
    for (let p = 0; p < 8; p++) for (let t = 0; t < 6; t++) project.trackLen[p][t] = clampLen(d[i++]);
    applyRemote(project);
    return;
  }
  if (d[0] === CMD.chunk && d.length >= 5) {
    const pat = d[1] & 7;
    const tr = d[2];
    const start = d[3];
    const count = d[4];
    let i = 5;
    if (tr < 0 || tr > 5) return;
    for (let s = 0; s < count; s++) {
      const step = start + s;
      if (step > 63 || i + 5 > d.length) break;
      project.steps[pat][tr][step] = { n: d[i++], v: d[i++], l: d[i++], f: d[i++], a: d[i++] };
    }
    applyRemote(project);
    return;
  }
  if (d[0] === CMD.lock && d.length >= 6) {
    const pat = d[1] & 7;
    const tr = d[2];
    const step = d[3] & 31;
    if (!project.stepPar || !project.fxPar) return;
    if (tr === 0x40 && d.length >= 12) {
      const mask = d[4] & 127;
      for (let i = 0; i < 7; i++) project.fxPar[pat][step][i] = mask & (1 << i) ? fxFromNib(i, d[5 + i] & 15) : null;
      applyRemote(project);
      return;
    }
    if (tr < 4 && d.length >= 16) {
      const mask = (d[4] & 127) | ((d[5] & 7) << 7);
      for (let i = 0; i < 10; i++) project.stepPar[pat][tr][step][i] = mask & (1 << i) ? drumFromNib(i, d[6 + i] & 15) : null;
      applyRemote(project);
    }
    return;
  }
  if (d[0] === CMD.playhead && d.length >= 8) {
    useLath.setState({
      hardwareClock: true,
      running: !!d[1],
      pos: [d[2], d[3], d[4], d[5], d[6], d[7]],
    });
    return;
  }
  if (d[0] === CMD.panel && d.length >= 8) {
    if (Date.now() < useLath.getState().hold) return;
    project.bpm = d[1] | (d[2] << 7);
    project.swing = d[3];
    project.drive = d[4];
    project.pattern = d[5] & 7;
    if (d.length >= 9) project.morph = d[8] & 127;
    if (d.length >= 10) project.songAt = d[9] & 15;
    if (d.length >= 11) project.pending = d[10] === 127 ? -1 : d[10];
    applyRemote(project);
    const sw = d[6];
    const running = d.length >= 12 ? !!d[11] : sw !== 2;
    const label =
      sw === 0 ? "Down click · next pattern" : sw === 2 ? "Switch up · stopped" : "Switch middle · playing";
    useLath.setState({ status: label, running });
    return;
  }
  if (d[0] === CMD.saved) {
    useLath.setState({ status: "Saved on the card" });
  }
}

function clampLen(n: number) {
  if (n < 1) return 16;
  if (n > 32) return 32;
  return n;
}

async function bind(midi: MIDIAccess) {
  const inputs = [...midi.inputs.values()];
  const outputs = [...midi.outputs.values()];
  const foundIn = inputs.find((p) => /lath/i.test(p.name || ""));
  const foundOut = outputs.find((p) => /lath/i.test(p.name || ""));
  if (!foundIn || !foundOut) {
    if (output) detach("Cable unplugged. Speakers again.");
    return;
  }
  if (input === foundIn && output === foundOut) return;
  if (input) input.onmidimessage = null;
  input = foundIn;
  output = foundOut;
  input.onmidimessage = (event) => {
    if (event.data) onMidi(event.data);
  };
  useLath.setState({
    connected: true,
    hardwareClock: true,
    status: "Card connected. Pick LATH if the browser asks again.",
  });
  engineRun(false);
  engineMonitor(false);
  send([CMD.hello, 1]);
}

function detach(status: string) {
  if (input) input.onmidimessage = null;
  input = null;
  output = null;
  useLath.setState({ connected: false, hardwareClock: false, status });
  const running = useLath.getState().running;
  engineRun(running);
  engineMonitor(true);
}

export async function connectCard() {
  if (!navigator.requestMIDIAccess) {
    useLath.setState({ status: "This browser has no Web MIDI. Use Chrome on a computer." });
    return;
  }
  access = await navigator.requestMIDIAccess({ sysex: true });
  await bind(access);
  access.onstatechange = () => {
    if (access) void bind(access);
  };
  if (!output) {
    useLath.setState({
      status: "No LATH card yet. Power the Computer, use a data cable, then connect again.",
    });
  }
}
