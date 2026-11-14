// Globe 3D des tendances (three.js, servi en local : aucun appel réseau).
// Reçoit de Python une liste de régions déjà analysées ; ne calcule aucune statistique.
// Une colonne par région : couleur = verdict, hauteur = |pente| ; anneau = pas de tendance significative.
import * as THREE from "./three.module.min.js";

const HAUTEUR = 560;
const RAD = Math.PI / 180;

// --- Protocole des composants Streamlit ------------------------------------------------------
const envoyer = (type, donnees = {}) =>
  window.parent.postMessage({ isStreamlitMessage: true, type, ...donnees }, "*");

// --- Scène -----------------------------------------------------------------------------------
const conteneur = document.getElementById("scene");
const bulle = document.getElementById("bulle");
const aide = document.getElementById("aide");

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
} catch (e) {
  const erreur = document.getElementById("erreur");
  erreur.style.display = "flex";
  erreur.textContent = "WebGL indisponible sur cet ordinateur : utilise le classement sous le globe.";
  envoyer("streamlit:componentReady", { apiVersion: 1 });
  envoyer("streamlit:setFrameHeight", { height: HAUTEUR });
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
conteneur.appendChild(renderer.domElement);

const monde = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 0, 4.4);

monde.add(new THREE.AmbientLight(0xffffff, 1.5));
const soleil = new THREE.DirectionalLight(0xffffff, 1.9);
soleil.position.set(-2, 1.5, 3);
monde.add(soleil);

const terreEtMarqueurs = new THREE.Group();
monde.add(terreEtMarqueurs);

const chargeur = new THREE.TextureLoader();
const image = chargeur.load("./earth-blue-marble.jpg");
image.colorSpace = THREE.SRGBColorSpace;
image.anisotropy = renderer.capabilities.getMaxAnisotropy();
const terre = new THREE.Mesh(
  new THREE.SphereGeometry(1, 96, 96),
  new THREE.MeshPhongMaterial({
    map: image,
    bumpMap: chargeur.load("./earth-topology.png"),
    bumpScale: 6,
    shininess: 8,
    specular: 0x1a1a1a,
  })
);
terreEtMarqueurs.add(terre);

// Halo d'atmosphère (sphère arrière en mélange additif).
monde.add(
  new THREE.Mesh(
    new THREE.SphereGeometry(1.13, 64, 64),
    new THREE.ShaderMaterial({
      vertexShader: `varying vec3 vN;
        void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vN;
        void main() { float i = pow(0.68 - dot(vN, vec3(0.0, 0.0, 1.0)), 2.6); gl_FragColor = vec4(0.36, 0.62, 1.0, 1.0) * i; }`,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
  )
);

// Étoiles.
{
  const n = 600;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 10);
    positions.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  monde.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.75 })));
}

const versVecteur = (lat, lon, r = 1) =>
  new THREE.Vector3(r * Math.cos(lat * RAD) * Math.cos(lon * RAD), r * Math.sin(lat * RAD), -r * Math.cos(lat * RAD) * Math.sin(lon * RAD));

// --- Marqueurs -------------------------------------------------------------------------------
let marqueurs = []; // { region, groupe, cible }
let anneauSelection = null;
let signatureDonnees = "";

function viderMarqueurs() {
  for (const m of marqueurs) {
    terreEtMarqueurs.remove(m.groupe);
    m.groupe.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  }
  marqueurs = [];
  anneauSelection = null;
}

function construire(regions, selection) {
  viderMarqueurs();
  const significatives = regions.filter((r) => r.significatif).map((r) => Math.abs(r.pente));
  const maximum = Math.max(...significatives, 1e-9);
  const haut = new THREE.Vector3(0, 1, 0);

  for (const r of regions) {
    const groupe = new THREE.Group();
    groupe.position.copy(versVecteur(r.lat, r.lon, 1.0));
    groupe.quaternion.setFromUnitVectors(haut, groupe.position.clone().normalize());
    const couleur = new THREE.Color(r.couleur);
    let hauteurCible = 0.05;

    if (r.significatif) {
      const h = 0.07 + 0.45 * (Math.abs(r.pente) / maximum);
      const colonne = new THREE.Mesh(
        new THREE.CylinderGeometry(0.017, 0.017, h, 24),
        new THREE.MeshPhongMaterial({ color: couleur, emissive: couleur, emissiveIntensity: 0.45 })
      );
      colonne.position.y = h / 2;
      const sommet = new THREE.Mesh(new THREE.SphereGeometry(0.027, 20, 20), new THREE.MeshBasicMaterial({ color: couleur }));
      sommet.position.y = h;
      const socle = new THREE.Mesh(
        new THREE.CircleGeometry(0.03, 32),
        new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
      );
      socle.rotation.x = -Math.PI / 2;
      socle.position.y = 0.003;
      groupe.add(colonne, sommet, socle);
      hauteurCible = h;
    } else {
      const anneau = new THREE.Mesh(
        new THREE.RingGeometry(0.022, 0.036, 40),
        new THREE.MeshBasicMaterial({ color: couleur, side: THREE.DoubleSide })
      );
      anneau.rotation.x = -Math.PI / 2;
      anneau.position.y = 0.004;
      groupe.add(anneau);
    }

    // Zone de clic invisible, plus large que le marqueur.
    const cible = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, hauteurCible + 0.04, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    cible.position.y = hauteurCible / 2;
    cible.userData.region = r;
    groupe.add(cible);

    if (r.id === selection) {
      anneauSelection = new THREE.Mesh(
        new THREE.RingGeometry(0.045, 0.055, 48),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide })
      );
      anneauSelection.rotation.x = -Math.PI / 2;
      anneauSelection.position.y = 0.005;
      groupe.add(anneauSelection);
    }

    terreEtMarqueurs.add(groupe);
    marqueurs.push({ region: r, groupe, cible });
  }
}

