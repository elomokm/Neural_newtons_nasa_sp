from trend.catalog import charger_regions, charger_scenarios, charger_variables


def test_catalogue_conforme_au_contrat():
    variables, regions = charger_variables(), charger_regions()
    assert list(variables) == ["t2m", "qv2m", "precip", "no2"]
    assert len(regions) == 11 and "paris" in regions and "svalbard" in regions
    assert "no2" not in regions["svalbard"].variables_suggerees  # nuit polaire
    for r in regions.values():
        o, s, e, n = r.bbox
        assert o < e and s < n and s <= r.centre[0] <= n and o <= r.centre[1] <= e
        assert set(r.variables_suggerees) <= set(variables)
    for v in variables.values():
        assert v.unite and v.definition and v.hausse_signifie and v.baisse_signifie and len(v.mots_cles) >= 3


def test_scenarios_referencent_le_catalogue():
    variables, regions = charger_variables(), charger_regions()
    scenarios = charger_scenarios()
    assert len(scenarios) >= 3
    for s in scenarios:
        assert s["titre"] and s["etapes"]
        for e in s["etapes"]:
            assert e["variable"] in variables
            assert 1 <= len(e["regions"]) <= 2
            for r in e["regions"]:
                assert e["variable"] in regions[r].variables_suggerees, (s["id"], r, e["variable"])
            assert e["periode"][0] >= variables[e["variable"]].debut
