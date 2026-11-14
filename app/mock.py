"""Faux moteur, SEULEMENT pour développer l'interface avant que trend.data / trend.stats soient prêts.

Mêmes fonctions et mêmes objets que le contrat (docs/CONTRAT.md). Les séries sont simulées, sauf la
température de Paris et de la France (vrais fichiers du spike). Les statistiques sont approximatives :
aucun chiffre de ce module ne doit être présenté comme un résultat.
"""
from __future__ import annotations

import math
import zlib
from pathlib import Path

import numpy as np
import pandas as pd
from trend.schemas import Region, ResultatTendance, Serie, Suggestion, Variable

RACINE = Path(__file__).resolve().parents[1]
FIN = "2024-12"

# --- Catalogue (section 3 du contrat) -------------------------------------------------------

_VARIABLES = {
    v.id: v
    for v in [
        Variable(
            id="t2m",
            giovanni_id="M2IMNXASM_5_12_4_T2M",
            nom="Température de l'air à 2 m",
            definition=(
                "Température de l'air à 2 mètres au-dessus du sol : c'est celle que donne la météo. "
                "Ici, chaque valeur est la moyenne d'un mois."
            ),
            unite="°C",
            source="MERRA-2 (NASA GMAO)",
            debut="1980-01",
            hausse_signifie="il fait plus chaud",
            baisse_signifie="il fait plus froid",
            mots_cles=("température", "chaleur", "chaud", "froid", "réchauffement", "climat"),
        ),
        Variable(
            id="qv2m",
            giovanni_id="M2IMNXASM_5_12_4_QV2M",
            nom="Humidité de l'air (humidité spécifique à 2 m)",
            definition=(
                "Quantité de vapeur d'eau contenue dans l'air, à 2 mètres du sol. "
                "Un air plus chaud peut contenir davantage de vapeur d'eau."
            ),
            unite="g/kg",
            source="MERRA-2 (NASA GMAO)",
            debut="1980-01",
            hausse_signifie="l'air contient plus de vapeur d'eau",
            baisse_signifie="l'air est plus sec",
            mots_cles=("humidité", "vapeur", "humide", "sec", "moiteur"),
        ),
        Variable(
            id="precip",
            giovanni_id="GPM_3IMERGM_07_precipitation",
            nom="Précipitations",
            definition=(
                "Quantité d'eau qui tombe du ciel (pluie, neige, grêle), estimée par satellites. "
                "1 mm correspond à 1 litre d'eau par mètre carré."
            ),
            unite="mm/jour",
            source="GPM IMERG (NASA)",
            debut="1998-01",
            hausse_signifie="il pleut davantage",
            baisse_signifie="il pleut moins",
            mots_cles=("pluie", "précipitations", "sécheresse", "mousson", "neige", "orage"),
        ),
        Variable(
            id="no2",
            giovanni_id="OMNO2d_003_ColumnAmountNO2TropCloudScreened",
            nom="Dioxyde d'azote (NO₂) troposphérique",
            definition=(
                "Gaz polluant émis surtout par le trafic routier, les centrales et l'industrie. "
                "L'instrument OMI, à bord du satellite Aura, mesure la quantité présente dans la basse atmosphère."
            ),
            unite="10¹⁵ molécules/cm²",
            source="OMI / Aura (NASA)",
            debut="2004-10",
            hausse_signifie="l'air contient plus de NO₂, donc plus de pollution",
            baisse_signifie="l'air contient moins de NO₂, donc moins de pollution",
            mots_cles=("pollution", "no2", "dioxyde d'azote", "trafic", "voitures", "usines", "air"),
        ),
    ]
}

_TOUTES = ("t2m", "qv2m", "precip", "no2")

