# Soumission Space Apps 2026 : Earth Detective (Neural Newtons)

> Date limite : **dimanche 15 novembre 2026, 23 h 59 heure locale de notre événement**. Seul le dernier clic sur
> « Submit for Judging » compte. Activer le « Lock » pendant qu'une personne édite, et « Save Progress » souvent.
>
> Les textes à coller sont en **anglais** (jury international). Chaque chiffre cité vient de `docs/data_choices.md`
> (moyennes de zone), aucun n'est arrondi à la main différemment.

## 0. À régler AVANT de soumettre (bloquant)

| # | Point | Pourquoi | Qui |
|---|---|---|---|
| 1 | **Fusionner le travail dans `main`** | Le dépôt est public, mais `origin/main` ne contient que le scaffold (`c4e0472`). Le jury ouvrira `main`. | ✅ fait |
| 2 | **Site déployé accessible sans compte**, lien complet en `https://` | Condition d'éligibilité. Mettre `?lang=en` au bout du lien envoyé au jury (l'app lit ce paramètre). | ✅ fait (Render) |
| 3 | **Bug de traduction corrigé** (voir section 9) | Avec `?lang=en`, les noms de régions, les définitions, les enquêtes guidées et le résumé du moteur restent en français. | ✅ corrigé (commit 2247b11), à vérifier à l’écran |
| 4 | **Démo publique** (7 slides max OU vidéo de 30 s max), lien sans mot de passe | Condition d'éligibilité aux prix globaux. | ✅ fait (PDF dans `docs/`, voir section 3) |
| 5 | **Mention de l'IA visible dans le projet** (README + page « Comment ça marche ») | Règle SI : le code et les données générés avec l'IA doivent être signalés dans le texte et les métadonnées, et le jury voit ces mentions. | ✅ README (section « Use of AI ») et rapport technique |
| 6 | **Assistant renommé Trendbot** (ex-NASABot) | Le règlement interdit d’utiliser la marque NASA. | ✅ fait |
| 7 | **Clé OpenAI sur le site public** | Une URL publique permet à n'importe qui de consommer la clé. Soit plafond de dépense sur la clé, soit déploiement sans clé (le repli par règles fonctionne). | ✅ déployé sans clé (repli par règles) |

## 1. Project Name

```
Earth Detective
```

## 2. Summary (50 à 200 mots, 1 500 caractères max)

```
Earth Detective is an interactive tool that lets anyone investigate whether Earth's environment is really changing, using NASA data. Users pick a question (temperature, air humidity, rainfall or nitrogen dioxide), a region on a 3D globe and a period. Earth Detective then shows the monthly NASA series, removes the seasonal cycle and gives a clear verdict: is the variable rising or falling, how fast per decade, and is the change statistically significant (Mann-Kendall test, Sen's slope with a 95% confidence interval)? It covers 11 contrasting regions with data from MERRA-2, GPM IMERG and OMI, extracted through NASA Giovanni and Harmony. It reveals that one variable can move in opposite directions: NO2 fell sharply over Los Angeles but rose over Dhaka. Trendbot, a conversational assistant, helps users choose an investigation and understand the result in plain language; it never computes the statistics itself. Guided investigations, data exports and a bilingual interface make it ready for classrooms. Our goal is to bridge the gap between complex satellite data and human understanding, and to encourage informed curiosity about our planet.
```

## 3. Project Demonstration

