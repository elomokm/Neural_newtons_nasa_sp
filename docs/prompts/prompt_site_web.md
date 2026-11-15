# Prompt : site web Earth Detective (Lovable ou Bolt)

Mode d'emploi :
1. Nouveau projet Lovable (ou Bolt). **Joindre les 6 captures** de `docs/captures/` dans le premier message.
2. Coller tout le texte sous la ligne « PROMPT ».
3. Les noms de l'équipe restent des `[Member 1]` à `[Member 4]` : on les remplit ensuite dans `src/content/team.ts` (rien de personnel envoyé à Lovable).
4. À la fin : export GitHub (Lovable : « GitHub » → nouveau dépôt) ou téléchargement du zip (Bolt). Me donner le dépôt ou le zip :
   je l'intègre dans `website/`, le serveur sert le site à `/` et l'explorateur actuel à `/explore/`.

Ne pas demander à Lovable de refaire le globe ou les calculs : l'explorateur existe et reste tel quel.

---

PROMPT

Build the public website of **Earth Detective**, our project for the NASA Space Apps Challenge 2026 (challenge "Be An Earth System Trend Detective!"), team **Neural Newtons**. Earth Detective already has a working interactive explorer (3D globe, charts, statistics engine). That explorer is a SEPARATE app that will be served at the path `/explore/` on the same domain. Your job is everything around it: a multi-page website that explains the project, presents the findings, and sends visitors into the explorer. Do NOT rebuild the explorer, the globe or any statistics.

## 1. Hard technical constraints (the site will be integrated by our team afterwards)

- Vite + React + TypeScript + Tailwind CSS + react-router-dom (BrowserRouter). shadcn/ui is fine.
- 100% static front end. NO backend, NO Supabase, NO database, NO authentication, NO forms that send data, NO analytics, NO cookies banner, NO environment variables, NO external API calls.
- `npm run build` must output a static site in `dist/` with `base: '/'`.
- Fonts self-hosted with @fontsource packages (no Google Fonts CDN): `@fontsource-variable/fraunces`, `@fontsource-variable/ibm-plex-sans`, `@fontsource/ibm-plex-mono`.
- Every link to the explorer is a plain `<a href="...">` (full page load), NEVER a router `<Link>`, because `/explore/` is not part of this React app. In the preview these links will 404: that is expected.
- All visible text lives in two files, `src/i18n/en.ts` and `src/i18n/fr.ts`, with the same keys. English is the default. A language toggle (EN / FR) in the header stores the choice in `localStorage` under the key `ed.lang` (values `en` or `fr`) and sets `<html lang>`. The explorer reads the same key, so the language carries over. Explorer links must append `?lang=<current language>`.
- All numbers and scientific facts live in ONE typed file, `src/content/findings.ts`, used by every page. Never hard-code a number in a component. Never invent a number, a date, a statistic, a quote or a claim that is not in this prompt.
- Team, data sources and credits live in `src/content/team.ts`, `src/content/data.ts`, `src/content/credits.ts`.
- Screenshots: use the 6 images attached to this message, saved as `public/images/01_accueil.jpg` … `06_paris_details.jpg` (names below). Reference them as `/images/<name>`.
- Responsive from 360 px to 1920 px, no horizontal scroll. WCAG AA contrast, visible focus states, full keyboard navigation, `prefers-reduced-motion` respected. Lighthouse performance > 90: no video backgrounds, no heavy 3D, lazy-load images.
- Include a README with `npm install`, `npm run dev`, `npm run build`.

## 2. Brand and design

Identity "Observatory": a scientific instrument at night. Calm, precise, editorial. Dark only.