_REGIONS = {
    r.id: r
    for r in [
        Region("paris", "Paris", "ville", (1.8, 48.6, 2.9, 49.1), (48.85, 2.35),
               "Grande ville européenne : on y suit à la fois le réchauffement et l'effet des politiques contre la pollution.",
               _TOUTES),
        Region("po", "Plaine du Pô", "agricole et industrielle", (8.5, 44.6, 12.0, 45.8), (45.2, 10.25),
               "Plaine agricole et industrielle du nord de l'Italie, entourée de montagnes : l'air pollué y stagne souvent.",
               _TOUTES),
        Region("pekin", "Pékin", "ville", (115.9, 39.5, 116.9, 40.3), (39.9, 116.4),
               "Mégapole chinoise qui a lancé un grand plan contre la pollution de l'air au début des années 2010.",
               _TOUTES),
        Region("los_angeles", "Los Angeles", "ville", (-118.7, 33.7, -117.6, 34.3), (34.0, -118.15),
               "Ville célèbre pour son smog, où les normes sur les voitures sont parmi les plus strictes du monde.",
               _TOUTES),
        Region("dhaka", "Dhaka (delta du Gange)", "ville", (90.0, 23.5, 90.8, 24.1), (23.8, 90.4),
               "Une des villes qui grandissent le plus vite au monde, dans un delta rythmé par la mousson.",
               _TOUTES),
        Region("delhi", "Delhi", "ville", (76.8, 28.3, 77.6, 28.9), (28.6, 77.2),
               "Mégapole indienne entourée de terres agricoles irriguées, connue pour ses épisodes de pollution en hiver.",
               _TOUTES),
        Region("sahel", "Sahel", "semi-aride", (-5.0, 12.0, 15.0, 16.0), (14.0, 5.0),
               "Bande semi-aride au sud du Sahara, marquée par de grandes sécheresses à la fin du XXᵉ siècle.",
               _TOUTES),
        Region("svalbard", "Svalbard", "arctique", (10.0, 76.5, 28.0, 80.5), (78.5, 19.0),
               "Archipel de l'Arctique, où les scientifiques observent un réchauffement plus rapide que la moyenne mondiale.",
               ("t2m", "qv2m", "precip")),  # pas de NO₂ : nuit polaire
        Region("espagne", "Espagne centrale", "méditerranéen", (-6.0, 38.5, -1.0, 41.5), (40.0, -3.5),
               "Plateau au climat méditerranéen, exposé aux vagues de chaleur et aux sécheresses.",
               _TOUTES),
        Region("amazonie", "Amazonie centrale", "forêt tropicale", (-65.0, -8.0, -55.0, -1.0), (-4.5, -60.0),
               "Cœur de la plus grande forêt tropicale du monde, qui recycle une grande partie de sa propre pluie.",
               _TOUTES),
        Region("france", "France (région de test)", "pays", (-5.0, 42.0, 9.0, 51.0), (46.5, 2.0),
               "Toute la France métropolitaine : sert à tester les moyennes sur une grande zone.",
               _TOUTES),
    ]
}

# Scénarios de démo (docs/DECISIONS_DONNEES.md, section 5), au format de la section 4 du contrat.
_SCENARIOS = [
    {
        "id": "paris_trois_verdicts",
        "titre": "Paris : trois enquêtes, trois verdicts",
        "accroche": "Hausse, baisse ou rien du tout : l'outil sait dire les trois.",
        "etapes": [
            {"texte": "La température à Paris, mois par mois : les saisons écrasent tout.",
             "variable": "t2m", "regions": ["paris"], "periode": ["1980-01", "2024-12"], "saisons_retirees": False},
            {"texte": "Retirons les saisons : la tendance apparaît.",
             "variable": "t2m", "regions": ["paris"], "periode": ["1980-01", "2024-12"], "saisons_retirees": True},
            {"texte": "Même ville, autre variable : le dioxyde d'azote (NO₂).",
             "variable": "no2", "regions": ["paris"], "periode": ["2005-01", "2024-12"], "saisons_retirees": True},
            {"texte": "Et la pluie ? Regardons ce que dit le test.",
             "variable": "precip", "regions": ["paris"], "periode": ["1998-01", "2024-12"], "saisons_retirees": True},
        ],
    },
    {
        "id": "no2_destins_opposes",
        "titre": "Même pollution, destins opposés",
        "accroche": "Une même variable peut monter ici et baisser là-bas.",
        "etapes": [
            {"texte": "On regarde d'abord le NO₂ au-dessus de Los Angeles.",
             "variable": "no2", "regions": ["los_angeles"], "periode": ["2005-01", "2024-12"], "saisons_retirees": False},
            {"texte": "Retirons les saisons, puis comparons avec Dhaka.",
             "variable": "no2", "regions": ["los_angeles", "dhaka"], "periode": ["2005-01", "2024-12"], "saisons_retirees": True},
        ],
    },
    {
        "id": "pekin_bascule",
        "titre": "Pékin : le moment où tout bascule",
        "accroche": "Le verdict dépend de la période choisie.",
        "etapes": [
            {"texte": "Le NO₂ à Pékin de 2005 à 2011.",
             "variable": "no2", "regions": ["pekin"], "periode": ["2005-01", "2011-12"], "saisons_retirees": True},
            {"texte": "Même ville, de 2012 à 2024.",
             "variable": "no2", "regions": ["pekin"], "periode": ["2012-01", "2024-12"], "saisons_retirees": True},
            {"texte": "Et sur toute la période ?",
             "variable": "no2", "regions": ["pekin"], "periode": ["2005-01", "2024-12"], "saisons_retirees": True},
        ],
    },
    {
        "id": "arctique",
        "titre": "L'Arctique se réchauffe-t-il plus vite ?",
        "accroche": "On compare le Svalbard et Paris sur toute la période.",
        "etapes": [
            {"texte": "Comparez les deux pentes.",
             "variable": "t2m", "regions": ["svalbard", "paris"], "periode": ["1980-01", "2024-12"], "saisons_retirees": True},
        ],
    },
]

