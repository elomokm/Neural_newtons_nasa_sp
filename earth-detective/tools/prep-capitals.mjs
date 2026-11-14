// Génère src/capitals.json : { ccn3: { n: nom de la capitale, lat, lon } }  (à relancer seulement pour mettre à jour)
import cities from 'all-the-cities';
import { createRequire } from 'module';
const countries = createRequire(import.meta.url)('world-countries');
import fs from 'fs';
const byIso2 = Object.fromEntries(countries.map((c) => [c.cca2, c]));
const out = {};
for (const c of cities.filter((x) => x.featureCode === 'PPLC')) {
  const co = byIso2[c.country];
  if (!co || !co.ccn3) continue;
  if (!out[co.ccn3] || c.population > out[co.ccn3].p) out[co.ccn3] = { n: c.name, lat: +c.loc.coordinates[1].toFixed(3), lon: +c.loc.coordinates[0].toFixed(3), p: c.population };
}
for (const k of Object.keys(out)) delete out[k].p;
fs.writeFileSync('src/capitals.json', JSON.stringify(out));
console.log(Object.keys(out).length, 'capitales');
