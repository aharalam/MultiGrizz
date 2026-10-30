"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildBear } from "@/lib/bears3d";
import { buildRoom, drawRoomWall, type Room } from "@/lib/rooms3d";
import { SLOTS, type Role, type Status, type Team } from "@/lib/teams";
import { drawBanner, drawGlow, drawMoonCanvas, drawSign, drawWallPaper, makeSignCanvas, PINK } from "@/lib/art";

type Props = {
  intro: boolean;
  teams: Team[];
  focus: number | null;
  bay: number;
  hover: number | null;
  onHover(i: number | null): void;
  onFocus(i: number | null): void;
  onBay(b: number): void;
  onSummon(team: number): void;
};

const R = 3.2; // carousel radius
const H = 3.0; // wall height
const BASE = 0.35;
const RING = 10; // carousels sit on this circle round the campfire
const STEP = Math.PI / 3;

type Bay = {
  bear: THREE.Group | null;
  bearKey: string; // species-costume the current model was built for
  shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  room: Room | null;
  sign: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  signCanvas: HTMLCanvasElement;
  panel: THREE.MeshBasicMaterial;
  key: string;
  role: Role | null;
  status: Status | null;
  hop: number;
};
type Den = {
  group: THREE.Group;
  banner: THREE.Sprite;
  bannerKey: string;
  bays: Bay[];
  phi: number;
  pos: THREE.Vector3;
  theta: number;
  spin: number;
  lift: number;
};

const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));
const ease = (dt: number, k: number) => 1 - Math.exp(-dt * k);