# --- Séries ----------------------------------------------------------------------------------

_FICHIERS_REELS = {
    ("t2m", "paris"): ("spike/data/t2m_paris_point.csv", "point"),
    ("t2m", "france"): ("spike/data/t2m_france_area.csv", "zone"),
}

# Paramètres de simulation : (moyenne, amplitude saisonnière, mois du pic, pente par décennie).
# Amplitude en unité pour t2m / qv2m, en fraction de la valeur pour precip / no2.
# Pentes inspirées du criblage de docs/DECISIONS_DONNEES.md, pour que l'interface montre des cas variés.
_PARAMS = {
    "t2m": {
        "po": (13, 10, 7, 0.52), "pekin": (12, 14, 7, 0.26), "los_angeles": (17, 5, 8, 0.17),
        "dhaka": (26, 5, 6, -0.20), "delhi": (25, 9, 6, -0.11), "sahel": (28, 4, 5, 0.13),
        "svalbard": (-6, 9, 7, 0.78), "espagne": (14, 9, 7, 0.37), "amazonie": (27, 0.7, 9, 0.24),
    },
    "qv2m": {
        "paris": (7, 2.5, 7, 0.10), "po": (8, 4, 7, 0.26), "pekin": (7, 6, 7, 0.18),
        "los_angeles": (8, 3, 8, 0.16), "dhaka": (17, 5, 7, 0.58), "delhi": (13, 7, 7, 0.48),
        "sahel": (12, 6, 8, 0.22), "svalbard": (2.5, 1.5, 7, 0.12), "espagne": (7, 2.5, 8, 0.14),
        "amazonie": (17, 0.8, 3, 0.12), "france": (7, 2.5, 7, 0.10),
    },
    "precip": {
        "paris": (1.9, 0.15, 10, -0.10), "po": (2.7, 0.2, 10, 0.03), "pekin": (1.6, 0.9, 7, 0.34),
        "los_angeles": (0.9, 0.9, 1, 0.0), "dhaka": (6, 0.9, 7, -0.28), "delhi": (2, 0.9, 8, 0.12),
        "sahel": (1.5, 0.95, 8, 0.0), "svalbard": (1.2, 0.25, 10, 0.07), "espagne": (1.2, 0.5, 11, -0.02),
        "amazonie": (6.5, 0.45, 3, -0.20), "france": (2.3, 0.15, 11, 0.03),
    },
    "no2": {
        "paris": (8, 0.35, 1, -2.99), "po": (9, 0.4, 1, -3.72), "pekin": (15, 0.45, 1, 0.0),
        "los_angeles": (10, 0.3, 1, -5.84), "dhaka": (5, 0.4, 1, 2.16), "delhi": (7, 0.35, 1, -0.40),
        "sahel": (1.5, 0.2, 2, 0.10), "espagne": (2.5, 0.3, 1, -0.72), "amazonie": (1.5, 0.4, 9, -0.20),
        "france": (4, 0.35, 1, -1.2),
    },
}
_BRUIT = {"t2m": 1.3, "qv2m": 0.5, "precip": 0.45, "no2": 0.18}  # absolu, ou relatif pour precip / no2


def _lire_csv(chemin: str) -> pd.Series:
    df = pd.read_csv(RACINE / chemin, parse_dates=["date"])
    valeurs = df["valeur"].astype(float)
    if (df["unite"] == "K").all():
        valeurs = valeurs - 273.15
    return pd.Series(valeurs.to_numpy(), index=pd.DatetimeIndex(df["date"]), name="valeur")


