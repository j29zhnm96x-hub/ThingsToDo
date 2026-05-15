// Subtle confetti burst on task completion
// Small colored particles burst from the checkbox position
// Colors are derived from the current theme palette (--accent / --accent2).

function getPaletteColors() {
  const style = getComputedStyle(document.documentElement);
  const c1 = style.getPropertyValue('--accent').trim();
  const c2 = style.getPropertyValue('--accent2').trim();
  // fallback if CSS variables aren't resolved yet
  if (!c1 || !c2) return ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  return [c1, c2];
}

let audioCtx = null;

async function shouldPlay() {
  try {
    const { db } = await import('../data/db.js');
    const s = await db.settings.get();
    return { visual: s.enableConfetti !== false, sound: s.enableConfettiSound !== false };
  } catch {
    return { visual: true, sound: true };
  }
}

async function playSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const resp = await fetch('./assets/confetti_sound.mp3');
    const buf = await resp.arrayBuffer();
    const audio = await audioCtx.decodeAudioData(buf);
    const src = audioCtx.createBufferSource();
    src.buffer = audio;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.25; // 25% volume
    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();
  } catch {
    // Silently fail — sound is optional
  }
}

export async function burstConfetti(x, y) {
  const flags = await shouldPlay();
  if (!flags.visual) return;
  if (flags.sound) playSound();
  const COLORS = getPaletteColors();
  const count = 12;
  const container = document.body;

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const dx = cx - x;
  const dy = cy - y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const size = 4 + Math.random() * 4;
    // Spread perpendicular to center direction for a fan effect
    const spread = (Math.random() - 0.5) * 60;
    const perpX = -dy / dist * spread;
    const perpY = dx / dist * spread;
    // Each particle moves a random portion of the distance to center
    const travel = 0.4 + Math.random() * 0.3;
    const tx = x + dx * travel + perpX;
    const ty = y + dy * travel + perpY;

    dot.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: ${size}px;
      height: ${size}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      background: ${color};
      pointer-events: none;
      z-index: 9999;
      opacity: 1;
      transition: none;
    `;
    container.appendChild(dot);

    let startTime = performance.now();
    const duration = 350 + Math.random() * 200;

    function animate(time) {
      const elapsed = time - startTime;
      const progress = elapsed / duration;
      if (progress >= 1) {
        dot.remove();
        return;
      }
      const ease = 1 - Math.pow(1 - progress, 3);
      dot.style.left = `${x + (tx - x) * ease}px`;
      dot.style.top = `${y + (ty - y) * ease}px`;
      dot.style.opacity = `${Math.max(0, 1 - progress * 1.3)}`;
      dot.style.transform = `rotate(${progress * 360}deg)`;
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }
}

export function burstFromElement(el) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  burstConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
}
