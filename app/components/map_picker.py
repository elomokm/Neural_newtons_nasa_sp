"""Carte du monde en 3D : un globe three.js (servi en local) avec une colonne par région.

Couleur = verdict (orange, bleu, gris), hauteur = vitesse du changement, anneau = pas de tendance
significative. Cliquer une région renvoie son id à Python. Aucun calcul ici : tout vient de analyser().
"""
from __future__ import annotations

from pathlib import Path

import streamlit.components.v1 as components

import charte
from textes import t

_globe = components.declare_component("globe_tendances", path=str(Path(__file__).parent / "globe"))


def points(resultats: dict) -> list[dict]:
    """Prépare les données du globe à partir de {region_id: ResultatTendance}."""
    sortie = []
    for region_id, res in resultats.items():
        reg, var = res.serie.region, res.serie.variable
        ton = charte.tonalite(res)
        d = charte.decimales(res.pente_decennie)
        pente = charte.avec_unite(charte.signe(res.pente_decennie, d), var.unite)
        sortie.append(
            {
                "id": region_id,
                "nom": reg.nom,
                "lat": reg.centre[0],
                "lon": reg.centre[1],
                "pente": res.pente_decennie,
                "significatif": bool(res.significatif),
                "couleur": charte.COULEURS_GLOBE[ton],
                "verdict": t("v_" + ton),
                "pente_txt": f"{pente} {t('v_par_decennie')}",
            }
        )
    return sortie


def globe(resultats: dict, selection: str | None, key: str = "globe") -> dict | None:
    """Affiche le globe ; renvoie {'region': id, 't': horodatage} au dernier clic, sinon None."""
    return _globe(
        regions=points(resultats),
        selection=selection,
        textes={"aide": t("carte_aide")},
        key=key,
        default=None,
    )
