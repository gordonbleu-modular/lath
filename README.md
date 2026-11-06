# LATH

A tracker for the Music Thing Workshop Computer. Four drum voices, two pitch-and-gate tracks for the analog oscillators, and a mixer that can bring those oscillators back in with the drums.

Use Chrome or Edge on a computer. Web MIDI does not work on phones.

## Start

1. Hold the Computer boot button, plug in USB, and copy `public/LATH.uf2` onto the drive that appears.
2. Open this site and press **Connect**. The device is named LATH.
3. Press **Save** to store the song on the card. After that it runs from the panel with USB unplugged.

The browser also plays a preview, so you can write patterns before the card is connected.

**Tempo** and **Swing** are the numbers in the top bar. Type a new value. **Play** starts the preview. **Save** writes the card.

On the module, the switch up stops, the middle plays, and a down click queues the next song step. The big knob morphs between presets A, B and C. The two small knobs do whatever you assign on the mixer.

## The page

Everything is on one screen. The grid is a narrow column on the left. The step you are editing sits above the desk, and the instruments, the mixer and the effects fill the right side.

![The tracker, the step editor, and the channel strips on one page.](docs/sequencer.png)

**Pattern** A–H is the pattern you are editing. **Clear** erases the notes and the per-step locks. **Copy to** duplicates the pattern onto another letter. **Preset** A, B and C sit with the strips, because they are the sounds.

The grid is six tracks, at most 32 steps. Each track has its own length. Steps past that length are dim. The header of a track shortens it, lengthens it, or mutes it. **Stop** puts every playhead back on step 1.

Click a step. That instrument's strip lights up, and the knobs show that step. Dragging a knob writes the step only, and the knob gets a gold ring. Double-click it to follow the preset again. **Kit** edits the preset itself, which is what unlocked steps and the big knob use. **Step** goes back to editing the selected step. Effects follow the selected step while you edit, and Pipe's playhead while the pattern plays.

The note buttons, or the computer keyboard: Z is C, the Q row is the octave above. Comma and period move the octave. **Rest** clears the step. **Velocity** and **Length** sit under the notes. On the CV tracks, length is the gate time.

A command shows on the step as its letter and value, such as `R 3`.

| Command | What the value does |
| --- | --- |
| R | Retrigger. How many hits fit in the step, from 2 to 8. |
| D | Extra delay send on this hit. |
| B | Extra room send on this hit. |
| C | Crush. Holds and bites the hit. |
| P | Pitch offset. 24 is unchanged. |
| ? | Probability. The hit plays if a roll lands under this. |
| G | Tone for this drum hit, or glide time on a CV track. |
| K | Choke. Silences the track for the next N steps. |

## The desk

Each drum is a strip on the right. The **Mix** box is the fader, the pan, and the delay and room sends. The sound box is labeled with the instrument. Pipe has fold and drive, Shard has a high metal source and its level (Metal, Air), Wire has drive and a noise snap, Glass has a strike and a partial spread. Decay, tone, pitch, and click, noise, wires or bite are still there. Glass also has a model, and that model stays with the preset: Glass, Wood, Zap or Tom. Drag a knob upward to turn it up. Off is 7 o'clock, full is 5 o'clock. A gold ring means this step is not using the preset.

**In 1** and **In 2** are the audio jacks. Patch the oscillators back in here. They have level, pan and the same two sends. **Master** is the last fader.

Delay, Room and Drive sit in their own boxes. **Vol** on a delay or a room is the return level. The channel **Dly** and **Rm** knobs decide how much of that channel goes into the effect. **Size** opens the room into a hall. From about 96 the label says **Hall**, and the last few values say **Freeze**: the tank holds and the reverb does not die. **Damp** darkens the tail.

**Panel** is the hardware. **Morph** is the big knob, blending preset A into B into C. While the card is connected, the knob on the module wins. **Knob X** and **Knob Y** choose what the two small knobs control. **Ext clock** uses pulse in 1 as a step clock and pulse in 2 as reset. The letters under that are the song. **Queue** lines up the next pattern. It starts when the longest track wraps. The down click on the module does the same thing.

## GitHub Pages

Push this folder to `main` or `master`. The workflow is `.github/workflows/pages.yml`. In the repo, set Settings → Pages → Source to GitHub Actions.
