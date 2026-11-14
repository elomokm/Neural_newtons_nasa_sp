// Globe WebGL en relief (three.js). Pins et repères sont des éléments HTML projetés : nets, stylables, interactifs.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as d3 from 'd3';
import { feature, mesh } from 'topojson-client';
import topo50 from 'world-atlas/countries-50m.json';
import names from './country-names.json';
import capitals from './capitals.json';
import mapUrl from '../public/assets/earth-blue-marble.jpg';
import bumpUrl from '../public/assets/earth-topology.png';
import waterUrl from '../public/assets/earth-water.png';

const NAMES = Object.fromEntries(names.map((c) => [c.n, c]));
const FEATURES = feature(topo50, topo50.objects.countries).features;
const BORDERS = mesh(topo50, topo50.objects.countries, (a, b) => a !== b);
const COAST = mesh(topo50, topo50.objects.countries, (a, b) => a === b);
const BY_ID = new Map(FEATURES.map((f) => [f.id, f]));
const BOUNDS = new Map(FEATURES.map((f) => [f, d3.geoBounds(f)]));
const rad = Math.PI / 180;

export const countryName = (id, lang) => {
  const n = NAMES[id];
  if (n) return n[lang === 'en' ? 'en' : 'fr'];
  const f = BY_ID.get(id);
  return f && f.properties ? f.properties.name : null;
};
export const capitalOf = (id) => (capitals[id] ? { ...capitals[id], id } : null);

export function countryAt(lon, lat) {
  for (const f of FEATURES) {
    const [[x0, y0], [x1, y1]] = BOUNDS.get(f);
    if (lat < y0 || lat > y1) continue;
    const inLon = x0 <= x1 ? lon >= x0 && lon <= x1 : lon >= x0 || lon <= x1;
    if (inLon && d3.geoContains(f, [lon, lat])) return f;
  }
  return null;
}
export const countryNameAt = (lon, lat, lang) => {
  const f = countryAt(lon, lat);
  return f ? countryName(f.id, lang) : null;
};

export const toVec = (lat, lon, r = 1) => new THREE.Vector3(r * Math.cos(lat * rad) * Math.cos(lon * rad), r * Math.sin(lat * rad), -r * Math.cos(lat * rad) * Math.sin(lon * rad));
const toLonLat = (p) => ({ lat: Math.asin(THREE.MathUtils.clamp(p.y / p.length(), -1, 1)) / rad, lon: Math.atan2(-p.z, p.x) / rad });

function overlayTexture(draw, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, ctx, canvas: c };
}

const PIN = (color, glyph, size) => `<svg viewBox="0 0 28 36" width="${size}" height="${Math.round(size * 36 / 28)}"><path d="M14 35.500S2.500 22.800 2.500 13.600a11.500 11.500 0 0 1 23 0C25.500 22.800 14 35.500 14 35.500z" fill="${color}"/><path d="M14 2.100a11.500 11.500 0 0 0-11.500 11.500c0 1.600.4 3.200 1.100 4.800C6.700 8.800 17 6.600 25.400 12.800A11.500 11.500 0 0 0 14 2.100z" fill="#fff" opacity=".28"/><circle cx="14" cy="13.600" r="5.600" fill="#0B1740" opacity=".92"/>${glyph}</svg>`;
const GLYPH = {
  up: (c) => `<path d="M14 10.300l3.300 5.400h-6.600z" fill="#fff"/>`,
  down: (c) => `<path d="M14 16.900l3.300-5.400h-6.600z" fill="#fff"/>`,
  none: (c) => `<rect x="11" y="12.600" width="6" height="2" rx="1" fill="#fff" opacity=".7"/>`
};

