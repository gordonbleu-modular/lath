import { useEffect, useState } from "react";
import { Minus, Play, Plus, RotateCcw, Save, Square, Usb } from "lucide-react";
import { connectCard, sendSave } from "../lib/lath/midi";
import {
  clearPattern,
  copyPattern,
  rewind,
  selectPattern,
  setBpm,
  setDelay,
  setDrive,
  setExt,
  setInSend,
  setKnob,
  setMaster,
  setMix,
  setMorph,
  setRoom,
  setScene,
  setSongStep,
  addSongStep,
  removeSongStep,
  queueNext,
  setSwing,
  setTrackLen,
  setVoice,
  setDrumLock,
  setFxLock,
  toggleMute,
  togglePlay,
  writeStep,
} from "../lib/lath/session";
import { loadStored, persist, useLath } from "../lib/lath/store";
import { pushProject, resumeAudio } from "../lib/lath/audio";
import { DELAY_TIMES, FX, KNOB_TARGETS, MODELS, TRACKS, drumFromNib, fxFromNib, noteName } from "../lib/lath/types";
import type { Step } from "../lib/lath/types";

const EMPTY: Step = { n: 0, v: 0, l: 0, f: 0, a: 0 };
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="slider">
      <span className="flex items-baseline justify-between gap-2">
        <span>{label}</span>
        <span className="text-fg">{value}</span>
      </span>
      <input type="range" min={min} max={max} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function LathTracker() {
  const project = useLath((s) => s.project);
  const pos = useLath((s) => s.pos);
  const running = useLath((s) => s.running);
  const connected = useLath((s) => s.connected);
  const status = useLath((s) => s.status);
  const selT = useLath((s) => s.selT);
  const selS = useLath((s) => s.selS);
  const octave = useLath((s) => s.octave);
  const ext = useLath((s) => s.ext);
  const kitEdit = useLath((s) => s.kitEdit);
  const pat = project.pattern;
  const cell = project.steps[pat][selT][selS];
  const lengths = project.trackLen[pat];
  const bank = project.scenes[project.scene] ?? project.scenes[0];

  useEffect(() => {
    const stored = loadStored();
    if (stored) {
      useLath.setState({ project: stored });
      pushProject(stored);
      persist(stored);
    } else {
      pushProject(useLath.getState().project);
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const s = useLath.getState();
      const move = (dt: number, ds: number) => {
        const L = s.project.trackLen[s.project.pattern][s.selT] || 16;
        useLath.setState({
          selT: Math.max(0, Math.min(5, s.selT + dt)),
          selS: (s.selS + ds + L) % L,
        });
      };
      if (event.code === "Space") {
        event.preventDefault();
        void togglePlay();
        return;
      }
      if (event.key === "ArrowRight") move(1, 0);
      else if (event.key === "ArrowLeft") move(-1, 0);
      else if (event.key === "ArrowDown") move(0, 1);
      else if (event.key === "ArrowUp") move(0, -1);
      else if (event.key === "Backspace" || event.key === "Delete") {
        writeStep(s.selT, s.selS, EMPTY);
      } else if (event.key === "," || event.key === ".") {
        useLath.setState({ octave: Math.max(0, Math.min(6, s.octave + (event.key === "." ? 1 : -1))) });
      } else {
        const note = keyToNote(event.key, s.octave);
        if (note) {
          event.preventDefault();
          const prev = s.project.steps[s.project.pattern][s.selT][s.selS];
          const next: Step = prev.n ? { ...prev, n: note } : { n: note, v: 104, l: 0, f: 0, a: 0 };
          writeStep(s.selT, s.selS, next, true);
          const L = s.project.trackLen[s.project.pattern][s.selT] || 16;
          useLath.setState({ selS: (s.selS + 1) % L });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const patchCell = (partial: Partial<Step>, audition = false) => {
    writeStep(selT, selS, { ...cell, ...partial }, audition);
  };

  return (
    <main className="shell bg-bg text-fg">
      <header className="bar">
        <h1 className="brand text-accent">LATH</h1>
        <span className={running ? "live on" : "live"} aria-hidden />
        <p className="status">{status}</p>
        <button className="btn btn-accent" onClick={() => void togglePlay()} aria-label={running ? "Stop" : "Play"}>
          {running ? <Square size={12} /> : <Play size={12} />}
          {running ? "Stop" : "Play"}
        </button>
        <button className="btn" onClick={() => void rewind()} aria-label="Back to the first step">
          <RotateCcw size={12} />
        </button>
        <Num label="Tempo" value={project.bpm} min={40} max={300} onChange={setBpm} />
        <Num label="Swing" value={project.swing} min={0} max={127} onChange={setSwing} />
        <button className="btn" onClick={() => void connectCard().catch(() => useLath.setState({ status: "MIDI permission was blocked." }))}>
          <Usb size={12} />
          {connected ? "On" : "Connect"}
        </button>
        <button
          className="btn"
          disabled={!connected}
          onClick={() => {
            sendSave();
            useLath.setState({ status: "Writing the card…" });
          }}
        >
          <Save size={12} />
          Save
        </button>
      </header>

      <div className="bar">
        <span className="hint">Pattern</span>
        {Array.from({ length: 8 }, (_, i) => (
          <button key={i} className={i === pat ? "btn btn-accent" : "btn"} onClick={() => selectPattern(i)}>
            {String.fromCharCode(65 + i)}
          </button>
        ))}
        <select
          aria-label="Copy to"
          className="copy"
          value=""
          onChange={(e) => {
            if (e.target.value) copyPattern(Number(e.target.value));
          }}
        >
          <option value="">Copy to…</option>
          {Array.from({ length: 8 }, (_, i) => (
            <option key={i} value={i}>
              {String.fromCharCode(65 + i)}
            </option>
          ))}
        </select>
        <button className="btn" onClick={() => clearPattern()} aria-label="Clear this pattern">
          Clear
        </button>
      </div>

      <div className="stage">
          <section className="seq">
            <div className="seq-body">
              <div className="seq-col" style={{ ["--rows" as string]: 32 }}>
                  <div className="row">
                    <div className="cell step-no">#</div>
                    {TRACKS.map((tr, i) => (
                      <div key={tr.id} className="cell th">
                        <button className="th-name" onClick={() => useLath.setState({ selT: i })}>
                          {tr.name}
                        </button>
                        <div className="th-tools">
                          <button className="icon-btn" aria-label={`Shorter ${tr.name}`} onClick={() => setTrackLen(i, lengths[i] - 1)}>
                            <Minus size={10} />
                          </button>
                          <span>{lengths[i]}</span>
                          <button className="icon-btn" aria-label={`Longer ${tr.name}`} onClick={() => setTrackLen(i, lengths[i] + 1)}>
                            <Plus size={10} />
                          </button>
                          <button
                            className={`icon-btn ${project.mute[i] ? "text-led" : ""}`}
                            aria-label={project.mute[i] ? `Unmute ${tr.name}` : `Mute ${tr.name}`}
                            onClick={() => toggleMute(i)}
                          >
                            {project.mute[i] ? "M" : "·"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {Array.from({ length: 32 }, (_, step) => {
                    return (
                      <div className="row" key={step}>
                        <div className="cell step-no">{String(step + 1).padStart(2, "0")}</div>
                        {TRACKS.map((_, tr) => {
                          const c = project.steps[pat][tr][step];
                          const dim = step >= lengths[tr];
                          const on = pos[tr] === step && running && !dim;
                          const sel = selT === tr && selS === step;
                          return (
                            <button
                              key={tr}
                              className={`cell ${dim ? "cell-dim" : ""} ${on ? "cell-on" : ""} ${sel ? "cell-sel" : ""}`}
                              onClick={() => {
                                useLath.setState({ selT: tr, selS: step });
                                void resumeAudio();
                              }}
                            >
                              <span>{noteName(c.n)}</span>
                              {c.n ? <span className="vel">{c.v}</span> : null}
                              {c.f ? (
                                <span className="fxmark">
                                  {FX[c.f]?.name} {c.a}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
            </div>
          </section>

          <div className="side">
          <aside className="edit">
            <div className="step-edit">
              <h2 className="text-sm text-accent">
                {TRACKS[selT].name} {String(selS + 1).padStart(2, "0")}
              </h2>
              <div className="notes" title={`Computer keys. Z is C${octave}. Comma and period move the octave.`}>
                {NOTES.map((name, i) => {
                  const n = (octave + 1) * 12 + i;
                  return (
                    <button key={name} className={cell.n === n ? "btn btn-accent" : "btn"} onClick={() => patchCell({ n, v: cell.v || 104 }, true)}>
                      {name}
                    </button>
                  );
                })}
                <button className="btn" onClick={() => useLath.setState({ octave: Math.max(0, octave - 1) })}>
                  −
                </button>
                <span className="hint self-center">C{octave}</span>
                <button className="btn" onClick={() => useLath.setState({ octave: Math.min(6, octave + 1) })}>
                  +
                </button>
                <button className="btn" onClick={() => patchCell(EMPTY)}>
                  Rest
                </button>
              </div>
              <div className="pair">
                <Slider label="Velocity" min={1} max={127} value={cell.v || 104} onChange={(v) => patchCell({ v, n: cell.n })} />
                <Slider label={selT < 4 ? "Length" : "Gate"} min={0} max={32} value={cell.l} onChange={(l) => patchCell({ l })} />
                <label className="slider">
                  Command
                  <select className="bg-surface text-fg" value={cell.f} onChange={(e) => patchCell({ f: Number(e.target.value) })}>
                    {FX.map((fx) => (
                      <option key={fx.id} value={fx.id}>
                        {fx.name === "—" ? "None" : `${fx.name} ${fx.hint.split(".")[0]}`}
                      </option>
                    ))}
                  </select>
                </label>
                <Slider label="Value" min={0} max={127} value={cell.a} onChange={(a) => patchCell({ a })} />
              </div>
            </div>
          </aside>

        <div className="desk-col">
          <div className="chans-wrap">
            <div className="kit-bar">
              <Banks scene={project.scene} />
              <button className={!kitEdit ? "btn btn-accent" : "btn"} onClick={() => useLath.setState({ kitEdit: false })}>
                Step
              </button>
              <button className={kitEdit ? "btn btn-accent" : "btn"} onClick={() => useLath.setState({ kitEdit: true })}>
                Kit
              </button>
              <span className="hint">
                {kitEdit
                  ? "Editing the preset. Steps with no gold ring follow it."
                  : `${TRACKS[selT].name} ${String(selS + 1).padStart(2, "0")} · double-click a knob to unlock`}
              </span>
            </div>
            <div className="chans">
            {TRACKS.slice(0, 4).map((tr, i) => (
              <Instrument key={tr.id} name={tr.name} i={i} hot={selT === i} />
            ))}
            {["In 1", "In 2"].map((label, i) => (
              <section key={label} className="chan jack">
                <h2>{label}</h2>
                <div className="chan-body">
                  <div className="mix-box">
                    <span className="box-label">Mix</span>
                    <div className="mix-controls">
                      <Fader label="Vol" min={0} max={127} value={bank.mix[4 + i].level} onChange={(v) => setMix(4 + i, "level", v)} />
                      <Knob pan label="Pan" min={0} max={127} value={bank.mix[4 + i].pan} onChange={(v) => setMix(4 + i, "pan", v)} />
                      <Knob label="Dly" min={0} max={127} value={bank.inSend[i].d} onChange={(v) => setInSend(i, "d", v)} />
                      <Knob label="Rm" min={0} max={127} value={bank.inSend[i].r} onChange={(v) => setInSend(i, "r", v)} />
                    </div>
                  </div>
                </div>
              </section>
            ))}
            <section className="chan master">
              <h2>Master</h2>
              <Fader label="Vol" min={0} max={127} value={bank.master} onChange={setMaster} />
            </section>
          </div>
          </div>
          <div className={`fx-groups ${kitEdit ? "" : "hot"}`}>
            <section className="fx-group">
              <h3>Delay {kitEdit ? "" : String(selS + 1).padStart(2, "0")}</h3>
              <FxTime />
              <div className="fx-knobs">
                <FxKnob index={1} label="Feedback" preset={bank.delay.fb} />
                <FxKnob index={2} label="Vol" preset={bank.delay.mix} />
              </div>
            </section>
            <section className="fx-group">
              <h3>Room</h3>
              <div className="fx-knobs">
                <FxKnob index={3} label={bank.room.size >= 124 ? "Freeze" : bank.room.size >= 96 ? "Hall" : "Size"} preset={bank.room.size} room />
                <FxKnob index={4} label="Damp" preset={bank.room.damp} />
                <FxKnob index={5} label="Vol" preset={bank.room.mix} />
              </div>
            </section>
            <section className="fx-group">
              <h3>Drive</h3>
              <div className="fx-knobs">
                <FxKnob index={6} label="Amount" preset={bank.drive} />
              </div>
            </section>
          </div>
          <section className="hw">
            <h2 className="text-sm text-accent">Panel</h2>
            <Slider label={connected ? "Main knob" : "Morph"} min={0} max={127} value={project.morph} disabled={connected} onChange={setMorph} />
            <label className="slider">
              Knob X
              <select className="bg-surface text-fg" value={project.knobX} onChange={(e) => setKnob("knobX", Number(e.target.value))}>
                {KNOB_TARGETS.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="slider">
              Knob Y
              <select className="bg-surface text-fg" value={project.knobY} onChange={(e) => setKnob("knobY", Number(e.target.value))}>
                {KNOB_TARGETS.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="hint flex items-center gap-2">
              <input type="checkbox" checked={ext} onChange={(e) => setExt(e.target.checked)} />
              Ext clock
            </label>
            <div className="song">
              {project.song.map((stepPat, i) => (
                <div key={i} className={`song-step ${project.songAt === i ? "now" : ""}`}>
                  <select className="bg-surface text-fg" value={stepPat} onChange={(e) => setSongStep(i, Number(e.target.value))}>
                    {["A", "B", "C", "D", "E", "F", "G", "H"].map((name, n) => (
                      <option key={name} value={n}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <button className="btn" disabled={project.song.length <= 1} onClick={() => removeSongStep(i)}>
                    ×
                  </button>
                </div>
              ))}
              <button className="btn" disabled={project.song.length >= 16} onClick={addSongStep}>
                Add
              </button>
              <button className="btn" onClick={() => queueNext()}>
                Queue
              </button>
            </div>
          </section>
        </div>
          </div>
      </div>
    </main>
  );
}


const EXTRAS = [
  ["Fold", "Drive"],
  ["Metal", "Air"],
  ["Drive", "Snap"],
  ["Strike", "Spread"],
] as const;

function Instrument({ name, i, hot }: { name: string; i: number; hot: boolean }) {
  const project = useLath((s) => s.project);
  const selS = useLath((s) => s.selS);
  const kitEdit = useLath((s) => s.kitEdit);
  const bank = project.scenes[project.scene] ?? project.scenes[0];
  const voice = bank.voice[i];
  const aux = i === 0 ? "Click" : i === 1 ? "Noise" : i === 2 ? "Wires" : "Bite";
  const step = Math.min(31, selS);
  const row = project.stepPar?.[project.pattern]?.[i]?.[step];
  const shown = (index: number, preset: number) => {
    const nib = !kitEdit ? row?.[index] : null;
    if (nib == null) return { value: preset, locked: false };
    return { value: drumFromNib(index, nib), locked: true };
  };
  const edit = (index: number, v: number) => {
    if (kitEdit) {
      if (index === 0) setVoice(i, "decay", v);
      else if (index === 1) setVoice(i, "tone", v);
      else if (index === 2) setVoice(i, "pitch", v);
      else if (index === 3) setVoice(i, "aux", v);
      else if (index === 4) setVoice(i, "pa", v);
      else if (index === 5) setVoice(i, "pb", v);
      else if (index === 6) setMix(i, "level", v);
      else if (index === 7) setMix(i, "pan", v);
      else if (index === 8) setVoice(i, "sendD", v);
      else setVoice(i, "sendR", v);
      return;
    }
    setDrumLock(i, step, index, v);
  };
  const reset = (index: number) => setDrumLock(i, step, index, null);
  const decay = shown(0, voice.decay);
  const tone = shown(1, voice.tone);
  const pitch = shown(2, voice.pitch);
  const auxV = shown(3, voice.aux);
  const pa = shown(4, voice.pa || 0);
  const pb = shown(5, voice.pb || 0);
  const level = shown(6, bank.mix[i].level);
  const pan = shown(7, bank.mix[i].pan);
  const dly = shown(8, voice.sendD || 0);
  const room = shown(9, voice.sendR || 0);
  return (
    <section className={hot ? "chan hot" : "chan"}>
      <h2>
        {name}
        {i === 3 ? (
          <select aria-label="Model" value={voice.model} onChange={(e) => setVoice(3, "model", Number(e.target.value))}>
            {MODELS.map((model, mi) => (
              <option key={model} value={mi}>
                {model}
              </option>
            ))}
          </select>
        ) : null}
      </h2>
      <div className="chan-body">
        <div className="mix-box">
          <span className="box-label">Mix</span>
          <div className="mix-controls">
            <Fader label="Vol" min={0} max={127} value={level.value} locked={level.locked} onChange={(v) => edit(6, v)} onReset={() => reset(6)} />
            <Knob pan label="Pan" min={0} max={127} value={pan.value} locked={pan.locked} onChange={(v) => edit(7, v)} onReset={() => reset(7)} />
            <Knob label="Dly" min={0} max={127} value={dly.value} locked={dly.locked} onChange={(v) => edit(8, v)} onReset={() => reset(8)} />
            <Knob label="Rm" min={0} max={127} value={room.value} locked={room.locked} onChange={(v) => edit(9, v)} onReset={() => reset(9)} />
          </div>
        </div>
        <div className="sound-box">
          <span className="box-label">{name}</span>
          <div className="sound-knobs">
            <Knob label="Decay" min={1} max={127} value={decay.value} locked={decay.locked} onChange={(v) => edit(0, v)} onReset={() => reset(0)} />
            <Knob label="Tone" min={0} max={127} value={tone.value} locked={tone.locked} onChange={(v) => edit(1, v)} onReset={() => reset(1)} />
            <Knob label="Pitch" min={0} max={48} value={pitch.value} locked={pitch.locked} onChange={(v) => edit(2, v)} onReset={() => reset(2)} />
            <Knob label={aux} min={0} max={127} value={auxV.value} locked={auxV.locked} onChange={(v) => edit(3, v)} onReset={() => reset(3)} />
            <Knob label={EXTRAS[i][0]} min={0} max={127} value={pa.value} locked={pa.locked} onChange={(v) => edit(4, v)} onReset={() => reset(4)} />
            <Knob label={EXTRAS[i][1]} min={0} max={127} value={pb.value} locked={pb.locked} onChange={(v) => edit(5, v)} onReset={() => reset(5)} />
          </div>
        </div>
      </div>
    </section>
  );
}

function FxTime() {
  const project = useLath((s) => s.project);
  const selS = useLath((s) => s.selS);
  const kitEdit = useLath((s) => s.kitEdit);
  const bank = project.scenes[project.scene] ?? project.scenes[0];
  const step = Math.min(31, selS);
  const nib = !kitEdit ? project.fxPar?.[project.pattern]?.[step]?.[0] : null;
  const locked = nib != null;
  const value = locked ? fxFromNib(0, nib) : bank.delay.time;
  return (
    <label className={locked ? "slider locked" : "slider"} onDoubleClick={() => setFxLock(step, 0, null)}>
      Time
      <select
        className="bg-surface text-fg"
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (kitEdit) setDelay("time", v);
          else setFxLock(step, 0, v);
        }}
      >
        {DELAY_TIMES.map((name, i) => (
          <option key={name} value={i}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function FxKnob({ index, label, preset, room }: { index: number; label: string; preset: number; room?: boolean }) {
  const project = useLath((s) => s.project);
  const selS = useLath((s) => s.selS);
  const kitEdit = useLath((s) => s.kitEdit);
  const step = Math.min(31, selS);
  const nib = !kitEdit ? project.fxPar?.[project.pattern]?.[step]?.[index] : null;
  const locked = nib != null;
  const value = locked ? fxFromNib(index, nib) : preset;
  const text = room ? (value >= 124 ? "Freeze" : value >= 96 ? "Hall" : "Size") : label;
  const change = (v: number) => {
    if (!kitEdit) {
      setFxLock(step, index, v);
      return;
    }
    if (index === 1) setDelay("fb", v);
    else if (index === 2) setDelay("mix", v);
    else if (index === 3) setRoom("size", v);
    else if (index === 4) setRoom("damp", v);
    else if (index === 5) setRoom("mix", v);
    else setDrive(v);
  };
  return <Knob label={text} min={0} max={127} value={value} locked={locked} onChange={change} onReset={() => setFxLock(step, index, null)} />;
}

function Banks({ scene }: { scene: number }) {
  return (
    <div className="flex items-center gap-1">
      <span className="hint">Preset</span>
      {["A", "B", "C"].map((name, i) => (
        <button key={name} className={scene === i ? "btn btn-accent" : "btn"} onClick={() => setScene(i)}>
          {name}
        </button>
      ))}
    </div>
  );
}

function Num({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="num">
      {label}
      <input
        inputMode="numeric"
        aria-label={label}
        value={text}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d]/g, "");
          setText(next);
          const n = Number(next);
          if (next !== "" && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => {
          const n = Number(text);
          const clamped = Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : value;
          setText(String(clamped));
          if (clamped !== value) onChange(clamped);
        }}
      />
    </label>
  );
}

function Fader({
  label,
  value,
  min,
  max,
  onChange,
  locked = false,
  onReset,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  locked?: boolean;
  onReset?: () => void;
}) {
  return (
    <label className={locked ? "fader locked" : "fader"} onDoubleClick={onReset}>
      <span>{value}</span>
      <input className="fader-range" type="range" min={min} max={max} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
      <span>{label}</span>
    </label>
  );
}

function knobAngle(value: number, min: number, max: number, pan: boolean) {
  if (pan) {
    const center = min === 0 && max === 127 ? 64 : (min + max) / 2;
    if (value <= center) {
      const t = center === min ? 0 : (value - min) / (center - min);
      return -150 + t * 150;
    }
    const t = max === center ? 1 : (value - center) / (max - center);
    return t * 150;
  }
  const t = max === min ? 0 : (value - min) / (max - min);
  return -150 + t * 300;
}

function Knob({
  label,
  value,
  min,
  max,
  pan,
  locked = false,
  onChange,
  onReset,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  pan?: boolean;
  locked?: boolean;
  onChange: (n: number) => void;
  onReset?: () => void;
}) {
  const angle = knobAngle(value, min, max, !!pan);
  const readout = pan ? (value === 64 ? "C" : value < 64 ? `L${64 - value}` : `R${value - 64}`) : String(value);
  return (
    <div className="knob">
      <button
        type="button"
        className={`${pan ? "knob-cap pan" : "knob-cap"}${locked ? " locked" : ""}`}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onDoubleClick={(e) => {
          e.preventDefault();
          onReset?.();
        }}
        onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          onChange(Math.max(min, Math.min(max, Math.round(value - e.movementY * 0.7))));
        }}
        onWheel={(e) => {
          e.preventDefault();
          onChange(Math.max(min, Math.min(max, value + (e.deltaY < 0 ? 1 : -1))));
        }}
      >
        <span className="knob-rotor" style={{ transform: `rotate(${angle}deg)` }}>
          <span className="knob-mark" />
        </span>
      </button>
      <span>{label}</span>
      <span className="text-fg">{readout}</span>
    </div>
  );
}

function Strip({
  name,
  level,
  pan,
  onLevel,
  onPan,
  delay,
  room,
  onDelay,
  onRoom,
}: {
  name: string;
  level: number;
  pan: number;
  onLevel: (n: number) => void;
  onPan: (n: number) => void;
  delay?: number;
  room?: number;
  onDelay?: (n: number) => void;
  onRoom?: (n: number) => void;
}) {
  return (
    <section className="strip">
      <h2>{name}</h2>
      <Fader label="Level" min={0} max={127} value={level} onChange={onLevel} />
      <div className="strip-knobs">
        <Knob pan label="Pan" min={0} max={127} value={pan} onChange={onPan} />
        {onDelay && delay != null ? <Knob label="Delay" min={0} max={127} value={delay} onChange={onDelay} /> : null}
        {onRoom && room != null ? <Knob label="Room" min={0} max={127} value={room} onChange={onRoom} /> : null}
      </div>
    </section>
  );
}

function keyToNote(key: string, octave: number): number | null {
  const white = "zxcvbnm".indexOf(key);
  const white2 = "qwertyu".indexOf(key);
  const black: Record<string, number> = { s: 1, d: 3, g: 6, h: 8, j: 10 };
  const black2: Record<string, number> = { "2": 1, "3": 3, "5": 6, "6": 8, "7": 10 };
  const semis = [0, 2, 4, 5, 7, 9, 11];
  let n: number | null = null;
  if (white >= 0) n = (octave + 1) * 12 + semis[white];
  else if (key in black) n = (octave + 1) * 12 + black[key];
  else if (white2 >= 0) n = (octave + 2) * 12 + semis[white2];
  else if (key in black2) n = (octave + 2) * 12 + black2[key];
  if (n === null) return null;
  if (n < 1 || n > 127) return null;
  return n;
}
