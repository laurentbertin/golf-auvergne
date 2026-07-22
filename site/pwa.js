// Installation sur l'écran d'accueil — enregistrement du service worker, et
// l'invitation qui va avec.
//
// Pourquoi une invitation maison plutôt que celle du navigateur : iOS n'a
// jamais proposé de bouton d'installation (Apple réserve le geste au menu
// Partager), et sur Android la bannière de Chrome n'apparaît qu'après plusieurs
// visites, quand elle apparaît. Sans un mot dans la page, personne ne devine
// que le site s'installe.
//
// Chargé par les cinq pages : on ne sait pas par laquelle un visiteur arrive.

// En local (file://) l'API n'existe pas : le garde évite une erreur inutile
// dans la console quand on ouvre simplement site/index.html.
if ("serviceWorker" in navigator) {
  addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Un enregistrement raté n'empêche rien : le site reste un site.
    });
  });
}

(() => {
  const MEMOIRE = "installation-ecartee";

  // Déjà installé : la page tourne alors sans barre d'adresse. Proposer
  // l'installation à quelqu'un qui l'a faite serait absurde.
  const dejaInstalle = matchMedia("(display-mode: standalone)").matches
    || navigator.standalone === true;
  if (dejaInstalle || localStorage.getItem(MEMOIRE)) return;

  // iPadOS 13+ se déclare « Macintosh » : l'écran tactile est le seul indice
  // fiable qui reste.
  const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

  function afficher(contenu) {
    const hote = document.querySelector("header .wrap");
    if (!hote || document.querySelector(".installer")) return null;
    // Le refus est relu ici, pas seulement au chargement : le navigateur peut
    // réémettre l'événement dans la même page, et la bannière refermée
    // resurgirait.
    if (localStorage.getItem(MEMOIRE)) return null;
    const bloc = document.createElement("div");
    bloc.className = "installer";
    bloc.innerHTML = contenu +
      `<button type="button" class="installer-fermer" aria-label="Ne plus proposer">×</button>`;
    hote.appendChild(bloc);
    bloc.querySelector(".installer-fermer").addEventListener("click", () => {
      // Un refus vaut pour de bon : réafficher à chaque visite se retournerait
      // contre le site.
      localStorage.setItem(MEMOIRE, "1");
      bloc.remove();
    });
    return bloc;
  }

  if (iOS) {
    afficher(
      `<span class="installer-texte">Ajoute l'agenda à ton écran d'accueil :
       <strong>Partager</strong> <span aria-hidden="true">▸</span>
       <strong>Sur l'écran d'accueil</strong>.</span>`);
    return;
  }

  // Android et ordinateurs : le navigateur signale lui-même qu'il sait
  // installer. On confisque sa bannière pour la rejouer au moment choisi.
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    const bloc = afficher(
      `<span class="installer-texte">Installe l'agenda comme une application.</span>
       <button type="button" class="installer-go">Installer</button>`);
    if (!bloc) return;
    bloc.querySelector(".installer-go").addEventListener("click", async () => {
      bloc.remove();
      e.prompt();
      // Un refus ici n'est pas un refus définitif : le navigateur reproposera
      // l'événement à la visite suivante, on ne mémorise donc rien.
      await e.userChoice;
    });
  });

  addEventListener("appinstalled", () => {
    localStorage.setItem(MEMOIRE, "1");
    document.querySelector(".installer")?.remove();
  });
})();
