"""Contrat de données partagé par data, stats, app et advisor. Ne pas modifier sans accord de l'équipe."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

import pandas as pd


@dataclass(frozen=True)
class Variable:
    id: str                    # identifiant court : "t2m", "qv2m", "precip", "no2"
    giovanni_id: str           # ex. "M2IMNXASM_5_12_4_T2M"
    nom: str                   # ex. "Température de l'air à 2 m"
    definition: str            # 1 à 3 phrases compréhensibles par un lycéen
    unite: str                 # unité D'AFFICHAGE, déjà convertie : "°C", "mm/jour", "kg/m²", "10¹⁵ molécules/cm²"
    source: str                # ex. "MERRA-2 (NASA GMAO)"
    debut: str                 # premier mois disponible, "AAAA-MM"
    hausse_signifie: str       # ex. "il fait plus chaud"
    baisse_signifie: str       # ex. "il fait plus froid"
    mots_cles: tuple[str, ...] # pour la recherche et l'advisor


@dataclass(frozen=True)
class Region:
    id: str                                  # ex. "paris"
    nom: str                                 # ex. "Paris"
    type: str                                # "ville", "agricole", "forêt tropicale", "semi-aride", "arctique", "méditerranéen", "pays"
    bbox: tuple[float, float, float, float]  # (ouest, sud, est, nord) en degrés
    centre: tuple[float, float]              # (lat, lon), pour placer la région sur une carte
    histoire: str                            # 1 à 2 phrases : pourquoi cette région est intéressante
    variables_suggerees: tuple[str, ...]     # ids de Variable


@dataclass
class Serie:
    variable: Variable
    region: Region
    valeurs: pd.Series                 # index : DatetimeIndex MENSUEL (1er du mois), valeurs float dans variable.unite
    origine: Literal["zone", "point"]  # moyenne sur la bbox, ou point de grille


@dataclass
class ResultatTendance:
    serie: Serie
    debut: pd.Timestamp                # début de la période réellement analysée
    fin: pd.Timestamp
    n_annees: float
    anomalies: pd.Series               # série SANS cycle saisonnier, même index que la période
    droite: pd.Series                  # droite de tendance ajustée sur les anomalies, même index
    pente_decennie: float              # pente de Sen, en unité par décennie
    ic95: tuple[float, float]          # intervalle de confiance à 95 % de la pente, par décennie
    p_value: float                     # test de Mann-Kendall (test principal)
    significatif: bool                 # p_value < 0.05
    sens: Literal["hausse", "baisse"]  # signe de la pente (même si non significatif)
    changement_total: float            # pente × durée, en unité
    periode_courte: bool               # moins de 30 ans (recommandation OMM)
    resume: str                        # phrase simple générée sans IA, toujours disponible
    tests: pd.DataFrame                # détail : colonnes Test, Valeur, p-value, Significatif, Détail
    ruptures: list[dict] = field(default_factory=list)  # option avancée, souvent vide


@dataclass
class Suggestion:
    variable_ids: list[str]            # uniquement des ids présents dans le catalogue
    region_id: str | None              # id du catalogue, ou None si aucune région ne correspond
    explication: str                   # pourquoi ces choix, en langage simple
    source: Literal["ia", "mots_cles"] # qui a produit la suggestion (IA ou repli sans IA)