// --- Rotation (glisser), zoom (molette), survol et clic ---------------------------------------
let lonCentre = 15;
let latCentre = 25;
let premierRendu = true;
let derniereInteraction = -Infinity;
let glisse = null; // { x, y, deplace }

const appliquerRotation = () => terreEtMarqueurs.rotation.set(latCentre * RAD, (-90 - lonCentre) * RAD, 0);

const raycaster = new THREE.Raycaster();
const pointeur = new THREE.Vector2();

function regionSous(evenement) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointeur.set(((evenement.clientX - rect.left) / rect.width) * 2 - 1, -((evenement.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointeur, camera);
  const touche = raycaster.intersectObjects([terre, ...marqueurs.map((m) => m.cible)], false)[0];
  return touche && touche.object !== terre ? touche.object.userData.region : null;
}

const canvas = renderer.domElement;
canvas.addEventListener("pointerdown", (e) => {
  glisse = { x: e.clientX, y: e.clientY, deplace: 0 };
  canvas.setPointerCapture(e.pointerId);
  derniereInteraction = performance.now();
});
canvas.addEventListener("pointermove", (e) => {
  if (glisse) {
    const dx = e.clientX - glisse.x;
    const dy = e.clientY - glisse.y;
    glisse.deplace += Math.abs(dx) + Math.abs(dy);
    glisse.x = e.clientX;
    glisse.y = e.clientY;
    if (glisse.deplace > 4) {
      canvas.classList.add("drag");
      bulle.style.display = "none";
    }
    const vitesse = 0.28 * (camera.position.z / 4.4);
    lonCentre -= dx * vitesse;
    latCentre = Math.max(-70, Math.min(70, latCentre + dy * vitesse));
    derniereInteraction = performance.now();
    return;
  }
  const r = regionSous(e);
  canvas.classList.toggle("survol", Boolean(r));
  if (!r) {
    bulle.style.display = "none";
    return;
  }
  bulle.style.setProperty("--c", r.couleur);
  bulle.innerHTML = "";
  const nom = document.createElement("b");
  nom.textContent = r.nom;
  const verdict = document.createElement("div");
  verdict.className = "v";
  verdict.textContent = r.verdict;
  const pente = document.createElement("small");
  pente.textContent = r.pente_txt;
  bulle.append(nom, verdict, pente);
  const rect = conteneur.getBoundingClientRect();
  bulle.style.left = `${e.clientX - rect.left}px`;
  bulle.style.top = `${e.clientY - rect.top}px`;
  bulle.style.display = "block";
});
canvas.addEventListener("pointerup", (e) => {
  const etaitUnClic = glisse && glisse.deplace <= 4;
  glisse = null;
  canvas.classList.remove("drag");
  if (!etaitUnClic) return;
  const r = regionSous(e);
  if (r) envoyer("streamlit:setComponentValue", { value: { region: r.id, t: Date.now() }, dataType: "json" });
});
canvas.addEventListener("pointerleave", () => { bulle.style.display = "none"; });
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    camera.position.z = Math.max(2.4, Math.min(7, camera.position.z * (1 + Math.sign(e.deltaY) * 0.08)));
    derniereInteraction = performance.now();
  },
  { passive: false }
);

// --- Taille et boucle d'animation --------------------------------------------------------------
function redimensionner() {
  const largeur = conteneur.clientWidth || 800;
  renderer.setSize(largeur, HAUTEUR);
  camera.aspect = largeur / HAUTEUR;
  camera.updateProjectionMatrix();
}
new ResizeObserver(redimensionner).observe(conteneur);
redimensionner();

let avant = performance.now();
renderer.setAnimationLoop((maintenant) => {
  const dt = Math.min(0.05, (maintenant - avant) / 1000);
  avant = maintenant;
  // Rotation automatique lente, qui s'arrête pendant 6 s après chaque interaction.
  if (!glisse && maintenant - derniereInteraction > 6000) lonCentre += 5 * dt;
  appliquerRotation();
  if (anneauSelection) {
    const k = 1 + 0.35 * (0.5 + 0.5 * Math.sin(maintenant / 260));
    anneauSelection.scale.set(k, k, k);
    anneauSelection.material.opacity = 1.15 - 0.6 * (k - 1) / 0.35;
  }
  renderer.render(monde, camera);
});

// --- Données envoyées par Python ---------------------------------------------------------------
window.addEventListener("message", (evenement) => {
  if (evenement.data?.type !== "streamlit:render") return;
  const { regions = [], selection = null, textes = {} } = evenement.data.args;
  aide.textContent = textes.aide || "";
  const signature = JSON.stringify([regions, selection]);
  if (signature !== signatureDonnees) {
    signatureDonnees = signature;
    construire(regions, selection);
  }
  if (premierRendu) {
    premierRendu = false;
    const choisie = regions.find((r) => r.id === selection);
    if (choisie) {
      lonCentre = choisie.lon;
      latCentre = Math.max(-50, Math.min(50, choisie.lat));
    }
  }
  envoyer("streamlit:setFrameHeight", { height: HAUTEUR });
});

envoyer("streamlit:componentReady", { apiVersion: 1 });
envoyer("streamlit:setFrameHeight", { height: HAUTEUR });
