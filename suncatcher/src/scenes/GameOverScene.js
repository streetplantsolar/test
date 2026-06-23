import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { formatEnergyString } from '../units.js';
import { addCrtOverlay } from '../crt.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    this.result = data || { energyWh: 0, day: 1, isHigh: false, prevHigh: 0 };
  }

  create() {
    const { WIDTH, HEIGHT } = CONFIG;
    const audio = this.registry.get('audio');

    // Dusk-toned backdrop.
    const bg = this.add.graphics();
    for (let i = 0; i < 16; i++) {
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(0x241433),
        Phaser.Display.Color.IntegerToColor(0x6a2f3a),
        15,
        i
      );
      bg.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
      bg.fillRect(0, (HEIGHT / 16) * i, WIDTH, HEIGHT / 16 + 1);
    }

    this.add
      .text(WIDTH / 2, 70, "THAT'S ALL FOR TODAY!", {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#ffe27a',
        stroke: '#3a1500',
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, 128, `${formatEnergyString(this.result.energyWh)} generated`, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, 162, `Reached Day ${this.result.day}`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#d8e2f0',
      })
      .setOrigin(0.5);

    if (this.result.isHigh) {
      const nh = this.add
        .text(WIDTH / 2, 196, '★ NEW HIGH SCORE! ★', {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#ffd23f',
        })
        .setOrigin(0.5);
      this.tweens.add({ targets: nh, scale: 1.12, duration: 500, yoyo: true, repeat: -1 });
    } else {
      this.add
        .text(WIDTH / 2, 196, `High score: ${formatEnergyString(this.result.prevHigh)}`, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ffd23f',
        })
        .setOrigin(0.5);
    }

    const btn = this.add
      .text(WIDTH / 2, 250, 'PLAY AGAIN', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#05060a',
        backgroundColor: '#ffd23f',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const prompt = this.add
      .text(WIDTH / 2, HEIGHT - 28, 'Press ENTER to play again', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    addCrtOverlay(this);

    let restarted = false;
    const restart = () => {
      if (restarted) return;
      restarted = true;
      audio.ensureContext();
      audio.sfxSelect();
      this.cameras.main.fade(250, 0, 0, 0);
      this.time.delayedCall(250, () => this.scene.start('Game'));
    };

    btn.on('pointerdown', restart);
    this.input.keyboard.once('keydown-ENTER', restart);
    // A short delay then allow any key, so the death keypress doesn't instantly restart.
    this.time.delayedCall(500, () => {
      this.input.keyboard.once('keydown', restart);
    });
  }
}
