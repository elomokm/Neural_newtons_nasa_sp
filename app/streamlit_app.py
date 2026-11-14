"""Trend Detective : point d'entrée Streamlit.

Lancement depuis la racine du dépôt :
    PYTHONPATH=src streamlit run app/streamlit_app.py          # mock (par défaut)
    TREND_MOCK=0 PYTHONPATH=src streamlit run app/streamlit_app.py   # vrai moteur
"""
from __future__ import annotations

import streamlit as st

import backend
import charte
from components import charts, definitions, verdict
from textes import t

st.set_page_config(page_title=t("app_titre"), page_icon="🔎", layout="wide")
charte.injecter_css()

VARIABLES = backend.variables()
REGIONS = backend.regions()
VUES = {"brut": t("vue_brut"), "sans_saisons": t("vue_sans_saisons")}

st.session_state.setdefault("variable", next(iter(VARIABLES)))
st.session_state.setdefault("vue", "sans_saisons")


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


if backend.MOCK:
    st.markdown(f'<div class="td-mock">{t("bandeau_mock")}</div>', unsafe_allow_html=True)

variable_id, region_id = barre_laterale()
ecran_enquete(variable_id, region_id)
