// Contenu affiché : variables, régions et enquêtes guidées.
// Tout vient du catalogue du contrat de l'équipe (docs/CONTRAT.md), servi par app/api.py :
// remplirCatalogue() est appelé une fois au démarrage (voir boot.js), avant l'interface.
// Ce fichier n'ajoute que la présentation : icônes, libellés courts, couleurs.
import { tl } from './i18n.js';

// Présentation propre à l'interface, par identifiant de variable du contrat.
const PRESENTATION = {
  t2m: {
    icon: 'thermo',
    chip: { fr: 'Température', en: 'Temperature' },
    nameEn: 'Air temperature at 2 m',
    short: { fr: 'Chaud ou froid ?', en: 'Warmer or colder?' }
  },
  qv2m: {
    icon: 'humidity',
    chip: { fr: 'Humidité', en: 'Humidity' },
    nameEn: 'Air humidity (specific humidity at 2 m)',
    short: { fr: 'Air sec ou humide ?', en: 'Dry or humid air?' }
  },
  precip: {
    icon: 'rain',
    chip: { fr: 'Précipitations', en: 'Precipitation' },
    nameEn: 'Precipitation',
    short: { fr: 'Plus ou moins de pluie ?', en: 'More or less rain?' }
  },
  no2: {
    icon: 'no2',
    chip: { fr: 'NO₂', en: 'NO₂' },
    nameEn: 'Tropospheric nitrogen dioxide (NO₂)',
    short: { fr: "L'air est-il plus ou moins pollué ?", en: 'Is the air more or less polluted?' }
  }
};
const PRESENTATION_DEFAUT = { icon: 'globe', chip: null, short: null };

// Traduction des types de région du contrat (le contrat est en français).
const TYPES_EN = {
  ville: 'City',
  'agricole et industrielle': 'Farming and industry',
  'semi-aride': 'Semi-arid',
  arctique: 'Arctic',
  'méditerranéen': 'Mediterranean',
  'forêt tropicale': 'Tropical forest',
  pays: 'Country'
};

// Version anglaise du contenu du contrat (le catalogue YAML est en français), par identifiant.
// Un identifiant absent ici retombe sur le texte français.
const VARIABLES_EN = {
  t2m: {
    def: 'Measured 2 metres above the ground: it is the temperature given in weather forecasts. Here, each value is a monthly mean.',
    up: 'it is getting warmer',
    down: 'it is getting colder'
  },
  qv2m: {
    def: 'Amount of water vapour in the air, 2 metres above the ground, in grams per kilogram of air. Warmer air can hold more water vapour.',
    up: 'the air holds more water vapour',
    down: 'the air is getting drier'
  },
  precip: {
    def: 'Amount of water falling from the sky (rain, snow, hail), estimated by the GPM satellite constellation. 1 mm equals 1 litre of water per square metre.',
    up: 'it rains more',
    down: 'it rains less'
  },
  no2: {
    def: 'A polluting gas emitted mainly by road traffic, power plants and industry. The OMI instrument, on board the Aura satellite, measures how much of it is in the lower atmosphere above every point on the globe.',
    up: 'the air contains more NO₂, so more pollution',
    down: 'the air contains less NO₂, so less pollution'
  }
};
const UNITES_EN = { 'mm/jour': 'mm/day', '10¹⁵ molécules/cm²': '10¹⁵ molecules/cm²' };
const REGIONS_EN = {
  po: 'Po Valley',
  pekin: 'Beijing',
  dhaka: 'Dhaka (Ganges delta)',
  espagne: 'Central Spain',
  amazonie: 'Central Amazon',
  france: 'France'
};
const SCENARIOS_EN = {
  paris_trois_verdicts: {
    titre: 'Paris: three investigations, three verdicts',
    accroche: 'Increase, decrease or nothing at all: the tool can tell all three.',
    etapes: [
      'Temperature in Paris since 1980. Look at the verdict, then at the slope of the line.',
      'Departures from the normal: each year compared with what is usual. The trend stands out better.',
      'Same city, another variable: nitrogen dioxide, measured by satellite since 2005.',
      'And rain? See what the test says when year-to-year variability is large.'
    ]
  },
  no2_destins_opposes: {
    titre: 'Same pollutant, opposite fates',
    accroche: 'One variable can rise here and fall there.',
    etapes: ['First, NO₂ over Los Angeles, the city of smog.', 'Now compare with Dhaka, one of the fastest-growing cities in the world.']
  },
  pekin_bascule: {
    titre: 'Beijing: the turning point',
    accroche: 'The verdict depends on the period you choose.',
    etapes: ['NO₂ in Beijing from 2005 to 2011, before the national clean-air plan.', 'Same city, from 2012 to 2024.', 'And over the whole period?']
  },
  arctique: {
    titre: 'Is the Arctic warming faster?',
    accroche: 'We compare Svalbard and Paris over the whole available period.',
    etapes: ['Compare the two slopes: which one is steeper?']
  }
};
const fr_en = (fr, en) => ({ fr, en: en || fr });

