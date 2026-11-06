// Browser stand-in for the LATH card. Same tracks, same step commands.
// The Workshop Computer itself runs integer versions of these voices.

function createEngine(sr) {
  const delayLen = Math.floor(sr);
  const delay = new Float32Array(delayLen);
  let delayW = 0;
  const combLen = [0.031, 0.037, 0.041, 0.047].map((t) => Math.floor(sr * t));
  const comb = combLen.map((n) => new Float32Array(n));
  const combI = [0, 0, 0, 0];
  const combLp = [0, 0, 0, 0];
  const apLen = [Math.floor(sr * 0.005), Math.floor(sr * 0.0017)];
  const ap = apLen.map((n) => new Float32Array(n));
  const apI = [0, 0];

  const vox = [0, 1, 2, 3].map(() => ({
    env: 0,
    coef: 0,
    phase: 0,
    mod: 0,
    freq: 100,
    target: 100,
    click: 0,
    tone: 0.4,
    aux: 0.5,
    model: 0,
    sendD: 0,
    sendB: 0,
    crush: 0,
    hold: 0,
    holdN: 0,
    held: 0,
    ks: new Float32Array(1024),
    ksLen: 32,
    ksPos: 0,
    ksLast: 0,
    lp: 0,
  }));

  const cv = [0, 1].map(() => ({
    phase: 0,
    freq: 110,
    env: 0,
    gate: 0,
    vel: 0.8,
  }));

  let project = null;
  let running = false;
  let pos = [0, 0, 0, 0, 0, 0];
  let master = 0;
  let acc = 0;
  let stepLen = Math.floor(sr / 8);
  let monitor = 1;
  let ext = false;
  const pending = [];
  const retrigLeft = [0, 0, 0, 0, 0, 0];
  const retrigEvery = [0, 0, 0, 0, 0, 0];
  const retrigAt = [0, 0, 0, 0, 0, 0];
  let rng = 0x12345678;

  function noise() {
    rng ^= rng << 13;
    rng ^= rng >> 17;
    rng ^= rng << 5;
    return ((rng >>> 0) / 4294967296) * 2 - 1;
  }
  function hz(n) {
    return 440 * 2 ** ((n - 69) / 12);
  }
  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function recompute() {
    if (!project) return;
    const base = (sr * 60) / project.bpm / 4;
    const swing = (project.swing - 64) / 128;
    const delta = base * swing;
    const even = (master & 1) === 0;
    stepLen = Math.max(64, Math.floor(even ? base + delta : base - delta));
  }

  function triggerDrum(t, note, vel, len, fx, fxv) {
    const voice = project.voice[t];
    const v = vox[t];
    let tone = voice.tone / 127;
    let sendD = 0;
    let sendB = 0;
    let crush = 0;
    if (fx === 2) sendD = fxv / 127;
    if (fx === 3) sendB = fxv / 127;
    if (fx === 4) crush = fxv / 127;
    if (fx === 7) tone = fxv / 127;
    let n = note + (voice.pitch - 24);
    if (fx === 5) n += fxv - 24;
    n = clamp(n | 0, 1, 127);
    const f = hz(n);
    v.env = vel / 127;
    const decay = len > 0 ? (voice.decay / 127) * (len / 32) : voice.decay / 127;
    const seconds = 0.045 + decay * 0.85;
    v.coef = Math.exp(-1 / (seconds * sr));
    v.tone = tone;
    v.aux = voice.aux / 127;
    v.model = voice.model & 3;
    v.sendD = sendD;
    v.sendB = sendB;
    v.crush = crush;
    v.holdN = 0;
    v.click = 1;
    v.target = t === 1 ? f * 7 : f;
    if (t === 0) v.freq = f * (3.2 + tone * 4);
    else if (t === 3 && v.model === 2) v.freq = f * 0.25;
    else if (t === 3 && v.model === 3) v.freq = f * 2.6;
    else v.freq = v.target;
    v.phase = Math.random() * 6.28;
    v.mod = Math.random() * 6.28;
    if (t === 2) {
      v.ksLen = clamp(Math.floor(sr / Math.max(40, f)), 12, 1000);
      v.ksPos = 0;
      v.ksLast = 0;
      for (let i = 0; i < v.ksLen; i++) v.ks[i] = noise() * 0.2;
      v.ks[0] = 0.85;
    }
  }

  function triggerCv(ch, note, vel, len) {
    const o = cv[ch];
    let n = clamp(note | 0, 1, 127);
    o.freq = hz(n);
    o.vel = vel / 127;
    o.env = 1;
    const frac = (len > 0 ? len : 24) / 32;
    o.gate = Math.max(64, Math.floor(stepLen * frac * (vel / 127)));
  }

  function fire(t, step, fromRetrig) {
    const L = project.trackLen[project.pattern][t] || 16;
    if (step < 0 || step >= L) return;
    if (project.mute[t]) return;
    const cell = project.steps[project.pattern][t][step];
    if (!cell || !cell.n || !cell.v) {
      if (t >= 4) cv[t - 4].gate = 0;
      return;
    }
    if (!fromRetrig && cell.f === 6) {
      if ((Math.abs(noise()) * 127) > cell.a) return;
    }
    if (!fromRetrig && cell.f === 8) {
      if (t < 4) vox[t].env = 0;
      else cv[t - 4].gate = 0;
      return;
    }
    if (t < 4) triggerDrum(t, cell.n, cell.v, cell.l, fromRetrig ? 0 : cell.f, cell.a);
    else triggerCv(t - 4, !fromRetrig && cell.f === 5 ? cell.n + cell.a - 24 : cell.n, cell.v, cell.l);
    if (!fromRetrig && cell.f === 1) {
      const times = Math.max(2, Math.min(8, cell.a || 2));
      retrigLeft[t] = times - 1;
      retrigEvery[t] = Math.max(32, Math.floor(stepLen / times));
      retrigAt[t] = retrigEvery[t];
    } else if (!fromRetrig) {
      retrigLeft[t] = 0;
    }
  }

  function advance() {
    acc = 0;
    master++;
    recompute();
    if (project.pending >= 0 && project.song && project.song.length) {
      const pat = project.pattern;
      let longest = 1;
      for (let t = 0; t < 6; t++) longest = Math.max(longest, project.trackLen[pat][t] || 16);
      let atEnd = true;
      for (let t = 0; t < 6; t++) {
        const L = project.trackLen[pat][t] || 16;
        if (L === longest && pos[t] + 1 < L) atEnd = false;
      }
      if (atEnd) {
        const at = project.pending % project.song.length;
        project.songAt = at;
        project.pattern = project.song[at] & 7;
        project.pending = -1;
        pos = [0, 0, 0, 0, 0, 0];
        recompute();
        for (let t = 0; t < 6; t++) fire(t, 0, false);
        songEvent = { pattern: project.pattern, songAt: at };
        return;
      }
    }
    const pat = project.pattern;
    for (let t = 0; t < 6; t++) {
      const L = project.trackLen[pat][t] || 16;
      pos[t] = (pos[t] + 1) % L;
      retrigLeft[t] = 0;
      fire(t, pos[t], false);
    }
  }

  function serviceRetrig() {
    for (let t = 0; t < 6; t++) {
      if (retrigLeft[t] > 0 && acc >= retrigAt[t]) {
        retrigLeft[t]--;
        retrigAt[t] += retrigEvery[t];
        fire(t, pos[t], true);
      }
    }
  }

  function renderVoice(t) {
    const v = vox[t];
    if (v.env < 0.0008) {
      v.env = 0;
      return 0;
    }
    let s = 0;
    if (t === 0) {
      v.freq += (v.target - v.freq) * 0.0022;
      const ratio = 0.45 + v.tone * 1.5;
      v.mod += (2 * Math.PI * v.freq * ratio) / sr;
      const mod = Math.sin(v.mod);
      const index = v.env * (0.4 + v.tone * 7);
      v.phase += (2 * Math.PI * (v.freq + mod * v.freq * index)) / sr;
      s = Math.sin(v.phase);
      s = Math.tanh(s * (1.1 + v.tone * 1.4));
      const click = noise() * v.click * v.aux;
      v.click *= 0.92;
      s = s + click * 0.85;
    } else if (t === 1) {
      const ratios = [1, 1.47, 1.71, 2.49];
      let metal = 0;
      for (let k = 0; k < 4; k++) {
        v.phase += (2 * Math.PI * v.target * ratios[k]) / sr;
        if (k === 0) v.mod = v.phase;
        metal += (Math.sin(v.phase * (k + 1) + v.mod) > 0 ? 1 : -1) * 0.25;
      }
      // cheap inharmonic squares from the phase accumulators
      metal = 0;
      let ph = v.mod;
      for (let k = 0; k < 4; k++) {
        ph += (2 * Math.PI * v.target * ratios[k]) / sr;
        metal += (ph % (2 * Math.PI)) > Math.PI ? 0.22 : -0.22;
      }
      const nz = noise();
      let x = metal * (1 - v.aux) + nz * v.aux;
      v.lp += (x - v.lp) * 0.35;
      s = x - v.lp;
    } else if (t === 2) {
      const a = v.ks[v.ksPos];
      let avg = (a + v.ksLast) * 0.5;
      avg *= 0.86 + v.tone * 0.13;
      v.ks[v.ksPos] = avg;
      v.ksLast = a;
      v.ksPos++;
      if (v.ksPos >= v.ksLen) v.ksPos = 0;
      v.phase += (2 * Math.PI * v.target) / sr;
      const head = Math.sin(v.phase) * 0.35;
      const nz = noise();
      v.lp += (nz - v.lp) * 0.55;
      const hp = nz - v.lp;
      v.click *= 0.997 + v.aux * 0.00293;
      s = head + avg * 1.15 + hp * v.click * v.aux * 1.7;
    } else {
      const model = v.model;
      if (model === 0) {
        v.freq += (v.target - v.freq) * 0.0012;
        v.mod += (2 * Math.PI * v.freq * 2.73) / sr;
        const mod = Math.sin(v.mod);
        const index = v.env * (2.4 + v.tone * 6);
        v.phase += (2 * Math.PI * (v.freq + mod * v.freq * index * 0.22)) / sr;
        const partial = Math.sin(v.phase * 5.31);
        s = Math.tanh((Math.sin(v.phase) * 0.78 + partial * 0.28) * (1.2 + v.aux));
      } else if (model === 1) {
        v.phase += (2 * Math.PI * v.target * 0.5) / sr;
        const knock = noise() * v.click;
        v.click *= 0.72;
        const x = Math.sin(v.phase) * 0.55 + knock * 0.9;
        v.lp += (x - v.lp) * 0.16;
        s = v.lp;
      } else {
        const glide = model === 2 ? 0.004 : 0.0012;
        v.freq += (v.target - v.freq) * glide;
        const ratio = model === 3 ? 0.75 : 1.2;
        v.mod += (2 * Math.PI * v.freq * ratio) / sr;
        const mod = Math.sin(v.mod);
        const index = v.env * (1.2 + v.tone * 4);
        v.phase += (2 * Math.PI * (v.freq + mod * v.freq * index * 0.35)) / sr;
        s = Math.tanh(Math.sin(v.phase) * (1 + v.aux));
      }
    }
    if (v.crush > 0.05) {
      const n = 1 + ((v.crush * 14) | 0);
      if (v.holdN <= 0) {
        const steps = 2 + ((v.crush * 10) | 0);
        const q = steps / 2;
        v.held = Math.round(s * q) / q;
        v.holdN = n;
      }
      v.holdN--;
      s = v.held;
    }
    s *= v.env;
    v.env *= v.coef;
    return s;
  }

  let songEvent = null;

  function lerp(a, b, t) {
    return a + ((b - a) * t) / 127;
  }

  function blendPair(a, b, t) {
    return {
      voice: a.voice.map((v, i) => ({
        decay: lerp(v.decay, b.voice[i].decay, t),
        tone: lerp(v.tone, b.voice[i].tone, t),
        model: t < 64 ? v.model : b.voice[i].model,
        pitch: lerp(v.pitch, b.voice[i].pitch, t),
        aux: lerp(v.aux, b.voice[i].aux, t),
        sendD: lerp(v.sendD || 0, b.voice[i].sendD || 0, t),
        sendR: lerp(v.sendR || 0, b.voice[i].sendR || 0, t),
      })),
      mix: a.mix.map((c, i) => ({
        level: lerp(c.level, b.mix[i].level, t),
        pan: lerp(c.pan, b.mix[i].pan, t),
      })),
      master: lerp(a.master, b.master, t),
      delay: {
        time: t < 64 ? a.delay.time : b.delay.time,
        fb: lerp(a.delay.fb, b.delay.fb, t),
        mix: lerp(a.delay.mix, b.delay.mix, t),
      },
      room: {
        size: lerp(a.room.size, b.room.size, t),
        damp: lerp(a.room.damp, b.room.damp, t),
        mix: lerp(a.room.mix, b.room.mix, t),
      },
      drive: lerp(a.drive, b.drive, t),
      inSend: a.inSend.map((s, i) => ({
        d: lerp(s.d, b.inSend[i].d, t),
        r: lerp(s.r, b.inSend[i].r, t),
      })),
    };
  }

  function morphAll(scenes, morph) {
    const m = Math.max(0, Math.min(127, morph | 0));
    if (m <= 64) return blendPair(scenes[0], scenes[1], Math.round((m * 127) / 64));
    return blendPair(scenes[1], scenes[2], Math.round(((m - 64) * 127) / 63));
  }

  function renderOne() {
    if (!project) return [0, 0];
    if (pending.length) {
      const a = pending.shift();
      if (a.t < 4) triggerDrum(a.t, a.n, a.v, a.l, a.f, a.a);
      else triggerCv(a.t - 4, a.n, a.v, a.l);
    }
    if (running && !ext) {
      acc++;
      if (acc >= stepLen) advance();
      else serviceRetrig();
    }
    let drumL = 0;
    let drumR = 0;
    let bus = 0;
    let extraD = 0;
    let extraB = 0;
    for (let t = 0; t < 4; t++) {
      let s = renderVoice(t);
      const level = project.mix[t].level / 127;
      const pan = project.mix[t].pan / 127;
      s *= level;
      drumL += s * (1 - pan);
      drumR += s * pan;
      bus += s * 0.5;
      extraD += s * vox[t].sendD;
      extraB += s * vox[t].sendB;
      const vs = project.voice[t] || {};
      extraD += s * ((vs.sendD || 0) / 127);
      extraB += s * ((vs.sendR || 0) / 127);
    }
    // Stand-in oscillators so the CV tracks are audible without the modular.
    let cvL = 0;
    let cvR = 0;
    for (let ch = 0; ch < 2; ch++) {
      const o = cv[ch];
      if (o.gate > 0) {
        o.gate--;
        o.env += (1 - o.env) * 0.2;
      } else {
        o.env *= 0.995;
      }
      o.phase += (2 * Math.PI * o.freq) / sr;
      let saw = (o.phase % (2 * Math.PI)) / Math.PI - 1;
      saw = Math.tanh(saw * (1.2 + o.vel * 2));
      const amp = saw * o.env * o.vel * 0.45;
      const pan = project.mix[4 + ch].pan / 127;
      const level = project.mix[4 + ch].level / 127;
      const sig = amp * level;
      const send = (project.inSend && project.inSend[ch]) || { d: 0, r: 0 };
      cvL += sig * (1 - pan);
      cvR += sig * pan;
      extraD += sig * (send.d / 127);
      extraB += sig * (send.r / 127);
    }
    let dryL = drumL;
    let dryR = drumR;
    const drv = project.drive / 127;
    if (drv > 0) {
      const k = 1 + drv * 6;
      const norm = Math.tanh(k);
      dryL = Math.tanh(dryL * k) / norm;
      dryR = Math.tanh(dryR * k) / norm;
      bus = Math.tanh(bus * k) / norm;
    }
    dryL += cvL;
    dryR += cvR;
    const divs = [1, 2, 3, 4, 6, 8, 12, 16];
    const base = (sr * 60) / project.bpm / 4;
    let age = Math.floor(base * divs[project.delay.time & 7]);
    age = clamp(age, 32, delayLen - 2);
    let r = delayW - age;
    if (r < 0) r += delayLen;
    const wet = delay[r | 0];
    const fb = (project.delay.fb / 127) * 0.82;
    const din = bus * (project.delay.mix / 127) + extraD;
    let rec = din + wet * fb;
    rec = Math.tanh(rec);
    delay[delayW] = rec;
    delayW++;
    if (delayW >= delayLen) delayW = 0;
    let r2 = r - Math.floor(sr * 0.013);
    if (r2 < 0) r2 += delayLen;
    const wetR = delay[r2 | 0];

    const size = 0.45 + (project.room.size / 127) * 0.7;
    const damp = 0.2 + (project.room.damp / 127) * 0.7;
    const rin = (bus * (project.room.mix / 127) + extraB) * 0.4;
    let tank = 0;
    for (let c = 0; c < 4; c++) {
      const len = Math.max(32, Math.floor(combLen[c] * size));
      const idx = combI[c] % len;
      const y = comb[c][idx];
      combLp[c] += (y - combLp[c]) * damp;
      const fbC = 0.55 + (project.room.size / 127) * 0.3;
      comb[c][idx] = rin + combLp[c] * fbC;
      combI[c] = idx + 1;
      tank += y;
    }
    for (let a = 0; a < 2; a++) {
      const y = ap[a][apI[a]];
      ap[a][apI[a]] = tank + y * 0.5;
      tank = y - tank * 0.5;
      apI[a]++;
      if (apI[a] >= apLen[a]) apI[a] = 0;
    }
    const master = (project.master / 127) * 0.85 * monitor;
    let L = (dryL + wet * 0.55 + tank * 0.18) * master;
    let R = (dryR + wetR * 0.55 + tank * 0.18) * master;
    if (L > 1) L = 1;
    if (L < -1) L = -1;
    if (R > 1) R = 1;
    if (R < -1) R = -1;
    return [L, R];
  }

  return {
    setProject(p) {
      if (p && p.scenes && p.scenes.length === 3) {
        project = Object.assign({}, p, morphAll(p.scenes, p.morph | 0));
      } else project = p;
      recompute();
    },
    setRunning(r) {
      const edge = r && !running;
      running = r;
      if (edge && acc === 0 && project) {
        recompute();
        for (let t = 0; t < 6; t++) fire(t, pos[t], false);
      }
    },
    setExt(v) {
      ext = v;
    },
    setMonitor(v) {
      monitor = v ? 1 : 0;
    },
    rewind() {
      pos = [0, 0, 0, 0, 0, 0];
      master = 0;
      acc = 0;
      if (running && project) {
        recompute();
        for (let t = 0; t < 6; t++) fire(t, 0, false);
      }
    },
    audition(t, n, v, l, f, a) {
      pending.push({ t, n, v, l, f, a });
    },
    positions() {
      return pos.slice();
    },
    render(left, right) {
      for (let i = 0; i < left.length; i++) {
        const s = renderOne();
        left[i] = s[0];
        right[i] = s[1];
      }
      return pos;
    },
    takeSong() {
      const ev = songEvent;
      songEvent = null;
      return ev;
    },
  };
}

if (typeof registerProcessor === "function") {
  class LathWorklet extends AudioWorkletProcessor {
    constructor() {
      super();
      this.eng = createEngine(sampleRate);
      this.last = "";
      this.port.onmessage = (e) => {
        const m = e.data;
        if (!m) return;
        if (m.type === "project") this.eng.setProject(m.project);
        else if (m.type === "run") this.eng.setRunning(!!m.value);
        else if (m.type === "ext") this.eng.setExt(!!m.value);
        else if (m.type === "monitor") this.eng.setMonitor(!!m.value);
        else if (m.type === "rewind") this.eng.rewind();
        else if (m.type === "audition") this.eng.audition(m.t, m.n, m.v, m.l, m.f, m.a);
      };
    }
    process(_in, outputs) {
      const chs = outputs[0];
      if (!chs || !chs[0]) return true;
      const pos = this.eng.render(chs[0], chs[1] || chs[0]);
      const song = this.eng.takeSong();
      if (song) this.port.postMessage({ type: "song", pattern: song.pattern, songAt: song.songAt });
      const key = pos.join(",");
      if (key !== this.last) {
        this.last = key;
        this.port.postMessage({ type: "head", pos });
      }
      return true;
    }
  }
  registerProcessor("lath", LathWorklet);
}
