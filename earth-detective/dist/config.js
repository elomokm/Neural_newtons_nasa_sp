// Configuration d'Earth Detective. Modifiez ce fichier sans toucher au reste du code.
window.EARTH_DETECTIVE_CONFIG = {
  // Adresse du backend de l'équipe (voir API_CONTRACT.md). Laisser vide pour lire directement NASA POWER.
  backendUrl: '',
  // NASABot : 'local' (règles, aucune clé), 'ollama' (gratuit, sur ta machine), 'groq' (gratuit avec clé) ou 'backend'.
  bot: {
    provider: 'local',
    // Ollama : ollama pull llama3.2 puis lancer avec OLLAMA_ORIGINS=* ollama serve
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3.2',
    // Groq : clé gratuite sur console.groq.com. Une clé dans le navigateur est visible : pour la démo seulement.
    groqKey: '',
    groqModel: 'llama-3.3-70b-versatile'
  }
};
