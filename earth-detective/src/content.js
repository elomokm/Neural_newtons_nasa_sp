// Contenu scientifique et éditorial : variables, lieux, enquêtes guidées.
// Tout ce qui est affiché à l'utilisateur est bilingue (fr / en).

export const VARIABLES = [
  {
    id: 'T2M',
    chip: { fr: 'Température', en: 'Temperature' },
    agg: 'mean',
    unit: '°C',
    decimals: 2,
    minYear: 1981,
    icon: 'thermo',
    up: '#FF9B6A',
    down: '#7CC8FF',
    name: { fr: "Température de l'air", en: 'Air temperature' },
    short: { fr: 'Chaud ou froid ?', en: 'Warmer or colder?' },
    def: {
      fr: "Température moyenne de l'air mesurée à 2 mètres du sol. C'est la température que donne la météo.",
      en: 'Average air temperature at 2 metres above the ground. It is the temperature a weather forecast gives.'
    },
    annual: { fr: 'moyenne annuelle', en: 'annual mean' },
    series: { fr: 'Température moyenne annuelle', en: 'Annual mean temperature' },
    monthly: { fr: 'Écart à la normale mensuelle', en: 'Departure from the monthly normal' }
  },

  {
    id: 'PRECTOTCORR',
    chip: { fr: 'Précipitations', en: 'Precipitation' },
    agg: 'sum_rate',
    unit: 'mm',
    unitLong: { fr: 'mm par an', en: 'mm per year' },
    unitMonthly: 'mm/j',
    decimals: 0,
    minYear: 1981,
    icon: 'rain',
    up: '#FF9B6A',
    down: '#7CC8FF',
    name: { fr: 'Précipitations', en: 'Precipitation' },
    short: { fr: 'Plus ou moins de pluie ?', en: 'More or less rain?' },
    def: {
      fr: "Quantité d'eau qui tombe du ciel (pluie, neige, grêle), exprimée en millimètres. 1 mm correspond à 1 litre par mètre carré.",
      en: 'Amount of water falling from the sky (rain, snow, hail) in millimetres. 1 mm equals 1 litre per square metre.'
    },
    annual: { fr: 'cumul annuel', en: 'annual total' },
    series: { fr: 'Cumul annuel de précipitations', en: 'Annual precipitation total' },
    monthly: { fr: 'Écart à la normale mensuelle', en: 'Departure from the monthly normal' }
  },

  {
    id: 'RH2M',
    chip: { fr: 'Humidité', en: 'Humidity' },
    agg: 'mean',
    unit: '%',
    decimals: 2,
    minYear: 1981,
    icon: 'humidity',
    up: '#FF9B6A',
    down: '#7CC8FF',
    name: { fr: "Humidité de l'air", en: 'Air humidity' },
    short: { fr: 'Air sec ou humide ?', en: 'Dry or humid air?' },
    def: {
      fr: "Humidité relative à 2 mètres du sol : la vapeur d'eau de l'air comparée à son maximum possible. Elle dépend aussi de la température.",
      en: 'Relative humidity at 2 metres: the water vapour in the air compared with its maximum. It also depends on temperature.'
    },
    annual: { fr: 'moyenne annuelle', en: 'annual mean' },
    series: { fr: 'Humidité relative moyenne', en: 'Mean relative humidity' },
    monthly: { fr: 'Écart à la normale mensuelle', en: 'Departure from the monthly normal' }
  },

  {
    id: 'SOIL',
    power: { param: 'GWETTOP', scale: 100 },
    chip: { fr: 'Humidité du sol', en: 'Soil moisture' },
    agg: 'mean',
    unit: '%',
    decimals: 2,
    minYear: 1981,
    icon: 'soil',
    up: '#FF9B6A',
    down: '#7CC8FF',
    name: { fr: 'Humidité du sol', en: 'Soil moisture' },
    short: { fr: 'Sol plus sec ou plus humide ?', en: 'Drier or wetter ground?' },
    def: {
      fr: "Taux de saturation du sol superficiel, de 0 % (sec) à 100 % (saturé). Ce n'est pas un pourcentage volumique d'eau. Estimation du modèle MERRA-2.",
      en: 'Saturation rate of the surface soil, from 0 % (dry) to 100 % (saturated). Not a volumetric water percentage. MERRA-2 model estimate.'
    },
    annual: { fr: 'moyenne annuelle', en: 'annual mean' },
    series: { fr: 'Humidité moyenne du sol', en: 'Mean soil moisture' },
    monthly: { fr: 'Écart à la normale mensuelle', en: 'Departure from the monthly normal' }
  },

  {
    id: 'NO2',
    backendOnly: true,
    chip: { fr: 'NO₂', en: 'NO₂' },
    agg: 'mean',
    unit: '10¹⁵ mol/cm²',
    decimals: 3,
    minYear: 2005,
    icon: 'no2',
    up: '#FF9B6A',
    down: '#7CC8FF',
    name: { fr: "Dioxyde d'azote (NO₂)", en: 'Nitrogen dioxide (NO₂)' },
    short: { fr: "L'air est-il plus ou moins pollué ?", en: 'Is the air more or less polluted?' },
    def: {
      fr: "Quantité de dioxyde d'azote dans la colonne d'air, un gaz émis surtout par le trafic et l'industrie. Mesuré par le satellite OMI de la NASA. Varie aussi avec la météo.",
      en: 'Amount of nitrogen dioxide in the air column, a gas emitted mostly by traffic and industry. Measured by NASA’s OMI satellite. Also varies with weather.'
    },
    annual: { fr: 'moyenne annuelle', en: 'annual mean' },
    series: { fr: 'Colonne troposphérique de NO₂ moyenne', en: 'Mean tropospheric NO₂ column' },
    monthly: { fr: 'Écart à la normale mensuelle', en: 'Departure from the monthly normal' }
  }
];

