import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { drawWallPaper } from "./art";
import type { Costume, Species } from "./teams";

// Costumed 3D bears built from primitives, after the Canva cut-outs.
// Feet at y = 0, facing +z, about 1.65 tall. Arms hang at the sides and hold the
// costume's prop; nothing is placed on the chest.

const mats = new Map<string, THREE.MeshStandardMaterial>();
// grainy colour map so every surface reads as felt / card
export function felt(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  const key = color + JSON.stringify(extra);
  if (!mats.has(key)) {
    const map = new THREE.CanvasTexture(drawWallPaper(color));
    map.colorSpace = THREE.SRGBColorSpace;
    mats.set(key, new THREE.MeshStandardMaterial({ map, roughness: 1, ...extra }));
  }
  return mats.get(key)!;
}
export function plain(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  const key = "p" + color + JSON.stringify(extra);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra }));
  return mats.get(key)!;
}

export const SPHERE = new THREE.SphereGeometry(1, 24, 16);

// Merge every static mesh under root into one mesh per material: a bear or room is
// built from ~100 primitives, and this turns them into a handful of draw calls.
// Anything under an object marked userData.live (it moves on its own) is left alone.
export function bake(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const merged: THREE.Mesh[] = [];
  const visit = (o: THREE.Object3D) => {
    if (!o.visible || (o !== root && o.userData.live)) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !(o as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(mesh.material) && mesh.geometry.attributes.uv && mesh.geometry.attributes.normal) {
      const g = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(inv.clone().multiply(o.matrixWorld));
      for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
      if (!byMat.has(mesh.material)) byMat.set(mesh.material, []);
      byMat.get(mesh.material)!.push(g);
      merged.push(mesh);
    }
    o.children.forEach(visit);
  };
  visit(root);
  merged.forEach((m) => m.removeFromParent());
  byMat.forEach((geos, mat) => root.add(new THREE.Mesh(mergeGeometries(geos), mat)));
}
type V3 = [number, number, number];
export function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3, scale?: V3, rot?: V3) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (scale) m.scale.set(...scale);
  if (rot) m.rotation.set(...rot);
  parent.add(m);
  return m;
}
const ball = (p: THREE.Object3D, mat: THREE.Material, pos: V3, s: V3) => part(p, SPHERE, mat, pos, s);
const cyl = (rt: number, rb: number, h: number, seg = 16, open = false, t0 = 0, tl = Math.PI * 2) =>
  new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, t0, tl);
const cone = (r: number, h: number, seg = 8) => new THREE.ConeGeometry(r, h, seg);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 6, 12);

const PALETTE: Record<Species, { fur: string; limb: string; muzzle: string; inner: string; patch?: string }> = {
  grizzly: { fur: "#7a4a2b", limb: "#7a4a2b", muzzle: "#c4925f", inner: "#c4925f" },
  polar: { fur: "#eeeae0", limb: "#eeeae0", muzzle: "#f8f4ea", inner: "#e2c8c0" },
  panda: { fur: "#f4f1ea", limb: "#1d1b1d", muzzle: "#f4f1ea", inner: "#3a3436", patch: "#1d1b1d" },
  black: { fur: "#2b2526", limb: "#2b2526", muzzle: "#c59a6c", inner: "#5a4a48" },
};
const DARK = "#151112";

type Rig = {
  g: THREE.Group;
  head: THREE.Group;
  arms: [THREE.Group, THREE.Group]; // [left (-x), right (+x)], pivot at the shoulder
  paws: [THREE.Group, THREE.Group]; // hold props here; local -y points down the arm
  legs: THREE.Mesh[];
  pal: (typeof PALETTE)[Species];
};

