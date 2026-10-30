"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { SLOTS, type Role, type Status, type Team } from "@/lib/teams";
import { drawBanner, drawEmptyScene, drawSign, drawWallPaper, makeSignCanvas, PINK } from "@/lib/art";

type Props = {
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
  bear: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  sign: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  signCanvas: HTMLCanvasElement;
  panel: THREE.MeshBasicMaterial;
  key: string;
  art: string | null;
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
    scene.background = new THREE.Color("#120d22");
    scene.fog = new THREE.FogExp2("#1a1230", 0.016);
    const camera = new THREE.PerspectiveCamera(40, el.clientWidth / el.clientHeight, 0.1, 300);
    const camPos = new THREE.Vector3(0, 21, 19);
    const camLook = new THREE.Vector3();
    camera.position.copy(camPos);

    // lights: cold moon, warm campfire, a lamp that follows the focused bay
    scene.add(new THREE.HemisphereLight("#7f6fb8", "#1a1020", 1.1));
    const moonLight = new THREE.DirectionalLight("#b9c6ff", 1.4);
    moonLight.position.set(-30, 40, -40);
    scene.add(moonLight);
    const fire = new THREE.PointLight("#ff8a3a", 60, 40, 1.6);
    fire.position.set(0, 1.5, 0);
    scene.add(fire);
    const lamp = new THREE.PointLight("#ffe2b8", 0, 12, 1.5);
    scene.add(lamp);

    const tex = (src: string | HTMLCanvasElement) => {
      const t = typeof src === "string" ? new THREE.TextureLoader().load(src) : new THREE.CanvasTexture(src);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };
    const sceneTex: Record<string, THREE.Texture> = {
      researcher: tex("/scenes/researcher.jpg"),
      coder: tex("/scenes/coder.jpg"),
      writer: tex("/scenes/writer.jpg"),
      planner: tex("/scenes/planner.jpg"),
      empty: tex(drawEmptyScene()),
    };
    const bearTex = new Map<string, THREE.Texture>();
    const bearTexture = (src: string) => {
      if (!bearTex.has(src)) bearTex.set(src, tex(src));
      return bearTex.get(src)!;
    };

    // ground, moon, stars, trees, pumpkins
    const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 64), new THREE.MeshStandardMaterial({ color: "#1d1729", roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 16), new THREE.MeshBasicMaterial({ color: "#f6e9c6", fog: false }));
    moon.position.set(-45, 38, -70);
    scene.add(moon);
    {
      const pts: number[] = [];
      for (let i = 0; i < 700; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(140);
        if (v.y > 5) pts.push(v.x, v.y, v.z);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: "#fff3dc", size: 0.5, fog: false })));
    }
    const pine = new THREE.MeshStandardMaterial({ color: "#0f0b18", roughness: 1 });
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 22 + Math.random() * 30;
      const h = 4 + Math.random() * 6;
      const t = new THREE.Mesh(new THREE.ConeGeometry(h * 0.3, h, 6), pine);
      t.position.set(Math.sin(a) * r, h / 2, Math.cos(a) * r);
      scene.add(t);
    }
    const pumpkinMat = new THREE.MeshStandardMaterial({ color: "#ff7a1a", emissive: "#ff5a00", emissiveIntensity: 0.35, roughness: 0.7 });
    const stemMat = new THREE.MeshStandardMaterial({ color: "#3b5a1e" });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2;
      const r = i % 2 ? 5.2 : 15.5;
      const p = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 10), pumpkinMat);
      body.scale.y = 0.75;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.25), stemMat);
      stem.position.y = 0.4;
      p.add(body, stem);
      p.position.set(Math.sin(a) * r, 0.34, Math.cos(a) * r);
      scene.add(p);
    }

    // campfire
    const flames: THREE.Mesh[] = [];
    {
      const log = new THREE.MeshStandardMaterial({ color: "#4a2c18", roughness: 1 });
      for (let i = 0; i < 4; i++) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.8, 8), log);
        l.rotation.set(Math.PI / 2 - 0.25, (i * Math.PI) / 4, 0);
        l.position.y = 0.25;
        scene.add(l);
      }
      const stone = new THREE.MeshStandardMaterial({ color: "#4a4552", roughness: 1 });
      for (let i = 0; i < 12; i++) {
        const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28), stone);
        s.position.set(Math.sin((i / 12) * Math.PI * 2) * 1.4, 0.15, Math.cos((i / 12) * Math.PI * 2) * 1.4);
        scene.add(s);
      }
      [["#ff5a1a", 0.7, 2.2], ["#ffa133", 0.5, 1.6], ["#ffe08a", 0.28, 1.0]].forEach(([c, r, h]) => {
        const f = new THREE.Mesh(
          new THREE.ConeGeometry(r as number, h as number, 10),
          new THREE.MeshBasicMaterial({ color: c as string, transparent: true, opacity: 0.9 }),
        );
        f.position.y = 0.3 + (h as number) / 2;
        flames.push(f);
        scene.add(f);
      });
    }
    // embers rising off the fire
    const EMBERS = 80;
    const emberPos = new Float32Array(EMBERS * 3);
    const emberGeo = new THREE.BufferGeometry();
    emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPos, 3));
    for (let i = 0; i < EMBERS; i++) emberPos[i * 3 + 1] = Math.random() * 8;
    scene.add(new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: "#ffb347", size: 0.12, transparent: true, opacity: 0.85 })));

    // carousels
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

        // the role scene, split across the two walls like an open pop-up spread
        // unlit: printed paper should read clearly whatever the lights do
        const panel = new THREE.MeshBasicMaterial({ map: sceneTex.empty, color: "#d9d0e0", side: THREE.DoubleSide });
        group.add(
          new THREE.Mesh(quad(left, zero, 0, 0.5, BASE, BASE + H), panel),
          new THREE.Mesh(quad(zero, right, 0.5, 1, BASE, BASE + H), panel),
        );

        const bear = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshStandardMaterial({ transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 }),
        );
        bear.position.copy(dir.clone().multiplyScalar(2.0));
        bear.rotation.y = a;
        bear.visible = false;
        bear.userData = { team: ti, slot: i };
        group.add(bear);

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

        bays.push({ bear, sign, signCanvas, panel, key: "", art: null, role: null, status: null, hop: 0 });
        hits.push(bear, sign);
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
          const role = ag?.role ?? null;
          if (role !== bay.role) {
            bay.role = role;
            bay.panel.map = sceneTex[role ?? "empty"];
            bay.panel.needsUpdate = true;
          }
          const art = ag?.art ?? null;
          if (art !== bay.art) {
            bay.art = art;
            bay.bear.visible = !!art;
            if (art) {
              const t = bearTexture(art);
              bay.bear.material.map = t;
              bay.bear.material.needsUpdate = true;
              const fit = () => {
                const img = t.image as HTMLImageElement | undefined;
                const aspect = img?.width ? img.width / img.height : 0.62;
                bay.bear.scale.set(1.75 * aspect, 1.75, 1);
                bay.bear.userData.baseY = BASE + 0.875;
              };
              fit();
              if (!(t.image as HTMLImageElement | undefined)?.width) setTimeout(fit, 600);
            }
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
    const onResize = () => {
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

      if (focus === null) {
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
          const baseY = (b.bear.userData.baseY as number) ?? BASE + 0.875;
          b.bear.position.y = baseY + Math.sin(b.hop * Math.PI) * 0.5 + (working ? Math.abs(Math.sin(t * 5 + k)) * 0.06 : 0);
          b.bear.rotation.z = working ? Math.sin(t * 3 + k) * 0.06 : Math.sin(t * 0.8 + k) * 0.015;
          // signs swing with the turn
          b.sign.rotation.z = Math.sin(t * 1.3 + k) * 0.025 - d.spin * 0.08;
        });
      });

      flames.forEach((f, i) => {
        f.scale.set(1 + Math.sin(t * 9 + i) * 0.08, 1 + Math.sin(t * 7 + i * 2) * 0.15, 1);
        f.rotation.y = t * (i + 1);
      });
      fire.intensity = 55 + Math.sin(t * 11) * 6 + Math.sin(t * 17) * 4;
      for (let i = 0; i < EMBERS; i++) {
        let y = emberPos[i * 3 + 1] + dt * (0.8 + (i % 5) * 0.25);
        if (y > 8) y = 0.5;
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