export const VAR_BY_ID = Object.fromEntries(VARIABLES.map((v) => [v.id, v]));

export const KINDS = {
  polar: { fr: 'Région polaire', en: 'Polar region' },
  dry: { fr: 'Zone sèche', en: 'Dry zone' },
  tropical: { fr: 'Forêt tropicale', en: 'Tropical forest' },
  desert: { fr: 'Désert', en: 'Desert' },
  city: { fr: 'Grande ville', en: 'Major city' },
  temperate: { fr: 'Climat tempéré', en: 'Temperate climate' },
  coast: { fr: 'Côte', en: 'Coast' },
  mountain: { fr: 'Montagne', en: 'Mountain' }
};

// Lieux de référence : points de départ pour explorer et couche « atlas des tendances ».
export const PLACES = [
  { id: 'paris', lat: 48.86, lon: 2.35, kind: 'city', fr: 'Paris', en: 'Paris' },
  { id: 'svalbard', lat: 78.22, lon: 15.63, kind: 'polar', fr: 'Svalbard', en: 'Svalbard' },
  { id: 'niamey', lat: 13.51, lon: 2.11, kind: 'dry', fr: 'Niamey (Sahel)', en: 'Niamey (Sahel)' },
  { id: 'manaus', lat: -3.12, lon: -60.02, kind: 'tropical', fr: 'Manaus (Amazonie)', en: 'Manaus (Amazon)' },
  { id: 'tamanrasset', lat: 22.79, lon: 5.52, kind: 'desert', fr: 'Tamanrasset (Sahara)', en: 'Tamanrasset (Sahara)' },
  { id: 'delhi', lat: 28.61, lon: 77.21, kind: 'city', fr: 'Delhi', en: 'Delhi' },
  { id: 'beijing', lat: 39.9, lon: 116.4, kind: 'city', fr: 'Pékin', en: 'Beijing' },
  { id: 'sydney', lat: -33.87, lon: 151.21, kind: 'coast', fr: 'Sydney', en: 'Sydney' },
  { id: 'greenland', lat: 72.58, lon: -38.46, kind: 'polar', fr: 'Groenland (centre)', en: 'Greenland (centre)' },
  { id: 'antarctic', lat: -64.25, lon: -56.65, kind: 'polar', fr: 'Péninsule antarctique', en: 'Antarctic Peninsula' },
  { id: 'mexico', lat: 19.43, lon: -99.13, kind: 'city', fr: 'Mexico', en: 'Mexico City' },
  { id: 'saopaulo', lat: -23.55, lon: -46.63, kind: 'city', fr: 'São Paulo', en: 'São Paulo' },
  { id: 'cairo', lat: 30.04, lon: 31.24, kind: 'desert', fr: 'Le Caire', en: 'Cairo' },
  { id: 'lagos', lat: 6.52, lon: 3.38, kind: 'coast', fr: 'Lagos', en: 'Lagos' },
  { id: 'nairobi', lat: -1.29, lon: 36.82, kind: 'city', fr: 'Nairobi', en: 'Nairobi' },
  { id: 'moscow', lat: 55.76, lon: 37.62, kind: 'temperate', fr: 'Moscou', en: 'Moscow' },
  { id: 'tokyo', lat: 35.68, lon: 139.69, kind: 'city', fr: 'Tokyo', en: 'Tokyo' },
  { id: 'newyork', lat: 40.71, lon: -74.01, kind: 'city', fr: 'New York', en: 'New York' },
  { id: 'losangeles', lat: 34.05, lon: -118.24, kind: 'coast', fr: 'Los Angeles', en: 'Los Angeles' },
  { id: 'kisangani', lat: 0.52, lon: 25.19, kind: 'tropical', fr: 'Bassin du Congo', en: 'Congo Basin' },
  { id: 'jakarta', lat: -6.21, lon: 106.85, kind: 'coast', fr: 'Jakarta', en: 'Jakarta' },
  { id: 'ulaanbaatar', lat: 47.89, lon: 106.91, kind: 'temperate', fr: 'Oulan-Bator', en: 'Ulaanbaatar' },
  { id: 'santiago', lat: -33.45, lon: -70.67, kind: 'mountain', fr: 'Santiago du Chili', en: 'Santiago, Chile' },
  { id: 'reykjavik', lat: 64.15, lon: -21.94, kind: 'polar', fr: 'Reykjavik', en: 'Reykjavik' },
  { id: 'capetown', lat: -33.92, lon: 18.42, kind: 'coast', fr: 'Le Cap', en: 'Cape Town' },
  { id: 'dubai', lat: 25.2, lon: 55.27, kind: 'desert', fr: 'Dubaï', en: 'Dubai' },
  { id: 'anchorage', lat: 61.22, lon: -149.9, kind: 'polar', fr: 'Anchorage (Alaska)', en: 'Anchorage (Alaska)' },
  { id: 'seville', lat: 37.39, lon: -5.98, kind: 'temperate', fr: 'Séville', en: 'Seville' },
  { id: 'oslo', lat: 59.91, lon: 10.75, kind: 'temperate', fr: 'Oslo', en: 'Oslo' },
  { id: 'aralsk', lat: 46.79, lon: 61.67, kind: 'dry', fr: "Mer d'Aral", en: 'Aral Sea' }
];

