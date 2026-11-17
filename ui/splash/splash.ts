import "@fontsource-variable/dm-sans";
import "./splash.css";
import { isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";

/** Event the shell sends when the main window is shown and the splash should dissolve. */
const EXIT_EVENT = "splash-exit";
/** Event telling the shell the intro is on screen, so its minimum display time starts now. */
const SHOWN_EVENT = "splash-shown";
const AMBER = [245, 160, 58] as const;
const LEAF = [207, 222, 156] as const;
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

const stage = document.querySelector<HTMLElement>(".stage")!;
const canvas = document.querySelector<HTMLCanvasElement>(".field")!;
const mark = document.querySelector<HTMLElement>(".mark")!;
const bars = [...document.querySelectorAll<SVGRectElement>(".bar")];
const context = canvas.getContext("2d")!;

interface Ripple { born: number }
interface Particle { radius: number; angle: number; speed: number; size: number; tint: readonly number[]; phase: number }

const particles: Particle[] = Array.from({ length: 28 }, (_, i) => ({
  radius: 112 + Math.random() * 54,
  angle: Math.random() * Math.PI * 2,
  speed: (0.25 + Math.random() * 0.5) * (i % 2 ? 1 : -1),
  size: 0.8 + Math.random() * 1.7,
  tint: i % 3 ? AMBER : LEAF,
  phase: Math.random() * Math.PI * 2,
}));
const ripples: Ripple[] = [];
const meters = bars.map(() => ({ level: 1, target: 1, live: false }));

function resize(): void {
  const ratio = devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * ratio);
  canvas.height = Math.round(canvas.clientHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function centre(): { x: number; y: number } {
  const box = mark.getBoundingClientRect();
  const field = canvas.getBoundingClientRect();
  return { x: box.left - field.left + box.width / 2, y: box.top - field.top + box.height / 2 };
}

const rgba = (tint: readonly number[], alpha: number) => `rgba(${tint[0]},${tint[1]},${tint[2]},${alpha.toFixed(3)})`;

function drawRipples(now: number, x: number, y: number): void {
  if (!ripples.length || now - ripples[ripples.length - 1].born > 950) ripples.push({ born: now });
  while (ripples.length && now - ripples[0].born > 1900) ripples.shift();
  for (const ripple of ripples) {
    const t = (now - ripple.born) / 1900;
    context.beginPath();
    context.arc(x, y, 100 + t * 95, 0, Math.PI * 2);
    context.lineWidth = 2 * (1 - t) + 0.4;
    context.strokeStyle = rgba(AMBER, 0.42 * (1 - t) ** 2);
    context.stroke();
  }
}

function drawParticles(now: number, delta: number, x: number, y: number, appear: number): void {
  for (const p of particles) {
    p.angle += p.speed * delta;
    const wobble = Math.sin(now / 700 + p.phase) * 6;
    const r = p.radius + wobble;
    const glow = appear * (0.45 + 0.55 * Math.sin(now / 420 + p.phase) ** 2);
    const trail = 0.22 * Math.sign(p.speed);
    context.beginPath();
    context.arc(x, y, r, p.angle - trail, p.angle, p.speed < 0);
    context.lineWidth = p.size * 0.8;
    context.lineCap = "round";
    context.strokeStyle = rgba(p.tint, 0.18 * glow);
    context.stroke();
    context.beginPath();
    context.arc(x + Math.cos(p.angle) * r, y + Math.sin(p.angle) * r, p.size, 0, Math.PI * 2);
    context.fillStyle = rgba(p.tint, 0.85 * glow);
    context.shadowColor = rgba(p.tint, glow);
    context.shadowBlur = 6;
    context.fill();
    context.shadowBlur = 0;
  }
}

/** Once a bar has risen, it behaves like a level meter: quick attack, slower release. */
function driveMeters(now: number, delta: number): void {
  meters.forEach((meter, i) => {
    if (!meter.live) return;
    if (Math.random() < delta * 7) meter.target = 0.42 + Math.random() * 0.58 * (0.75 + 0.25 * Math.sin(now / 300 + i));
    const rate = meter.target > meter.level ? 18 : 5;
    meter.level += (meter.target - meter.level) * Math.min(1, rate * delta);
    bars[i].style.transform = `scaleY(${meter.level.toFixed(3)})`;
  });
}

let last = performance.now();
const start = last;
function frame(now: number): void {
  const delta = Math.min(0.05, (now - last) / 1000);
  last = now;
  context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  const { x, y } = centre();
  const appear = Math.min(1, Math.max(0, (now - start - 500) / 700));
  if (appear > 0) drawRipples(now, x, y);
  drawParticles(now, delta, x, y, appear);
  driveMeters(now, delta);
  requestAnimationFrame(frame);
}

bars.forEach((bar, i) => bar.addEventListener("animationend", () => {
  bar.style.animation = "none";
  bar.style.transform = "scaleY(1)";
  meters[i].live = true;
}, { once: true }));

function exit(): void {
  stage.dataset.exit = "true";
}

resize();
addEventListener("resize", resize);
if (!calm) requestAnimationFrame(frame);
if (isTauri()) {
  void listen(EXIT_EVENT, exit);
  requestAnimationFrame(() => requestAnimationFrame(() => void emit(SHOWN_EVENT).catch(() => {})));
}
