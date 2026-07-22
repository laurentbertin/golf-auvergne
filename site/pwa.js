// Enregistre le service worker. Chargé par toutes les pages : on ne sait pas
// par laquelle un visiteur arrive, et l'installation doit être proposée quelle
// que soit la porte d'entrée.
//
// En local (file://, et sans HTTPS), l'API n'existe pas : le garde évite une
// erreur dans la console quand on ouvre simplement site/index.html.
if ("serviceWorker" in navigator) {
  addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Un enregistrement raté n'empêche rien : le site reste un site.
    });
  });
}