Design tokens (use exactly these, as CSS variables and in the Tailwind config):
- Background `#07111F`, background 2 `#0A1A2F`, panel `#0F2340`, panel 2 `#15305A`, line `#1C3556`, line 2 `#2A4A74`
- Text `#EEF4FF`, muted text `#AFC0DA`, faint `#8FA2C0`
- Accent (cyan) `#5FD4E6`, text on accent `#07111F`
- Verdict colours: significant increase `#FF6B7D`, significant decrease `#3D9BFF`, no significant trend `#9AA7BD`. A colour never carries meaning alone: always pair it with a word ("Significant increase") and an icon or arrow. The colour does not judge good or bad: a decrease of pollution and a decrease of rain use the same blue.
- Fonts: Fraunces (headings, large numbers), IBM Plex Sans (body), IBM Plex Mono (small uppercase labels, eyebrows, data values, units).
- Radius 12 px (cards), 18 px (large panels). Subtle star-field or grain on the background is welcome, kept very light.
- Logo: a circle with a small rising zig-zag line inside (white line, cyan ring), plus the wordmark "Earth Detective" in Fraunces. Draw it as inline SVG.

Branding rules (competition rules, mandatory):
- NO NASA logo, insignia ("meatball", "worm"), mission patch or flag, and the word NASA is never part of our name or logo. We may write "uses NASA data" in plain text.
- Footer disclaimer on every page: "Earth Detective uses NASA data. It is not affiliated with or endorsed by NASA."
- NO AI-generated images or illustrations. Use only the attached screenshots, SVG icons (lucide-react) and simple SVG/CSS graphics (charts drawn from the numbers below are encouraged).

Tone: short sentences, active voice, readable by a 16-year-old. Never write "proven" or "proves". Say "significant trend (at the 5% level)" or "no significant trend over this period". A non-significant result never means "stable".

## 3. Site map

Header (sticky): logo, nav (Home, Investigations, Findings, Method, Data, About), language toggle, primary button "Open the explorer" → `/explore/?lang=en`.

