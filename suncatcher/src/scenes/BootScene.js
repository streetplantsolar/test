import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { AudioEngine } from '../audio.js';

// Generates every sprite procedurally as a pixel-art texture, builds the shared
// AudioEngine, then hands off to the Title scene. No external asset files.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.makePanelTexture();
    this.makePileTexture();
    this.makeSheepTexture();
    this.makeNimbyTexture();
    this.makeSunTexture();
    this.makeMoonTexture();
    this.makeCloudTexture();
    this.makeHailTexture();
    this.makeDustTexture();
    this.makeStarTexture();
    this.makeTuftTexture();

    // Shared singletons live in the registry so every scene can reach them.
    if (!this.registry.get('audio')) {
      this.registry.set('audio', new AudioEngine());
    }
    const crtStored = localStorage.getItem(CONFIG.STORE_CRT);
    if (this.registry.get('crt') === undefined) {
      this.registry.set('crt', crtStored === null ? CONFIG.CRT_DEFAULT : crtStored === '1');
    }

    this.scene.start('Title');
  }

  // --- Pixel-art texture builders (each pixel is drawn as a filled rect) ---

  _tex(key, w, h, drawFn) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    drawFn(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  makePanelTexture() {
    // A 48x22 solar panel: dark frame, blue cells with a lighter sheen.
    this._tex('panel', 48, 22, (g) => {
      g.fillStyle(0x2b3a4a, 1);
      g.fillRect(0, 0, 48, 22); // frame
      const cols = 6;
      const rows = 2;
      const cw = 7;
      const ch = 8;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = 2 + c * (cw + 1);
          const y = 2 + r * (ch + 1);
          g.fillStyle(0x1b69b3, 1);
          g.fillRect(x, y, cw, ch);
          g.fillStyle(0x3aa0e6, 1);
          g.fillRect(x, y, cw, 2); // top sheen
          g.fillStyle(0x12508f, 1);
          g.fillRect(x, y + ch - 1, cw, 1); // bottom shade
        }
      }
    });
  }

  makePileTexture() {
    // Galvanized steel pile/post.
    this._tex('pile', 8, 40, (g) => {
      g.fillStyle(0x8a8f99, 1);
      g.fillRect(0, 0, 8, 40);
      g.fillStyle(0xb6bcc6, 1);
      g.fillRect(1, 0, 2, 40); // highlight
      g.fillStyle(0x5e636d, 1);
      g.fillRect(6, 0, 2, 40); // shadow
    });
  }

  makeSheepTexture() {
    // Chunky white sheep with a dark head and legs.
    this._tex('sheep', 30, 22, (g) => {
      g.fillStyle(0xf2efe6, 1);
      g.fillRect(2, 4, 22, 12); // wool body
      g.fillRect(0, 6, 4, 8);
      g.fillRect(22, 6, 6, 8);
      g.fillStyle(0xfbf9f2, 1);
      g.fillRect(4, 2, 6, 4); // fluff
      g.fillRect(12, 2, 6, 4);
      g.fillStyle(0x3a3a40, 1);
      g.fillRect(23, 8, 7, 7); // head
      g.fillStyle(0x222226, 1);
      g.fillRect(4, 16, 3, 5); // legs
      g.fillRect(10, 16, 3, 5);
      g.fillRect(16, 16, 3, 5);
      g.fillStyle(0xffffff, 1);
      g.fillRect(27, 10, 1, 1); // eye
    });
  }

  makeNimbyTexture() {
    // A small group of protesters with a picket sign held high.
    this._tex('nimby', 40, 40, (g) => {
      // sign post
      g.fillStyle(0x7a5230, 1);
      g.fillRect(18, 6, 3, 24);
      // sign board
      g.fillStyle(0xf2efe6, 1);
      g.fillRect(8, 2, 26, 12);
      g.fillStyle(0xc23b2b, 1);
      g.fillRect(8, 2, 26, 2);
      g.fillRect(8, 12, 26, 2);
      // crude "NO" text bars
      g.fillStyle(0x2a2a30, 1);
      g.fillRect(12, 6, 2, 5);
      g.fillRect(14, 6, 2, 2);
      g.fillRect(16, 6, 2, 5);
      g.fillRect(22, 6, 6, 2);
      g.fillRect(22, 9, 6, 2);
      // two people
      const person = (px, shirt) => {
        g.fillStyle(0xe2b48c, 1);
        g.fillRect(px + 2, 18, 6, 5); // head
        g.fillStyle(shirt, 1);
        g.fillRect(px, 23, 10, 9); // torso
        g.fillStyle(0x33333a, 1);
        g.fillRect(px + 1, 32, 3, 7); // legs
        g.fillRect(px + 6, 32, 3, 7);
      };
      person(6, 0x2f6db5);
      person(22, 0x3b9e54);
    });
  }

  makeSunTexture() {
    this._tex('sun', 44, 44, (g) => {
      g.fillStyle(0xfff2a8, 1);
      g.fillCircle(22, 22, 18);
      g.fillStyle(0xffd23f, 1);
      g.fillCircle(22, 22, 14);
      g.fillStyle(0xffb02e, 1);
      g.fillCircle(22, 22, 8);
    });
  }

  makeMoonTexture() {
    this._tex('moon', 32, 32, (g) => {
      g.fillStyle(0xe8edf5, 1);
      g.fillCircle(16, 16, 12);
      g.fillStyle(0xc7d0de, 1);
      g.fillCircle(12, 12, 3);
      g.fillCircle(20, 18, 2);
      g.fillCircle(15, 21, 2);
    });
  }

  makeCloudTexture() {
    this._tex('cloud', 80, 34, (g) => {
      g.fillStyle(0xdfe4ec, 1);
      g.fillCircle(20, 22, 14);
      g.fillCircle(40, 16, 18);
      g.fillCircle(60, 22, 14);
      g.fillRect(12, 22, 56, 12);
      g.fillStyle(0xf4f7fb, 1);
      g.fillCircle(40, 14, 12);
      g.fillStyle(0xc2c9d6, 1);
      g.fillRect(12, 30, 56, 4);
    });
  }

  makeHailTexture() {
    this._tex('hail', 5, 5, (g) => {
      g.fillStyle(0xcfe8ff, 1);
      g.fillRect(0, 0, 5, 5);
      g.fillStyle(0xffffff, 1);
      g.fillRect(1, 1, 2, 2);
    });
  }

  makeDustTexture() {
    this._tex('dust', 6, 6, (g) => {
      g.fillStyle(0xcdbb9a, 1);
      g.fillCircle(3, 3, 3);
    });
  }

  makeStarTexture() {
    this._tex('star', 3, 3, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillRect(1, 0, 1, 3);
      g.fillRect(0, 1, 3, 1);
    });
  }

  makeTuftTexture() {
    // A tuft of taller grass for ground texture.
    this._tex('tuft', 8, 10, (g) => {
      g.fillStyle(0x2f7d32, 1);
      g.fillRect(1, 4, 2, 6);
      g.fillRect(3, 1, 2, 9);
      g.fillRect(5, 3, 2, 7);
      g.fillStyle(0x3fa047, 1);
      g.fillRect(3, 1, 1, 5);
    });
  }
}