// Icône d'une enquête guidée selon sa variable.
const ICONE_ENQUETE = { t2m: 'sun', qv2m: 'drop', precip: 'rain', no2: 'compare' };

export const VARIABLES = [];
export const VAR_BY_ID = {};
export const KINDS = {};
export const PLACES = [];
export const PLACE_BY_ID = {};
export const STORIES = [];

/** Première année complète d'une série qui commence au mois "AAAA-MM". */
export const premiereAnneeComplete = (aaaaMm) => (aaaaMm.endsWith('-01') ? +aaaaMm.slice(0, 4) : +aaaaMm.slice(0, 4) + 1);

const deux = (texte) => ({ fr: texte, en: texte }); // contenu du contrat : français seulement

export function remplirCatalogue(cat) {
  for (const v of cat.variables) {
    const p = PRESENTATION[v.id] || PRESENTATION_DEFAUT;
    const en = VARIABLES_EN[v.id] || {};
    const periode = (cat.periodes || {})[v.id] || [v.debut, v.debut];
    const unite = fr_en(v.unite, UNITES_EN[v.unite]);
    const variable = {
      id: v.id,
      contrat: v,
      chip: p.chip || deux(v.nom),
      short: p.short || deux(v.nom),
      icon: p.icon,
      agg: 'mean',
      // Unité d'affichage dans la langue courante (lue à chaque rendu).
      get unit() {
        return tl(unite);
      },
      upMeans: fr_en(v.hausse_signifie, en.up),
      downMeans: fr_en(v.baisse_signifie, en.down),
      decimals: 2,
      minYear: premiereAnneeComplete(periode[0]),
      maxYear: +periode[1].slice(0, 4),
      up: '#FF6B7D',
      down: '#3D9BFF',
      name: p.nameEn ? { fr: v.nom, en: p.nameEn } : deux(v.nom),
      def: fr_en(v.definition, en.def),
      annual: { fr: 'série mensuelle', en: 'monthly series' },
      series: p.nameEn ? { fr: v.nom, en: p.nameEn } : deux(v.nom),
      monthly: { fr: 'Écart à la normale mensuelle', en: 'Departure from the monthly normal' }
    };
    VARIABLES.push(variable);
    VAR_BY_ID[v.id] = variable;
  }

  for (const r of cat.regions) {
    KINDS[r.type] = { fr: r.type.charAt(0).toUpperCase() + r.type.slice(1), en: TYPES_EN[r.type] || r.type };
    const place = { id: r.id, lat: r.centre[0], lon: r.centre[1], kind: r.type, fr: r.nom, en: REGIONS_EN[r.id] || r.nom, contrat: r };
    PLACES.push(place);
    PLACE_BY_ID[r.id] = place;
  }

  // Une enquête guidée = un scénario du contrat ; chaque étape devient une entrée navigable.
  for (const sc of cat.scenarios || []) {
    const en = SCENARIOS_EN[sc.id] || { etapes: [] };
    sc.etapes.forEach((e, i) => {
      const [debut, fin] = e.periode || [];
      STORIES.push({
        id: `${sc.id}~${i}`,
        scenario: sc.id,
        etape: i,
        nEtapes: sc.etapes.length,
        a: e.regions[0],
        b: e.regions[1] || null,
        variable: e.variable,
        period: [debut ? premiereAnneeComplete(debut) : 0, fin ? +fin.slice(0, 4) : 9999],
        saisonsRetirees: !!e.saisons_retirees,
        emoji: ICONE_ENQUETE[e.variable] || 'compare',
        title: fr_en(sc.titre, en.titre),
        hook: fr_en(e.texte, en.etapes[i]),
        lesson: fr_en(sc.accroche || '', en.accroche)
      });
    });
  }
}

export const MONTHS = {
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
};