function baseBear(species: Species, opts: { pose?: "down" | "forward" | "out"; face?: boolean } = {}): Rig {
  const pal = PALETTE[species];
  const fur = felt(pal.fur), limb = felt(pal.limb), muzzle = felt(pal.muzzle), dark = plain(DARK, { roughness: 0.5 });
  const g = new THREE.Group();

  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    legs.push(part(g, capsule(0.15, 0.2), limb, [0.17 * s, 0.23, 0]));
    ball(g, limb, [0.18 * s, 0.07, 0.06], [0.17, 0.09, 0.22]);
  }
  ball(g, fur, [0, 0.72, 0], [0.38, 0.44, 0.33]);

  const arms: Rig["arms"] = [new THREE.Group(), new THREE.Group()];
  const paws: Rig["paws"] = [new THREE.Group(), new THREE.Group()];
  [-1, 1].forEach((s, k) => {
    const arm = arms[k];
    arm.position.set(0.32 * s, 1.0, 0.02);
    if (opts.pose === "forward") arm.rotation.set(-1.3, 0, 0.1 * s);
    else if (opts.pose === "out") arm.rotation.set(0, 0, 1.15 * s);
    else arm.rotation.set(0, 0, 0.28 * s);
    part(arm, capsule(0.095, 0.3), limb, [0, -0.2, 0]);
    paws[k].position.set(0, -0.42, 0);
    ball(paws[k], limb, [0, 0, 0], [0.1, 0.1, 0.09]);
    arm.add(paws[k]);
    g.add(arm);
  });

  const head = new THREE.Group();
  head.position.set(0, 1.3, 0.02);
  ball(head, fur, [0, 0, 0], [0.34, 0.3, 0.3]);
  for (const s of [-1, 1]) {
    ball(head, species === "panda" ? limb : fur, [0.25 * s, 0.22, -0.02], [0.1, 0.1, 0.07]);
    ball(head, felt(pal.inner), [0.25 * s, 0.22, 0.03], [0.055, 0.055, 0.03]);
  }
  if (opts.face !== false) {
    for (const s of [-1, 1]) {
      if (pal.patch) ball(head, felt(pal.patch), [0.11 * s, 0.03, 0.25], [0.07, 0.09, 0.04]).rotation.z = 0.5 * s;
      ball(head, pal.patch ? plain("#f4f1ea") : dark, [0.11 * s, 0.05, 0.27], [0.03, 0.035, 0.025]);
      ball(head, pal.patch ? dark : plain("#ffffff"), [0.11 * s + 0.01, 0.062, 0.29], [0.012, 0.012, 0.008]);
    }
    ball(head, muzzle, [0, -0.08, 0.24], [0.14, 0.1, 0.09]);
    ball(head, dark, [0, -0.03, 0.32], [0.055, 0.038, 0.035]);
    part(head, new THREE.TorusGeometry(0.045, 0.008, 6, 16, Math.PI), dark, [0, -0.11, 0.315], undefined, [0, 0, Math.PI]);
  }
  g.add(head);
  return { g, head, arms, paws, legs, pal };
}

// --- clothing and props -------------------------------------------------------------

