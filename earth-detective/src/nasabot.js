// NASABot : assistant d'explication. Répond à partir des chiffres affichés.
// Si un back expose POST {backendUrl}/chat, la réponse du back (LLM) est utilisée en priorité.
import { CONFIG } from './api.js';

const T = {
  fr: {
    intro: "Je suis NASABot. Je t'explique ce que montrent les données de la NASA, sans jargon. Choisis un lieu sur la Terre, puis pose-moi une question.",
    chips0: ['Comment ça marche ?', "Qu'est-ce que Mann-Kendall ?", 'Quelle est la source des données ?'],
    chips1: ['Que montre ce résultat ?', 'Est-ce significatif ?', 'Que ne peut-on pas conclure ?', 'Que comparer ensuite ?'],
    nolocation: "Clique d'abord sur la Terre pour choisir un lieu. Je commenterai ensuite sa tendance.",
    how: "Tu choisis une variable en bas, puis tu cliques un lieu ou tu lances une enquête guidée. L'outil calcule la pente par décennie et teste si elle se distingue de la variabilité naturelle. Le verdict apparaît à droite.",
    method: "Mann-Kendall compare chaque année à toutes les suivantes. Si les hausses l'emportent largement sur les baisses, la tendance est jugée statistiquement significative. La pente est estimée par la méthode de Sen, robuste aux valeurs extrêmes.",
    source: "Les mesures viennent de NASA POWER, construit sur la réanalyse MERRA-2 (grille d'environ 50 km).",
    limits: (n) => `Ce résultat décrit une tendance dans une réanalyse (MERRA-2), sur une maille d'environ 50 km${n ? ' autour de ' + n : ''}, pas une mesure sur place. Il ne prouve aucune cause et ne dit rien des épisodes extrêmes quotidiens. Le verdict peut changer avec la période (onglet Stabilité). Et si un lieu est significatif et l'autre non concluant, cela ne prouve pas que leurs pentes diffèrent.`,
    unknown: "Je peux expliquer le verdict, la significativité, la fiabilité ou la méthode. Essaie l'une des questions proposées."
  },
  en: {
    intro: "I'm NASABot. I explain what NASA data shows, without jargon. Pick a place on the globe, then ask me a question.",
    chips0: ['How does it work?', 'What is Mann-Kendall?', 'Where does the data come from?'],
    chips1: ['What does this show?', 'Is it significant?', 'What can we not conclude?', 'What should I compare next?'],
    nolocation: "Click the globe to pick a place first. I will then comment on its trend.",
    how: "Pick a variable at the bottom, then click a place or start a guided investigation. The tool computes the slope per decade and tests whether it stands out from natural variability. The verdict appears on the right.",
    method: "Mann-Kendall compares each year with all later ones. If increases clearly outnumber decreases, the trend is judged statistically significant. The slope is estimated with Sen's method, which resists extreme values.",
    source: "Measurements come from NASA POWER, built on the MERRA-2 reanalysis (about 50 km grid).",
    limits: (n) => `This result describes a trend in a reanalysis (MERRA-2), over a roughly 50 km cell${n ? ' around ' + n : ''}, not an on-site measurement. It proves no cause and says nothing about daily extreme events. The verdict can change with the period (Stability tab). And if one place is significant and the other inconclusive, that does not prove their slopes differ.`,
    unknown: "I can explain the verdict, significance, reliability or the method. Try one of the suggested questions."
  }
};

export const suggestions = (lang, hasLoc) => (hasLoc ? T[lang].chips1 : T[lang].chips0);
export const intro = (lang) => T[lang].intro;

const SYSTEM = {
  fr: "Tu es NASABot, assistant de l'outil Earth Detective (NASA Space Apps). Tu expliques en français simple, en 3 phrases maximum, des tendances climatiques calculées sur des données NASA POWER (MERRA-2). Tu t'appuies UNIQUEMENT sur le contexte JSON fourni. Si une information manque, dis-le. Ne donne jamais de chiffre absent du contexte. Ne fais pas de prédiction.",
  en: "You are NASABot, assistant of the Earth Detective tool (NASA Space Apps). Explain in plain English, 3 sentences max, climate trends computed from NASA POWER data (MERRA-2). Rely ONLY on the JSON context provided. If something is missing, say so. Never give a number absent from the context. Make no forecasts."
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

export async function ask(question, ctx, lang) {
  const B = CONFIG.bot || {};
  try {
    if (B.provider === 'ollama' || B.provider === 'groq') return (await llm(question, ctx, lang)).trim();
    if (B.provider === 'backend' && CONFIG.backendUrl) {
      const r = await fetch(CONFIG.backendUrl.replace(/\/$/, '') + '/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, context: ctx, lang }) });
      if (r.ok) {
        const j = await r.json();
        if (j && j.answer) return j.answer;
      }
    }
  } catch (_) { /* repli sur les règles locales */ }
  return local(question, ctx, lang);
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
  if (!a) return L.nolocation;
  const u = ctx.unit;
  const sl = a.slope;
  const dir = a.direction;
  const name = a.name;
  const dirTxt = dir === 'up' ? (fr ? 'monte' : 'rises') : dir === 'down' ? (fr ? 'baisse' : 'falls') : '';
  if (has('signific', 'hasard', 'chance', 'p-value', 'valeur p', 'sûr', 'sure')) {
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
    notes.push(fr ? 'chaque point est une maille de 50 km, pas une station locale' : 'each point is a 50 km cell, not a local station');
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