export function createGlobe(host, opts = {}) {
  const cb = { pick: () => {}, hover: () => {}, markerHover: () => {}, ...opts };
  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  host.appendChild(canvas);
  const layer = document.createElement('div');
  layer.className = 'pins';
  host.appendChild(layer);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
  camera.position.copy(toVec(22, 8, 5.3));

  // éclairage de studio : toute la face visible reste lisible, le relief ressort
  scene.add(new THREE.AmbientLight(0xbfd2ff, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6fa0ff, 0.9);
  rim.position.set(-4, -1, -3);
  scene.add(rim);

  const loader = new THREE.TextureLoader();
  const tex = (url, srgb) => {
    const t = loader.load(url, () => {
      dirty = true;
    });
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  const baseMap = tex(mapUrl, true);
  const bump = tex(bumpUrl, false);
  const water = tex(waterUrl, false);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 192, 192),
    new THREE.MeshPhongMaterial({ map: baseMap, bumpMap: bump, bumpScale: 0.9, displacementMap: bump, displacementScale: 0.028, displacementBias: -0.012, specularMap: water, specular: new THREE.Color(0x4466aa), shininess: 22 })
  );
  earth.renderOrder = -2;
  scene.add(earth);

  // frontières et côtes, dessinées une fois
  const lines = overlayTexture((ctx, W, H) => {
    const proj = d3.geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]);
    const path = d3.geoPath(proj, ctx);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    path(COAST);
    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    path(BORDERS);
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    // graticule très discret
    ctx.beginPath();
    path(d3.geoGraticule().step([30, 30])());
    ctx.strokeStyle = 'rgba(190,210,255,.13)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }, 4096, 2048);
  const linesMesh = new THREE.Mesh(new THREE.SphereGeometry(1.0015, 128, 128), new THREE.MeshBasicMaterial({ map: lines.tex, transparent: true, depthWrite: false }));
  scene.add(linesMesh);

  // surbrillance du pays survolé
  const hi = overlayTexture(() => {}, 2048, 1024);
  const hiMesh = new THREE.Mesh(new THREE.SphereGeometry(1.0025, 96, 96), new THREE.MeshBasicMaterial({ map: hi.tex, transparent: true, depthWrite: false }));
  scene.add(hiMesh);
  let hiId = null;
  const paintHi = (f, color) => {
    const { ctx, canvas: c } = hi;
    ctx.clearRect(0, 0, c.width, c.height);
    if (f) {
      const proj = d3.geoEquirectangular().scale(c.width / (2 * Math.PI)).translate([c.width / 2, c.height / 2]);
      const path = d3.geoPath(proj, ctx);
      ctx.beginPath();
      path(f);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    hi.tex.needsUpdate = true;
    dirty = true;
  };

  // atmosphère
  const glowMat = (inner) =>
    new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: inner ? THREE.FrontSide : THREE.BackSide,
      vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
      fragmentShader: inner
        ? 'varying vec3 vN; void main(){ float i = pow(1.0 - max(dot(vN, vec3(0.0,0.0,1.0)),0.0), 2.6); gl_FragColor = vec4(0.45,0.7,1.0,1.0)*i*0.4; }'
        : 'varying vec3 vN; void main(){ float i = pow(max(0.62 - dot(vN, vec3(0.0,0.0,1.0)),0.0), 3.0); gl_FragColor = vec4(0.36,0.6,1.0,1.0)*i*1.15; }'
    });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.16, 96, 96), glowMat(false));
  const rimMesh = new THREE.Mesh(new THREE.SphereGeometry(1.006, 96, 96), glowMat(true));
  scene.add(halo, rimMesh);

  // étoiles
  const N = 2600;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(120 + Math.random() * 60);
    pos.set([v.x, v.y, v.z], i * 3);
    const b = 0.45 + Math.random() * 0.55;
    col.set([b * 0.85, b * 0.92, b], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
  scene.add(stars);

  // contrôles
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 1.04;
  controls.maxDistance = 9;
  controls.zoomSpeed = 0.7;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.45;
  let dragging = false;
  let lastInput = 0;
  let dirty = true;
  controls.addEventListener('start', () => {
    userMoved = true;
    dragging = true;
    controls.autoRotate = false;
    anim = null;
    lastInput = performance.now();
  });
  controls.addEventListener('end', () => {
    dragging = false;
    lastInput = performance.now();
  });
  controls.addEventListener('change', () => {
    viewStamp = performance.now();
    viewPending = true;
    dirty = true;
    controls.rotateSpeed = THREE.MathUtils.clamp((camera.position.length() - 1) * 0.42, 0.1, 1.1);
  });

  // marqueurs HTML
  const markers = new Map();
  const pinBox = {};
  let palette = { up: '#FF7A66', down: '#5AA9FF' };
  const tmp = new THREE.Vector3();
  const colorOf = (d) => (d === 'up' ? palette.up : d === 'down' ? palette.down : '#9AA8C9');

  function makeMarker(it) {
    const el = document.createElement('button');
    el.className = 'mk';
    el.setAttribute('aria-label', it.id);
    paintMarker(el, it);
    el.addEventListener('pointerenter', () => {
      const r = host.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      cb.markerHover(it, b.left - r.left + b.width / 2, b.top - r.top);
    });
    el.addEventListener('pointerleave', () => cb.markerHover(null));
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      cb.pick({ lat: it.lat, lon: it.lon, placeId: /^[a-z]+$/.test(it.id) ? it.id : null });
    });
    layer.appendChild(el);
    return el;
  }
  function paintMarker(el, it) {
    const c = colorOf(it.direction);
    const sig = it.direction !== 'inconclusive';
    el.classList.toggle('weak', !sig);
    el.innerHTML = PIN(sig ? c : 'rgba(150,165,205,.9)', GLYPH[sig ? it.direction : 'none'](sig ? c : '#6B7BA6'), sig ? 21 : 15);
    el.style.setProperty('--c', c);
  }

  function makeBadge(letter, color) {
    const el = document.createElement('div');
    el.className = 'badge-pin';
    el.style.setProperty('--c', color);
    el.innerHTML = `<i class="ripple"></i><span class="body"><svg viewBox="0 0 28 36" width="38" height="49"><path d="M14 35S3 22.500 3 13.500a11 11 0 0 1 22 0C25 22.500 14 35 14 35z" fill="${color}"/></svg><b></b></span>`;
    layer.appendChild(el);
    return el;
  }
  const capEl = document.createElement('div');
  capEl.className = 'cap-pin';
  capEl.innerHTML = '<i></i><span></span>';
  layer.appendChild(capEl);
  let capData = null;

  // capitales toujours visibles, triées par importance, sans chevauchement
  const PRIORITY = ['Paris','London','Washington, D.C.','Beijing','Moscow','Tokyo','New Delhi','Brasília','Cairo','Canberra','Ottawa','Mexico City','Buenos Aires','Pretoria','Nairobi','Abuja','Berlin','Madrid','Rome','Ankara','Riyadh','Tehran','Jakarta','Seoul','Bangkok','Hanoi','Manila','Kinshasa','Addis Ababa','Algiers','Lima','Bogotá','Santiago','Caracas','Kyiv','Warsaw','Stockholm','Oslo','Wellington','Islamabad','Dhaka','Baghdad','Khartoum','Luanda','Nuuk','Reykjavik','Ulaanbaatar','Astana','Dakar','Rabat'];
  const rank = (n) => { const i = PRIORITY.indexOf(n); return i < 0 ? 999 : i; };
  const capList = Object.entries(capitals).map(([id, c]) => {
    const el = document.createElement('div');
    el.className = 'cp';
    el.innerHTML = `<i></i><span>${c.n}</span>`;
    layer.appendChild(el);
    return { id, ...c, el, p: rank(c.n), wd: c.n.length * 6.4 + 18, on: false };
  }).sort((a, b) => a.p - b.p);
  let capsOn = true;
  let capTick = 0;
  function updateCapitals() {
    const d = camera.position.length();
    const labelBudget = d > 3.0 ? 0 : d > 2.5 ? 8 : 400;
    const boxes = [];
    for (const m of markers.values()) { const b = m.el._p; if (b) boxes.push([b.x - 16, b.y - 36, 32, 40]); }
    for (const k of ['A', 'B']) if (pinBox[k] && pinBox[k].el._p) { const b = pinBox[k].el._p; boxes.push([b.x - 24, b.y - 60, 48, 66]); }
    let n = 0;
    for (const c of capList) {
      tmp.copy(toVec(c.lat, c.lon, 1.004));
      const facing = tmp.dot(camera.position) - 1;
      const hidden = !capsOn || facing < 0.04 || (capData && capData.n === c.n);
      if (hidden) { if (c.on) { c.on = false; c.el.classList.remove('on', 'lab'); } continue; }
      tmp.project(camera);
      const x = (tmp.x * 0.5 + 0.5) * w.W;
      const y = (-tmp.y * 0.5 + 0.5) * w.H;
      c.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      c.el.style.setProperty('--a', Math.min(1, (facing - 0.04) / 0.2).toFixed(2));
      let lab = false;
      if (n < labelBudget) {
        const bx = [x - 4, y - 8, c.wd + 4, 16];
        if (!boxes.some((q) => bx[0] < q[0] + q[2] && bx[0] + bx[2] > q[0] && bx[1] < q[1] + q[3] && bx[1] + bx[3] > q[1])) { boxes.push(bx); lab = true; n++; }
      }
      if (!c.on) { c.on = true; c.el.classList.add('on'); }
      if (lab !== c.lab) { c.lab = lab; c.el.classList.toggle('lab', lab); }
    }
  }


  // ---- détail haute résolution : imagerie NASA GIBS qui suit la zone visible (îles, côtes fines) ----
  let patch = null;
  let patchKey = '';
  let viewStamp = 0;
  let viewPending = false;
  const DETAIL_LAYER = 'BlueMarble_ShadedRelief_Bathymetry';
  function dropPatch() {
    if (!patch) return;
    scene.remove(patch);
    patch.geometry.dispose();
    patch.material.map && patch.material.map.dispose();
    patch.material.dispose();
    patch = null;
    patchKey = '';
    linesMesh.visible = true;
    dirty = true;
  }
  function updateDetail() {
    const d = camera.position.length();
    if (d > 2.6) return dropPatch();
    const dir = camera.position.clone().normalize();
    const lat = (Math.asin(dir.y) * 180) / Math.PI;
    const lon = (Math.atan2(-dir.z, dir.x) * 180) / Math.PI;
    const tanH = Math.tan((camera.fov * Math.PI) / 360) * Math.max(1, camera.aspect);
    const halfRad = Math.min(Math.acos(1 / d), (d - 1) * tanH * 1.5 + 0.03);
    const half = (halfRad * 180) / Math.PI;
    const lonHalf = Math.min(90, half / Math.max(Math.cos((lat * Math.PI) / 180), 0.3));
    const latMin = Math.max(-89.9, lat - half);
    const latMax = Math.min(89.9, lat + half);
    const lonMin = Math.max(-180, lon - lonHalf);
    const lonMax = Math.min(180, lon + lonHalf);
    const q = Math.max(0.5, half / 6);
    const key = [Math.round(latMin / q), Math.round(latMax / q), Math.round(lonMin / q), Math.round(lonMax / q)].join('|');
    if (key === patchKey) return;
    const lonSpan = lonMax - lonMin;
    const latSpan = latMax - latMin;
    const W = Math.round(THREE.MathUtils.clamp(lonSpan / 0.0045, 768, 2048));
    const H = Math.max(256, Math.round((W * latSpan) / lonSpan));
    const url = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${DETAIL_LAYER}&STYLES=&FORMAT=image/jpeg&CRS=EPSG:4326&BBOX=${latMin},${lonMin},${latMax},${lonMax}&WIDTH=${W}&HEIGHT=${H}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (camera.position.length() > 2.7) return;
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, W, H);
      const proj = d3.geoEquirectangular().scale(W / ((lonSpan * Math.PI) / 180)).center([(lonMin + lonMax) / 2, (latMin + latMax) / 2]).translate([W / 2, H / 2]);
      const path = d3.geoPath(proj, ctx);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      path(COAST);
      ctx.strokeStyle = 'rgba(255,255,255,.34)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      path(BORDERS);
      ctx.strokeStyle = 'rgba(255,255,255,.62)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const map = new THREE.CanvasTexture(cv);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const rad = (x) => (x * Math.PI) / 180;
      const geo = new THREE.SphereGeometry(1.0009, 128, 128, rad(lonMin + 180), rad(lonSpan), rad(90 - latMax), rad(latSpan));
      const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ map, specular: new THREE.Color(0x223355), shininess: 8, depthWrite: false, depthTest: false }));
      mesh.renderOrder = -1;
      const old = patch;
      patch = mesh;
      patchKey = key;
      scene.add(mesh);
      linesMesh.visible = false;
      if (old) {
        scene.remove(old);
        old.geometry.dispose();
        old.material.map && old.material.map.dispose();
        old.material.dispose();
      }
      dirty = true;
    };
    img.onerror = () => { /* hors ligne : on garde la carte 4K de base */ };
    img.src = url;
  }

  const w = { W: 1, H: 1 };
  function place(el, lat, lon, anchorY, radius = 1.012) {
    tmp.copy(toVec(lat, lon, radius));
    const facing = tmp.dot(camera.position) / radius - 1; // > 0 : visible
    const a = THREE.MathUtils.clamp(facing / 0.18, 0, 1);
    if (a <= 0.01) {
      el.style.opacity = 0;
      el.style.pointerEvents = 'none';
      return null;
    }
    tmp.project(camera);
    const x = (tmp.x * 0.5 + 0.5) * w.W;
    const y = (-tmp.y * 0.5 + 0.5) * w.H;
    el.style.opacity = a;
    el.style.pointerEvents = a > 0.6 ? 'auto' : 'none';
    el.style.transform = `translate3d(${x.toFixed(1)}px,${(y - (anchorY || 0)).toFixed(1)}px,0)`;
    el._p = { x, y };
    return { x, y };
  }

  // survol et clic
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickSphere = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 48));
  function hit(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObject(pickSphere)[0];
    return h ? toLonLat(h.point) : null;
  }
  let hoverRaf = 0;
  let lastMove = null;
  canvas.addEventListener('pointermove', (e) => {
    lastMove = e;
    if (dragging || hoverRaf) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0;
      const ev = lastMove;
      const ll = hit(ev.clientX, ev.clientY);
      const r = canvas.getBoundingClientRect();
      if (!ll) return setHover(null);
      setHover({ ...ll, x: ev.clientX - r.left, y: ev.clientY - r.top });
    });
  });
  canvas.addEventListener('pointerleave', () => setHover(null));
  let hoverState = null;
  function setHover(info) {
    if (!info) {
      hoverState = null;
      if (hiId) {
        hiId = null;
        paintHi(null);
      }
      capData = null;
      capEl.classList.remove('on');
      canvas.style.cursor = 'grab';
      cb.hover(null);
      return;
    }
    const f = countryAt(info.lon, info.lat);
    const id = f ? f.id : null;
    if (id !== hiId) {
      hiId = id;
      paintHi(f, 'rgba(150,190,255,.22)');
      const cap = id ? capitalOf(id) : null;
      capData = cap;
      capEl.classList.toggle('on', !!cap);
      if (cap) capEl.querySelector('span').textContent = cap.n;
    }
    canvas.style.cursor = 'crosshair';
    hoverState = { ...info, countryId: id, capital: capData };
    cb.hover(hoverState);
  }
  let down = null;
  canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() }));
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const dt = performance.now() - down.t;
    down = null;
    if (moved > 5 || dt > 600) return;
    const ll = hit(e.clientX, e.clientY);
    if (!ll) return;
    // aimantation sur la capitale affichée
    if (capData && capEl.classList.contains('on')) {
      const b = capEl.getBoundingClientRect();
      if (Math.hypot(e.clientX - (b.left + 6), e.clientY - (b.top + 6)) < 16) return cb.pick({ lat: capData.lat, lon: capData.lon, capital: capData });
    }
    cb.pick({ lat: ll.lat, lon: ll.lon });
  });

  // animations de caméra
  let anim = null;
  function flyTo(lat, lon, { k, duration = 1300 } = {}) {
    userMoved = true;
    controls.autoRotate = false;
    const from = camera.position.clone();
    const d0 = from.length();
    const d1 = k ? fitD / k : Math.min(d0, fitD * 0.8);
    const dirFrom = from.clone().normalize();
    const dirTo = toVec(lat, lon, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(dirFrom, dirTo);
    const id = new THREE.Quaternion();
    anim = { t0: performance.now(), dur: duration, step: (t) => {
      const e = d3.easeCubicInOut(t);
      const qq = id.clone().slerp(q, e);
      const dist = d0 + (d1 - d0) * e + Math.sin(Math.PI * e) * Math.max(0, d0 - 1.6) * -0.0 ;
      camera.position.copy(dirFrom.clone().applyQuaternion(qq).multiplyScalar(dist));
      camera.lookAt(0, 0, 0);
    } };
  }
  function zoomTo(dist, duration = 500) {
    const from = camera.position.clone();
    const d0 = from.length();
    const d1 = THREE.MathUtils.clamp(dist, controls.minDistance, controls.maxDistance);
    const dir = from.clone().normalize();
    anim = { t0: performance.now(), dur: duration, step: (t) => {
      const e = d3.easeCubicOut(t);
      camera.position.copy(dir.clone().multiplyScalar(d0 + (d1 - d0) * e));
    } };
  }

  // base : relief local ou imagerie NASA en direct (GIBS)
  async function setBase(kind, date) {
    if (kind === 'relief') {
      earth.material.map = baseMap;
      earth.material.needsUpdate = true;
      dirty = true;
      return true;
    }
    const layerName = kind === 'live' ? 'MODIS_Terra_CorrectedReflectance_TrueColor' : 'BlueMarble_ShadedRelief_Bathymetry';
    const url = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${layerName}&STYLES=&FORMAT=image/jpeg&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=4096&HEIGHT=2048${kind === 'live' ? '&TIME=' + date : ''}`;
    return new Promise((resolve) => {
      new THREE.TextureLoader().setCrossOrigin('anonymous').load(
        url,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = renderer.capabilities.getMaxAnisotropy();
          earth.material.map = t;
          earth.material.needsUpdate = true;
          dirty = true;
          resolve(true);
        },
        undefined,
        () => resolve(false)
      );
    });
  }

  const inset = { l: 0, r: 0, t: 0, b: 0 };
  let fitD = 5.3;
  let userMoved = false;
  function resize() {
    const r = host.getBoundingClientRect();
    w.W = Math.max(200, r.width);
    w.H = Math.max(200, r.height);
    renderer.setSize(w.W, w.H, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    camera.aspect = w.W / w.H;
    // garde le globe entier visible quelle que soit la forme de la zone
    camera.fov = w.W / w.H < 1 ? 34 / Math.min(1, (w.W / w.H) * 1.1) : 34;
    const fw = Math.max(120, w.W - inset.l - inset.r);
    const fh = Math.max(120, w.H - inset.t - inset.b);
    const D = Math.min(fw, fh) * 0.88;
    fitD = THREE.MathUtils.clamp(w.H / (Math.tan((camera.fov * Math.PI) / 360) * D), 2.6, 9);
    controls.maxDistance = fitD * 1.5;
    const dx = (inset.l - inset.r) / 2;
    const dy = (inset.t - inset.b) / 2;
    if (dx || dy) camera.setViewOffset(w.W, w.H, -dx, -dy, w.W, w.H);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    if (!userMoved && !anim) camera.position.setLength(fitD);
    dirty = true;
  }
  new ResizeObserver(resize).observe(host);
  resize();

  let raf = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (anim) {
      const t = Math.min(1, (now - anim.t0) / anim.dur);
      anim.step(t);
      if (t >= 1) anim = null;
      dirty = true;
    }
    if (!controls.autoRotate && !anim && !dragging && !pinBox.A && now - lastInput > 9000 && lastInput) controls.autoRotate = true;
    key.position.copy(camera.position).add(new THREE.Vector3(-1.4, 1.2, 0.6)).normalize().multiplyScalar(6);
    controls.update();
    if (viewPending && !anim && !dragging && now - viewStamp > 420) {
      viewPending = false;
      updateDetail();
    }
    stars.rotation.y += 0.00004;
    renderer.render(scene, camera);
    for (const m of markers.values()) place(m.el, m.it.lat, m.it.lon, 0, 1.012);
    for (const k of ['A', 'B']) if (pinBox[k]) place(pinBox[k].el, pinBox[k].lat, pinBox[k].lon, 0, 1.012);
    if (capData) place(capEl, capData.lat, capData.lon, 0, 1.014);
    if (++capTick % 3 === 0) updateCapitals();
  }
  raf = requestAnimationFrame(frame);

  const api = {
    flyTo,
    setCapitals: (v) => { capsOn = !!v; },
    setBase,
    setInsets: (i) => { Object.assign(inset, i); resize(); },
    zoomBy: (f) => zoomTo(camera.position.length() / f),
    reset: () => { flyTo(20, 10, { k: 1 }); userMoved = false; },
    setPins: ({ A, B }) => {
      const two = !!(A && B);
      for (const [k, p, color] of [['A', A, '#7C9CFF'], ['B', B, '#3FD2C7']]) {
        if (!p) {
          if (pinBox[k]) {
            pinBox[k].el.remove();
            delete pinBox[k];
          }
          continue;
        }
        if (!pinBox[k]) pinBox[k] = { el: makeBadge(k, color) };
        pinBox[k].el.querySelector('b').innerHTML = two ? k : '<i class="dot"></i>';
        pinBox[k].lat = p.lat;
        pinBox[k].lon = p.lon;
        if (k === 'A') controls.autoRotate = false;
      }
    },
    addAtlasItem: (it) => {
      const old = markers.get(it.id);
      if (old) {
        old.it = it;
        paintMarker(old.el, it);
        return;
      }
      const el = makeMarker(it);
      el.style.setProperty('--delay', (markers.size % 12) * 40 + 'ms');
      el.classList.add('pop');
      markers.set(it.id, { el, it });
    },
    clearAtlas: () => {
      markers.forEach((m) => m.el.remove());
      markers.clear();
    },
    setPalette: (p) => {
      palette = p;
      markers.forEach((m) => paintMarker(m.el, m.it));
    },
    selectAtlas: () => {},
    setAutoRotate: (v) => (controls.autoRotate = v),
    resize,
    destroy: () => cancelAnimationFrame(raf)
  };
  window.__globe = { camera, controls, toLonLat, toVec };
  return api;
}