function sleeves(r: Rig, mat: THREE.Material) {
  r.arms.forEach((a) => part(a, capsule(0.11, 0.24), mat, [0, -0.16, 0]));
}
function robe(r: Rig, mat: THREE.Material, jagged = true, length = 0.95) {
  const top = 1.08;
  (mat as THREE.MeshStandardMaterial).side = THREE.DoubleSide; // the open hem shows its inside
  part(r.g, cyl(0.3, 0.5, length, 32, true), mat, [0, top - length / 2, 0]);
  part(r.g, cyl(0.12, 0.3, 0.12, 24), mat, [0, top + 0.03, 0]); // shoulders
  if (jagged) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      part(r.g, cone(0.07, 0.12, 4), mat, [Math.sin(a) * 0.49, top - length - 0.05, Math.cos(a) * 0.49], undefined, [Math.PI, 0, 0]);
    }
  }
  sleeves(r, mat);
}
function cape(r: Rig, outer: string, inner: string, collar = true) {
  const o = felt(outer, { side: THREE.FrontSide }), i = felt(inner, { side: THREE.BackSide });
  const geo = cyl(0.34, 0.64, 1.05, 40, true, Math.PI * 0.32, Math.PI * 1.36);
  part(r.g, geo, o, [0, 0.6, -0.04]);
  part(r.g, geo, i, [0, 0.6, -0.04]);
  for (let k = 0; k < 14; k++) {
    const a = Math.PI * 0.32 + (k + 0.5) * ((Math.PI * 1.36) / 14);
    part(r.g, cone(0.06, 0.12, 4), o, [Math.sin(a) * 0.64, 0.02, Math.cos(a) * 0.64 - 0.04], undefined, [Math.PI, 0, 0]);
  }
  if (collar) {
    const c = cyl(0.55, 0.3, 0.52, 32, true, Math.PI * 0.38, Math.PI * 1.24);
    part(r.g, c, o, [0, 1.28, -0.04]);
    part(r.g, c, i, [0, 1.28, -0.04]);
  }
}
function shirt(r: Rig, mat: THREE.Material) {
  ball(r.g, mat, [0, 0.74, 0], [0.4, 0.43, 0.35]);
  sleeves(r, mat);
}
function pointyHat(r: Rig, color: string, h: number, crooked: number, band?: string) {
  const mat = felt(color);
  part(r.head, cyl(0.42, 0.42, 0.03, 32), mat, [0, 0.22, -0.02]);
  const lower = part(r.head, cyl(0.12, 0.26, h * 0.6, 20), mat, [0, 0.22 + h * 0.3, -0.02]);
  const tip = part(r.head, cone(0.12, h * 0.5, 20), mat, [crooked * 0.12, 0.22 + h * 0.6 + h * 0.2, -0.02 - crooked * 0.05], undefined, [-crooked * 0.3, 0, -crooked * 0.6]);
  if (band) part(r.head, cyl(0.245, 0.26, 0.06, 20), felt(band), [0, 0.27, -0.02]);
  return { lower, tip };
}
const stars = (parent: THREE.Object3D, n: number, at: (k: number) => V3) => {
  const gold = plain("#f2c14e", { emissive: "#6a4a00" });
  for (let k = 0; k < n; k++) part(parent, new THREE.OctahedronGeometry(0.03), gold, at(k), [1, 1, 0.4]);
};

// props held in a paw, standing upright
function stick(paw: THREE.Group, len: number, color: string, below = 0.6) {
  return part(paw, cyl(0.022, 0.022, len, 8), felt(color), [0, len / 2 - len * below, 0.06]);
}
function magnifier(paw: THREE.Group) {
  stick(paw, 0.3, "#3a2a20", 0.3);
  part(paw, new THREE.TorusGeometry(0.09, 0.018, 8, 24), plain("#2a2a2a", { metalness: 0.5 }), [0, 0.3, 0.06]);
  part(paw, new THREE.CircleGeometry(0.085, 24), plain("#bfe6ff", { transparent: true, opacity: 0.45 }), [0, 0.3, 0.065]);
}
function laptop(paw: THREE.Group) {
  const l = new THREE.Group();
  part(l, box(0.32, 0.02, 0.22), plain("#8a8f99", { metalness: 0.3 }), [0, 0, 0]);
  part(l, box(0.32, 0.22, 0.02), plain("#6b707a", { metalness: 0.3 }), [0, 0.11, -0.11]);
  part(l, new THREE.PlaneGeometry(0.28, 0.18), plain("#9fffc4", { emissive: "#2aa86a" }), [0, 0.11, -0.098]);
  l.position.set(0, -0.06, 0.16);
  l.rotation.x = 0.2;
  paw.add(l);
}

// --- costumes ---------------------------------------------------------------------

