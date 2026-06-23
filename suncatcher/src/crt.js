import { CONFIG } from './config.js';

// Adds a subtle scanline + vignette overlay on top of a scene. Returns the
// container so callers can toggle its visibility. Honors the saved CRT setting.
export function addCrtOverlay(scene) {
  const { WIDTH, HEIGHT } = CONFIG;
  const g = scene.add.graphics();
  g.setDepth(10000);
  g.setScrollFactor(0);

  // Horizontal scanlines.
  g.fillStyle(0x000000, 0.16);
  for (let y = 0; y < HEIGHT; y += 3) {
    g.fillRect(0, y, WIDTH, 1);
  }
  // Simple vignette using nested translucent borders.
  for (let i = 0; i < 18; i++) {
    g.fillStyle(0x000000, 0.018);
    g.fillRect(i, i, WIDTH - i * 2, HEIGHT - i * 2);
  }

  const enabled = scene.registry.get('crt');
  g.setVisible(enabled !== false);
  scene.registry.set('crtOverlayRef', g);
  return g;
}

export function toggleCrt(scene) {
  const cur = scene.registry.get('crt') !== false;
  const next = !cur;
  scene.registry.set('crt', next);
  localStorage.setItem(CONFIG.STORE_CRT, next ? '1' : '0');
  const ref = scene.registry.get('crtOverlayRef');
  if (ref) ref.setVisible(next);
  return next;
}
