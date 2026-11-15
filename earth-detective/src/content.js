// Contenu affiché : variables, régions et enquêtes guidées.
// Tout vient du catalogue du contrat de l'équipe (docs/CONTRAT.md), servi par app/api.py :
// remplirCatalogue() est appelé une fois au démarrage (voir boot.js), avant l'interface.
// Ce fichier n'ajoute que la présentation : icônes, libellés courts, couleurs.

// Présentation propre à l'interface, par identifiant de variable du contrat.
const PRESENTATION = {
  t2m: {
    icon: 'thermo',
    chip: { fr: 'Température', en: 'Temperature' },
    short: { fr: 'Chaud ou froid ?', en: 'Warmer or colder?' }
  },
  qv2m: {
    icon: 'humidity',
    chip: { fr: 'Humidité', en: 'Humidity' },
    short: { fr: 'Air sec ou humide ?', en: 'Dry or humid air?' }
  },
  precip: {
    icon: 'rain',
    chip: { fr: 'Précipitations', en: 'Precipitation' },
    short: { fr: 'Plus ou moins de pluie ?', en: 'More or less rain?' }
  },
  no2: {
    icon: 'no2',
    chip: { fr: 'NO₂', en: 'NO₂' },
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
    const periode = (cat.periodes || {})[v.id] || [v.debut, v.debut];
    const variable = {
      id: v.id,
      contrat: v,
      chip: p.chip || deux(v.nom),
      short: p.short || deux(v.nom),
      icon: p.icon,
      agg: 'mean',
      unit: v.unite,
      decimals: 2,
      minYear: premiereAnneeComplete(periode[0]),
      maxYear: +periode[1].slice(0, 4),
      up: '#FF8A3D',
      down: '#5AB0FF',
      name: deux(v.nom),
      def: deux(v.definition),
      annual: { fr: 'moyenne annuelle', en: 'annual mean' },
      series: deux(v.nom),
      monthly: { fr: 'Écart à la normale mensuelle', en: 'Departure from the monthly normal' }
    };
    VARIABLES.push(variable);
    VAR_BY_ID[v.id] = variable;
  }

  for (const r of cat.regions) {
    KINDS[r.type] = { fr: r.type.charAt(0).toUpperCase() + r.type.slice(1), en: TYPES_EN[r.type] || r.type };
    const place = { id: r.id, lat: r.centre[0], lon: r.centre[1], kind: r.type, fr: r.nom, en: r.nom, contrat: r };
    PLACES.push(place);
    PLACE_BY_ID[r.id] = place;
  }

  // Une enquête guidée = un scénario du contrat ; chaque étape devient une entrée navigable.
  for (const sc of cat.scenarios || []) {
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
        title: deux(sc.titre),
        hook: deux(e.texte),
        lesson: deux(sc.accroche || '')
      });
    });
  }
}

export const MONTHS = {
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
};
