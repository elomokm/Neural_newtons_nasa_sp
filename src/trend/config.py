"""Chemins et constantes partagés par le moteur."""
from __future__ import annotations

import os
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("TREND_DATA_DIR", RACINE / "data"))
CATALOG_DIR = DATA_DIR / "catalog"
DEMOS_DIR = DATA_DIR / "demos"
CACHE_DIR = DATA_DIR / "cache"

# Dernier mois couvert par le cache (décision d'équipe : séries arrêtées fin 2024).
FIN_PERIODE = "2024-12"

# Durée minimale d'une analyse (contrat : ValueError en dessous) et seuil « climat » de l'OMM.
MIN_ANNEES = 5
ANNEES_CLIMAT = 30
SEUIL_P = 0.05
