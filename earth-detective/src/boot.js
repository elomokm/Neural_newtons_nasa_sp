// Démarrage : charge le catalogue du contrat (serveur Python) AVANT de lancer l'interface,
// pour que variables, régions et enquêtes soient connues dès le premier affichage.
import { chargerCatalogue } from './api.js';
import { remplirCatalogue } from './content.js';

(async () => {
  try {
    remplirCatalogue(await chargerCatalogue());
  } catch (e) {
    const box = document.createElement('div');
    box.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:32px;text-align:center;' +
      'color:#EEF3FF;font:16px/1.6 system-ui,sans-serif;background:#0D1A44;z-index:999';
    box.innerHTML =
      '<div><b style="font-size:20px">Le serveur Earth Detective ne répond pas.</b><br>' +
      'Depuis la racine du dépôt, lance :<br><code style="background:rgba(255,255,255,.1);padding:4px 10px;border-radius:6px">' +
      'PYTHONPATH=src .venv/bin/python app/api.py</code><br>puis ouvre <b>http://localhost:8000</b></div>';
    document.body.appendChild(box);
    return;
  }
  await import('./main.js');
})();