function quad(s: THREE.Vector3, e: THREE.Vector3, u0: number, u1: number, y0: number, y1: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([s.x, y0, s.z, e.x, y0, e.z, e.x, y1, e.z, s.x, y1, s.z], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, 0, u1, 0, u1, 1, u0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

const dirAt = (a: number) => new THREE.Vector3(Math.sin(a), 0, Math.cos(a));

export default function BearWorld(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef(props);
  live.current = props;
  const syncRef = useRef<(teams: Team[]) => void>(() => {});

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#221b3d");
    scene.fog = new THREE.FogExp2("#2b2350", 0.012);
    const camera = new THREE.PerspectiveCamera(40, el.clientWidth / el.clientHeight, 0.1, 300);
    const camPos = new THREE.Vector3(0, 46, 72); // starts high; dives in as the intro opens
    const camLook = new THREE.Vector3();
    camera.position.copy(camPos);

    // lights: a bright cold moon, warm campfire, a lamp that follows the focused bay
    scene.add(new THREE.HemisphereLight("#a99be0", "#2c2244", 1.7));
    const moonLight = new THREE.DirectionalLight("#cdd6ff", 2.4);
    moonLight.position.set(-30, 40, -40);
    scene.add(moonLight);
    const fire = new THREE.PointLight("#ff8a3a", 70, 45, 1.5);
    fire.position.set(0, 1.6, 0);
    scene.add(fire);
    const lamp = new THREE.PointLight("#ffe2b8", 0, 12, 1.5);
    scene.add(lamp);

    const tex = (src: string | HTMLCanvasElement) => {
      const t = typeof src === "string" ? new THREE.TextureLoader().load(src) : new THREE.CanvasTexture(src);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };
    const wallTex: Record<Role | "empty", THREE.Texture> = {
      researcher: tex(drawRoomWall("researcher")),
      coder: tex(drawRoomWall("coder")),
      writer: tex(drawRoomWall("writer")),
      planner: tex(drawRoomWall("planner")),
      empty: tex(drawRoomWall("empty")),
    };
    const glowTex = tex(drawGlow());
    const shadowTex = tex(drawGlow("rgba(0,0,0,.75)", "rgba(0,0,0,0)"));
    const glow = (color: string, size: number, opacity = 1) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.scale.setScalar(size);
      return s;
    };

    // ground, moon, stars
    const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 64), new THREE.MeshStandardMaterial({ color: "#3a3256", roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const moonPos = new THREE.Vector3(-45, 38, -70);
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(drawMoonCanvas(96)), fog: false, transparent: true }));
    moon.scale.setScalar(30);
    moon.position.copy(moonPos);
    const moonHalo = glow("#c9c2ff", 60, 0.5);
    moonHalo.material.fog = false;
    moonHalo.position.copy(moonPos);
    scene.add(moon, moonHalo);
    {
      const pts: number[] = [];
      for (let i = 0; i < 900; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(140);
        if (v.y > 5) pts.push(v.x, v.y, v.z);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: "#fff3dc", size: 0.6, fog: false })));
    }

    // far mountains and a ring of pines
    const mountainMat = new THREE.MeshStandardMaterial({ color: "#2a2347", roughness: 1, flatShading: true });
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const h = 14 + Math.random() * 16;
      const m = new THREE.Mesh(new THREE.ConeGeometry(h * 0.9, h, 5), mountainMat);
      m.position.set(Math.sin(a) * 75, h / 2 - 1, Math.cos(a) * 75);
      m.rotation.y = Math.random() * 3;
      scene.add(m);
    }
    const pine = new THREE.MeshStandardMaterial({ color: "#1b1630", roughness: 1 });
    for (let i = 0; i < 110; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 21 + Math.random() * 34;
      const h = 4 + Math.random() * 7;
      const t = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(h * (0.32 - k * 0.07), h * 0.55, 7), pine);
        c.position.y = h * (0.3 + k * 0.22);
        t.add(c);
      }
      t.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      scene.add(t);
    }

    // dirt paths from the fire to each den
    const pathMat = new THREE.MeshStandardMaterial({ color: "#4c3f5e", roughness: 1 });
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, RING - 4.8), pathMat);
      p.rotation.set(-Math.PI / 2, 0, -a);
      p.position.copy(dirAt(a).multiplyScalar((RING - 3.2) / 2 + 1)).setY(0.01);
      scene.add(p);
    }

    // graveyard between the dens: tombstones, crosses, bare trees
    const stoneMat = new THREE.MeshStandardMaterial({ color: "#8d88a3", roughness: 0.95 });
    const barkMat = new THREE.MeshStandardMaterial({ color: "#2a2030", roughness: 1 });
    for (let i = 0; i < 4; i++) {
      const mid = (i * Math.PI) / 2; // halfway between two dens
      for (let k = 0; k < 6; k++) {
        const a = mid + (Math.random() - 0.5) * 0.5;
        const r = 9 + Math.random() * 7;
        const g = new THREE.Group();
        if (k % 3 === 0) {
          const v = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.16), stoneMat);
          const h = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.16), stoneMat);
          v.position.y = 0.55;
          h.position.y = 0.75;
          g.add(v, h);
        } else {
          const slab = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.18), stoneMat);
          const top = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.18, 16, 1, false, 0, Math.PI), stoneMat);
          slab.position.y = 0.4;
          top.rotation.set(Math.PI / 2, 0, Math.PI / 2);
          top.position.y = 0.8;
          g.add(slab, top);
        }
        g.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
        g.rotation.set((Math.random() - 0.5) * 0.25, a + Math.PI + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.2);
        scene.add(g);
      }
      // a crooked bare tree
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.28, 4, 6), barkMat);
      trunk.position.y = 2;
      trunk.rotation.z = 0.12;
      tree.add(trunk);
      for (let b = 0; b < 5; b++) {
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.09, 1.6, 5), barkMat);
        br.position.set(0, 2.4 + b * 0.35, 0);
        br.rotation.set(0, b * 1.3, 0.9 + (b % 2) * 0.4);
        br.translateY(0.7);
        tree.add(br);
      }
      tree.position.copy(dirAt(mid).multiplyScalar(17.5));
      scene.add(tree);
    }

    // picket fence round the yard
    const fenceMat = new THREE.MeshStandardMaterial({ color: "#3d3550", roughness: 1 });
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      if (i % 30 < 3) continue; // gates
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9 + (i % 2) * 0.15, 0.06), fenceMat);
      post.position.copy(dirAt(a).multiplyScalar(19)).setY(0.45);
      post.rotation.y = a;
      scene.add(post);
    }

    // glowing lanterns on posts, pumpkins along the paths
    const lanterns: THREE.Sprite[] = [];
    const postMat = new THREE.MeshStandardMaterial({ color: "#241c2e" });
    const lanternMat = new THREE.MeshBasicMaterial({ color: "#ffcf7a" });
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 4 + (i % 2 ? 0.35 : -0.35);
      const at = dirAt(a).multiplyScalar(i % 2 ? 6 : 15);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.2, 6), postMat);
      post.position.copy(at).setY(1.1);
      const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.28), lanternMat);
      lantern.position.copy(at).setY(2.35);
      const halo = glow("#ffb85c", 3.2, 0.8);
      halo.position.copy(lantern.position);
      lanterns.push(halo);
      scene.add(post, lantern, halo);
    }
    const pumpkinMat = new THREE.MeshStandardMaterial({ color: "#ff7a1a", emissive: "#ff5a00", emissiveIntensity: 0.45, roughness: 0.7 });
    const stemMat = new THREE.MeshStandardMaterial({ color: "#3b5a1e" });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.2;
      const r = i % 2 ? 5.2 : 15.5;
      const p = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 10), pumpkinMat);
      body.scale.y = 0.75;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.25), stemMat);
      stem.position.y = 0.4;
      const halo = glow("#ff7a1a", 1.6, 0.35);
      halo.position.y = 0.3;
      p.add(body, stem, halo);
      p.position.set(Math.sin(a) * r, 0.34, Math.cos(a) * r);
      scene.add(p);
    }

    // ground fog drifting between the dens
    const fogPuffs: THREE.Sprite[] = [];
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: "#b9b0e8", transparent: true, opacity: 0.09, depthWrite: false }));
      s.scale.set(9 + Math.random() * 6, 2.2, 1);
      const a = Math.random() * Math.PI * 2;
      s.position.set(Math.sin(a) * (6 + Math.random() * 14), 0.6, Math.cos(a) * (6 + Math.random() * 14));
      s.userData.a = a;
      fogPuffs.push(s);
      scene.add(s);
    }

    // bats circling overhead
    const bats: THREE.Group[] = [];
    const batMat = new THREE.MeshBasicMaterial({ color: "#0d0a14", side: THREE.DoubleSide });
    const wing = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.7, 0.15, 0), new THREE.Vector3(0.35, -0.1, 0.25)]);
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Group();
      const l = new THREE.Mesh(wing, batMat);
      const r = new THREE.Mesh(wing, batMat);
      r.scale.x = -1;
      b.add(l, r);
      b.scale.setScalar(0.6);
      b.userData = { r: 6 + Math.random() * 14, h: 7 + Math.random() * 6, s: 0.25 + Math.random() * 0.3, p: Math.random() * 6 };
      bats.push(b);
      scene.add(b);
    }

    // campfire: logs, stones, then a particle flame
    {
      const log = new THREE.MeshStandardMaterial({ color: "#4a2c18", roughness: 1 });
      for (let i = 0; i < 5; i++) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.9, 8), log);
        l.rotation.set(Math.PI / 2 - 0.35, (i * Math.PI * 2) / 5, 0);
        l.position.y = 0.3;
        scene.add(l);
      }
      const stone = new THREE.MeshStandardMaterial({ color: "#5b5568", roughness: 1 });
      for (let i = 0; i < 12; i++) {
        const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3), stone);
        s.position.set(Math.sin((i / 12) * Math.PI * 2) * 1.45, 0.15, Math.cos((i / 12) * Math.PI * 2) * 1.45);
        scene.add(s);
      }
    }
    // Each puff is born at the logs, rises, narrows and cools from white-yellow to red smoke.
    const FLAME = 220;
    const flameGeo = new THREE.BufferGeometry();
    const fp = new Float32Array(FLAME * 3);
    const fs = new Float32Array(FLAME);
    for (let i = 0; i < FLAME; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.6;
      fp.set([Math.sin(a) * r, 0.35, Math.cos(a) * r], i * 3);
      fs[i] = Math.random();
    }
    flameGeo.setAttribute("position", new THREE.BufferAttribute(fp, 3));
    flameGeo.setAttribute("aSeed", new THREE.BufferAttribute(fs, 1));
    const flameMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: 600 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uPx;
        attribute float aSeed;
        varying float vLife;
        void main() {
          float life = fract(uTime * (0.7 + 0.5 * fract(aSeed * 13.7)) + aSeed);
          vec3 p = position;
          p.xz *= 1.0 - life * 0.9;
          p.x += sin(uTime * 4.0 + aSeed * 40.0) * 0.12 * life;
          p.z += cos(uTime * 3.3 + aSeed * 31.0) * 0.12 * life;
          p.y += life * life * 2.4 + life * 0.6;
          vLife = life;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (0.8 - life * 0.5) * uPx / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vLife;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          vec3 hot = vec3(1.0, 0.78, 0.32), mid = vec3(1.0, 0.45, 0.08), cool = vec3(0.55, 0.06, 0.05);
          vec3 col = mix(hot, mid, smoothstep(0.0, 0.35, vLife));
          col = mix(col, cool, smoothstep(0.35, 0.9, vLife));
          gl_FragColor = vec4(col, a * smoothstep(0.0, 0.12, vLife) * (1.0 - vLife) * 0.26);
        }`,
    });
    const flame = new THREE.Points(flameGeo, flameMat);
    flame.frustumCulled = false;
    scene.add(flame);
    const fireGlow = glow("#ff6a1a", 7, 0.35);
    fireGlow.position.y = 1.2;
    scene.add(fireGlow);

    // embers spiralling up off the fire
    const EMBERS = 90;
    const emberPos = new Float32Array(EMBERS * 3);
    const emberGeo = new THREE.BufferGeometry();
    emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPos, 3));
    for (let i = 0; i < EMBERS; i++) emberPos[i * 3 + 1] = Math.random() * 9;
    scene.add(new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: "#ffb347", size: 0.1, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
    // carousels
    const shadowGeo = new THREE.PlaneGeometry(1, 1);
    const wallMats = new Map<string, THREE.MeshStandardMaterial>();
    const cream = new THREE.MeshStandardMaterial({ color: "#efe3c8", roughness: 0.95 });
    const threadMat = new THREE.LineBasicMaterial({ color: PINK });
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hits: THREE.Object3D[] = [];

    const dens: Den[] = live.current.teams.map((team, ti) => {
      const phi = (ti * Math.PI) / 2 + Math.PI / 4;
      const pos = dirAt(phi).multiplyScalar(RING);
      const group = new THREE.Group();
      group.position.copy(pos);
      scene.add(group);

      if (!wallMats.has(team.color)) {
        wallMats.set(team.color, new THREE.MeshStandardMaterial({ map: tex(drawWallPaper(team.color)), roughness: 0.9 }));
      }
      const wallMat = wallMats.get(team.color)!;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.2, R + 0.35, BASE, 64), wallMat);
      base.position.y = BASE / 2;
      const top = new THREE.Mesh(new THREE.CircleGeometry(R + 0.05, 64), cream);
      top.rotation.x = -Math.PI / 2;
      top.position.y = BASE + 0.002;
      const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, H + 0.3, 12), new THREE.MeshStandardMaterial({ color: "#2a2033" }));
      spine.position.y = BASE + (H + 0.3) / 2;
      group.add(base, top, spine);

      const hit = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.4, R + 0.4, H + 1, 16), hitMat);
      hit.position.y = (H + 1) / 2;
      hit.userData = { team: ti };
      group.add(hit);
      hits.push(hit);

      for (let i = 0; i < SLOTS; i++) {
        const a = i * STEP + STEP / 2;
        const wall = new THREE.Mesh(new THREE.BoxGeometry(R, H, 0.04), wallMat);
        wall.rotation.y = a - Math.PI / 2;
        wall.position.copy(dirAt(a).multiplyScalar(R / 2)).setY(BASE + H / 2);
        group.add(wall);
      }

      const bays: Bay[] = [];
      for (let i = 0; i < SLOTS; i++) {
        const a = i * STEP;
        const dir = dirAt(a);
        const left = dirAt(a - STEP / 2 + 0.02).multiplyScalar(R);
        const right = dirAt(a + STEP / 2 - 0.02).multiplyScalar(R);
        const zero = new THREE.Vector3();

        // the room's wallpaper on the two walls; unlit so it reads whatever the lights do
        const panel = new THREE.MeshBasicMaterial({ map: wallTex.empty, color: "#d9d0e0", side: THREE.DoubleSide });
        group.add(
          new THREE.Mesh(quad(left, zero, 0, 0.5, BASE, BASE + H), panel),
          new THREE.Mesh(quad(zero, right, 0.5, 1, BASE, BASE + H), panel),
        );

        // contact shadow under the bear
        const shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.copy(dir.clone().multiplyScalar(2.0)).setY(BASE + 0.012);
        shadow.scale.set(1.1, 0.8, 1);
        shadow.visible = false;
        group.add(shadow);

        const signCanvas = makeSignCanvas();
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(1.7, 1.06),
          new THREE.MeshStandardMaterial({ map: tex(signCanvas), transparent: true, alphaTest: 0.1, roughness: 1, side: THREE.DoubleSide }),
        );
        sign.position.copy(dir.clone().multiplyScalar(2.85)).setY(BASE + 2.45);
        sign.rotation.y = a;
        sign.userData = { team: ti, slot: i };
        group.add(sign);

        // pink thread the sign hangs from, rim to rim
        const ty = BASE + H + 0.05;
        const pts = [left.clone().setY(ty)];
        for (let k = 1; k < 8; k++) {
          const p = left.clone().lerp(right, k / 8);
          p.y = ty - Math.sin((k / 8) * Math.PI) * 0.2;
          pts.push(p);
        }
        pts.push(right.clone().setY(ty));
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), threadMat));

        bays.push({ bear: null, bearKey: "", shadow, room: null, sign, signCanvas, panel, key: "", role: null, status: null, hop: 0 });
        hits.push(sign);
      }

      const banner = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(drawBanner(team)), transparent: true, depthTest: false }));
      banner.scale.set(4.2, 1.45, 1);
      banner.position.set(pos.x, H + 2.4, pos.z);
      banner.renderOrder = 10;
      scene.add(banner);

      return { group, banner, bannerKey: "", bays, phi, pos, theta: phi - ti, spin: 0, lift: 0 };
    });

    // push team data into the paper: signs, bears, scenes, banners
    const sync = (teams: Team[]) => {
      teams.forEach((team, ti) => {
        const den = dens[ti];
        if (!den) return;
        const bk = `${team.name}${team.agents.length}`;
        if (bk !== den.bannerKey) {
          den.bannerKey = bk;
          den.banner.material.map?.dispose();
          den.banner.material.map = tex(drawBanner(team));
        }
        den.bays.forEach((bay, i) => {
          const ag = team.agents[i];
          bay.status = ag?.status ?? null;
          const key = ag ? `${ag.name}|${ag.status}|${Math.round(ag.progress)}|${ag.activity}` : "empty";
          if (key !== bay.key) {
            bay.key = key;
            drawSign(bay.signCanvas, team, ag, i);
            bay.sign.material.map!.needsUpdate = true;
          }
          // the room follows the agent's role; an empty den keeps its starry wallpaper
          const role = ag?.role ?? null;
          if (role !== bay.role) {
            bay.role = role;
            if (bay.room) den.group.remove(bay.room.group);
            bay.room = role ? buildRoom(role) : null;
            if (bay.room) {
              bay.room.group.rotation.y = i * STEP;
              bay.room.group.position.y = BASE;
              den.group.add(bay.room.group);
            }
            bay.panel.map = wallTex[role ?? "empty"];
            bay.panel.needsUpdate = true;
          }
          // the bear: this team's species in the agent's costume
          const bearKey = ag ? `${team.species}-${ag.costume}` : "";
          if (bearKey !== bay.bearKey) {
            bay.bearKey = bearKey;
            if (bay.bear) den.group.remove(bay.bear);
            bay.bear = ag ? buildBear(team.species, ag.costume) : null;
            if (bay.bear) {
              bay.bear.position.copy(dirAt(i * STEP).multiplyScalar(2.0));
              bay.bear.traverse((o) => {
                o.userData = { team: ti, slot: i };
                if ((o as THREE.Mesh).isMesh) hits.push(o);
              });
              den.group.add(bay.bear);
            }
            bay.shadow.visible = !!bay.bear;
          }
        });
      });
    };
    syncRef.current = sync;
    sync(live.current.teams);
    document.fonts?.ready.then(() => {
      dens.forEach((d) => { d.bannerKey = ""; d.bays.forEach((b) => (b.key = "")); });
      sync(live.current.teams);
    });

    // input
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pick = (e: PointerEvent | MouseEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const { focus } = live.current;
      const pool = focus === null ? hits.filter((h) => h.userData.slot === undefined) : hits.filter((h) => h.userData.team === focus && h.userData.slot !== undefined);
      return ray.intersectObjects(pool, false)[0]?.object.userData as { team: number; slot?: number } | undefined;
    };
    const turn = (d: number) => {
      const p = live.current;
      if (p.focus !== null) p.onBay((p.bay + d + SLOTS) % SLOTS);
    };

    let downX = 0;
    let dragging = false;
    let moved = false;
    const onDown = (e: PointerEvent) => { downX = e.clientX; dragging = true; moved = false; };
    const onMove = (e: PointerEvent) => {
      const p = live.current;
      if (dragging && p.focus !== null && Math.abs(e.clientX - downX) > 70) {
        turn(e.clientX < downX ? 1 : -1);
        downX = e.clientX;
        moved = true;
      }
      const hit = pick(e);
      const hoverTeam = p.focus === null ? hit?.team ?? null : null;
      if (hoverTeam !== p.hover) p.onHover(hoverTeam);
      renderer.domElement.style.cursor = hit ? "pointer" : dragging && p.focus !== null ? "grabbing" : "default";
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      if (moved) return;
      const p = live.current;
      const hit = pick(e);
      if (!hit) return;
      if (p.focus === null) return p.onFocus(hit.team);
      const slot = hit.slot!;
      if (!p.teams[p.focus].agents[slot]) {
        // new bears fill the first free den, so turn to it
        p.onSummon(p.focus);
        return p.onBay(p.teams[p.focus].agents.length);
      }
      if (slot !== p.bay) return p.onBay(slot);
      dens[p.focus].bays[slot].hop = 1;
    };
    let wheelAcc = 0;
    let wheelLock = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (live.current.focus === null || performance.now() < wheelLock) return;
      wheelAcc += e.deltaY + e.deltaX;
      if (Math.abs(wheelAcc) > 60) {
        turn(wheelAcc > 0 ? 1 : -1);
        wheelAcc = 0;
        wheelLock = performance.now() + 380;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      const p = live.current;
      if (e.key === "Escape") p.onFocus(null);
      if (e.key === "ArrowRight") turn(1);
      if (e.key === "ArrowLeft") turn(-1);
    };
    const setPx = () => (flameMat.uniforms.uPx.value = (el.clientHeight * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360)));
    setPx();
    const onResize = () => {
      setPx();
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    const c = renderer.domElement;
    c.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    c.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);

    // the one loop: camera, carousels, bears, fire
    const clock = new THREE.Clock();
    const targetPos = new THREE.Vector3();
    const targetLook = new THREE.Vector3();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      const { focus, bay, hover } = live.current;

      if (live.current.intro) {
        targetPos.set(0, 46, 72);
        targetLook.set(0, 0, 0);
      } else if (focus === null) {
        targetPos.set(0, 21, 19);
        targetLook.set(0, 0, 0);
        lamp.intensity += (0 - lamp.intensity) * ease(dt, 4);
      } else {
        const out = dens[focus].pos.clone().normalize();
        targetPos.copy(dens[focus].pos).addScaledVector(out, 9.2).setY(2.6);
        targetLook.copy(dens[focus].pos).setY(1.75);
        lamp.position.copy(dens[focus].pos).addScaledVector(out, 5).setY(3.5);
        lamp.intensity += (26 - lamp.intensity) * ease(dt, 3);
      }
      camPos.lerp(targetPos, ease(dt, 2.6));
      camLook.lerp(targetLook, ease(dt, 3));
      camera.position.copy(camPos);
      camera.lookAt(camLook);

      dens.forEach((d, i) => {
        const before = d.theta;
        if (focus === i) d.theta += wrap(d.phi - bay * STEP - d.theta) * ease(dt, 5);
        else d.theta += dt * 0.18;
        const vel = (d.theta - before) / Math.max(dt, 1e-3);
        d.spin += (vel - d.spin) * ease(dt, 6);
        d.group.rotation.y = d.theta;
        d.lift += ((hover === i ? 0.45 : 0) - d.lift) * ease(dt, 8);
        d.group.position.y = d.lift;
        const showBanner = focus === null ? 1 : 0;
        const m = d.banner.material;
        m.opacity += (showBanner - m.opacity) * ease(dt, 6);
        d.banner.position.y = H + 2.4 + d.lift + Math.sin(t * 1.5 + i) * 0.12;
        const s = hover === i ? 1.12 : 1;
        d.banner.scale.x += (4.2 * s - d.banner.scale.x) * ease(dt, 8);
        d.banner.scale.y = d.banner.scale.x / 2.9;

        d.bays.forEach((b, k) => {
          const working = b.status === "thinking" || b.status === "tool";
          b.hop = Math.max(0, b.hop - dt * 2.2);
          const jump = Math.sin(b.hop * Math.PI) * 0.5 + (working ? Math.abs(Math.sin(t * 5 + k)) * 0.06 : 0);
          b.room?.tick(t);
          // signs swing with the turn
          b.sign.rotation.z = Math.sin(t * 1.3 + k) * 0.025 - d.spin * 0.08;
          const body = b.bear;
          if (!body) return;
          body.position.y = BASE + jump;
          // turn a little on the spot; a hop adds a full spin
          body.rotation.y = k * STEP + Math.sin(t * 0.7 + k * 1.7) * 0.32 + (1 - b.hop) * (b.hop > 0 ? Math.PI * 2 : 0);
          body.rotation.z = working ? Math.sin(t * 3 + k) * 0.06 : Math.sin(t * 0.8 + k) * 0.015;
          const sh = 1 - jump * 0.8;
          b.shadow.material.opacity = 0.85 * sh;
        });
      });

      flameMat.uniforms.uTime.value = t;
      const flicker = Math.sin(t * 11) * 0.5 + Math.sin(t * 17.3) * 0.3 + Math.sin(t * 5.1) * 0.2;
      fire.intensity = 70 + flicker * 12;
      fireGlow.material.opacity = 0.32 + flicker * 0.06;
      fireGlow.scale.setScalar(7 + flicker * 0.5);
      lanterns.forEach((l, i) => (l.material.opacity = 0.7 + Math.sin(t * 6 + i * 2) * 0.12));
      fogPuffs.forEach((f, i) => {
        const a = f.userData.a + t * 0.015 * (i % 2 ? 1 : -1);
        const r = Math.hypot(f.position.x, f.position.z);
        f.position.set(Math.sin(a) * r, 0.6, Math.cos(a) * r);
      });
      bats.forEach((b) => {
        const { r, h, s, p } = b.userData as { r: number; h: number; s: number; p: number };
        const a = t * s + p;
        b.position.set(Math.sin(a) * r, h + Math.sin(t * 1.3 + p) * 0.8, Math.cos(a) * r);
        b.rotation.y = a + Math.PI / 2;
        const flap = Math.sin(t * 14 + p) * 0.7;
        b.children[0].rotation.z = flap;
        b.children[1].rotation.z = -flap;
      });
      for (let i = 0; i < EMBERS; i++) {
        let y = emberPos[i * 3 + 1] + dt * (0.8 + (i % 5) * 0.25);
        if (y > 9) y = 1;
        const a = i * 2.4 + y * 0.6;
        const r = 0.2 + y * 0.12;
        emberPos[i * 3] = Math.sin(a) * r;
        emberPos[i * 3 + 1] = y;
        emberPos[i * 3 + 2] = Math.cos(a) * r;
      }
      emberGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      c.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      c.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      el.removeChild(c);
    };
  }, []);

  useEffect(() => syncRef.current(props.teams), [props.teams]);

  return <div ref={host} className="absolute inset-0" />;
}