def _simuler(variable: Variable, region: Region) -> pd.Series:
    moyenne, amplitude, pic, pente = _PARAMS[variable.id][region.id]
    index = pd.date_range(f"{variable.debut}-01", f"{FIN}-01", freq="MS")
    rng = np.random.default_rng(zlib.crc32(f"{variable.id}/{region.id}".encode()))
    temps = (index.year + (index.month - 1) / 12).to_numpy()
    saison = np.cos(2 * np.pi * (index.month.to_numpy() - pic) / 12)
    niveau = moyenne + pente / 10 * (temps - temps.mean())
    if (variable.id, region.id) == ("no2", "pekin"):  # stable jusqu'en 2011, puis chute
        niveau = np.where(temps < 2012, 20 - 0.1 * (temps - 2005), 19.3 - 0.92 * (temps - 2012))
    bruit = rng.normal(0, _BRUIT[variable.id], len(index))
    if variable.id in ("t2m", "qv2m"):
        valeurs = niveau + amplitude * saison + bruit
    else:
        valeurs = np.clip(niveau * (1 + amplitude * saison) * (1 + bruit), 0.02, None)
    return pd.Series(valeurs, index=index, name="valeur")


# --- Fonctions du contrat --------------------------------------------------------------------

def charger_variables() -> dict[str, Variable]:
    return dict(_VARIABLES)


def charger_regions() -> dict[str, Region]:
    return dict(_REGIONS)


def charger_scenarios() -> list[dict]:
    return [dict(s) for s in _SCENARIOS]


def get_series(variable_id: str, region_id: str) -> Serie:
    variable = _VARIABLES[variable_id]  # KeyError si inconnue, comme le contrat
    region = _REGIONS[region_id]
    if variable_id not in region.variables_suggerees:
        raise FileNotFoundError(f"Pas de série {variable_id} pour {region_id}.")
    if (variable_id, region_id) in _FICHIERS_REELS:
        chemin, origine = _FICHIERS_REELS[(variable_id, region_id)]
        return Serie(variable, region, _lire_csv(chemin), origine)
    return Serie(variable, region, _simuler(variable, region), "zone")


def analyser(serie: Serie, debut: str | None = None, fin: str | None = None) -> ResultatTendance:
    """Analyse FACTICE : anomalies mensuelles, droite par polyfit, p-value approchée."""
    v = serie.valeurs.dropna()
    if debut:
        v = v[v.index >= pd.Timestamp(f"{debut}-01")]
    if fin:
        v = v[v.index <= pd.Timestamp(f"{fin}-01")]
    if len(v) < 60:
        raise ValueError("Période trop courte : moins de 5 ans.")

    anomalies = v - v.groupby(v.index.month).transform("mean")
    t = ((v.index - v.index[0]).days / 365.25).to_numpy()
    a, b = np.polyfit(t, anomalies.to_numpy(), 1)
    droite = pd.Series(a * t + b, index=v.index)
    residus = anomalies.to_numpy() - droite.to_numpy()
    erreur = math.sqrt((residus**2).sum() / (len(t) - 2) / ((t - t.mean()) ** 2).sum())
    z = a / erreur if erreur > 0 else 0.0
    p = math.erfc(abs(z) / math.sqrt(2))

    n_annees = len(v) / 12
    pente = a * 10
    ic = (pente - 1.96 * erreur * 10, pente + 1.96 * erreur * 10)
    sens = "hausse" if pente >= 0 else "baisse"
    tests = pd.DataFrame(
        [
            {"Test": "Mann-Kendall (simulé)", "Valeur": round(z, 2), "p-value": round(p, 4),
             "Significatif": p < 0.05, "Détail": "Statistique Z approchée (mock)"},
            {"Test": "Pente (simulée)", "Valeur": round(pente, 3), "p-value": None,
             "Significatif": None, "Détail": "polyfit sur les anomalies (mock)"},
        ]
    )
    return ResultatTendance(
        serie=serie,
        debut=v.index[0],
        fin=v.index[-1],
        n_annees=n_annees,
        anomalies=anomalies,
        droite=droite,
        pente_decennie=pente,
        ic95=ic,
        p_value=p,
        significatif=p < 0.05,
        sens=sens,
        changement_total=pente * n_annees / 10,
        periode_courte=n_annees < 30,
        resume=f"[mock] {serie.region.nom} : {sens} de {pente:.2f} {serie.variable.unite} par décennie (p = {p:.3f}).",
        tests=tests,
    )


def suggerer(question: str) -> Suggestion:
    """Repli par mots-clés, comme l'advisor sans IA."""
    q = question.lower()
    variables = [v.id for v in _VARIABLES.values() if any(m in q for m in v.mots_cles)]
    region = next((r.id for r in _REGIONS.values() if r.nom.lower().split(" (")[0] in q), None)
    return Suggestion(
        variable_ids=variables or ["t2m"],
        region_id=region,
        explication="[mock] Suggestion par mots-clés.",
        source="mots_cles",
    )


def expliquer(resultat: ResultatTendance) -> str:
    return resultat.resume
