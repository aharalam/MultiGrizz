import { STATUS_COLOR, STATUS_LABEL, type Agent, type Team } from "./teams";

export const PINK = "#ff4f8b";
export const PAPER = "#f3ead8";
const PIXEL = '"Pixelify Sans", monospace';
const HAND = '"Gaegu", cursive';

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

// faint fibres so flat fills read as paper
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, alpha = 0.06) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * alpha;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// a card with a slightly torn edge
function deckle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  const step = 14;
  for (let i = 0; i <= w; i += step) ctx.lineTo(x + i, y + Math.random() * 3);
  for (let i = 0; i <= h; i += step) ctx.lineTo(x + w - Math.random() * 3, y + i);
  for (let i = w; i >= 0; i -= step) ctx.lineTo(x + i, y + h - Math.random() * 3);
  for (let i = h; i >= 0; i -= step) ctx.lineTo(x + Math.random() * 3, y + i);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number, lines = 2) {
  const words = text.split(" ");
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > max && line) {
      ctx.fillText(line, x, y);
      y += lh;
      line = w;
      if (--lines === 1) {
        // last line: let it run, trimmed with an ellipsis
        const rest = words.slice(words.indexOf(w)).join(" ");
        let t = rest;
        while (ctx.measureText(t).width > max) t = t.slice(0, -2) + "…";
        ctx.fillText(t, x, y);
        return;
      }
    } else line = test;
  }
  ctx.fillText(line, x, y);
}

export const SIGN_W = 640;
export const SIGN_H = 400;

// The hanging paper card in each bay: agent name, description and live progress.
export function drawSign(target: HTMLCanvasElement, team: Team, agent: Agent | undefined, slot: number) {
  const ctx = target.getContext("2d")!;
  ctx.clearRect(0, 0, SIGN_W, SIGN_H);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  deckle(ctx, 16, 16, SIGN_W - 32, SIGN_H - 40);
  ctx.fillStyle = agent ? PAPER : "#2a2336";
  ctx.fill();
  ctx.restore();

  // pins
  for (const px of [70, SIGN_W - 70]) {
    ctx.fillStyle = PINK;
    ctx.beginPath(); ctx.arc(px, 34, 10, 0, Math.PI * 2); ctx.fill();
  }

  ctx.textBaseline = "alphabetic";
  if (!agent) {
    ctx.fillStyle = PINK;
    ctx.font = `700 70px ${PIXEL}`;
    ctx.textAlign = "center";
    ctx.fillText("+ summon", SIGN_W / 2, 170);
    ctx.fillStyle = "#d8cde8";
    ctx.font = `400 38px ${HAND}`;
    ctx.fillText(`empty den ${slot + 1} · click to add a bear`, SIGN_W / 2, 240);
    return;
  }

  ctx.textAlign = "left";
  ctx.fillStyle = "#8a7d6a";
  ctx.font = `700 30px ${HAND}`;
  ctx.fillText(`den ${slot + 1} · the ${agent.role}`, 48, 84);
  ctx.fillStyle = team.ink;
  ctx.font = `700 76px ${PIXEL}`;
  ctx.fillText(agent.name, 46, 154);
  ctx.fillStyle = "#3b342c";
  ctx.font = `400 34px ${HAND}`;
  wrap(ctx, agent.description, 48, 200, SIGN_W - 96, 34);

  // status + progress
  const color = STATUS_COLOR[agent.status];
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(58, 287, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3b342c";
  ctx.font = `700 30px ${HAND}`;
  ctx.fillText(`${STATUS_LABEL[agent.status]} — ${agent.activity}`.slice(0, 40), 76, 297);
  const bx = 48, by = 318, bw = SIGN_W - 96, bh = 22;
  ctx.fillStyle = "rgba(42,38,34,.15)";
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = color;
  ctx.fillRect(bx, by, (bw * agent.progress) / 100, bh);
  ctx.strokeStyle = "#2a2622";
  ctx.lineWidth = 3;
  ctx.strokeRect(bx, by, bw, bh);
}

export function makeSignCanvas() {
  return canvas(SIGN_W, SIGN_H)[0];
}

// Pennant floating over each carousel in the overview.
export function drawBanner(team: Team) {
  const [c, ctx] = canvas(640, 220);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.5)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = team.color;
  ctx.beginPath();
  ctx.moveTo(30, 30); ctx.lineTo(610, 30); ctx.lineTo(580, 110); ctx.lineTo(610, 190); ctx.lineTo(30, 190); ctx.lineTo(60, 110);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  grain(ctx, 640, 220, 0.08);
  ctx.fillStyle = "#fff8ea";
  ctx.textAlign = "center";
  ctx.font = `700 60px ${PIXEL}`;
  ctx.fillText(team.name, 320, 108);
  ctx.font = `700 36px ${HAND}`;
  ctx.fillText(`${team.species} bears · ${team.agents.length}/6 agents`, 320, 158);
  return c;
}

