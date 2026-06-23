import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { formatEnergyString } from '../units.js';
import { addCrtOverlay } from '../crt.js';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const { WIDTH, HEIGHT } = CONFIG;
    const audio = this.registry.get('audio');

    // Sky-ish gradient backdrop.
    const bg = this.add.graphics();
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(0x1a2a55),
        Phaser.Display.Color.IntegerToColor(0xf2a35e),
        11,
        i
      );
      bg.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
      bg.fillRect(0, (HEIGHT / 12) * i, WIDTH, HEIGHT / 12 + 1);
    }
    // ground strip
    bg.fillStyle(0x3c7a34, 1);
    bg.fillRect(0, HEIGHT - 46, WIDTH, 46);
    bg.fillStyle(0x2f6029, 1);
    bg.fillRect(0, HEIGHT - 46, WIDTH, 4);

    const sun = this.add.image(WIDTH - 90, 96, 'sun');
    this.tweens.add({ targets: sun, y: 86, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // Decorative panel on its pile.
    this.add.image(120, HEIGHT - 64, 'pile');
    const panel = this.add.image(120, HEIGHT - 86, 'panel');
    panel.setAngle(28);
    this.tweens.add({ targets: panel, angle: -10, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.add
      .text(WIDTH / 2, 64, 'SUNCATCHER', {
        fontFamily: 'monospace',
        fontSize: '46px',
        color: '#ffe27a',
        stroke: '#7a3b10',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, 104, 'chase the sun • generate the most energy', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const how = [
      'A / ←   tilt west        D / →   tilt east',
      'W / ↑   hop the pile      M  mute     C  CRT     P  pause',
      '',
      'Aim the panel at the sun to make power.',
      'Jump sheep & NIMBYs. Brace (±60°) for hail.',
      'Hold tilt into the wind. Go flat under clouds.',
      'Night makes no power. Survive, rack up the Wh.',
    ];
    this.add
      .text(WIDTH / 2, 168, how, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#e9eef7',
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5);

    const hi = Number(localStorage.getItem(CONFIG.STORE_HIGHSCORE) || 0);
    this.add
      .text(WIDTH / 2, HEIGHT - 56, `HIGH SCORE: ${hi > 0 ? formatEnergyString(hi) : '—'}`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffd23f',
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(WIDTH / 2, HEIGHT - 26, 'PRESS ENTER / ANY KEY TO START', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });

    addCrtOverlay(this);

    // Any key starts. The key press also unlocks WebAudio.
    this.input.keyboard.once('keydown', () => {
      audio.ensureContext();
      audio.startMusic();
      audio.sfxSelect();
      this.cameras.main.fade(250, 0, 0, 0);
      this.time.delayedCall(250, () => this.scene.start('Game'));
    });
  }
}
