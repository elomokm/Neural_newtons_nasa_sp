"""Tous les textes affichés par l'app. Pour passer en anglais : ajouter un bloc "en" et lancer avec TREND_LANGUE=en."""
from __future__ import annotations

import os

LANGUE = os.environ.get("TREND_LANGUE", "fr")

TEXTES: dict[str, dict[str, str]] = {
    "fr": {
        # Général
        "app_titre": "Trend Detective",
        "app_sous_titre": "Est-ce que ça change vraiment ? Données NASA, test statistique, verdict.",
        "bandeau_mock": (
            "Données de démonstration (mock) : seules les températures de Paris et de la France "
            "sont de vraies données NASA, le reste est simulé pour construire l'interface."
        ),
        # Barre latérale
        "sb_titre": "Que veux-tu enquêter ?",
        "sb_variable": "Variable",
        "sb_region": "Région",
        "sb_periode_dispo": "Données disponibles : **{debut} → {fin}**",
        # En-tête et verdict
        "entete": "<b>{region}</b> · {variable} · {debut} → {fin}",
        "v_hausse": "▲ Hausse significative",
        "v_baisse": "▼ Baisse significative",
        "v_aucune": "● Pas de tendance significative sur cette période",
        "v_par_decennie": "par décennie",
        "v_total": "Sur {n} ans : environ <b>{total}</b> au total",
        "v_ic": "Intervalle de confiance à 95 % : {bas} à {haut} par décennie",
        "v_signif": (
            "Cette {sens} est significative (au seuil de 5 %) : sans tendance réelle, "
            "une pente aussi nette n'apparaîtrait par hasard que dans {chance} des cas."
        ),
        "v_en_clair": "En clair : {phrase}.",
        "v_non_signif": (
            "La pente estimée ({pente} par décennie) se perd dans les variations naturelles "
            "d'une année à l'autre. « Pas significatif » ne veut pas dire « stable » : "
            "essaie une période plus longue."
        ),
        "v_courte": (
            "Moins de 30 ans de données : on parle de tendance récente, pas encore de climat "
            "(recommandation de l'Organisation météorologique mondiale)."
        ),
        "nom_hausse": "hausse",
        "nom_baisse": "baisse",
        "chance_01": "moins de 0,1 %",
        "chance_1": "moins de 1 %",
        "chance_5": "moins de 5 %",
        # Graphiques
        "vue_label": "Affichage",
        "vue_brut": "Données brutes",
        "vue_sans_saisons": "Sans les saisons",
        "explique_brut": (
            "Chaque point est un mois. Les grandes vagues régulières sont les saisons : "
            "elles sont bien plus fortes que la tendance et la cachent."
        ),
        "explique_saisons": (
            "Pourquoi retirer les saisons ? L'écart entre l'été et l'hiver est bien plus grand que "
            "la tendance sur 40 ans. On compare donc chaque mois à la moyenne de ce même mois : "
            "ce qui reste montre si l'ensemble monte ou descend."
        ),
        "g_titre_brut": "{variable} · {region} · valeurs mensuelles",
        "g_titre_anom": "{variable} · {region} · sans les saisons",
        "g_axe_brut": "{unite}",
        "g_axe_anom": "Écart à la normale du mois ({unite})",
        "g_leg_brut": "Valeur du mois",
        "g_leg_anom": "Écart à la normale du mois",
        "g_leg_droite": "Tendance : {pente} par décennie",
        "g_leg_periode": "Période analysée",
        "g_source": "Source : {source} · {giovanni_id}",
        # Encadrés
        "def_titre": "C'est quoi cette variable ?",
        "def_unite": "**Unité : {unite}**, {explication}.",
        "def_source": "Source : {source}, données disponibles depuis {debut}.",
        "reg_titre": "Pourquoi cette région ?",
        "reg_type": "Type de région : **{type}**",
        "reg_point": "Valeurs au point de grille le plus proche du centre de la région.",
        "reg_zone": "Valeurs moyennées sur toute la zone.",
        # Détails statistiques
        "det_titre": "Détails statistiques",
        "det_pente": (
            "**Pente (méthode de Sen) :** {pente} par décennie, "
            "intervalle de confiance à 95 % : {bas} à {haut}."
        ),
        "det_p": "**p-value du test de Mann-Kendall :** {p} · {n} ans analysés ({debut} → {fin}).",
        "det_p_explication": (
            "**La p-value, c'est quoi ?** Imaginons que rien ne change vraiment et que les variations "
            "soient dues au hasard. La p-value donne la probabilité d'obtenir quand même une pente "
            "aussi nette. Si elle est sous 0,05 (5 %), le hasard devient une explication peu "
            "crédible : on parle de tendance significative."
        ),
        "det_ic_explication": (
            "**L'intervalle de confiance** donne la fourchette des pentes compatibles avec les "
            "données. Plus il est étroit, plus l'estimation est précise."
        ),
        "det_methode": (
            "**Méthode :** on retire d'abord les saisons (chaque mois est comparé à la moyenne de ce "
            "même mois). Le test de Mann-Kendall regarde ensuite si les valeurs montent ou descendent "
            "plus souvent que le hasard ne le permet. La pente de Sen est la médiane des pentes entre "
            "toutes les paires de points : elle résiste aux valeurs extrêmes."
        ),
        "det_tableau": "**Tous les tests**",
        "det_limites": "**À garder en tête**",
        "limite_1": "Une tendance décrit un changement, elle n'en explique pas la cause.",
        "limite_2": "Le choix de la période peut changer le verdict.",
        "limite_3": (
            "Ces données viennent de satellites et de modèles : elles décrivent une zone ou un point "
            "de grille, pas une station météo au sol."
        ),
        # Pied de page
        "pied": (
            "Données : {source} · identifiant Giovanni : {giovanni_id} · "
            "Tendance : test de Mann-Kendall et pente de Sen · NASA Space Apps Challenge 2026"
        ),
        # Modes
        "sb_mode": "Mode",
        "mode_enquete": "Une région",
        "mode_carte": "Carte du monde",
        # Carte du monde (globe 3D)
        "carte_titre": "<b>Où ça change ?</b> · {variable} · {debut} → {fin}",
        "carte_aide": "Glisse pour faire tourner la Terre · molette pour zoomer · clique sur une région pour ouvrir l'enquête",
        "carte_legende": (
            "Une colonne par région. <b style='color:{orange}'>Orange</b> : hausse significative · "
            "<b style='color:{bleu}'>bleu</b> : baisse significative · "
            "<b style='color:{gris}'>anneau gris</b> : pas de tendance significative sur cette période. "
            "<b>Plus la colonne est haute, plus le changement est rapide.</b>"
        ),
        "carte_credit": "Image de la Terre : NASA Blue Marble. Tendances calculées sur toute la période disponible.",
        "carte_classement": "Classement des régions, de la plus forte hausse à la plus forte baisse",
        "carte_vide": "Aucune série disponible pour cette variable.",
        "col_region": "Région",
        "col_verdict": "Verdict",
        "col_pente": "Pente par décennie",
        # Erreurs
        "err_inconnu": "Cette variable ou cette région n'existe pas dans le catalogue.",
        "err_pas_en_cache": (
            "Cette série n'est pas encore disponible : elle n'a pas encore été téléchargée par "
            "l'équipe données."
        ),
        "err_trop_court": "Période trop courte : il faut au moins 5 ans pour chercher une tendance.",
    },
}

MOIS: dict[str, list[str]] = {
    "fr": ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
}

# Explication des unités d'affichage (clé = Variable.unite).
UNITES: dict[str, dict[str, str]] = {
    "fr": {
        "°C": "degrés Celsius",
        "g/kg": "grammes de vapeur d'eau par kilogramme d'air",
        "mm/jour": "millimètres d'eau tombés par jour, en moyenne sur le mois (1 mm = 1 litre par mètre carré)",
        "10¹⁵ molécules/cm²": (
            "millions de milliards de molécules de NO₂ au-dessus de chaque centimètre carré de sol, "
            "dans la basse atmosphère (troposphère)"
        ),
    },
}


def t(cle: str, **valeurs: object) -> str:
    """Texte de l'interface dans la langue active, avec ses valeurs insérées."""
    texte = TEXTES[LANGUE][cle]
    return texte.format(**valeurs) if valeurs else texte


def nom_mois(numero: int) -> str:
    return MOIS[LANGUE][numero - 1]


def explication_unite(unite: str) -> str:
    return UNITES[LANGUE].get(unite, unite)
