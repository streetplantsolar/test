import Phaser from 'phaser';
import { CONFIG, CYCLE_SECONDS } from '../config.js';
import { formatEnergy, formatEnergyString, ENERGY_UNITS } from '../units.js';
import { addCrtOverlay, toggleCrt } from '../crt.js';

const BASE_GROUND_Y = CONFIG.HEIGHT - 64; // average ground line
const HORIZON_Y = BASE_GROUND_Y - 4;

// Sky gradient keyframes across the full 120s cycle: [t, topColor, bottomColor].
const SKY_KEYS = [
  [0, 0x0d1330, 0x223052], // predawn
  [7, 0x3a3470, 0xf2a35e], // sunrise
  [18, 0x2f74d6, 0xbfe0f7], // morning
  [40, 0x2a6fd6, 0x9fd0f5], // midday
  [64, 0x2f74d6, 0xbfe0f7], // afternoon
  [74, 0x6a2f63, 0xf2693c], // sunset
  [81, 0x2a1c44, 0x7a3b4a], // dusk
  [90, 0x0d1330, 0x223052], // night
  [CYCLE_SECONDS, 0x0d1330, 0x223052], // wrap back to predawn
];

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.audio = this.registry.get('audio');
    const { WIDTH, HEIGHT } = CONFIG;
    this.panelX = Math.round(WIDTH * CONFIG.PANEL_X_FRACTION);

    this.resetState();

    // ---- Layers (draw order) ----
    this.skyGfx = this.add.graphics().setDepth(0);
    this.stars = [];
    for (let i = 0; i < 46; i++) {
      const s = this.add.image(
        Phaser.Math.Between(0, WIDTH),
        Phaser.Math.Between(8, HEIGHT * 0.55),
        'star'
      );
      s.setDepth(1).setAlpha(0);
      this.stars.push(s);
    }

    this.sun = this.add.image(WIDTH, HORIZON_Y, 'sun').setDepth(2);
    this.moon = this.add.image(WIDTH, HORIZON_Y, 'moon').setDepth(2).setVisible(false);

    this.groundGfx = this.add.graphics().setDepth(3);

    // Cloud hazard sprite (hidden until a cloud event runs).
    this.cloudSprite = this.add.image(WIDTH + 100, 70, 'cloud').setDepth(6).setVisible(false);

    // ---- Player rig: pile + panel in a container that hops as one ----
    this.rig = this.add.container(this.panelX, BASE_GROUND_Y).setDepth(5);
    this.pile = this.add.image(0, 0, 'pile').setOrigin(0.5, 1);
    this.panel = this.add.image(0, -30, 'panel').setOrigin(0.5, 0.5);
    this.rig.add([this.pile, this.panel]);

    this.dust = this.add.particles(0, 0, 'dust', {
      lifespan: 380,
      speed: { min: 20, max: 60 },
      angle: { min: 200, max: 340 },
      gravityY: 120,
      scale: { start: 1, end: 0 },
      quantity: 6,
      emitting: false,
    });
    this.dust.setDepth(4);

    this.hailEmitter = this.add.particles(0, 0, 'hail', {
      x: { min: 0, max: WIDTH },
      y: -10,
      lifespan: 1400,
      speedY: { min: 220, max: 320 },
      speedX: { min: -60, max: -20 },
      quantity: 3,
      frequency: 60,
      scale: { start: 1, end: 1 },
      emitting: false,
    });
    this.hailEmitter.setDepth(7);

    this.windGfx = this.add.graphics().setDepth(7);

    this.obstacles = [];

    this.buildHud();
    addCrtOverlay(this);

    this.bindInput();

    // Pause overlay (hidden by default).
    this.pauseText = this.add
      .text(WIDTH / 2, HEIGHT / 2, 'PAUSED\n\nP / ESC to resume', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        align: 'center',
        backgroundColor: '#000000aa',
        padding: { x: 16, y: 12 },
      })
      .setOrigin(0.5)
      .setDepth(11000)
      .setScrollFactor(0)
      .setVisible(false);

    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  resetState() {
    this.runTime = 0;
    this.worldDist = 0;
    this.energyWh = 0;
    this.health = CONFIG.MAX_HEALTH;
    this.day = 1;
    this.tilt = 30; // start tilted east toward the rising sun
    this.jumpY = 0;
    this.vy = 0;
    this.grounded = true;
    this.lastGroundedTime = 0;
    this.scrollSpeed = CONFIG.SCROLL_BASE;
    this.spawnTimer = Phaser.Math.FloatBetween(1.2, 2.2);
    this.lastUnitIndex = 0;
    this.paused = false;
    this.gameOver = false;
    this.trackingFraction = 0;

    // Hazard event state.
    this.wind = { active: false, end: 0, next: 0 };
    this.hail = { active: false, end: 0, next: 0 };
    this.cloud = { active: false, end: 0, scheduledDay: 0, scheduledAt: -1 };
    this._tiltCooldown = 0;
  }

  buildHud() {
    const { WIDTH } = CONFIG;
    const mk = (x, y, size, color, origin = 0.5) =>
      this.add
        .text(x, y, '', {
          fontFamily: 'monospace',
          fontSize: `${size}px`,
          color,
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(origin, 0)
        .setDepth(9000)
        .setScrollFactor(0);

    this.trackingText = mk(WIDTH / 2, 8, 18, '#ffffff');
    this.energyText = mk(WIDTH / 2, 30, 16, '#ffe27a');
    this.dayText = mk(10, 8, 14, '#ffffff', 0);
    this.highText = mk(WIDTH - 10, 8, 12, '#ffd23f', 1);
    this.indicatorText = mk(WIDTH - 10, 24, 11, '#bcd', 1);
    this.statusText = mk(WIDTH / 2, 52, 13, '#9fe0ff'); // hazard hint line

    this.highScore = Number(localStorage.getItem(CONFIG.STORE_HIGHSCORE) || 0);

    // Milestone flash overlay.
    this.flash = this.add
      .rectangle(WIDTH / 2, CONFIG.HEIGHT / 2, WIDTH, CONFIG.HEIGHT, 0xffffff, 0)
      .setDepth(9500)
      .setScrollFactor(0);

    this.healthGfx = this.add.graphics().setDepth(9000);
  }

  bindInput() {
    const kb = this.input.keyboard;
    this.cursors = kb.createCursorKeys();
    this.keys = kb.addKeys({
      A: Phaser.Input.Keyboard.KeyCodes.A,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      W: Phaser.Input.Keyboard.KeyCodes.W,
    });

    kb.on('keydown-W', () => this.tryJump());
    kb.on('keydown-UP', () => this.tryJump());

    kb.on('keydown-M', () => {
      const muted = this.audio.toggleMute();
      this.flashStatus(muted ? 'MUTED' : 'SOUND ON');
    });
    kb.on('keydown-C', () => {
      const on = toggleCrt(this);
      this.flashStatus(on ? 'CRT ON' : 'CRT OFF');
    });
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-ESC', () => this.togglePause());
  }

  togglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
    this.pauseText.setVisible(this.paused);
    if (this.paused) this.hailEmitter.stop();
  }

  flashStatus(msg) {
    this.statusFlash = msg;
    this.statusFlashUntil = this.runTime + 1.5;
  }

  // ---------------------------------------------------------------------------
  update(time, deltaMs) {
    if (this.gameOver) return;
    if (this.paused) return;
    const dt = Math.min(deltaMs / 1000, 0.05); // clamp big frame gaps

    this.runTime += dt;
    this.scrollSpeed = Math.min(
      CONFIG.SCROLL_MAX,
      CONFIG.SCROLL_BASE + (this.day - 1) * CONFIG.SCROLL_RAMP_PER_DAY
    );
    this.worldDist += this.scrollSpeed * dt;

    this.updateDayCycle();
    this.handleTiltInput(dt);
    this.updateWind(dt);
    this.updateJump(dt);
    this.updateGeneration(dt);
    this.updateHail(dt);
    this.updateCloud(dt);
    this.updateSpawning(dt);
    this.updateObstacles(dt);

    this.renderSky();
    this.renderGround();
    this.renderRig();
    this.renderHealthBar();
    this.updateHud();

    if (this.health <= 0) this.endGame();
  }

  // ---- Day / night + sun ----
  updateDayCycle() {
    const cycle = this.runTime % CYCLE_SECONDS;
    const newDay = Math.floor(this.runTime / CYCLE_SECONDS) + 1;
    if (newDay !== this.day) {
      this.day = newDay;
      this.onNewDay();
    }
    this.isDay = cycle < CONFIG.DAY_SECONDS;
    this.audio.setNight(!this.isDay);

    const { WIDTH } = CONFIG;
    if (this.isDay) {
      const p = cycle / CONFIG.DAY_SECONDS; // 0..1
      this.sunProgress = p;
      this.sunAngle = Phaser.Math.Linear(CONFIG.SUN_EAST_ANGLE, CONFIG.SUN_WEST_ANGLE, p);
      const sx = Phaser.Math.Linear(WIDTH - 40, 40, p);
      const sy = HORIZON_Y - Math.sin(p * Math.PI) * CONFIG.SUN_ARC_HEIGHT;
      this.sun.setPosition(sx, sy).setVisible(true);
      this.sunAltitude = Math.sin(p * Math.PI);
      this.moon.setVisible(false);
    } else {
      const np = (cycle - CONFIG.DAY_SECONDS) / CONFIG.NIGHT_SECONDS;
      const mx = Phaser.Math.Linear(WIDTH - 40, 40, np);
      const my = HORIZON_Y - Math.sin(np * Math.PI) * (CONFIG.SUN_ARC_HEIGHT * 0.7);
      this.moon.setPosition(mx, my).setVisible(true);
      this.sun.setVisible(false);
      this.sunAltitude = -0.3;
    }
  }

  onNewDay() {
    this.flashStatus(`DAY ${this.day}`);
    // Roll for a cloud event today (clouds start past day 1).
    if (this.day >= CONFIG.UNLOCK.wind && Math.random() < CONFIG.CLOUD_PROBABILITY) {
      this.cloud.scheduledDay = this.day;
      // Schedule sometime during daylight of this day.
      const dayStart = (this.day - 1) * CYCLE_SECONDS;
      this.cloud.scheduledAt = dayStart + Phaser.Math.FloatBetween(10, CONFIG.DAY_SECONDS - 15);
    }
  }

  // ---- Tilt (stepped + persistent) ----
  handleTiltInput(dt) {
    this._tiltCooldown -= dt * 1000;
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    if ((left || right) && this._tiltCooldown <= 0) {
      if (left) this.tilt -= CONFIG.TILT_STEP;
      if (right) this.tilt += CONFIG.TILT_STEP;
      this._tiltCooldown = CONFIG.TILT_REPEAT_MS;
    }
    this.tilt = Phaser.Math.Clamp(this.tilt, -CONFIG.MAX_TILT, CONFIG.MAX_TILT);
  }

  // ---- Jump ----
  tryJump() {
    if (this.paused || this.gameOver) return;
    const canCoyote = this.runTime - this.lastGroundedTime <= CONFIG.COYOTE_MS / 1000;
    if (this.grounded || (canCoyote && this.vy === 0)) {
      this.vy = CONFIG.JUMP_VELOCITY;
      this.grounded = false;
      this.audio.sfxJump();
      // Squash-and-stretch on takeoff.
      this.tweens.add({
        targets: this.rig,
        scaleY: 1.18,
        scaleX: 0.86,
        duration: 90,
        yoyo: true,
        ease: 'Quad.out',
      });
      this.emitDust();
    }
  }

  emitDust() {
    const gy = this.groundYAt(this.panelX);
    this.dust.emitParticleAt(this.panelX, gy, 6);
  }

  updateJump(dt) {
    if (!this.grounded) {
      this.jumpY += this.vy * dt;
      this.vy -= CONFIG.GRAVITY * dt;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.vy = 0;
        this.grounded = true;
        this.lastGroundedTime = this.runTime;
        this.audio.sfxLand();
        this.emitDust();
        this.tweens.add({
          targets: this.rig,
          scaleY: 0.82,
          scaleX: 1.16,
          duration: 90,
          yoyo: true,
          ease: 'Quad.out',
        });
      }
    } else {
      this.lastGroundedTime = this.runTime;
    }
  }

  // ---- Generation (core mechanic) ----
  updateGeneration(dt) {
    let frac = 0;
    if (this.isDay) {
      if (this.cloud.active) {
        // Under cloud: flat panel (0deg) is best; aiming is penalized.
        frac = CONFIG.CLOUD_FLAT_FRACTION * Math.max(0, Math.cos(Phaser.Math.DegToRad(this.tilt)));
      } else {
        const error = this.tilt - this.sunAngle;
        frac = Math.max(0, Math.cos(Phaser.Math.DegToRad(error)));
      }
    }
    this.trackingFraction = frac;

    const genMult = Math.pow(CONFIG.GEN_RAMP_PER_DAY, this.day - 1);
    if (this.isDay) {
      this.energyWh += CONFIG.BASE_RATE * frac * genMult * dt;
    }

    if (CONFIG.HEALTH_REGEN) {
      this.health = Math.min(CONFIG.MAX_HEALTH, this.health + CONFIG.HEALTH_REGEN_RATE * dt);
    }

    // Unit rollover milestone.
    const idx = formatEnergy(this.energyWh).index;
    if (idx > this.lastUnitIndex) {
      this.lastUnitIndex = idx;
      this.celebrateMilestone(ENERGY_UNITS[idx]);
    }
  }

  celebrateMilestone(unit) {
    this.audio.sfxMilestone();
    this.flash.setAlpha(0.6);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 450 });
    const t = this.add
      .text(CONFIG.WIDTH / 2, 90, `${unit}!`, {
        fontFamily: 'monospace',
        fontSize: '34px',
        color: '#ffffff',
        stroke: '#7a3b10',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(9600)
      .setScrollFactor(0);
    this.tweens.add({ targets: t, y: 60, alpha: 0, duration: 1100, onComplete: () => t.destroy() });
  }

  // ---- Wind ----
  updateWind(dt) {
    const unlocked = this.day >= CONFIG.UNLOCK.wind;
    if (!unlocked) return;
    if (this.wind.next === 0) {
      this.wind.next = this.runTime + Phaser.Math.FloatBetween(...CONFIG.WIND_INTERVAL);
    }
    if (!this.wind.active && this.runTime >= this.wind.next) {
      this.wind.active = true;
      this.wind.end = this.runTime + Phaser.Math.FloatBetween(...CONFIG.WIND_DURATION);
      this.audio.sfxWind();
      this.flashStatus('WIND! hold tilt east →');
    }
    if (this.wind.active) {
      // Gust blows R->L, pushing the panel angle toward west (negative).
      this.tilt = Phaser.Math.Clamp(
        this.tilt - CONFIG.WIND_FORCE * dt,
        -CONFIG.MAX_TILT,
        CONFIG.MAX_TILT
      );
      this.renderWind();
      if (this.runTime >= this.wind.end) {
        this.wind.active = false;
        this.wind.next = this.runTime + Phaser.Math.FloatBetween(...CONFIG.WIND_INTERVAL);
        this.windGfx.clear();
      }
    }
  }

  renderWind() {
    const { WIDTH, HEIGHT } = CONFIG;
    this.windGfx.clear();
    this.windGfx.lineStyle(2, 0xffffff, 0.25);
    const offset = (this.runTime * 600) % 40;
    for (let i = 0; i < 7; i++) {
      const y = 40 + i * 38 + (i % 2) * 12;
      const x = WIDTH - ((offset + i * 60) % (WIDTH + 80));
      this.windGfx.beginPath();
      this.windGfx.moveTo(x + 26, y);
      this.windGfx.lineTo(x, y);
      this.windGfx.strokePath();
    }
  }

  // ---- Hail ----
  updateHail(dt) {
    const unlocked = this.day >= CONFIG.UNLOCK.hail;
    if (unlocked) {
      if (this.hail.next === 0) {
        this.hail.next = this.runTime + Phaser.Math.FloatBetween(...CONFIG.HAIL_INTERVAL);
      }
      if (!this.hail.active && this.runTime >= this.hail.next) {
        this.hail.active = true;
        this.hail.duration = Phaser.Math.FloatBetween(...CONFIG.HAIL_DURATION);
        this.hail.end = this.runTime + this.hail.duration;
        this.hailEmitter.start();
        this.audio.sfxHail();
        this.flashStatus('HAIL! brace ±60°');
      }
    }
    if (this.hail.active) {
      // Exposure 1 when flat, 0 when braced to HAIL_BRACE_TILT or beyond.
      const exposure = Phaser.Math.Clamp(
        1 - Math.abs(this.tilt) / CONFIG.HAIL_BRACE_TILT,
        0,
        1
      );
      // Total over a fully-exposed event approximates HAIL_DMG.
      const dmgRate = CONFIG.HAIL_DMG / this.hail.duration;
      if (exposure > 0) this.health -= dmgRate * exposure * dt;
      if (Math.random() < dt * 2) this.audio.sfxHail();
      if (this.runTime >= this.hail.end) {
        this.hail.active = false;
        this.hail.next = this.runTime + Phaser.Math.FloatBetween(...CONFIG.HAIL_INTERVAL);
        this.hailEmitter.stop();
      }
    }
  }

  // ---- Cloud ----
  updateCloud(dt) {
    if (
      !this.cloud.active &&
      this.cloud.scheduledAt >= 0 &&
      this.runTime >= this.cloud.scheduledAt &&
      this.isDay
    ) {
      this.cloud.active = true;
      this.cloud.end = this.runTime + Phaser.Math.FloatBetween(...CONFIG.CLOUD_DURATION);
      this.cloud.scheduledAt = -1;
      this.cloudSprite.setVisible(true);
      this.flashStatus('CLOUDY — go flat (0°)');
    }
    if (this.cloud.active) {
      // Drift the cloud across to sit over the sun.
      const target = this.sun.visible ? this.sun.x : CONFIG.WIDTH / 2;
      this.cloudSprite.x += (target - this.cloudSprite.x) * Math.min(1, dt * 1.5);
      this.cloudSprite.y = Math.max(50, this.sun.y - 6);
      if (this.runTime >= this.cloud.end || !this.isDay) {
        this.cloud.active = false;
        this.cloudSprite.setVisible(false);
        this.cloudSprite.x = CONFIG.WIDTH + 100;
      }
    }
  }

  // ---- Obstacle spawning ----
  currentSpawnInterval() {
    const [lo, hi] = CONFIG.SPAWN_INTERVAL;
    const scale = Math.pow(CONFIG.SPAWN_RAMP_PER_DAY, this.day - 1);
    return Math.max(
      CONFIG.SPAWN_INTERVAL_MIN,
      Phaser.Math.FloatBetween(lo, hi) * scale
    );
  }

  updateSpawning(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.currentSpawnInterval();
      this.spawnGroundObstacle();
    }
  }

  spawnGroundObstacle() {
    const nimbyReady = this.day >= CONFIG.UNLOCK.nimby;
    let type = 'sheep';
    if (nimbyReady && Math.random() < 0.38) type = 'nimby';
    const tex = type === 'nimby' ? 'nimby' : 'sheep';
    const sprite = this.add.image(CONFIG.WIDTH + 40, 0, tex).setDepth(5);
    sprite.setOrigin(0.5, 1);
    this.obstacles.push({
      sprite,
      type,
      dmg: type === 'nimby' ? CONFIG.NIMBY_DMG : CONFIG.SHEEP_DMG,
      hit: false,
    });
  }

  updateObstacles(dt) {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.sprite.x -= this.scrollSpeed * dt;
      o.sprite.y = this.groundYAt(o.sprite.x) + 2;

      // Collision check near the panel.
      if (!o.hit && Math.abs(o.sprite.x - this.panelX) < 20) {
        if (this.jumpY >= CONFIG.JUMP_CLEAR_HEIGHT) {
          // cleared — no damage
        } else {
          o.hit = true;
          this.applyDamage(o.dmg, o.type);
        }
      }
      if (o.sprite.x < -50) {
        o.sprite.destroy();
        this.obstacles.splice(i, 1);
      }
    }
  }

  applyDamage(amount, kind) {
    this.health = Math.max(0, this.health - amount);
    this.audio.sfxDamage(kind);
    this.cameras.main.shake(180, 0.012);
    this.flash.fillColor = 0xff0000;
    this.flash.setAlpha(0.4);
    this.tweens.add({
      targets: this.flash,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.flash.fillColor = 0xffffff;
      },
    });
  }

  // ---- Terrain ----
  hillHeight(worldX) {
    const amp = Math.min(
      CONFIG.HILL_MAX_AMP,
      CONFIG.HILL_BASE_AMP + (this.day - 1) * CONFIG.HILL_RAMP_AMP
    );
    return amp * (0.6 * Math.sin(worldX * 0.012) + 0.4 * Math.sin(worldX * 0.027 + 1.3));
  }

  groundYAt(screenX) {
    return BASE_GROUND_Y - this.hillHeight(this.worldDist + screenX);
  }

  // ---- Rendering ----
  lerpColor(a, b, t) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(a),
      Phaser.Display.Color.IntegerToColor(b),
      100,
      Math.round(t * 100)
    );
    return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
  }

  skyColors() {
    const cycle = this.runTime % CYCLE_SECONDS;
    let lo = SKY_KEYS[0];
    let hi = SKY_KEYS[SKY_KEYS.length - 1];
    for (let i = 0; i < SKY_KEYS.length - 1; i++) {
      if (cycle >= SKY_KEYS[i][0] && cycle <= SKY_KEYS[i + 1][0]) {
        lo = SKY_KEYS[i];
        hi = SKY_KEYS[i + 1];
        break;
      }
    }
    const span = hi[0] - lo[0] || 1;
    const t = Phaser.Math.Clamp((cycle - lo[0]) / span, 0, 1);
    return {
      top: this.lerpColor(lo[1], hi[1], t),
      bottom: this.lerpColor(lo[2], hi[2], t),
    };
  }

  renderSky() {
    const { WIDTH, HEIGHT } = CONFIG;
    const { top, bottom } = this.skyColors();
    this.skyGfx.clear();
    const bands = 24;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      this.skyGfx.fillStyle(this.lerpColor(top, bottom, t), 1);
      this.skyGfx.fillRect(0, (HEIGHT / bands) * i, WIDTH, HEIGHT / bands + 1);
    }
    // Stars fade with darkness.
    const darkness = Phaser.Math.Clamp(1 - this.sunAltitude * 1.5, 0, 1);
    const starAlpha = Phaser.Math.Clamp(darkness * 1.1 - 0.2, 0, 0.95);
    for (const s of this.stars) s.setAlpha(starAlpha);
    this.moon.setAlpha(Phaser.Math.Clamp(darkness, 0, 1));
  }

  renderGround() {
    const { WIDTH, HEIGHT } = CONFIG;
    const g = this.groundGfx;
    g.clear();

    // Grass body.
    const step = 6;
    const pts = [];
    for (let sx = 0; sx <= WIDTH; sx += step) pts.push([sx, this.groundYAt(sx)]);

    g.fillStyle(0x3c7a34, 1);
    g.beginPath();
    g.moveTo(0, HEIGHT);
    g.lineTo(0, pts[0][1]);
    for (const [x, y] of pts) g.lineTo(x, y);
    g.lineTo(WIDTH, HEIGHT);
    g.closePath();
    g.fillPath();

    // Dirt band just under the grass top.
    g.fillStyle(0x5a3a22, 1);
    g.beginPath();
    g.moveTo(0, HEIGHT);
    for (const [x, y] of pts) g.lineTo(x, y + 10);
    g.lineTo(WIDTH, HEIGHT);
    g.closePath();
    g.fillPath();
    // redraw grass on top of dirt's upper edge
    g.fillStyle(0x3c7a34, 1);
    g.beginPath();
    g.moveTo(0, pts[0][1]);
    for (const [x, y] of pts) g.lineTo(x, y);
    for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i][0], pts[i][1] + 6);
    g.closePath();
    g.fillPath();

    // Bright grass top edge.
    g.lineStyle(2, 0x66b04a, 1);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts) g.lineTo(x, y);
    g.strokePath();

    // Grass tufts at fixed world positions so they scroll naturally.
    const spacing = 56;
    const startWorld = Math.floor(this.worldDist / spacing) * spacing;
    g.fillStyle(0x2f7d32, 1);
    for (let w = startWorld; w < this.worldDist + WIDTH; w += spacing) {
      const sx = w - this.worldDist;
      const gy = BASE_GROUND_Y - this.hillHeight(w);
      g.fillRect(sx - 2, gy - 6, 1, 6);
      g.fillRect(sx, gy - 8, 1, 8);
      g.fillRect(sx + 2, gy - 5, 1, 5);
    }
  }

  renderRig() {
    const gy = this.groundYAt(this.panelX);
    this.rig.y = gy - this.jumpY;
    this.panel.angle = this.tilt;
  }

  healthColor() {
    const frac = this.health / CONFIG.MAX_HEALTH;
    for (const band of CONFIG.HEALTH_COLORS) {
      if (frac >= band.t) return band.color;
    }
    return CONFIG.HEALTH_COLORS[CONFIG.HEALTH_COLORS.length - 1].color;
  }

  renderHealthBar() {
    const g = this.healthGfx;
    g.clear();
    const w = 46;
    const h = 6;
    const x = this.rig.x - w / 2;
    const y = this.rig.y - 64;
    g.fillStyle(0x000000, 0.6);
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(0x222222, 1);
    g.fillRect(x, y, w, h);
    const frac = Phaser.Math.Clamp(this.health / CONFIG.MAX_HEALTH, 0, 1);
    g.fillStyle(this.healthColor(), 1);
    g.fillRect(x, y, Math.round(w * frac), h);
  }

  // ---- HUD ----
  updateHud() {
    const pct = Math.round(this.trackingFraction * 100);
    this.trackingText.setText(`${this.isDay ? pct : 0}% tracking`);
    this.energyText.setText(formatEnergyString(this.energyWh));
    this.dayText.setText(`DAY ${this.day}`);

    const shownHigh = Math.max(this.highScore, this.energyWh);
    this.highText.setText(`HI ${shownHigh > 0 ? formatEnergyString(shownHigh) : '—'}`);

    const muted = this.audio.muted ? 'MUTE' : 'SND';
    const crt = this.registry.get('crt') !== false ? 'CRT' : '---';
    this.indicatorText.setText(`${muted} ${crt}`);

    if (this.statusFlash && this.runTime < this.statusFlashUntil) {
      this.statusText.setText(this.statusFlash);
    } else {
      this.statusText.setText('');
    }
  }

  // ---- Game over ----
  endGame() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.hailEmitter.stop();
    this.audio.sfxGameOver();

    const prevHigh = this.highScore;
    const isHigh = this.energyWh > prevHigh;
    if (isHigh) {
      localStorage.setItem(CONFIG.STORE_HIGHSCORE, String(Math.floor(this.energyWh)));
    }

    this.cameras.main.fade(450, 0, 0, 0);
    this.time.delayedCall(460, () => {
      this.scene.start('GameOver', {
        energyWh: this.energyWh,
        day: this.day,
        isHigh,
        prevHigh,
      });
    });
  }
}
