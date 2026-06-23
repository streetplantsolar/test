// =============================================================================
// SunCatcher — Tunable constants
// -----------------------------------------------------------------------------
// Every balance number lives here. Adjust freely without hunting through code.
// Angles are in DEGREES unless noted. 0deg tilt = panel pointing straight up.
// Positive tilt aims EAST (right), negative tilt aims WEST (left).
// =============================================================================

export const CONFIG = {
  // ---- Display ----
  WIDTH: 640,
  HEIGHT: 360,

  // ---- Day / night cycle ----
  DAY_SECONDS: 80, // length of daylight
  NIGHT_SECONDS: 40, // night is half of day; full cycle = 120s
  // (full cycle is derived: DAY_SECONDS + NIGHT_SECONDS)

  // ---- Sun arc ----
  SUN_EAST_ANGLE: 75, // sun angle at sunrise (east / right)
  SUN_WEST_ANGLE: -75, // sun angle at sunset (west / left)
  SUN_ARC_HEIGHT: 210, // how high the sun climbs at noon (pixels above horizon)

  // ---- Generation model ----
  BASE_RATE: 1, // Wh per second at 100% tracking
  GEN_RAMP_PER_DAY: 1.6, // genMultiplier = GEN_RAMP_PER_DAY ^ (day - 1)

  // ---- Panel / tilt ----
  MAX_TILT: 60, // +/- max tilt from vertical
  TILT_STEP: 6, // degrees nudged per input step
  TILT_REPEAT_MS: 60, // how fast tilt steps repeat while held
  PANEL_X_FRACTION: 0.4, // panel horizontal screen position (0..1)

  // ---- Health ----
  MAX_HEALTH: 100,
  HEALTH_REGEN: false, // passive regen off by default
  HEALTH_REGEN_RATE: 1.5, // HP/sec if HEALTH_REGEN is true
  // Health-bar colour thresholds (fraction of max -> colour). Checked high to low.
  HEALTH_COLORS: [
    { t: 0.6, color: 0x5bd24a }, // green
    { t: 0.35, color: 0xf2d33c }, // yellow
    { t: 0.15, color: 0xf2922c }, // orange
    { t: 0.0, color: 0xe0392b }, // red
  ],

  // ---- Jump ----
  JUMP_VELOCITY: 340, // initial upward velocity (px/s)
  GRAVITY: 1000, // downward accel (px/s^2)
  JUMP_CLEAR_HEIGHT: 26, // must be this high to clear a ground obstacle
  COYOTE_MS: 110, // grace period to still jump just after leaving ground

  // ---- Damage ----
  SHEEP_DMG: 15,
  HAIL_DMG: 25, // total for a fully-exposed hail event
  NIMBY_DMG: 35,

  // ---- Wind (generation hazard) ----
  WIND_FORCE: 34, // degrees/sec the gust pushes your tilt toward west
  WIND_DURATION: [3.0, 6.0], // [min,max] seconds per gust
  WIND_INTERVAL: [6.0, 11.0], // [min,max] seconds between gusts (once unlocked)

  // ---- Hail (health hazard, damage-over-time) ----
  HAIL_BRACE_TILT: 50, // |tilt| at/above this = fully braced (sheds hail)
  HAIL_DURATION: [3.0, 5.0], // [min,max] seconds per hail event
  HAIL_INTERVAL: [9.0, 15.0], // [min,max] seconds between hail events

  // ---- Clouds (generation hazard) ----
  CLOUD_PROBABILITY: 0.5, // chance per day (past day 1) a cloud event happens
  CLOUD_DURATION: [7.0, 12.0], // [min,max] seconds a cloud covers the sun
  CLOUD_FLAT_FRACTION: 0.55, // best (reduced) tracking fraction when flat under cloud

  // ---- Scroll speed ----
  SCROLL_BASE: 95, // px/sec on day 1
  SCROLL_RAMP_PER_DAY: 13, // +px/sec each day
  SCROLL_MAX: 260,

  // ---- Ground-obstacle spawning (sheep / NIMBY) ----
  SPAWN_INTERVAL: [2.6, 4.4], // [min,max] seconds between ground obstacles on day 1
  SPAWN_RAMP_PER_DAY: 0.88, // multiply the interval each day (smaller = more frequent)
  SPAWN_INTERVAL_MIN: 1.1, // never spawn faster than this

  // ---- Hazard unlock schedule (day a hazard first appears) ----
  UNLOCK: {
    sheep: 1,
    wind: 2,
    hail: 3,
    nimby: 4,
  },

  // ---- Rolling hills ----
  HILL_BASE_AMP: 5, // hill amplitude on day 1 (pixels)
  HILL_RAMP_AMP: 7, // +amplitude per day
  HILL_MAX_AMP: 72,

  // ---- CRT / scanline overlay ----
  CRT_DEFAULT: true,

  // ---- Storage keys ----
  STORE_HIGHSCORE: 'suncatcher_highscore_wh',
  STORE_MUTED: 'suncatcher_muted',
  STORE_CRT: 'suncatcher_crt',
};

// Derived helper.
export const CYCLE_SECONDS = CONFIG.DAY_SECONDS + CONFIG.NIGHT_SECONDS;
