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

// Dark, starry den for empty slots.
export function drawEmptyScene() {
  const [c, ctx] = canvas(1024, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#0d0a18");
  g.addColorStop(1, "#241a38");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(255,240,220,${Math.random() * 0.6})`;
    ctx.fillRect(Math.random() * 1024, Math.random() * 380, 2, 2);
  }
  ctx.fillStyle = "#16112a";
  ctx.beginPath();
  ctx.moveTo(0, 512);
  for (let x = 0; x <= 1024; x += 64) ctx.lineTo(x, 400 + Math.sin(x / 90) * 30);
  ctx.lineTo(1024, 512);
  ctx.fill();
  grain(ctx, 1024, 512, 0.05);
  return c;
}

export function drawWallPaper(color: string) {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  grain(ctx, 256, 256, 0.1);
  return c;
}
