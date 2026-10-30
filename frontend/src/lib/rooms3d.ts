import * as THREE from "three";
import { drawGlow } from "./art";
import { bake, felt, part, plain, SPHERE } from "./bears3d";
import type { Role } from "./teams";

// 3D dioramas that fill one 60° bay: floor, both walls and the back.
// Local space: +z runs from the spine (0) out to the rim (R), the bay is 0.577·z wide either
// side, y = 0 is the carousel floor. The bear stands in the middle at z ≈ 2, so the scene is
// built along the walls and the floor edges where the camera can see it round the bear.

export type Room = { group: THREE.Group; tick(t: number): void };
type V3 = [number, number, number];

const R = 3.15;
const COS = Math.cos(Math.PI / 6), SIN = Math.sin(Math.PI / 6);

let glowTexture: THREE.Texture | null = null;
const glow = (color: string, size: number, opacity = 0.8) => {
  glowTexture ??= Object.assign(new THREE.CanvasTexture(drawGlow()), { colorSpace: THREE.SRGBColorSpace });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
};
const canvasTex = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat?: [number, number]) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// --- the room shell ------------------------------------------------------------------

function shell(floor: THREE.Material) {
  const group = new THREE.Group();
  const f = new THREE.Mesh(new THREE.CircleGeometry(R, 32, -Math.PI * (2 / 3), Math.PI / 3), floor);
  f.rotation.x = -Math.PI / 2;
  f.position.y = 0.006;
  group.add(f);
  // put an object flat against a wall (side −1 left, +1 right), d along the wall from the spine,
  // facing into the room; build objects with their back at z = 0 and their front towards +z
  const onWall = (o: THREE.Object3D, side: -1 | 1, d: number, y: number, off = 0.02) => {
    o.position.set(side * SIN * d - side * COS * off, y, COS * d + SIN * off);
    o.rotation.y = -side * (Math.PI / 3);
    group.add(o);
    return o;
  };
  // a point on the floor, `inset` in from a wall
  const nearWall = (side: -1 | 1, d: number, inset: number): V3 => [side * SIN * d - side * COS * inset, 0, COS * d + SIN * inset];
  return { group, onWall, nearWall };
}

