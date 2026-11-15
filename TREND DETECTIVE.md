- Choix des datas 
Plaine du Pô · Humidité de l'air (humidité spécifique à 2 m) · 2005-01 → 2024-12
Significant increase : +0.41 g/kg per decade [+0.15 ; +0.69], p = 0.003 (Mann-Kendall).
Plaine du Pô, 2005 → 2024 : hausse significative (au seuil de 5 %, p = 0,003) d'environ +0,41 g/kg par décennie. En clair : l'air contient plus de vapeur d'eau. Moins de 30 ans de données : on parle de tendance récente, pas encore de climat.
MERRA-2 (NASA GMAO) · M2IMNXASM_5_12_4_QV2M · Earth Detective, NASA Space Apps 2026.


Voici les étapes de l'outil, dans l'ordre :

1. **Prendre la série** : les valeurs mensuelles NASA d'une variable, en moyenne sur la région (par exemple 540 mois de température à Paris).
2. **Retirer les saisons** : on compare chaque mois à la moyenne de ce même mois (janvier avec les janviers, etc.). Il reste les écarts à la normale.
3. **Passer en moyennes annuelles** : une valeur par an. Deux mois voisins se ressemblent trop pour être testés comme indépendants.
4. **Tester la tendance (Mann-Kendall)** : on compare chaque année à toutes les suivantes, puis on regarde si les hausses (ou les baisses) dominent plus que ce que permettrait le hasard. Le test donne une **p-value**.
5. **Mesurer la vitesse (pente de Sen)** : c'est la médiane des pentes entre toutes les paires d'années, exprimée **par décennie**, avec son **intervalle de confiance à 95 %**.
6. **Rendre le verdict** :
   - p < 0,05 et pente positive : **hausse significative** ;
   - p < 0,05 et pente négative : **baisse significative** ;
   - p ≥ 0,05 : **pas de tendance significative sur cette période**, ce qui ne veut pas dire « stable ».
7. **Ajouter les garde-fous** :
   - avertissement s'il y a moins de 30 ans de données (règle de l'OMM) ;
   - pas d'analyse en dessous de 5 ans ;
   - rappel qu'une tendance ne prouve pas sa cause.