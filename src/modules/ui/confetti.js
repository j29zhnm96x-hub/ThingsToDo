// Confetti burst on task completion.
// Particles converge from the checkbox toward screen center,
// using random shades of the current theme palette accent color.

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

function randomShade(baseColor) {
  const rgb = hexToRgb(baseColor);
  if (!rgb) return baseColor;
  // vary each channel between 70% and 130% of original, clamped 0-255
  const vary = (v) => Math.round(Math.min(255, Math.max(0, v * (0.7 + Math.random() * 0.6))));
  return `rgb(${vary(rgb.r)}, ${vary(rgb.g)}, ${vary(rgb.b)})`;
}

function getAccentColor() {
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue('--accent').trim() || '#22c55e';
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
  const accent = getAccentColor();
  const count = 36;
  const container = document.body;

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const dx = cx - x;
  const dy = cy - y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    const color = randomShade(accent);
    const size = 3 + Math.random() * 5;
    const spread = (Math.random() - 0.5) * 80;
    const perpX = -dy / dist * spread;
    const perpY = dx / dist * spread;
    const travel = 0.3 + Math.random() * 0.35;
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

    // Firework-style: fan upward-right, gravity kicks in after a moment
    const spreadAngle = (Math.PI / 4) + (Math.random() - 0.5) * 1.4;
    const speed = 200 + Math.random() * 180;
    let vx = Math.cos(spreadAngle) * speed;
    let vy = -Math.abs(Math.sin(spreadAngle) * speed) - 140;
    const gravity = 160;
    let px = x, py = y;
    let prevTime = 0;
    let gravDelay = 0;
    let opacity = 1;

    function animate(time) {
      if (!prevTime) prevTime = time;
      const dt = Math.min((time - prevTime) / 1000, 0.05);
      prevTime = time;
      gravDelay += dt;
      // Slight delay, then gravity ramps up quickly
      const gravFactor = Math.min(Math.max(0, gravDelay - 0.15) * 3, 1);
      vy += gravity * gravFactor * dt;
      px += vx * dt;
      py += vy * dt;
      opacity -= dt * 0.4;
      if (opacity <= 0 || py > window.innerHeight + 50) {
        dot.remove();
        return;
      }
      dot.style.left = `${px}px`;
      dot.style.top = `${py}px`;
      dot.style.opacity = `${Math.max(0, opacity)}`;
      dot.style.transform = `rotate(${px * 2}deg) scale(${1 + dt * 0.4})`;
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