// Wall pictures painted behind the props (the two wall faces of the bay).
export function drawRoomWall(role: Role | "empty"): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  const grad = (stops: [number, string][]) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
  };
  if (role === "researcher") {
    grad([[0, "#1a1236"], [0.7, "#4a3474"], [1, "#6d4f8f"]]);
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `rgba(255,244,220,${Math.random() * 0.7})`;
      ctx.fillRect(Math.random() * 1024, Math.random() * 340, 2, 2);
    }
    [["#3a2a5c", 380, 40], ["#2c2048", 430, 28]].forEach(([col, y, amp]) => {
      ctx.fillStyle = col as string;
      ctx.beginPath();
      ctx.moveTo(0, 512);
      for (let x = 0; x <= 1024; x += 32) ctx.lineTo(x, (y as number) + Math.sin(x / 110 + (y as number)) * (amp as number));
      ctx.lineTo(1024, 512);
      ctx.fill();
    });
  } else if (role === "coder") {
    grad([[0, "#0f2a2e"], [1, "#1d4a4c"]]);
    ctx.strokeStyle = "rgba(120,220,200,.12)";
    for (let x = 0; x < 1024; x += 48) for (let y = 0; y < 512; y += 48) ctx.strokeRect(x + 2, y + 2, 44, 44);
    ctx.fillStyle = "#3d6a66";
    [110, 150, 330].forEach((y) => ctx.fillRect(0, y, 1024, 14));
    ctx.fillStyle = "#86b8a8";
    for (let x = 20; x < 1024; x += 120) [110, 150, 330].forEach((y) => ctx.fillRect(x, y - 3, 10, 20));
  } else if (role === "writer") {
    grad([[0, "#3a0f1a"], [1, "#5a1a28"]]);
    ctx.fillStyle = "rgba(255,200,160,.07)";
    for (let x = 0; x < 1024; x += 64) for (let y = 0; y < 512; y += 64) {
      ctx.beginPath();
      ctx.ellipse(x + 32 + ((y / 64) % 2) * 32, y + 32, 10, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#2a0a12";
    ctx.fillRect(0, 440, 1024, 72);
  } else if (role === "planner") {
    grad([[0, "#2c2826"], [1, "#433c38"]]);
    for (let y = 0, row = 0; y < 512; y += 40, row++) {
      for (let x = -(row % 2) * 40; x < 1024; x += 80) {
        ctx.fillStyle = `hsl(20, 6%, ${22 + Math.random() * 10}%)`;
        ctx.fillRect(x + 3, y + 3, 74, 34);
      }
    }
  } else {
    grad([[0, "#0d0a18"], [1, "#241a38"]]);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(255,240,220,${Math.random() * 0.6})`;
      ctx.fillRect(Math.random() * 1024, Math.random() * 380, 2, 2);
    }
  }
  return c;
}

// --- shared props ------------------------------------------------------------------------

function jackOLantern(size: number) {
  const g = new THREE.Group();
  const orange = plain("#ff7a1a", { emissive: "#ff5a00", emissiveIntensity: 0.5 });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    part(g, SPHERE, orange, [Math.sin(a) * size * 0.35, size * 0.8, Math.cos(a) * size * 0.35], [size * 0.55, size * 0.8, size * 0.55]);
  }
  part(g, new THREE.CylinderGeometry(size * 0.08, size * 0.1, size * 0.4, 8), felt("#3f6a24"), [0, size * 1.7, 0]);
  const face = plain("#3a1500", { emissive: "#ffb347", emissiveIntensity: 1 });
  for (const s of [-1, 1]) part(g, new THREE.CircleGeometry(size * 0.18, 3), face, [s * size * 0.3, size * 0.95, size * 0.9], undefined, [0, 0, Math.PI / 2]);
  part(g, new THREE.PlaneGeometry(size * 0.6, size * 0.14), face, [0, size * 0.55, size * 0.92]);
  const halo = glow("#ff8a2a", size * 5, 0.5);
  halo.position.y = size;
  g.add(halo);
  return g;
}

function candle(height = 0.22) {
  const g = new THREE.Group();
  part(g, new THREE.CylinderGeometry(0.04, 0.045, height, 12), plain("#f4ecd8"), [0, height / 2, 0]);
  part(g, new THREE.ConeGeometry(0.025, 0.08, 8), plain("#ffd27a", { emissive: "#ffb347", emissiveIntensity: 2 }), [0, height + 0.05, 0]);
  const halo = glow("#ffb347", 0.5, 0.7);
  halo.position.y = height + 0.05;
  g.add(halo);
  return { g, halo };
}

const shelfRun = (len: number, depth: number, color: string) => {
  const s = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, depth), felt(color));
  s.position.z = depth / 2;
  return s;
};

// --- the four rooms ---------------------------------------------------------------------

function graveyard(): Room {
  const { group, onWall, nearWall } = shell(felt("#4b4872"));
  const stone = felt("#a29db6"), stoneDark = felt("#767092"), iron = plain("#1c1824", { metalness: 0.4 });
  const ticks: ((t: number) => void)[] = [];

  // iron fences along both walls
  for (const side of [-1, 1] as const) {
    const fence = new THREE.Group();
    const len = 2.3;
    for (let x = 0; x <= len; x += 0.18) {
      part(fence, new THREE.BoxGeometry(0.025, 0.6, 0.025), iron, [x - len / 2, 0.3, 0.05]);
      part(fence, new THREE.ConeGeometry(0.025, 0.08, 4), iron, [x - len / 2, 0.64, 0.05]);
    }
    [0.2, 0.5].forEach((y) => part(fence, new THREE.BoxGeometry(len, 0.025, 0.025), iron, [0, y, 0.05]));
    onWall(fence, side, 1.95, 0);
  }

  // tombstones and crosses in front of the fences
  const tomb = (w: number, h: number, mat: THREE.Material) => {
    const t = new THREE.Group();
    part(t, new THREE.BoxGeometry(w, h, 0.1), mat, [0, h / 2, 0]);
    part(t, new THREE.CylinderGeometry(w / 2, w / 2, 0.1, 20, 1, false, 0, Math.PI), mat, [0, h, 0], undefined, [Math.PI / 2, 0, Math.PI / 2]);
    part(t, new THREE.BoxGeometry(0.03, h * 0.45, 0.02), stoneDark, [0, h * 0.7, 0.055]);
    part(t, new THREE.BoxGeometry(w * 0.4, 0.03, 0.02), stoneDark, [0, h * 0.78, 0.055]);
    part(t, SPHERE, felt("#4a3a42"), [0, 0, 0.22], [w * 0.45, 0.05, 0.2]);
    return t;
  };
  const cross = (h: number) => {
    const t = new THREE.Group();
    part(t, new THREE.BoxGeometry(0.07, h, 0.07), stone, [0, h / 2, 0]);
    part(t, new THREE.BoxGeometry(h * 0.55, 0.07, 0.07), stone, [0, h * 0.72, 0]);
    return t;
  };
  ([
    [tomb(0.42, 0.55, stone), -1, 1.1], [cross(0.75), -1, 1.85], [tomb(0.34, 0.42, stoneDark), -1, 2.7],
    [tomb(0.38, 0.5, stoneDark), 1, 1.3], [tomb(0.3, 0.38, stone), 1, 2.15], [cross(0.6), 1, 2.85],
  ] as [THREE.Group, -1 | 1, number][]).forEach(([o, side, d], i) => {
    o.position.set(...nearWall(side, d, 0.32));
    o.rotation.set(-0.06, -side * (Math.PI / 3) + (i % 2 ? 0.2 : -0.15), i % 2 ? 0.08 : -0.06);
    group.add(o);
  });

  // a mausoleum at the back
  const crypt = new THREE.Group();
  part(crypt, new THREE.BoxGeometry(0.75, 0.9, 0.5), stone, [0, 0.45, 0]);
  part(crypt, new THREE.CylinderGeometry(0.01, 0.52, 0.32, 4), stoneDark, [0, 1.06, 0], [1, 1, 0.7], [0, Math.PI / 4, 0]);
  part(crypt, new THREE.PlaneGeometry(0.3, 0.5), plain("#120d18"), [0, 0.3, 0.26]);
  [-1, 1].forEach((s) => part(crypt, new THREE.CylinderGeometry(0.04, 0.04, 0.85, 10), stone, [0.3 * s, 0.43, 0.27]));
  crypt.position.set(0, 0, 0.85);
  group.add(crypt);

  // a crooked bare tree on the left, a paper moon on the right wall
  const tree = new THREE.Group();
  const bark = felt("#6e5a72");
  part(tree, new THREE.CylinderGeometry(0.05, 0.12, 2.0, 7), bark, [0, 1.0, 0], undefined, [0, 0, 0.12]);
  for (let b = 0; b < 7; b++) {
    const br = part(tree, new THREE.CylinderGeometry(0.012, 0.035, 0.7, 5), bark, [0, 1.1 + b * 0.13, 0], undefined, [b * 0.4, b * 1.9, 0.9 + (b % 2) * 0.5]);
    br.translateY(0.3);
  }
  tree.position.set(...nearWall(-1, 1.45, 0.25));
  group.add(tree);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(0.28, 32), plain("#fff2c8", { emissive: "#fff2c8", emissiveIntensity: 0.8 }));
  onWall(moon, 1, 1.4, 1.55, 0.03);
  const moonGlow = glow("#d8d0ff", 1.5, 0.6);
  moonGlow.position.copy(moon.position);
  group.add(moonGlow);

  // jack-o'-lanterns at the front corners
  const jl = jackOLantern(0.14);
  jl.position.set(...nearWall(-1, 2.95, 0.25));
  const jr = jackOLantern(0.11);
  jr.position.set(...nearWall(1, 3.0, 0.22));
  group.add(jl, jr);

  // a ghost drifting along the right wall
  const ghostMat = plain("#f3f0ff", { emissive: "#b9b4ff", emissiveIntensity: 0.4, transparent: true, opacity: 0.88 });
  const ghost = new THREE.Group();
  part(ghost, SPHERE, ghostMat, [0, 0.2, 0], [0.15, 0.15, 0.15]);
  part(ghost, new THREE.ConeGeometry(0.15, 0.3, 16, 1, true), ghostMat, [0, 0.05, 0], [1, -1, 1]);
  for (const s of [-1, 1]) part(ghost, SPHERE, plain("#1a1424"), [0.05 * s, 0.22, 0.14], [0.025, 0.035, 0.01]);
  ghost.userData.live = true;
  group.add(ghost);
  ticks.push((t) => {
    const [x, , z] = nearWall(1, 1.9 + Math.sin(t * 0.5) * 0.6, 0.6);
    ghost.position.set(x, 1.0 + Math.sin(t * 1.7) * 0.08, z);
    ghost.rotation.y = -Math.PI / 4 + Math.sin(t * 0.5) * 0.4;
  });

  // bats and low fog
  const wing = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.16, 0.04, 0), new THREE.Vector3(0.08, -0.03, 0.05)]);
  const batMat = new THREE.MeshBasicMaterial({ color: "#120d18", side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Group();
    const l = new THREE.Mesh(wing, batMat), r = new THREE.Mesh(wing, batMat);
    r.scale.x = -1;
    b.add(l, r);
    b.userData.live = true;
    group.add(b);
    ticks.push((t) => {
      const a = t * (0.8 + i * 0.2) + i * 2;
      const z = 1.6 + Math.sin(a) * 0.6;
      b.position.set(Math.cos(a) * 0.45 * z, 2.0 + i * 0.15, z);
      b.rotation.y = a;
      const flap = Math.sin(t * 16 + i) * 0.7;
      l.rotation.z = flap;
      r.rotation.z = -flap;
    });
  }
  for (let i = 0; i < 5; i++) {
    const f = glow("#cfc8ff", 1, 0.12);
    f.material.blending = THREE.NormalBlending;
    f.scale.set(1.6, 0.35, 1);
    group.add(f);
    ticks.push((t) => f.position.set((i - 2) * 0.35 + Math.sin(t * 0.3 + i) * 0.15, 0.18, 1.2 + (i % 3) * 0.6));
  }
  return { group, tick: (t) => ticks.forEach((f) => f(t)) };
}

function lab(): Room {
  const tiles = canvasTex(64, 64, (ctx) => {
    ctx.fillStyle = "#16262a"; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#2c4a4c"; ctx.fillRect(0, 0, 32, 32); ctx.fillRect(32, 32, 32, 32);
  }, [8, 8]);
  const { group, onWall, nearWall } = shell(new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.6 }));
  const ticks: ((t: number) => void)[] = [];
  const wood = "#5a3d2a";
  const glassColors = ["#7dff7a", "#c07cff", "#ffb347", "#5ee0ff"];
  const liquids: THREE.MeshStandardMaterial[] = [];
  const glass = plain("#cfe8ee", { transparent: true, opacity: 0.5 });

  // two shelves of glowing flasks on each wall
  for (const side of [-1, 1] as const) {
    for (const y of [0.95, 1.55]) {
      const run = new THREE.Group();
      const len = 2.1;
      run.add(shelfRun(len, 0.26, wood));
      for (let x = -len / 2 + 0.15, k = 0; x < len / 2 - 0.1; x += rnd(0.17, 0.26), k++) {
        const col = glassColors[(k + (side > 0 ? 1 : 0)) % glassColors.length];
        const liquid = plain(col, { emissive: col, emissiveIntensity: 0.7, transparent: true, opacity: 0.9 });
        liquids.push(liquid);
        const r = rnd(0.05, 0.08);
        if (k % 2) {
          part(run, SPHERE, liquid, [x, r + 0.02, 0.13], [r, r, r]);
          part(run, new THREE.CylinderGeometry(0.02, 0.025, 0.1, 8), glass, [x, r * 2 + 0.06, 0.13]);
        } else {
          part(run, new THREE.CylinderGeometry(r * 0.8, r * 0.8, r * 3, 12), liquid, [x, r * 1.5 + 0.02, 0.13]);
        }
      }
      onWall(run, side, 1.95, y);
    }
    // a slowly turning gear high on the wall
    const gear = new THREE.Group();
    const brass = plain("#a08a5a", { metalness: 0.6 });
    part(gear, new THREE.TorusGeometry(0.16, 0.04, 6, 20), brass, [0, 0, 0]);
    for (let k = 0; k < 10; k++) part(gear, new THREE.BoxGeometry(0.05, 0.08, 0.06), brass, [Math.sin(k * 0.628) * 0.21, Math.cos(k * 0.628) * 0.21, 0], undefined, [0, 0, -k * 0.628]);
    const mount = new THREE.Group();
    gear.position.z = 0.05;
    gear.userData.live = true;
    mount.add(gear);
    onWall(mount, side, 1.3, 2.05);
    ticks.push((t) => (gear.rotation.z = t * 0.6 * side));
  }
  ticks.push((t) => liquids.forEach((m, i) => (m.emissiveIntensity = 0.55 + Math.sin(t * 2 + i) * 0.25)));

  // a tesla coil on the left with crackling lightning
  const coil = new THREE.Group();
  const metal = plain("#8a8f99", { metalness: 0.7, roughness: 0.3 });
  part(coil, new THREE.CylinderGeometry(0.16, 0.2, 0.15, 16), plain("#2a2a30"), [0, 0.075, 0]);
  for (let k = 0; k < 6; k++) part(coil, new THREE.TorusGeometry(0.07, 0.015, 6, 16), plain("#c87a2a", { metalness: 0.6 }), [0, 0.22 + k * 0.08, 0], undefined, [Math.PI / 2, 0, 0]);
  part(coil, new THREE.CylinderGeometry(0.05, 0.05, 0.55, 10), metal, [0, 0.42, 0]);
  part(coil, new THREE.TorusGeometry(0.13, 0.05, 10, 24), metal, [0, 0.78, 0], undefined, [Math.PI / 2, 0, 0]);
  const spark = glow("#9fd8ff", 1.2, 0.6);
  spark.position.y = 0.8;
  coil.add(spark);
  const boltGeo = new THREE.BufferGeometry();
  boltGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Array(8 * 3).fill(0), 3));
  const bolt = new THREE.Line(boltGeo, new THREE.LineBasicMaterial({ color: "#d8f0ff" }));
  coil.add(bolt);
  coil.position.set(...nearWall(-1, 2.6, 0.38));
  group.add(coil);
  ticks.push((t) => {
    const on = Math.sin(t * 9) + Math.sin(t * 23) > 0.6;
    bolt.visible = on;
    spark.material.opacity = on ? 0.9 : 0.4;
    if (on) {
      const p = boltGeo.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < 8; k++) p.setXYZ(k, rnd(-0.08, 0.08) + k * 0.06, 0.85 + k * 0.07 + rnd(-0.05, 0.05), rnd(-0.08, 0.08));
      p.needsUpdate = true;
    }
  });

  // a workbench with a glowing code monitor on the right
  const bench = new THREE.Group();
  part(bench, new THREE.BoxGeometry(0.9, 0.05, 0.45), felt(wood), [0, 0.62, 0.22]);
  [-0.4, 0.4].forEach((x) => part(bench, new THREE.BoxGeometry(0.05, 0.62, 0.4), felt(wood), [x, 0.31, 0.22]));
  const code = canvasTex(256, 160, (ctx) => {
    ctx.fillStyle = "#0b1a14"; ctx.fillRect(0, 0, 256, 160);
    const cols = ["#7dff7a", "#5ee0ff", "#ffb347", "#c07cff"];
    for (let y = 14; y < 160; y += 14) {
      ctx.fillStyle = cols[(y / 14) % 4];
      ctx.fillRect(12 + ((y / 14) % 3) * 14, y - 6, 60 + Math.random() * 120, 6);
    }
  });
  part(bench, new THREE.BoxGeometry(0.46, 0.32, 0.04), plain("#2a2a30"), [0, 0.86, 0.12]);
  part(bench, new THREE.PlaneGeometry(0.42, 0.28), new THREE.MeshBasicMaterial({ map: code }), [0, 0.86, 0.141]);
  part(bench, new THREE.BoxGeometry(0.34, 0.02, 0.12), plain("#3a3a42"), [0, 0.65, 0.32]);
  const screenGlow = glow("#5effb0", 1.1, 0.35);
  screenGlow.position.set(0, 0.86, 0.3);
  bench.add(screenGlow);
  onWall(bench, 1, 2.55, 0, 0.05);

  return { group, tick: (t) => ticks.forEach((f) => f(t)) };
}

function library(): Room {
  const planks = canvasTex(128, 128, (ctx) => {
    for (let y = 0; y < 128; y += 16) {
      ctx.fillStyle = `hsl(24, 40%, ${22 + Math.random() * 8}%)`;
      ctx.fillRect(0, y, 128, 15);
    }
  }, [6, 6]);
  const { group, onWall, nearWall } = shell(new THREE.MeshStandardMaterial({ map: planks, roughness: 0.8 }));
  const ticks: ((t: number) => void)[] = [];
  const wood = felt("#4a2c1c");

  // tall bookshelves on both walls; all the books are one instanced mesh
  const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), 400);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), color = new THREE.Color();
  const palette = ["#8a1c2a", "#1f4a6a", "#2f6a3a", "#c49a3a", "#5a2a6a", "#e6d6b0", "#3a3a4a"];
  let n = 0;
  for (const side of [-1, 1] as const) {
    const shelf = new THREE.Group();
    const len = 2.2;
    part(shelf, new THREE.BoxGeometry(len, 1.95, 0.04), wood, [0, 0.975, 0.02]);
    [-len / 2, len / 2].forEach((x) => part(shelf, new THREE.BoxGeometry(0.05, 1.95, 0.3), wood, [x, 0.975, 0.15]));
    const ys = [0.05, 0.5, 0.95, 1.4];
    ys.forEach((y) => part(shelf, new THREE.BoxGeometry(len, 0.04, 0.3), wood, [0, y, 0.15]));
    part(shelf, new THREE.BoxGeometry(len + 0.1, 0.06, 0.32), wood, [0, 1.95, 0.16]);
    onWall(shelf, side, 1.95, 0);
    shelf.updateMatrix();
    for (const y of ys) {
      for (let x = -len / 2 + 0.06; x < len / 2 - 0.08 && n < 400; ) {
        const w = rnd(0.04, 0.08), h = rnd(0.26, 0.4);
        q.setFromEuler(new THREE.Euler(0, 0, Math.random() < 0.08 ? 0.25 : 0));
        m.compose(new THREE.Vector3(x + w / 2, y + 0.02 + h / 2, 0.16), q, new THREE.Vector3(w, h, 0.24));
        m.premultiply(shelf.matrix);
        books.setMatrixAt(n, m);
        books.setColorAt(n, color.set(palette[Math.floor(Math.random() * palette.length)]));
        n++;
        x += w + 0.006;
      }
    }
  }
  books.count = n;
  group.add(books);

  // floating candles that bob along both walls
  for (let i = 0; i < 7; i++) {
    const c = candle(rnd(0.16, 0.26));
    c.g.userData.live = true;
    const [x, , z] = nearWall(i % 2 ? 1 : -1, 1.2 + i * 0.28, 0.5);
    group.add(c.g);
    ticks.push((t) => {
      c.g.position.set(x, 1.55 + Math.sin(t * 1.2 + i) * 0.08 + (i % 3) * 0.12, z);
      c.halo.material.opacity = 0.6 + Math.sin(t * 9 + i * 2) * 0.15;
    });
  }

  // an open book flapping round the room
  const page = plain("#f4ecd8", { side: THREE.DoubleSide });
  const flyer = new THREE.Group();
  const left = new THREE.Group(), right = new THREE.Group();
  part(left, new THREE.PlaneGeometry(0.22, 0.28), page, [-0.11, 0, 0]);
  part(right, new THREE.PlaneGeometry(0.22, 0.28), page, [0.11, 0, 0]);
  flyer.add(left, right);
  flyer.userData.live = true;
  group.add(flyer);
  ticks.push((t) => {
    const a = t * 0.6;
    flyer.position.set(Math.sin(a) * 0.6, 2.05 + Math.sin(t * 1.4) * 0.1, 1.7 + Math.cos(a) * 0.5);
    flyer.rotation.set(-1.2, a, 0);
    const flap = 0.5 + Math.sin(t * 7) * 0.4;
    left.rotation.y = flap;
    right.rotation.y = -flap;
  });

  // a reading desk with an inkpot and quill, and a rug
  const desk = new THREE.Group();
  part(desk, new THREE.BoxGeometry(0.6, 0.05, 0.35), wood, [0, 0.55, 0]);
  [-0.26, 0.26].forEach((x) => part(desk, new THREE.BoxGeometry(0.05, 0.55, 0.3), wood, [x, 0.275, 0]));
  part(desk, new THREE.BoxGeometry(0.32, 0.02, 0.22), page, [0, 0.585, 0], undefined, [0, 0.2, 0]);
  part(desk, new THREE.CylinderGeometry(0.03, 0.035, 0.06, 12), plain("#151520"), [0.2, 0.61, -0.08]);
  part(desk, new THREE.ConeGeometry(0.03, 0.28, 8), plain("#f6f0e2"), [0.22, 0.72, -0.08], [1, 1, 0.3], [0, 0, -0.3]);
  desk.position.set(...nearWall(-1, 2.85, 0.42));
  desk.rotation.y = Math.PI / 3 - 0.3;
  group.add(desk);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), felt("#7a1f2c"));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.01, 2.0);
  rug.scale.set(1, 0.7, 1);
  group.add(rug);

  return { group, tick: (t) => ticks.forEach((f) => f(t)) };
}

function cauldronRoom(): Room {
  const flags = canvasTex(128, 128, (ctx) => {
    ctx.fillStyle = "#1e1a18"; ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 32) for (let x = (y / 32) % 2 ? -16 : 0; x < 128; x += 32) {
      ctx.fillStyle = `hsl(25, 5%, ${26 + Math.random() * 10}%)`;
      ctx.fillRect(x + 2, y + 2, 28, 28);
    }
  }, [5, 5]);
  const { group, onWall, nearWall } = shell(new THREE.MeshStandardMaterial({ map: flags, roughness: 0.95 }));
  const ticks: ((t: number) => void)[] = [];

  // the cauldron, bubbling over a fire, front right
  const pot = new THREE.Group();
  const profile = [[0.001, 0.05], [0.2, 0.06], [0.32, 0.18], [0.34, 0.34], [0.28, 0.46], [0.31, 0.5]].map(([x, y]) => new THREE.Vector2(x, y));
  part(pot, new THREE.LatheGeometry(profile, 32), plain("#1a1a1e", { side: THREE.DoubleSide, metalness: 0.4, roughness: 0.5 }), [0, 0, 0]);
  const brew = plain("#7dff5a", { emissive: "#4adf2a", emissiveIntensity: 0.9 });
  part(pot, new THREE.CircleGeometry(0.28, 32), brew, [0, 0.45, 0], undefined, [-Math.PI / 2, 0, 0]);
  [0, 2.1, 4.2].forEach((a) => part(pot, new THREE.CylinderGeometry(0.025, 0.025, 0.12, 6), plain("#1a1a1e"), [Math.sin(a) * 0.2, 0.0, Math.cos(a) * 0.2]));
  const fire = glow("#ff6a1a", 0.9, 0.8);
  fire.position.y = 0.05;
  const steam = glow("#9dff7a", 1.2, 0.35);
  steam.position.y = 0.65;
  pot.add(fire, steam);
  const bubbles = Array.from({ length: 6 }, (_, i) => ({
    b: Object.assign(part(pot, SPHERE, brew, [0, 0.46, 0], [0.04, 0.04, 0.04]), { userData: { live: true } }),
    x: rnd(-0.18, 0.18),
    z: rnd(-0.18, 0.18),
    o: i / 6,
  }));
  pot.position.set(...nearWall(1, 2.65, 0.55));
  group.add(pot);
  ticks.push((t) => {
    bubbles.forEach(({ b, x, z, o }) => {
      const k = (t * 0.7 + o) % 1;
      b.position.set(x, 0.46 + k * 0.35, z);
      b.scale.setScalar(0.03 + k * 0.04);
    });
    fire.material.opacity = 0.7 + Math.sin(t * 13) * 0.15;
    steam.material.opacity = 0.3 + Math.sin(t * 2) * 0.1;
  });

  // the plan: a treasure map pinned on the left wall
  const map = canvasTex(256, 192, (ctx) => {
    ctx.fillStyle = "#e8d3a2"; ctx.fillRect(0, 0, 256, 192);
    ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 3; ctx.strokeRect(6, 6, 244, 180);
    ctx.fillStyle = "#b8d0a0";
    ctx.beginPath(); ctx.ellipse(90, 100, 70, 50, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(190, 70, 40, 30, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#a02a2a"; ctx.lineWidth = 3; ctx.setLineDash([8, 7]);
    ctx.beginPath(); ctx.moveTo(30, 160); ctx.bezierCurveTo(80, 60, 140, 170, 190, 70); ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(178, 58); ctx.lineTo(202, 82); ctx.moveTo(202, 58); ctx.lineTo(178, 82); ctx.stroke();
  });
  const mapBoard = new THREE.Group();
  part(mapBoard, new THREE.PlaneGeometry(0.9, 0.68), new THREE.MeshStandardMaterial({ map, roughness: 1 }), [0, 0, 0.01], undefined, [0, 0, 0.04]);
  [-0.4, 0.4].forEach((x) => part(mapBoard, SPHERE, plain("#ff4f8b"), [x, 0.3, 0.03], [0.03, 0.03, 0.03]));
  onWall(mapBoard, -1, 1.7, 1.2);

  // potion shelves on the right wall
  for (const y of [1.05, 1.6]) {
    const run = new THREE.Group();
    run.add(shelfRun(1.3, 0.22, "#4a2c1c"));
    for (let x = -0.55, k = 0; x < 0.6; x += rnd(0.14, 0.2), k++) {
      const col = ["#c07cff", "#ff4f8b", "#5ee0ff", "#ffd24a"][k % 4];
      const h = rnd(0.1, 0.2);
      part(run, new THREE.CylinderGeometry(0.045, 0.05, h, 10), plain(col, { emissive: col, emissiveIntensity: 0.5, transparent: true, opacity: 0.9 }), [x, h / 2 + 0.02, 0.11]);
      part(run, new THREE.ConeGeometry(0.035, 0.07, 10), plain("#cfc8b8"), [x, h + 0.055, 0.11]);
    }
    onWall(run, 1, 1.3, y);
  }

  // hanging herbs along the tops of both walls
  for (const side of [-1, 1] as const) {
    for (let d = 0.8, k = 0; d < 3.0; d += 0.32, k++) {
      const bunch = new THREE.Group();
      part(bunch, new THREE.CylinderGeometry(0.004, 0.004, 0.2, 4), plain("#2a2020"), [0, -0.1, 0]);
      part(bunch, new THREE.ConeGeometry(0.07, 0.24, 6), felt(k % 2 ? "#5a7a3a" : "#8a6a3a"), [0, -0.3, 0], undefined, [Math.PI, 0, 0]);
      onWall(bunch, side, d, 2.25, 0.1);
    }
  }

  // jack-o'-lanterns and a broom on the left
  ([[2.95, 0.3, 0.13], [2.5, 0.32, 0.1]] as const).forEach(([d, inset, s]) => {
    const j = jackOLantern(s);
    j.position.set(...nearWall(-1, d, inset));
    group.add(j);
  });
  const broom = new THREE.Group();
  part(broom, new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8), felt("#7a4f2a"), [0, 0.75, 0]);
  part(broom, new THREE.ConeGeometry(0.12, 0.3, 12), felt("#d9a64a"), [0, 0.13, 0], undefined, [Math.PI, 0, 0]);
  broom.rotation.z = -0.25;
  const leaning = new THREE.Group();
  broom.position.z = 0.15;
  leaning.add(broom);
  onWall(leaning, -1, 2.2, 0);

  return { group, tick: (t) => ticks.forEach((f) => f(t)) };
}

const ROOMS: Record<Role, () => Room> = { researcher: graveyard, coder: lab, writer: library, planner: cauldronRoom };

export function buildRoom(role: Role): Room {
  const room = ROOMS[role]();
  bake(room.group);
  return room;
}