export const PLACE_BY_ID = Object.fromEntries(PLACES.map((p) => [p.id, p]));

// Enquêtes guidées. Aucune conclusion chiffrée n'est écrite à l'avance : le verdict vient des données.
export const STORIES = [
  {
    id: 'arctic',
    a: 'svalbard',
    b: 'paris',
    variable: 'T2M',
    period: [1981, 2025],
    emoji: 'polar',
    title: { fr: "L'Arctique se réchauffe-t-il plus vite ?", en: 'Is the Arctic warming faster?' },
    hook: {
      fr: 'On compare le Svalbard et Paris sur 45 ans. Regardez la pente de chaque courbe.',
      en: 'We compare Svalbard and Paris over 45 years. Look at the slope of each curve.'
    },
    lesson: {
      fr: "Les scientifiques parlent d'amplification arctique. Vérifiez si les données NASA la montrent ici.",
      en: 'Scientists call this Arctic amplification. Check whether the NASA data show it here.'
    }
  },
  {
    id: 'sahel',
    a: 'niamey',
    variable: 'PRECTOTCORR',
    period: [1981, 2025],
    emoji: 'rain',
    title: { fr: 'Les pluies du Sahel reviennent-elles ?', en: 'Is the Sahel rain coming back?' },
    hook: {
      fr: 'Le Sahel a connu de longues sécheresses. Que disent les 45 dernières années ?',
      en: 'The Sahel went through long droughts. What do the last 45 years say?'
    },
    lesson: {
      fr: "Essayez de raccourcir la période en glissant sur le graphique. Le verdict peut changer : le choix de la période compte.",
      en: 'Try shortening the period by dragging on the chart. The verdict can change: the choice of period matters.'
    }
  },
  {
    id: 'europe',
    a: 'seville',
    b: 'oslo',
    variable: 'PRECTOTCORR',
    period: [1981, 2025],
    emoji: 'compare',
    title: { fr: 'Deux Europe, deux histoires ?', en: 'Two Europes, two stories?' },
    hook: {
      fr: 'Le sud de la Méditerranée et la Scandinavie réagissent-ils de la même façon ?',
      en: 'Do the Mediterranean south and Scandinavia respond in the same way?'
    },
    lesson: {
      fr: "Une même cause peut produire des tendances opposées selon la région. C'est le piège central du défi.",
      en: 'The same cause can produce opposite trends depending on the region. This is the core trap of the challenge.'
    }
  },
  {
    id: 'beijing',
    a: 'beijing',
    variable: 'RH2M',
    period: [1981, 2025],
    emoji: 'drop',
    title: { fr: "L'air de Pékin s'assèche-t-il ?", en: 'Is the air over Beijing drying out?' },
    hook: {
      fr: "L'humidité de l'air dépend de la température, des vents et de l'évaporation des sols.",
      en: 'Air humidity depends on temperature, winds and evaporation from the ground.'
    },
    lesson: {
      fr: 'Regardez le calendrier : quels mois changent le plus ? La tendance annuelle cache parfois des saisons très différentes.',
      en: 'Look at the calendar: which months change the most? The annual trend sometimes hides very different seasons.'
    }
  },
  {
    id: 'amazon',
    a: 'manaus',
    variable: 'SOIL',
    period: [1981, 2025],
    emoji: 'forest',
    title: { fr: "Le sol de l'Amazonie s'assèche-t-il ?", en: 'Is the Amazon soil drying out?' },
    hook: {
      fr: "On suit l'humidité du sol au cœur de la forêt tropicale.",
      en: 'We follow soil moisture in the heart of the rainforest.'
    },
    lesson: {
      fr: "Comparez avec les précipitations. Un sol plus sec s'explique-t-il par moins de pluie, ou par plus de chaleur ?",
      en: 'Compare with precipitation. Is a drier soil explained by less rain, or by more heat?'
    }
  }
];

export const MONTHS = {
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
};