### 3.1 Home `/`
1. Hero. Eyebrow "NASA Space Apps Challenge 2026". Title "Is it really changing?" Subtitle "Pick a question, touch the Earth, read the verdict. Earth Detective tests 20 to 45 years of NASA data and tells you whether a change is real, which way it goes, how fast, and how sure we can be." Buttons: "Open the explorer" (primary) and "Start a guided investigation" (→ `/investigations`). Visual: screenshot `02_paris_temperature.jpg` in a framed device-like panel.
2. "Same variable, opposite directions": a small bar chart (SVG, drawn from `findings.ts`) of NO₂ trends for Los Angeles, Beijing, Paris, Dhaka, with verdict colours. One sentence: "Over the same 20 years, nitrogen dioxide fell sharply over Los Angeles and Beijing, but rose over Dhaka." Link "See it in the explorer" (deep link, section 4).
3. "Four questions, one verdict": 4 cards: Is it changing? Which way? How fast? How sure are we?
4. "How it works" in 4 steps with icons: NASA monthly data for a region → remove the seasons → test the trend (Mann-Kendall) → measure the speed (Sen's slope, 95% confidence interval). Link to `/method`.
5. Key findings teaser: 3 cards from section 5 (opposite fates, Arctic, rain). Link to `/findings`.
6. "Built for classrooms": guided investigations, plain-language verdicts, CSV export, English and French. Screenshot `03_no2_la_dhaka.jpg`.
7. Final call to action: "Become an Earth trend detective" + "Open the explorer".

### 3.2 Investigations `/investigations`
Four guided stories as large cards. Each card: title, hook, variable, region(s), period, a "What to look for" line, and a button "Start this investigation" that deep-links into the explorer (section 4). Never give the answer on the card: the verdict is discovered in the explorer.
1. "Paris: three investigations, three verdicts". Hook: "Increase, decrease or nothing at all: the tool can tell all three." Variables: temperature, NO₂, rain. Screenshot `05_paris_pluie.jpg`.
2. "Same pollutant, opposite fates". Hook: "One variable can rise here and fall there." NO₂, Los Angeles vs Dhaka, 2005–2024. Screenshot `03_no2_la_dhaka.jpg`.
3. "Beijing: the turning point". Hook: "The verdict depends on the period you choose." NO₂, Beijing, 2005–2011 then 2012–2024. Screenshot `04_pekin_no2_2012.jpg`.
4. "Is the Arctic warming faster?" Hook: "Compare Svalbard and Paris over the whole period." Temperature, 1980–2024.

### 3.3 Findings `/findings`
What our analysis of NASA data shows (area averages over each region, Sen's slope per decade, Mann-Kendall test on annual means of seasonal anomalies). One section per finding, each with a small SVG chart or big number, the exact values from `findings.ts`, the period, and a deep link. Then the full results table (section 5) with verdict colours and a legend. End with "What we cannot conclude": a trend does not prove its cause; regional satellite and model data are not a local weather station; nothing here is about daily extremes; the verdict can change with the period.

### 3.4 Method `/method`
Plain-language explanation of the 7 steps (section 6), each with a small diagram or icon, a "Why?" sentence, then a "Safeguards" block, a "Limitations" block and "References". Optional: an interactive toy showing a noisy series with a slider for the start year, entirely with fake illustrative data that is clearly labelled "Illustration, not real data".

### 3.5 Data `/data`
- The 4 variables (table or cards): name, plain definition, NASA source, dataset identifier, period, unit (section 7).
- The 11 regions: name, type, why it is interesting (section 7). A simple SVG world map (equirectangular, from a light world outline such as `world-atlas` via `d3-geo` or a static SVG) with one dot per region at its centre coordinates.
- The data pipeline in 4 boxes: NASA GES DISC datasets → Giovanni / Harmony area averages → monthly series cache (86 series) → statistics engine → explorer.
- "What we left out and why" (section 7).

### 3.6 About `/about`
- The challenge in 2 sentences, link to https://www.spaceappschallenge.org/2026/challenges/
- Team Neural Newtons (4 cards from `team.ts`): [Member 1] (NASA data access and statistics), [Member 2] (statistics engine), [Member 3] (explorer app), [Member 4] (AI assistant). Keep these placeholders exactly; we fill the names in `team.ts`. Use initials avatars, no photos.
- "Use of AI" section (mandatory, keep the wording): "Development: the team used AI coding assistants to write and review parts of the code, the documentation and the data scripts; all code was reviewed and tested by the team. In the product: the assistant (Trendbot) uses a large language model to map a free-text question to a variable and region from our catalogue and to rephrase computed results in plain words. It never computes statistics: every number shown comes from our statistics engine, and answers containing unverified numbers are rejected automatically. No images, video or audio were generated with AI."
- Source code: https://github.com/elomokm/Neural_newtons_nasa_sp
- Credits (section 8).

### 3.7 404 page
Friendly, with links to Home and the explorer.

Footer on every page: logo, short tagline, nav links, GitHub link, "NASA Space Apps Challenge 2026 · Team Neural Newtons", and the NASA disclaimer.

## 4. Explorer deep links (use exactly this format)

Base: `/explore/?lang=<en|fr>&nowelcome=1#<hash>` where the hash is URL-encoded `key=value` pairs:
- `v` = variable id: `t2m` (temperature), `qv2m` (humidity), `precip` (rain), `no2`
- `a` = first place `lat,lon,regionId`; optional `b` = second place, same format (comparison)
- `p` = period `startYear-endYear`

Ready-made links (put them in `findings.ts`):
- Paris temperature: `#v=t2m&a=48.85,2.35,paris&p=1980-2024`
- Paris NO₂: `#v=no2&a=48.85,2.35,paris&p=2005-2024`
- Paris rain: `#v=precip&a=48.85,2.35,paris&p=1998-2024`
- Los Angeles vs Dhaka NO₂: `#v=no2&a=34.0,-118.15,los_angeles&b=23.8,90.4,dhaka&p=2005-2024`
- Beijing NO₂ 2005–2011: `#v=no2&a=39.9,116.4,pekin&p=2005-2011`
- Beijing NO₂ 2012–2024: `#v=no2&a=39.9,116.4,pekin&p=2012-2024`
- Svalbard vs Paris temperature: `#v=t2m&a=78.5,19.0,svalbard&b=48.85,2.35,paris&p=1980-2024`
- Sahel rain: `#v=precip&a=14.0,5.0,sahel&p=1998-2024`

## 5. Findings (the ONLY numbers allowed on the site)

Trend = Sen's slope per decade, area average over the region. "significant" = Mann-Kendall p < 0.05. Periods: temperature and humidity 1980–2024, rain 1998–2024, NO₂ 2005–2024.

Units: temperature °C per decade; humidity g/kg per decade (grams of water vapour per kg of air); rain mm/day per decade; NO₂ ×10¹⁵ molecules/cm² per decade.

| Region | Temperature | Humidity | Rain | NO₂ |
|---|---|---|---|---|
| Paris | +0.40 sig | +0.10 sig | −0.04 not sig | −1.98 sig |
| Po Valley | +0.50 sig | +0.23 sig | +0.05 not sig | −2.55 sig |
| Beijing | +0.22 sig | +0.19 sig | +0.33 sig | −4.17 sig |
| Los Angeles | +0.17 sig | +0.16 sig | +0.01 not sig | −4.59 sig |
| Dhaka | −0.23 sig | +0.57 sig | −0.26 not sig | +1.59 sig |
| Delhi | −0.12 not sig | +0.48 sig | +0.12 not sig | −0.30 not sig |
| Sahel | +0.12 sig | +0.23 sig | +0.06 not sig | +0.03 not sig |
| Svalbard | +0.70 sig | +0.12 sig | +0.05 not sig | no data (polar night) |
| Central Spain | +0.34 sig | +0.13 sig | −0.04 not sig | −0.30 sig |
| Central Amazon | +0.31 sig | +0.08 sig | −0.11 not sig | +0.02 not sig |
| France | +0.39 sig | +0.15 sig | −0.06 not sig | −0.53 sig |

Headline findings (exact wording allowed):
1. Same pollutant, opposite fates: NO₂ fell significantly over Los Angeles (−4.59) and Beijing (−4.17) but rose significantly over Dhaka (+1.59), ×10¹⁵ molecules/cm² per decade, 2005–2024.
2. The Arctic warms faster: Svalbard +0.70 °C per decade versus Paris +0.40 °C per decade (1980–2024), about 1.75 times faster.
3. Rain is hard to read: only 1 of 11 regions shows a significant rain trend (Beijing). Rain varies so much from year to year that 27 years are not enough.
4. The period changes the verdict: over Beijing, NO₂ shows no significant trend from 2005 to 2011 (p = 0.23), then a sharp decrease from 2012 to 2024 (−7.7 per decade, p < 0.001).
5. The air holds more water: specific humidity increased significantly in all 11 regions, consistent with warmer air holding more water vapour.
6. An open question, not a finding: MERRA-2 shows a significant cooling over Dhaka (−0.23 °C per decade) while humidity rises strongly. Possible explanations (irrigation, aerosols) are not verified. Present it as a question for detectives.

## 6. Method (7 steps, plain words)

1. Take the series: monthly NASA values of one variable, averaged over the region (for example 540 months of temperature in Paris).
2. Remove the seasons: compare each month with the average of the same month (January with all Januaries). What remains are departures from normal.
3. Average per year: one value per year. Two neighbouring months are too similar to be tested as independent.
4. Test the trend (Mann-Kendall): compare each year with all later years and check whether increases (or decreases) dominate more than chance would allow. This gives a p-value.
5. Measure the speed (Sen's slope): the median of the slopes between all pairs of years, per decade, with a 95% confidence interval.
6. Give the verdict: p < 0.05 and positive slope → significant increase; p < 0.05 and negative slope → significant decrease; p ≥ 0.05 → no significant trend over this period (which does not mean stable).
7. Add the safeguards: warning when fewer than 30 years of data are used (World Meteorological Organization climate normals); no analysis under 5 years; a trend does not prove its cause.

Extra checks shown in the explorer: Mann-Kendall corrected for autocorrelation (Hamed and Rao), seasonal Mann-Kendall (Hirsch and Slack), linear regression.

Explain the p-value simply: "If there were no trend at all, how often would chance alone produce a slope this clear? p = 0.01 means about 1 time in 100."

References: Mann (1945), Econometrica; Kendall (1975), Rank Correlation Methods; Sen (1968), Journal of the American Statistical Association; Hamed and Rao (1998), Journal of Hydrology; Hirsch and Slack (1984), Water Resources Research; World Meteorological Organization, climate normals (30 years).

## 7. Data

Variables:
- Air temperature at 2 m. "Measured 2 metres above the ground: it is the temperature given in weather forecasts. Each value is a monthly mean." Source: MERRA-2 reanalysis (NASA GMAO), dataset M2IMNXASM v5.12.4, variable T2M. 1980–2024. °C.
- Air humidity (specific humidity at 2 m). "Amount of water vapour in the air, in grams per kilogram of air. Warmer air can hold more water vapour. This is not the relative humidity of weather apps." Source: MERRA-2, M2IMNXASM v5.12.4, variable QV2M. 1980–2024. g/kg.
- Precipitation. "Water falling from the sky (rain, snow, hail), estimated by the GPM satellite constellation. 1 mm equals 1 litre of water per square metre." Source: GPM IMERG Final Monthly V07 (GPM_3IMERGM). 1998–2024. mm/day.
- Tropospheric nitrogen dioxide (NO₂). "A polluting gas emitted mainly by road traffic, power plants and industry, measured from space by the OMI instrument on the Aura satellite." Source: OMI/Aura OMNO2d v003, daily values averaged per month. 2005–2024. ×10¹⁵ molecules/cm².

Regions (id, name, type, centre lat/lon, why):
- paris, Paris, city, 48.85/2.35: a European capital where we can follow both warming and anti-pollution policies.
- po, Po Valley, farming and industry, 45.2/10.25: an industrial plain surrounded by mountains, where polluted air often stagnates.
- pekin, Beijing, city, 39.9/116.4: a megacity that launched a major clean-air plan in the early 2010s.
- los_angeles, Los Angeles, city, 34.0/−118.15: famous for its smog and for some of the strictest car standards in the world.
- dhaka, Dhaka (Ganges delta), city, 23.8/90.4: one of the fastest-growing cities in the world.
- delhi, Delhi, city, 28.6/77.2: a huge city with an open puzzle in the data.
- sahel, Sahel, semi-arid, 14.0/5.0: the edge of the desert, where rain decides everything.
- svalbard, Svalbard, Arctic, 78.5/19.0: the high Arctic. No NO₂ data (no sunlight in polar night).
- espagne, Central Spain, Mediterranean, 40.0/−3.5: a hot, dry Mediterranean plateau.
- amazonie, Central Amazon, tropical forest, −4.5/−60.0: the largest tropical rainforest.
- france, France, country, 46.5/2.0: a whole country, for comparison with Paris.

Pipeline: data accessed through NASA Giovanni and NASA Harmony (area averages over each region's bounding box), stored as 86 monthly series, analysed by our Python statistics engine, displayed by the explorer.

What we left out and why:
- GLDAS soil moisture (version 2.1): over the same years (2000–2014) it gives trends of the opposite sign to version 2.0 in several regions. The trend would reflect changes in the model inputs, not the climate.
- NO₂ over Svalbard: the satellite cannot measure during the polar night, so the series is too incomplete.

## 8. Credits

NASA data and services: MERRA-2 (NASA GMAO), GPM IMERG (NASA), OMI/Aura OMNO2d (NASA), NASA Giovanni, NASA Harmony, NASA GES DISC, NASA GIBS and Blue Marble imagery (in the explorer).
Open-source tools: three.js, D3, pandas, SciPy, pyMannKendall, FastAPI, Natural Earth / world-atlas, Fontsource (Fraunces, IBM Plex, SIL Open Font License), plus the libraries used to build this site.

## 9. Images attached

`01_accueil.jpg` (explorer home), `02_paris_temperature.jpg` (Paris temperature verdict), `03_no2_la_dhaka.jpg` (Los Angeles vs Dhaka comparison), `04_pekin_no2_2012.jpg` (Beijing 2012–2024), `05_paris_pluie.jpg` (Paris rain, no significant trend), `06_paris_details.jpg` (statistical details). Show them in subtle frames with a caption; they are screenshots of our real tool.

## 10. Before you finish

Check: every page renders in EN and FR with no missing key; no number appears outside `findings.ts`; no NASA logo; footer disclaimer present; all explorer links are `<a>` with `?lang=`; `npm run build` succeeds with no TypeScript error.
