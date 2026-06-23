# SunCatcher ☀️

An endless, auto-scrolling 80s-arcade side-runner about a single-axis solar
tracker chasing the sun. Tilt the panel to aim at the sun and generate energy,
hop the pile to clear ground obstacles, and brace against the weather. Rack up
as many watt-hours as you can before your health runs out.

Built with **Phaser 3** + **Vite**. All art is generated procedurally as
pixel-art textures and all audio is synthesized with the Web Audio API, so the
build is fully self-contained and license-free — no asset files to ship.

---

## Run it

```bash
cd suncatcher
npm install
npm run dev      # local dev server with hot reload (Vite prints the URL)
```

## Build a static site

```bash
npm run build    # outputs static files to suncatcher/dist/
npm run preview  # serve the production build locally to sanity-check it
```

`dist/` is a plain static bundle (relative asset paths via `base: './'`), so you
can drop it on any static host — GitHub Pages, Netlify, Vercel, S3, or a
subfolder of an existing site.

---

## How to play

| Action | Keys |
| --- | --- |
| Tilt west (left) | `←` or `A` |
| Tilt east (right) | `→` or `D` |
| Jump (hop the pile) | `↑` or `W` |
| Mute / unmute | `M` |
| Toggle CRT overlay | `C` |
| Pause | `P` or `Esc` |
| Start / play again | `Enter` (or any key) |

**Goal:** generate the most energy (Wh) in one run. The sun rises in the east
(right), arcs overhead, and sets in the west (left). Tilt the panel to face it —
tracking uses a realistic cosine falloff, so the closer you aim, the higher your
`% tracking` and the faster watt-hours accumulate. **Night makes no power.**

Tilt is **stepped and persistent**: each nudge moves the angle a step and it
**holds** where you leave it (max **±60°**) — unless the wind shoves it.

### Hazards (introduced one at a time, then mixed)

| Hazard | Type | How to handle it |
| --- | --- | --- |
| 🐑 **Sheep** | Health (−15) | **Jump** over it |
| 💨 **Wind** | Generation | **Hold tilt into the gust** (east) — it pushes you west and tanks tracking |
| 🧊 **Hail** | Health (−25 if fully exposed) | Tilt to **near-vertical (±60°)** to shed it |
| 🪧 **NIMBYs** | Health (−35, the hardest hit) | **Jump** over them |
| ☁️ **Clouds** | Generation | Go **flat (0°)** for the best (reduced) diffuse output; aiming at the hidden sun is penalized |

Difficulty ramps each in-game **Day**: faster scrolling, more obstacles, taller
rolling hills, and a generation multiplier so the energy-unit milestones
(**Wh → kWh → MWh → GWh → TWh → PWh**) actually land.

Your **high score persists** across sessions via `localStorage`.

---

## Tuning

Every balance number lives in one place: [`src/config.js`](src/config.js).
Day length, generation rate and ramp, tilt step, max tilt, damage values, wind
force, spawn rates, hazard unlock days, cloud probability, hill amplitude,
health-bar colour thresholds, and the CRT default are all constants there.

## Project layout

```
suncatcher/
├── index.html            # Vite entry; mounts the Phaser canvas
├── vite.config.js        # base:'./' for portable static output
├── src/
│   ├── main.js           # Phaser game config + scene list
│   ├── config.js         # ALL tunable constants
│   ├── units.js          # Wh→kWh→…→PWh formatting
│   ├── audio.js          # procedural chiptune + SFX (Web Audio)
│   ├── crt.js            # scanline/vignette overlay (toggle with C)
│   └── scenes/
│       ├── BootScene.js      # generates pixel-art textures
│       ├── TitleScene.js     # title + how-to-play + high score
│       ├── GameScene.js      # the main loop
│       └── GameOverScene.js  # results + play again
```
