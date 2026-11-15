from conftest import serie_synthetique
from trend.advisor import expliquer, suggerer
from trend.stats import analyser


def test_suggestions_par_mots_cles():
    s = suggerer("Est-ce que la pollution baisse à Pékin ?")
    assert s.variable_ids[0] == "no2" and s.region_id == "pekin" and s.source == "mots_cles"
    s = suggerer("Il pleut moins au Sahel ?")
    assert s.variable_ids[0] == "precip" and s.region_id == "sahel"
    s = suggerer("Is the Arctic warming faster?")
    assert s.variable_ids[0] == "t2m" and s.region_id == "svalbard"
    s = suggerer("NO2 au Svalbard")
    assert "no2" not in s.variable_ids and s.region_id == "svalbard"  # pas de NO₂ en nuit polaire


def test_suggestion_sans_indice_ne_plante_pas():
    s = suggerer("")
    assert s.variable_ids and s.explication
    s = suggerer("blabla 42 ???")
    assert s.variable_ids == ["t2m"] and s.region_id is None


def test_expliquer_reprend_les_chiffres_du_resultat():
    r = analyser(serie_synthetique(pente_decennie=0.5, bruit=0.8))
    texte = expliquer(r)
    assert "Paris" in texte and "par décennie" in texte and "significative" in texte
    assert "prouv" not in texte.lower()
    r2 = analyser(serie_synthetique(pente_decennie=0.0, bruit=1.0, graine=3))
    assert "pas de tendance significative" in expliquer(r2)