const COSTUMES: Record<Costume, (r: Rig) => void> = {
  vampire(r) {
    const hair = felt("#1c1a1c");
    part(r.head, new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, 1.0), hair, [0, 0.04, -0.03], [0.36, 0.33, 0.33], [-0.5, 0, 0]);
    part(r.head, cone(0.07, 0.13, 4), hair, [0, 0.2, 0.23], undefined, [Math.PI + 0.5, Math.PI / 4, 0]);
    for (const s of [-1, 1]) {
      part(r.head, cone(0.018, 0.06, 8), plain("#f6f0e2"), [0.045 * s, -0.17, 0.3], undefined, [Math.PI, 0, 0]);
      part(r.head, box(0.11, 0.025, 0.03), plain(DARK), [0.11 * s, 0.13, 0.26], undefined, [0, 0, -0.38 * s]); // angry brows
      part(r.g, cone(0.05, 0.11, 4), plain(DARK), [0.06 * s, 1.07, 0.3], undefined, [0, 0, (Math.PI / 2) * s]);
    }
    part(r.g, cyl(0.04, 0.04, 0.025, 20), plain("#e0aa2e", { metalness: 0.6, roughness: 0.35 }), [0, 1.07, 0.32], undefined, [Math.PI / 2, 0, 0]);
    cape(r, "#1d1a1f", "#a3121f");
  },
  witch(r) {
    robe(r, felt("#5b2a86"));
    pointyHat(r, "#4a2370", 0.62, 1, "#1d1a1f");
    part(r.head, box(0.08, 0.06, 0.02), plain("#e0aa2e", { metalness: 0.5 }), [0, 0.27, 0.24]);
    const broom = stick(r.paws[1], 1.15, "#7a4f2a", 0.75);
    part(r.paws[1], cone(0.12, 0.3, 12), felt("#d9a64a"), [0, -0.93, 0.06], undefined, [Math.PI, 0, 0]);
    broom.rotation.z = 0.05;
  },
  frankenstein(r) {
    part(r.head, box(0.58, 0.14, 0.5), felt("#3d5a2e"), [0, 0.25, -0.02]);
    for (let k = 0; k < 3; k++) part(r.head, box(0.012, 0.06, 0.01), plain(DARK), [-0.06 + k * 0.06, 0.16, 0.285]);
    part(r.head, box(0.18, 0.012, 0.01), plain(DARK), [0, 0.16, 0.285]);
    for (const s of [-1, 1]) part(r.g, cyl(0.035, 0.035, 0.16, 10), plain("#9aa0a8", { metalness: 0.7 }), [0.24 * s, 1.1, 0], undefined, [0, 0, Math.PI / 2]);
    part(r.g, cyl(0.36, 0.44, 0.8, 32, true, Math.PI * 0.18, Math.PI * 1.64), felt("#2b2a33", { side: THREE.DoubleSide }), [0, 0.68, 0]);
    sleeves(r, felt("#2b2a33"));
    part(r.paws[1], box(0.05, 0.32, 0.03), plain("#9aa0a8", { metalness: 0.7 }), [0, 0.05, 0.06]);
    part(r.paws[1], new THREE.TorusGeometry(0.05, 0.02, 8, 16, Math.PI * 1.5), plain("#9aa0a8", { metalness: 0.7 }), [0, 0.24, 0.06]);
  },
  skeleton(r) {
    const suit = felt("#1a1a1f"), bone = plain("#f2efe6");
    shirt(r, suit);
    r.legs.forEach((l) => part(r.g, capsule(0.16, 0.2), suit, [l.position.x, 0.23, 0]));
    // ribs are horizontal arcs across the front, with a spine down the middle
    for (let k = 0; k < 4; k++) {
      part(r.g, new THREE.TorusGeometry(0.3 - k * 0.02, 0.016, 6, 24, Math.PI * 0.55), bone, [0, 0.98 - k * 0.1, 0.02], [1, 1, 1.15], [Math.PI / 2, 0, Math.PI * 0.225]);
    }
    part(r.g, box(0.04, 0.42, 0.02), bone, [0, 0.8, 0.39]);
    part(r.g, box(0.22, 0.08, 0.02), bone, [0, 0.5, 0.36]);
    r.arms.forEach((a) => part(a, capsule(0.02, 0.26), bone, [0, -0.16, 0.11]));
    r.legs.forEach((l) => part(r.g, capsule(0.022, 0.18), bone, [l.position.x, 0.25, 0.16]));
    part(r.paws[1], cyl(0.05, 0.05, 0.34, 16), felt("#e8d6a8"), [0, 0, 0.08], undefined, [0, 0, 0.3]);
  },
  mummy(r) {
    const wrap = felt("#e9dfc6");
    for (let k = 0; k < 7; k++) part(r.g, new THREE.TorusGeometry(0.36 - Math.abs(k - 3) * 0.04, 0.035, 6, 32), wrap, [0, 0.42 + k * 0.1, 0], [1, 0.87, 1], [Math.PI / 2 + (k % 2 ? 0.12 : -0.1), 0, 0]);
    for (let k = 0; k < 3; k++) part(r.head, new THREE.TorusGeometry(0.31, 0.03, 6, 32), wrap, [0, 0.14 - k * 0.12, 0], [1, 1, 0.95], [Math.PI / 2 + (k - 1) * 0.15, 0, 0]);
    r.arms.forEach((a) => [0, 1, 2].forEach((k) => part(a, new THREE.TorusGeometry(0.1, 0.025, 6, 16), wrap, [0, -0.08 - k * 0.11, 0], undefined, [Math.PI / 2, 0, 0.2])));
    r.legs.forEach((l) => [0, 1].forEach((k) => part(r.g, new THREE.TorusGeometry(0.15, 0.028, 6, 16), wrap, [l.position.x, 0.18 + k * 0.14, 0], undefined, [Math.PI / 2, 0, 0])));
    laptop(r.paws[1]);
  },
  ghost(r) {
    const sheet = plain("#f6f4ff", { side: THREE.DoubleSide, emissive: "#3a3560" });
    const pts = [[0.001, 1.66], [0.18, 1.63], [0.32, 1.5], [0.37, 1.3], [0.38, 1.05], [0.44, 0.7], [0.52, 0.35], [0.58, 0.14]].map(([x, y]) => new THREE.Vector2(x, y));
    part(r.g, new THREE.LatheGeometry(pts, 40), sheet, [0, 0, 0]);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ball(r.g, sheet, [Math.sin(a) * 0.55, 0.13, Math.cos(a) * 0.55], [0.09, 0.06, 0.09]);
    }
    for (const s of [-1, 1]) ball(r.g, plain(DARK), [0.12 * s, 1.36, 0.355], [0.05, 0.07, 0.02]);
    r.arms.forEach((a) => (a.visible = false));
    const hand = new THREE.Group();
    hand.position.set(0.52, 0.75, 0.2);
    r.g.add(hand);
    magnifier(hand);
  },
  wizard(r) {
    const blue = felt("#1f2a5a");
    robe(r, blue, false, 1.0);
    stars(r.g, 10, (k) => {
      const a = -0.9 + (k % 5) * 0.45;
      const y = 0.25 + Math.floor(k / 5) * 0.4 + (k % 2) * 0.1;
      const rad = 0.31 + (1.08 - y) * 0.2;
      return [Math.sin(a) * rad, y, Math.cos(a) * rad];
    });
    pointyHat(r, "#1f2a5a", 0.7, 0.2);
    stars(r.head, 4, (k) => [Math.sin(k * 1.6) * 0.17, 0.4 + k * 0.08, 0.2 - k * 0.04]);
    stick(r.paws[1], 0.12, "#3a2a20", 0.5);
    part(r.paws[1], cone(0.05, 0.36, 10), plain("#f6f0e2"), [0, 0.2, 0.06], [1, 1, 0.25]);
  },
  pirate(r) {
    const coat = felt("#2a2228", { side: THREE.DoubleSide });
    part(r.g, cyl(0.36, 0.48, 0.95, 32, true, Math.PI * 0.16, Math.PI * 1.68), coat, [0, 0.6, 0]);
    sleeves(r, coat);
    for (let k = 0; k < 4; k++) part(r.g, cyl(0.025, 0.025, 0.02, 12), plain("#e0aa2e", { metalness: 0.6 }), [0.17, 0.95 - k * 0.15, 0.36], undefined, [Math.PI / 2, 0, 0]);
    const black = felt("#16131a");
    part(r.head, cyl(0.42, 0.42, 0.03, 3), black, [0, 0.24, -0.02], undefined, [0, Math.PI, 0]);
    part(r.head, cyl(0.2, 0.25, 0.16, 20), black, [0, 0.32, -0.02]);
    ball(r.head, plain("#f2efe6"), [0, 0.3, 0.22], [0.04, 0.04, 0.02]);
    ball(r.head, plain(DARK), [-0.11, 0.05, 0.285], [0.06, 0.055, 0.02]);
    part(r.head, new THREE.TorusGeometry(0.315, 0.008, 6, 40), plain(DARK), [0, 0.1, 0], undefined, [Math.PI / 2 - 0.25, 0, 0.3]);
    part(r.paws[1], cyl(0.035, 0.05, 0.42, 14), plain("#b8862f", { metalness: 0.6 }), [0, 0.04, 0.08], undefined, [0.3, 0, 0]);
  },
  pumpkin(r) {
    const orange = felt("#f07a1e");
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      ball(r.g, orange, [Math.sin(a) * 0.2, 0.74, Math.cos(a) * 0.17], [0.24, 0.42, 0.24]);
    }
    const face = plain("#2a1408", { emissive: "#ff8a1a", emissiveIntensity: 0.5 });
    const tri = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.06, 0), new THREE.Vector2(0.06, 0), new THREE.Vector2(0, 0.08)]));
    for (const s of [-1, 1]) part(r.g, tri, face, [0.11 * s, 0.86, 0.43]);
    const mouth = new THREE.Shape([new THREE.Vector2(-0.16, 0), new THREE.Vector2(-0.08, -0.06), new THREE.Vector2(0, -0.02), new THREE.Vector2(0.08, -0.06), new THREE.Vector2(0.16, 0), new THREE.Vector2(0, -0.12)]);
    part(r.g, new THREE.ShapeGeometry(mouth), face, [0, 0.72, 0.44]);
    part(r.head, cyl(0.04, 0.05, 0.14, 8), felt("#3f6a24"), [0, 0.33, 0], undefined, [0.2, 0, 0.1]);
    part(r.head, new THREE.CircleGeometry(0.07, 3), felt("#4d8a2c", { side: THREE.DoubleSide }), [0.06, 0.32, 0], undefined, [-1.2, 0, 0]);
    sleeves(r, orange);
    stick(r.paws[1], 0.36, "#f2c14e", 0.4);
    part(r.paws[1], cone(0.022, 0.06, 8), plain("#e8c9a0"), [0, 0.25, 0.06]);
  },
  zombie(r) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#4f6b3a"; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "rgba(120,30,30,.55)"; ctx.fillRect(0, 26, 64, 10); ctx.fillRect(26, 0, 10, 64);
    ctx.fillStyle = "rgba(20,30,15,.4)"; ctx.fillRect(0, 8, 64, 4); ctx.fillRect(8, 0, 4, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 4);
    const plaid = new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
    shirt(r, plaid);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      part(r.g, cone(0.05, 0.1, 4), plaid, [Math.sin(a) * 0.36, 0.38, Math.cos(a) * 0.3], undefined, [Math.PI, 0, 0]);
    }
    for (let k = 0; k < 4; k++) part(r.head, box(0.01, 0.06, 0.01), plain(DARK), [0.12 + k * 0.03, 0.16, 0.25], undefined, [0, 0, 0.2]);
    part(r.head, box(0.13, 0.01, 0.01), plain(DARK), [0.165, 0.16, 0.255], undefined, [0, 0, 0.2]);
    r.arms.forEach((a, k) => a.rotation.set(-1.25, 0, (k ? 1 : -1) * 0.08));
    laptop(r.paws[1]);
    r.paws[1].children.at(-1)!.rotation.set(-1.2, 0, 0);
  },
  bat(r) {
    const black = felt("#16131a", { side: THREE.DoubleSide });
    r.arms.forEach((a, k) => {
      a.rotation.set(0, 0, (k ? 1 : -1) * 1.0);
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.lineTo(0.75, 0.12);
      s.quadraticCurveTo(0.62, -0.08, 0.6, -0.28);
      s.quadraticCurveTo(0.45, -0.18, 0.4, -0.42);
      s.quadraticCurveTo(0.28, -0.3, 0.2, -0.5);
      s.quadraticCurveTo(0.12, -0.3, 0, -0.35);
      const w = part(a, new THREE.ShapeGeometry(s), black, [0, -0.05, -0.04], [k ? 1 : -1, 1, 1], [0, 0, -Math.PI / 2 * (k ? 1 : -1) + (k ? 1 : -1) * 1.0]);
      w.rotation.z = (k ? -1 : 1) * 0.55;
    });
    for (const s of [-1, 1]) part(r.head, cone(0.07, 0.2, 4), black, [0.17 * s, 0.33, 0], undefined, [0, 0, -0.25 * s]);
    part(r.head, new THREE.TorusGeometry(0.3, 0.012, 6, 32, Math.PI), plain("#16131a"), [0, 0.12, -0.02], undefined, [0, 0, 0]);
    magnifier(r.paws[1]);
  },
  reaper(r) {
    const cloak = felt("#1e1b24");
    robe(r, cloak, true, 1.02);
    part(r.head, new THREE.SphereGeometry(1, 24, 16, Math.PI * 0.85, Math.PI * 1.3), felt("#1e1b24", { side: THREE.DoubleSide }), [0, 0.04, -0.03], [0.42, 0.4, 0.4]); // open at the front
    stick(r.paws[1], 1.5, "#4a3626", 0.55);
    part(r.paws[1], new THREE.TorusGeometry(0.28, 0.025, 6, 24, Math.PI * 0.6), plain("#c8ccd4", { metalness: 0.8, roughness: 0.3 }), [-0.22, 0.65, 0.06], [1, 1, 0.4], [0, 0, Math.PI * 0.35]);
    part(r.paws[0], box(0.24, 0.3, 0.02), felt("#8a5a32"), [0, -0.05, 0.08], undefined, [0, 0, -0.28]);
    part(r.paws[0], box(0.2, 0.24, 0.01), plain("#f6f0e2"), [0, -0.06, 0.095], undefined, [0, 0, -0.28]);
  },
  devil(r) {
    const red = felt("#c0182a");
    cape(r, "#b0141f", "#5a0a12", false);
    for (const s of [-1, 1]) part(r.head, cone(0.05, 0.18, 10), red, [0.15 * s, 0.32, 0.02], undefined, [0, 0, -0.45 * s]);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.5, -0.3), new THREE.Vector3(0.1, 0.32, -0.55), new THREE.Vector3(0.3, 0.4, -0.7), new THREE.Vector3(0.38, 0.65, -0.62)]);
    part(r.g, new THREE.TubeGeometry(curve, 20, 0.025, 8), red, [0, 0, 0]);
    part(r.g, cone(0.07, 0.12, 3), red, [0.38, 0.7, -0.62]);
    stick(r.paws[1], 1.1, "#6a1a1a", 0.6);
    part(r.paws[1], box(0.24, 0.03, 0.03), red, [0, 0.44, 0.06]);
    for (const x of [-0.11, 0, 0.11]) part(r.paws[1], cone(0.018, 0.14, 6), red, [x, 0.52, 0.06]);
    laptop(r.paws[0]);
  },
  scarecrow(r) {
    const denim = felt("#3d5f8f"), straw = felt("#e0b54a"), shirtMat = felt("#d06a2a");
    part(r.g, cyl(0.36, 0.39, 0.42, 32), denim, [0, 0.55, 0]);
    part(r.g, box(0.34, 0.3, 0.06), denim, [0, 0.86, 0.3], undefined, [-0.15, 0, 0]);
    for (const s of [-1, 1]) part(r.g, box(0.06, 0.5, 0.04), denim, [0.14 * s, 1.0, 0.1], undefined, [-0.6, 0, 0]);
    part(r.g, box(0.1, 0.1, 0.01), felt("#c0503a"), [0.1, 0.5, 0.39]);
    part(r.g, box(0.08, 0.08, 0.01), felt("#7a9a3a"), [-0.12, 0.62, 0.37]);
    sleeves(r, shirtMat);
    r.arms.forEach((a) => {
      for (let k = 0; k < 5; k++) part(a, cone(0.025, 0.14, 4), straw, [Math.sin(k) * 0.07, -0.36, Math.cos(k) * 0.07], undefined, [Math.PI + Math.sin(k) * 0.4, 0, Math.cos(k) * 0.4]);
    });
    part(r.head, cyl(0.46, 0.46, 0.03, 32), straw, [0, 0.22, -0.02]);
    part(r.head, cyl(0.2, 0.24, 0.18, 24), straw, [0, 0.32, -0.02]);
    part(r.head, cyl(0.245, 0.245, 0.05, 24), felt("#8a2a2a"), [0, 0.26, -0.02]);
    magnifier(r.paws[1]);
  },
};

export function buildBear(species: Species, costume: Costume): THREE.Group {
  const r = baseBear(species, { face: costume !== "ghost" });
  COSTUMES[costume](r);
  bake(r.g);
  return r.g;
}
