"""Trend Detective : point d'entrée Streamlit.

Lancement depuis la racine du dépôt :
    PYTHONPATH=src streamlit run app/streamlit_app.py          # mock (par défaut)
    TREND_MOCK=0 PYTHONPATH=src streamlit run app/streamlit_app.py   # vrai moteur
"""
from __future__ import annotations

import pandas as pd
import streamlit as st

import backend
import charte
from components import charts, definitions, map_picker, verdict
from textes import t

st.set_page_config(page_title=t("app_titre"), page_icon="🔎", layout="wide")
charte.injecter_css()

VARIABLES = backend.variables()
REGIONS = backend.regions()
VUES = {"brut": t("vue_brut"), "sans_saisons": t("vue_sans_saisons")}
MODES = {"enquete": t("mode_enquete"), "carte": t("mode_carte")}

st.session_state.setdefault("variable", next(iter(VARIABLES)))
st.session_state.setdefault("vue", "sans_saisons")
st.session_state.setdefault("mode", "enquete")

# Navigation demandée au tour précédent (clic sur le globe) : appliquée AVANT de créer les widgets.
if "aller_a" in st.session_state:
    st.session_state["region"] = st.session_state.pop("aller_a")
    st.session_state["mode"] = "enquete"


def barre_laterale() -> tuple[str, str]:
    with st.sidebar:
        st.markdown(f"### 🔎 {t('app_titre')}")
        st.caption(t("app_sous_titre"))
        st.markdown(f"#### {t('sb_titre')}")
        var_id = st.selectbox(
            t("sb_variable"), list(VARIABLES), format_func=lambda k: VARIABLES[k].nom, key="variable"
        )
        # On ne propose que les régions qui ont cette variable (pas de NO₂ au Svalbard).
        dispo = [r for r in REGIONS if backend.disponible(var_id, r)]
        if st.session_state.get("region") not in dispo:
            st.session_state["region"] = dispo[0]
        reg_id = st.selectbox(t("sb_region"), dispo, format_func=lambda k: REGIONS[k].nom, key="region")
        try:
            valeurs = backend.serie(var_id, reg_id).valeurs
            st.markdown(t("sb_periode_dispo", debut=charte.mois(valeurs.index[0]), fin=charte.mois(valeurs.index[-1])))
        except (KeyError, FileNotFoundError):
            pass  # l'erreur est expliquée dans la zone principale
        st.radio(t("sb_mode"), list(MODES), format_func=MODES.get, key="mode")
    return var_id, reg_id


def charger(var_id: str, reg_id: str):
    """Résultat d'analyse, ou None après avoir affiché un message clair (jamais de trace Python)."""
    try:
        return backend.resultat(var_id, reg_id)
    except KeyError:
        st.error(t("err_inconnu"))
    except FileNotFoundError:
        st.info(t("err_pas_en_cache"))
    except ValueError:
        st.warning(t("err_trop_court"))
    return None


def ecran_enquete(var_id: str, reg_id: str) -> None:
    res = charger(var_id, reg_id)
    if res is None:
        return
    var, reg = res.serie.variable, res.serie.region

    # 1. Le verdict d'abord.
    entete = t("entete", region=reg.nom, variable=var.nom, debut=res.debut.year, fin=res.fin.year)
    st.markdown(f'<div class="td-entete">{entete}</div>', unsafe_allow_html=True)
    verdict.carte(res)

    # 2. Le graphique ensuite.
    vue = st.segmented_control(
        t("vue_label"), list(VUES), format_func=VUES.get, key="vue", required=True, label_visibility="collapsed"
    )
    if vue == "brut":
        st.caption(t("explique_brut"))
        st.plotly_chart(charts.brut(res), theme=None, config={"displaylogo": False})
    else:
        st.caption(t("explique_saisons"))
        st.plotly_chart(charts.anomalies(res), theme=None, config={"displaylogo": False})

    # 3. Les explications après, 4. les détails techniques repliés.
    gauche, droite = st.columns(2)
    with gauche:
        definitions.variable(var)
    with droite:
        definitions.region(reg, res.serie)
    definitions.details(res)
    definitions.pied(var)


def ecran_carte(var_id: str, reg_id: str) -> None:
    """Où ça change ? Une colonne par région sur un globe 3D ; un clic ouvre l'enquête."""
    resultats = {}
    for r in REGIONS:
        if backend.disponible(var_id, r):
            try:
                resultats[r] = backend.resultat(var_id, r)
            except (KeyError, FileNotFoundError, ValueError):
                continue  # série absente du cache : la région n'apparaît pas
    if not resultats:
        st.info(t("carte_vide"))
        return

    var = VARIABLES[var_id]
    debut = min(res.debut for res in resultats.values()).year
    fin = max(res.fin for res in resultats.values()).year
    titre = t("carte_titre", variable=var.nom, debut=debut, fin=fin)
    st.markdown(f'<div class="td-entete">{titre}</div>', unsafe_allow_html=True)

    clic = map_picker.globe(resultats, selection=reg_id)
    if clic and clic.get("t") != st.session_state.get("dernier_clic"):
        st.session_state["dernier_clic"] = clic["t"]
        st.session_state["aller_a"] = clic["region"]
        st.rerun()

    legende = t("carte_legende", orange=charte.ORANGE, bleu=charte.BLEU, gris=charte.GRIS)
    st.markdown(f'<div class="td-legende">{legende}</div>', unsafe_allow_html=True)
    st.caption(t("carte_credit"))

    st.markdown(f"**{t('carte_classement')}**")
    lignes = []
    for res in sorted(resultats.values(), key=lambda r: r.pente_decennie, reverse=True):
        d = charte.decimales(res.pente_decennie)
        lignes.append(
            {
                t("col_region"): res.serie.region.nom,
                t("col_verdict"): t("v_" + charte.tonalite(res)),
                t("col_pente"): charte.avec_unite(charte.signe(res.pente_decennie, d), var.unite),
            }
        )
    st.dataframe(pd.DataFrame(lignes), hide_index=True, width="stretch")
    definitions.pied(var)


if backend.MOCK:
    st.markdown(f'<div class="td-mock">{t("bandeau_mock")}</div>', unsafe_allow_html=True)

variable_id, region_id = barre_laterale()
if st.session_state["mode"] == "carte":
    ecran_carte(variable_id, region_id)
else:
    ecran_enquete(variable_id, region_id)