export function drawWallPaper(color: string) {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  grain(ctx, 256, 256, 0.1);
  return c;
}

// soft round falloff for glows, fire puffs, fog and contact shadows
export function drawGlow(inner = "rgba(255,255,255,1)", outer = "rgba(255,255,255,0)") {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

// The crescent moon from the intro, shared by the intro sky, the site's moon overlay and
// the 3D sky: a cream disc with craters, its upper right bitten away, in a warm haze.
const moonSprites = new Map<number, HTMLCanvasElement>();
function crescent(r: number) {
  const key = Math.round(r);
  if (moonSprites.has(key)) return moonSprites.get(key)!;
  const s = Math.ceil(r * 2.2);
  const [c, ctx] = canvas(s, s);
  const x = s / 2, y = s / 2;
  const lit = ctx.createRadialGradient(x - r * 0.35, y + r * 0.25, r * 0.1, x, y, r);
  lit.addColorStop(0, "#fbf6ea");
  lit.addColorStop(1, "#d8ccbd");
  ctx.fillStyle = lit;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  const craters: [number, number, number][] = [[-0.62, 0.05, 0.13], [-0.42, 0.42, 0.2], [-0.7, -0.3, 0.09], [-0.12, 0.66, 0.15], [-0.55, 0.62, 0.08], [-0.25, 0.3, 0.1], [0.12, 0.42, 0.11]];
  for (const [cx, cy, cr] of craters) {
    ctx.fillStyle = "rgba(160,142,132,.35)";
    ctx.strokeStyle = "rgba(255,255,255,.3)";
    ctx.lineWidth = Math.max(1, r * 0.02);
    ctx.beginPath(); ctx.arc(x + cx * r, y + cy * r, cr * r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // bite out the dark side with a soft edge
  ctx.globalCompositeOperation = "destination-out";
  const bx = x + r * 0.42, by = y - r * 0.24, br = r * 0.9;
  const bite = ctx.createRadialGradient(bx, by, br * 0.96, bx, by, br * 1.02);
  bite.addColorStop(0, "rgba(0,0,0,1)");
  bite.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bite;
  ctx.beginPath(); ctx.arc(bx, by, br * 1.02, 0, Math.PI * 2); ctx.fill();
  moonSprites.set(key, c);
  return c;
}

// Draw the moon centred at (x, y) with radius r; t (seconds) drifts the cloud wisps across it.
export function drawMoon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t = 0, wisps = true) {
  const haze = ctx.createRadialGradient(x - r * 0.2, y + r * 0.1, r * 0.5, x, y, r * 2.6);
  haze.addColorStop(0, "rgba(255,226,210,.22)");
  haze.addColorStop(1, "rgba(255,226,210,0)");
  ctx.fillStyle = haze;
  ctx.fillRect(x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
  const k = ctx.getTransform().a || 1; // render the sprite at device resolution
  const sprite = crescent(r * k);
  const sw = sprite.width / k;
  ctx.drawImage(sprite, x - sw / 2, y - sw / 2, sw, sw);
  if (!wisps) return;
  // soft dark cloud wisps (gradient ellipses, so no canvas filter is needed)
  [[-0.05, 0.55], [0.45, 0.6], [-0.4, 0.35]].forEach(([dy, a], i) => {
    const span = r * 5;
    const dx = (((t * r * 0.08 + i * r * 1.7) % span) + span) % span - span / 2;
    const fade = 1 - Math.abs(dx) / (span / 2); // fade out at the ends so they never pop
    ctx.save();
    ctx.translate(x + dx, y + dy * r);
    ctx.scale(1, 0.1);
    const w = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.2);
    w.addColorStop(0, `rgba(48,18,24,${a * fade})`);
    w.addColorStop(1, "rgba(48,18,24,0)");
    ctx.fillStyle = w;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
}

// The moon alone on a transparent canvas, for textures.
export function drawMoonCanvas(r: number) {
  const [c, ctx] = canvas(Math.ceil(r * 5.2), Math.ceil(r * 5.2));
  drawMoon(ctx, c.width / 2, c.height / 2, r, 0, false);
  return c;
}
