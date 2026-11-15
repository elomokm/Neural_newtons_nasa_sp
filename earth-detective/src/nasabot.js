// NASABot : assistant d'explication. Répond à partir des chiffres affichés.
// Avec le serveur de l'équipe (provider 'backend') : une question qui nomme un lieu passe par trend.advisor.suggerer
// (l'app ouvre la variable et la région proposées) ; toute autre question passe par trend.advisor.repondre (agent IA,
// avec le résultat affiché comme contexte). Sans agent, ou si sa réponse est refusée, les règles locales répondent.
import { CONFIG, repondre, suggerer } from './api.js';
import { VAR_BY_ID, PLACE_BY_ID } from './content.js';
import { tl } from './i18n.js';

const T = {
  fr: {
    intro: "Je suis NASABot. Je t'explique ce que montrent les données de la NASA, sans jargon. Choisis un lieu sur la Terre, puis pose-moi une question.",
    chips0: ['La pollution baisse-t-elle à Pékin ?', 'Comment ça marche ?', "Qu'est-ce que Mann-Kendall ?", 'Quelle est la source des données ?'],
    chips1: ['Que montre ce résultat ?', 'Est-ce significatif ?', 'Que ne peut-on pas conclure ?', 'Que comparer ensuite ?'],
    nolocation: "Clique d'abord sur la Terre pour choisir un lieu. Je commenterai ensuite sa tendance.",
    how: "Tu choisis une variable en bas, puis tu cliques un lieu ou tu lances une enquête guidée. L'outil calcule la pente par décennie et teste si elle se distingue de la variabilité naturelle. Le verdict apparaît à droite.",
    method: "Mann-Kendall compare chaque année à toutes les suivantes. Si les hausses l'emportent largement sur les baisses, la tendance est jugée statistiquement significative. La pente est estimée par la méthode de Sen, robuste aux valeurs extrêmes.",
    source: "Les données viennent de la NASA : MERRA-2 pour la température et l'humidité, GPM IMERG pour la pluie, le satellite OMI pour le NO₂. L'équipe les prépare en séries mensuelles par région.",
    limits: (n) => `Ce résultat décrit une tendance dans des données satellite et de modèle${n ? ' pour ' + n : ''}, pas une mesure sur place. Il ne prouve aucune cause et ne dit rien des épisodes extrêmes quotidiens. Le verdict peut changer avec la période (onglet Stabilité). Et si un lieu est significatif et l'autre non concluant, cela ne prouve pas que leurs pentes diffèrent.`,
    unknown: "Je peux expliquer le verdict, la significativité, la fiabilité ou la méthode. Essaie l'une des questions proposées."
  },
  en: {
    intro: "I'm NASABot. I explain what NASA data shows, without jargon. Pick a place on the globe, then ask me a question.",
    chips0: ['Is pollution falling in Beijing?', 'How does it work?', 'What is Mann-Kendall?', 'Where does the data come from?'],
    chips1: ['What does this show?', 'Is it significant?', 'What can we not conclude?', 'What should I compare next?'],
    nolocation: "Click the globe to pick a place first. I will then comment on its trend.",
    how: "Pick a variable at the bottom, then click a place or start a guided investigation. The tool computes the slope per decade and tests whether it stands out from natural variability. The verdict appears on the right.",
    method: "Mann-Kendall compares each year with all later ones. If increases clearly outnumber decreases, the trend is judged statistically significant. The slope is estimated with Sen's method, which resists extreme values.",
    source: "The data come from NASA: MERRA-2 for temperature and humidity, GPM IMERG for rain, the OMI satellite for NO₂. The team prepares them as monthly series per region.",
    limits: (n) => `This result describes a trend in satellite and model data${n ? ' for ' + n : ''}, not an on-site measurement. It proves no cause and says nothing about daily extreme events. The verdict can change with the period (Stability tab). And if one place is significant and the other inconclusive, that does not prove their slopes differ.`,
    unknown: "I can explain the verdict, significance, reliability or the method. Try one of the suggested questions."
  }
};

export const suggestions = (lang, hasLoc) => (hasLoc ? T[lang].chips1 : T[lang].chips0);
export const intro = (lang) => T[lang].intro;

const SYSTEM = {
  fr: "Tu es NASABot, assistant de l'outil Earth Detective (NASA Space Apps). Tu expliques en français simple, en 3 phrases maximum, des tendances climatiques calculées sur des données NASA. Tu t'appuies UNIQUEMENT sur le contexte JSON fourni. Si une information manque, dis-le. Ne donne jamais de chiffre absent du contexte. Ne fais pas de prédiction.",
  en: "You are NASABot, assistant of the Earth Detective tool (NASA Space Apps). Explain in plain English, 3 sentences max, climate trends computed from NASA data. Rely ONLY on the JSON context provided. If something is missing, say so. Never give a number absent from the context. Make no forecasts."
};