7 slides en PDF, dans le dépôt public (s'ouvre sans compte) :

```
https://github.com/elomokm/Neural_newtons_nasa_sp/blob/main/docs/Earth_Detective_Demo.pdf
```

1. Titre : Earth Detective, Neural Newtons, le défi, le lien du site.
2. Le problème : 40 ans de données NASA, les saisons qui masquent la tendance, « une ligne qui monte n'est pas une preuve ».
3. L'outil en une capture (Los Angeles contre Dhaka) et ses 4 fonctions : atlas 3D, comparaison, période, Trendbot.
4. La méthode en 4 étapes (données NASA, saisons retirées, Mann-Kendall, pente de Sen) et les garde-fous.
5. Paris, température 1980-2024 : la série brute, puis sans saisons, en moyennes annuelles, avec la pente de Sen.
6. Pékin, NO₂ : 2005-2011 contre 2012-2024, le verdict dépend de la période.
7. Résultats sur 11 régions, limites assumées, liens (site et dépôt).

Règle : aucune image générée par IA ; pas de logo NASA ; captures d'écran de l'app et graphiques du moteur uniquement.

## 4. Project (lien)

```
https://github.com/elomokm/Neural_newtons_nasa_sp
```

Le dépôt plutôt que le site : il répond toujours (le site gratuit s'endort), et le README pointe en tête vers le site en
ligne, le rapport technique et le code.

## 5. Project Details

```
WHAT IT DOES
Earth Detective is a web application that helps students and the general public investigate how the Earth system is changing, using NASA data. The user chooses a question (Is it getting warmer? Is the air more humid? Is there more or less rain? Is the air more or less polluted?), clicks on a region of a 3D globe and selects a period. The tool shows the monthly NASA time series (raw, or with the seasons removed), draws the trend line, and gives a verdict in one sentence: significant increase, significant decrease, or no significant trend over this period. It states how much the variable changes per decade, with a 95% confidence interval, and what that means in everyday words.

HOW IT WORKS
1. Data: four NASA variables from three sources. Air temperature and specific humidity at 2 m (MERRA-2 reanalysis, 1980 to 2024), precipitation (GPM IMERG V07, 1998 to 2024) and tropospheric NO2 (OMI on Aura, 2005 to 2024, daily values aggregated to monthly means). For each of the 11 regions we computed area averages over a bounding box with NASA Giovanni and Harmony and cached 86 monthly series, so the analysis never depends on a live connection.
2. Statistics: the seasonal cycle is removed (each month is compared with the mean of the same month), anomalies are averaged per year, the Mann-Kendall test gives the p-value and Sen's slope gives the rate of change per decade with its confidence interval. Robustness checks (Hamed-Rao correction for autocorrelation, seasonal Mann-Kendall, linear regression) are shown in an expandable evidence panel.
3. Interface: a 3D globe (three.js) with one marker per region coloured by its verdict, side-by-side comparison of two regions, a period selector, a stability view showing how the verdict changes with the start year, and CSV export. English and French.
4. Trendbot: users can type a free question ("Is pollution dropping in Beijing?"). Trendbot picks a variable and a region from the catalogue, opens the investigation and explains the result in simple words. It can use a language model, and falls back to rule-based answers without one (this is how the public site runs).

WHAT IT REVEALS (area averages)
- Temperature rose significantly in 9 of 11 regions; Svalbard warms by about +0.70 C per decade, 1.77 times the Paris rate (+0.40 C).
- Specific humidity rose significantly in all 11 regions, consistent with warmer air holding more water vapour.
- Rainfall shows a significant trend in only one region (Beijing): 27 years are not enough to detect a trend in such a variable signal, and the tool says so.
- NO2 fell strongly over Los Angeles (-4.59) and Beijing (-4.17 x 10^15 molecules/cm2 per decade) but rose over Dhaka (+1.59): the same variable moves in opposite directions.
- Over Beijing, NO2 shows no significant trend from 2005 to 2011 (p = 0.23) and a sharp decrease from 2012 to 2024 (p < 0.001): the conclusion depends on the period chosen.
The tool measures trends; it does not establish their causes.

BENEFITS AND INTENDED IMPACT
Earth Detective teaches the scientific reflex behind climate headlines: look at the data, remove what is normal, test whether the change could be chance, and report the uncertainty. It is designed for classrooms: four guided investigations walk students step by step without giving the answer in advance, and every result can be exported and cited.

TOOLS AND LANGUAGES
Python (pandas, NumPy, SciPy, pyMannKendall, FastAPI, Uvicorn), JavaScript (three.js, D3, esbuild), NASA Giovanni and Harmony, earthaccess and harmony-py for data access, OpenAI API (optional) for Trendbot, pytest (38 automated tests). Hosted on Render. No special hardware: the analysis runs on a standard CPU and the globe needs a WebGL browser.

CREATIVITY
Instead of a dashboard of charts, the tool is framed as an investigation: a question, a place, evidence, a verdict. The stability view lets users see a trend appear or disappear when they move the start year, which makes a subtle statistical idea visible.

FACTORS WE CONSIDERED
- Scientific honesty: the tool never says "proven"; a non-significant result is reported as "no significant trend over this period", not as "stable"; a warning appears when fewer than 30 years of data are used (WMO recommendation); no analysis below 5 years.
- Data quality: we screened candidate variables and regions before choosing, rejected GLDAS 2.1 soil moisture because it gives trends of opposite sign to GLDAS 2.0 in several regions over 2000 to 2014, and use area averages rather than a single grid point. We audited all 86 cached series (calendar, duplicates, missing values, units).
- Responsible AI: Trendbot never computes or invents a number. It may only choose identifiers from the catalogue, and any explanation containing a number that is not in the computed result is discarded and replaced by the engine's own summary.
- Accessibility: plain language, colour plus text for every verdict, English and French interface.

LIMITATIONS
Values describe a region from satellite and reanalysis data, not a local weather station. MERRA-2 shows a surprising cooling over Dhaka, which we present as an open question rather than a finding. Eleven regions are pre-computed; extending to any point on Earth requires live API calls.

LINKS
Live application: https://earth-detective.onrender.com/?lang=en (free hosting: first load can take about one minute)
Source code: https://github.com/elomokm/Neural_newtons_nasa_sp
Technical report: https://github.com/elomokm/Neural_newtons_nasa_sp/blob/main/docs/Earth_Detective_Technical_Report.pdf
Demo slides: https://github.com/elomokm/Neural_newtons_nasa_sp/blob/main/docs/Earth_Detective_Demo.pdf
```

## 6. Use of Super Intelligence (SI)

Cocher dans la liste ce qui s'applique (à confirmer par chaque membre) : **code** (assistants de code IA utilisés par
l'équipe) et **texte / chatbot intégré au produit** (assistant de l'app). Ne PAS cocher images, vidéo ou audio si aucun
n'a été généré. Texte de référence, à reprendre dans le README (section « Use of AI ») pour que le jury le voie :

```
Use of AI in Earth Detective
- Development: the team used AI coding assistants (Claude Code; add any other tool each member used) to write and review parts of the Python and JavaScript code, the documentation and the data-access scripts. All code was reviewed and tested by the team (38 automated tests).
- In the product: the assistant uses the OpenAI API (gpt-4.1-mini by default) to map a free-text question to a variable and region from our catalogue and to rephrase computed results in plain language. It never computes statistics: every number shown comes from our statistics engine, and AI answers containing unverified numbers are rejected automatically.
- No images, video or audio were generated with AI. Globe imagery is NASA Blue Marble / GIBS.
```

## 7. NASA Data (Link Text / Link Url)

| Link Text | Link Url |
|---|---|
| MERRA-2 M2IMNXASM v5.12.4 (2 m air temperature and specific humidity) | https://disc.gsfc.nasa.gov/datasets/M2IMNXASM_5.12.4/summary |
| GPM IMERG Final Monthly V07 (precipitation) | https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGM_07/summary |
| OMI/Aura OMNO2d v003 (tropospheric NO2) | https://disc.gsfc.nasa.gov/datasets/OMNO2d_003/summary |
| NASA Giovanni (time series and area averaging) | https://giovanni.gsfc.nasa.gov/giovanni/ |
| NASA Harmony (area-average service) | https://harmony.earthdata.nasa.gov/ |
| harmony-py (NASA Harmony Python client) | https://github.com/nasa/harmony-py |
| NASA GIBS (Blue Marble and MODIS globe imagery) | https://nasa-gibs.github.io/gibs-api-docs/ |
| NASA Blue Marble (globe texture) | https://visibleearth.nasa.gov/collection/1484/blue-marble |
| MERRA-2 reanalysis (NASA GMAO) | https://gmao.gsfc.nasa.gov/reanalysis/MERRA-2/ |
| NASA Earthdata | https://www.earthdata.nasa.gov/ |

## 8. Space Agency Partner & Other Data (Link Text / Link Url)

| Link Text | Link Url |
|---|---|
| earthaccess (NSIDC, Earthdata access library) | https://github.com/nsidc/earthaccess |
| three.js (3D globe) | https://threejs.org/ |
| D3.js (charts and map projections) | https://d3js.org/ |
| world-atlas / Natural Earth (country borders) | https://github.com/topojson/world-atlas |
| world-countries (country names) | https://github.com/mledoze/countries |
| all-the-cities / GeoNames (capital cities, build step) | https://github.com/zeke/all-the-cities |
| Fontsource (Fraunces and IBM Plex fonts, SIL Open Font License) | https://fontsource.org/ |
| FastAPI (web server) | https://fastapi.tiangolo.com/ |
| pandas | https://pandas.pydata.org/ |
| SciPy | https://scipy.org/ |
| pyMannKendall (trend tests) | https://github.com/mmhs013/pyMannKendall |
| OpenAI API (assistant, gpt-4.1-mini) | https://platform.openai.com/docs/models |

Si d'autres outils ou textes extérieurs ont été utilisés (ex. icônes, captures, articles cités), les ajouter ici :
la case « Confirm All Work is Original » engage l'équipe sur l'exhaustivité de ces deux listes.

## 9. Bug de traduction (anglais) : diagnostic

Constaté dans le code et dans la sortie copiée dans `TREND DETECTIVE.md` : l'interface est traduite (`i18n.js`), mais
tout ce qui vient du catalogue et du moteur reste en français.

| Texte encore en français en mode anglais | D'où il vient |
|---|---|
| Noms de régions (« Pékin », « Plaine du Pô », « Espagne centrale »…) | `content.js` : `place = { fr: r.nom, en: r.nom }` |
| Définitions des variables | `content.js` : `def: deux(v.definition)` (`deux` copie le français dans `en`) |
| Enquêtes guidées (titre, texte, accroche) | `content.js` : `deux(sc.titre)`, `deux(e.texte)`, `deux(sc.accroche)` |
| « Le résumé du moteur » et le résumé copié | `main.js` : `c.resume`, phrase française générée par `trend.stats` |
| Nom de région dans le panneau « Identité » | `main.js` : `reg.nom` |
| Tableau des tests (colonne « Détail », en-têtes) | `trend.stats` : DataFrame `tests` en français |
| Messages d'erreur du serveur | `app/api.py` : `message` en français |
| Explication de la suggestion de l'assistant | `trend.advisor.suggerer` : `explication` en français |

Correction proposée (front seulement, sans toucher au contrat) : un dictionnaire anglais par identifiant dans
`content.js` (11 régions, 4 définitions, scénarios), un résumé anglais construit dans le front à partir des seuls
chiffres du résultat, et traduction des en-têtes du tableau de tests et des messages d'erreur par leur `code`.
