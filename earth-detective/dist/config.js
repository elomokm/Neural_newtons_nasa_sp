// Configuration d'Earth Detective. Modifiez ce fichier sans toucher au reste du code.
window.EARTH_DETECTIVE_CONFIG = {
  // Adresse du serveur Python (app/api.py). Vide = la même adresse que la page, le cas normal :
  // le serveur sert à la fois le front et l'API. Pour un autre serveur : ?api=http://hote:port
  apiBase: '',
  // NASABot : 'backend' = trend.advisor via le serveur (repli sans IA intégré). 'local' = règles seules.
  bot: { provider: 'backend' }
};