async function llm(question, ctx, lang) {
  const B = CONFIG.bot || {};
  const msgs = [
    { role: 'system', content: SYSTEM[lang] },
    { role: 'user', content: `Contexte : ${JSON.stringify(ctx)}\n\nQuestion : ${question}` }
  ];
  if (B.provider === 'ollama') {
    const r = await fetch(`${B.ollamaUrl || 'http://localhost:11434'}/api/chat`, { method: 'POST', body: JSON.stringify({ model: B.ollamaModel || 'llama3.2', messages: msgs, stream: false }) });
    if (!r.ok) throw new Error('ollama');
    return (await r.json()).message.content;
  }
  if (B.provider === 'groq' && B.groqKey) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${B.groqKey}` }, body: JSON.stringify({ model: B.groqModel || 'llama-3.3-70b-versatile', messages: msgs, temperature: 0.3, max_tokens: 300 }) });
    if (!r.ok) throw new Error('groq');
    return (await r.json()).choices[0].message.content;
  }
  throw new Error('none');
}

// Une question qui cite une région ou un mot-clé d'une variable du catalogue est une demande d'enquête.
const mentionneCatalogue = (q) => {
  const s = q.toLowerCase();
  return (
    Object.values(PLACE_BY_ID).some((p) => s.includes(p.fr.toLowerCase().split(' (')[0])) ||
    Object.values(VAR_BY_ID).some((v) => (v.contrat.mots_cles || []).some((m) => s.includes(String(m).toLowerCase())))
  );
};
// Noms anglais et courants des régions du catalogue (le catalogue ne les donne qu'en français).
const ALIAS = { pekin: ['beijing', 'china', 'chine'], po: ['po valley', 'italy', 'italie', 'milan'], svalbard: ['arctic', 'arctique'], espagne: ['spain', 'madrid'], amazonie: ['amazon', 'rainforest', 'bresil', 'brazil'], sahel: ['niger', 'mali'], dhaka: ['bangladesh'], delhi: ['india', 'inde'], los_angeles: ['california', 'californie'] };
const sansAccents = (x) => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const nommeUnLieu = (q) => {
  const s = sansAccents(q);
  return Object.values(PLACE_BY_ID).some((p) => [p.fr.split(' (')[0], ...(ALIAS[p.id] || [])].some((n) => s.includes(sansAccents(n))));
};

function phraseSuggestion(sug, lang) {
  const v = VAR_BY_ID[(sug.variable_ids || [])[0]];
  const p = sug.region_id ? PLACE_BY_ID[sug.region_id] : null;
  const cible = [v ? tl(v.chip) : null, p ? tl(p) : null].filter(Boolean).join(' · ');
  if (!cible) return sug.explication;
  return `${sug.explication} ${lang === 'fr' ? 'Je t’emmène sur' : 'Taking you to'} : ${cible}.`;
}

/** Réponse du bot : { text, suggestion? }. Une suggestion est appliquée par l'interface (variable, région). */
export async function ask(question, ctx, lang) {
  const B = CONFIG.bot || {};
  try {
    if (B.provider === 'ollama' || B.provider === 'groq') return { text: (await llm(question, ctx, lang)).trim() };
    if (B.provider === 'backend' && CONFIG.advisor) {
      // Un lieu nommé, ou une variable citée sans lieu choisi : on ouvre l'enquête correspondante.
      if (nommeUnLieu(question) || (!ctx.A && mentionneCatalogue(question))) {
        const sug = await suggerer(question);
        return { text: phraseSuggestion(sug, lang), suggestion: sug };
      }
      const texte = await repondre(question, lang, ctx.demande, ctx.historique);
      if (texte) return { text: texte };
    }
  } catch (_) { /* repli sur les règles locales */ }
  const reponse = local(question, ctx, lang);
  return { text: reponse ?? (ctx && ctx.A ? T[lang].unknown : T[lang].nolocation) };
}

function local(q, ctx, lang) {
  const fr = lang === 'fr';
  const s = q.toLowerCase();
  const has = (...w) => w.some((x) => s.includes(x));
  const L = T[lang];
  if (has('comment ça', 'how does', 'how do', 'fonctionne', 'marche', 'utilis')) return L.how;
  if (has('mann', 'méthode', 'method', 'sen ')) return L.method;
  if (has('source', 'donnée', 'data come', 'where does', 'nasa power', 'merra')) return L.source;
  if (has('ne peut-on pas', 'cannot conclude', 'not conclude', 'what can we not')) return L.limits(ctx && ctx.A ? ctx.A.name : null);
  const a = ctx && ctx.A;
  if (!a) return null;
  const u = ctx.unit;
  const sl = a.slope;
  const dir = a.direction;
  const name = a.name;
  const dirTxt = dir === 'up' ? (fr ? 'monte' : 'rises') : dir === 'down' ? (fr ? 'baisse' : 'falls') : '';
  if (has('signific', 'hasard', 'chance', 'p-value', 'p value', 'pvalue', 'valeur p', 'sûr', 'sure')) {
    if (dir === 'inconclusive') return fr
      ? `Pour ${name}, la pente de ${sl} ${u} par décennie reste dans la variabilité naturelle (p = ${a.p}). Aucune tendance ne peut être affirmée sur ${ctx.period[0]}-${ctx.period[1]}.`
      : `At ${name}, the slope of ${sl} ${u} per decade stays within natural variability (p = ${a.p}). No trend can be claimed for ${ctx.period[0]}-${ctx.period[1]}.`;
    return fr
      ? `Le test est significatif. Pour ${name}, la valeur ${dirTxt} de ${sl} ${u} par décennie et p = ${a.p}. Si aucune tendance n'existait, une pente aussi nette apparaîtrait dans moins de ${a.pPct} % des cas, sous les hypothèses du test. Intervalle plausible : ${a.ci}.`
      : `The test is significant. At ${name}, the value ${dirTxt} by ${sl} ${u} per decade with p = ${a.p}. If no trend existed, a slope this clear would appear in under ${a.pPct}% of cases, under the test assumptions. Plausible range: ${a.ci}.`;
  }
  if (has('fier', 'fiable', 'trust', 'reliable', 'limite', 'confiance')) {
    const notes = [];
    if (a.autocorrelated) notes.push(fr ? 'les années voisines se ressemblent, le test a donc été corrigé (Hamed-Rao)' : 'neighbouring years resemble each other, so the test was corrected (Hamed-Rao)');
    if (a.n < 20) notes.push(fr ? `seulement ${a.n} années, ce qui limite la puissance du test` : `only ${a.n} years, which limits test power`);
    notes.push(fr ? 'les valeurs décrivent une région (zone ou point de grille), pas une station locale' : 'values describe a region (area or grid point), not a local station');
    notes.push(fr ? "l'onglet Stabilité montre si le verdict change quand on décale l'année de départ" : 'the Stability tab shows whether the verdict changes when the start year moves');
    return (fr ? 'Quelques points de vigilance : ' : 'A few cautions: ') + notes.join(fr ? ' ; ' : '; ') + '.';
  }
  if (has('compar', 'ensuite', 'next', 'suivant')) {
    return ctx.B
      ? (fr ? `Tu compares déjà ${a.name} et ${ctx.B.name}. Regarde l'onglet Évolution en mode anomalies pour voir qui s'écarte le plus de sa moyenne.` : `You already compare ${a.name} and ${ctx.B.name}. Open Trend in anomaly mode to see who departs most from its average.`)
      : (fr ? `Clique « Comparer » puis un lieu très différent de ${a.name}, par exemple à une autre latitude. Une même cause peut donner des tendances opposées selon la région.` : `Click Compare then pick a place very different from ${a.name}, for example at another latitude. One cause can give opposite trends in different regions.`);
  }
  // résumé par défaut
  if (dir === 'inconclusive') return fr
    ? `Pour ${name}, ${ctx.variable} ne montre pas de tendance claire sur ${ctx.period[0]}-${ctx.period[1]} : ${sl} ${u} par décennie, p = ${a.p}.`
    : `At ${name}, ${ctx.variable} shows no clear trend over ${ctx.period[0]}-${ctx.period[1]}: ${sl} ${u} per decade, p = ${a.p}.`;
  return fr
    ? `Pour ${name}, ${ctx.variable} ${dirTxt} de ${sl} ${u} par décennie sur ${ctx.period[0]}-${ctx.period[1]}, soit ${a.total} ${u} au total. La tendance est statistiquement significative (p = ${a.p}).`
    : `At ${name}, ${ctx.variable} ${dirTxt} by ${sl} ${u} per decade over ${ctx.period[0]}-${ctx.period[1]}, ${a.total} ${u} in total. The trend is statistically significant (p = ${a.p}).`;
}
