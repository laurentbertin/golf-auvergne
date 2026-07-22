// Installation sur l'écran d'accueil — enregistrement du service worker, et
// l'invitation qui va avec.
//
// L'invitation ne dépend PAS de l'événement `beforeinstallprompt`. C'était la
// première version, et elle n'affichait presque jamais rien : Safari ne l'émet
// pas du tout, Firefox non plus, et Chrome le retient tant qu'il juge la visite
// trop récente — ou définitivement, une fois le site installé.
//
// On affiche donc toujours quelque chose, et on se sert de l'événement
// seulement s'il arrive : il transforme le mode d'emploi en un bouton qui
// installe d'un clic.
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
    || matchMedia("(display-mode: window-controls-overlay)").matches
    || navigator.standalone === true;
  if (dejaInstalle) return;

  const ua = navigator.userAgent;
  // iPadOS 13+ se déclare « Macintosh » : l'écran tactile est le seul indice
  // fiable qui reste.
  const iOS = /iPhone|iPad|iPod/.test(ua)
    || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // Safari de bureau se reconnaît en creux : les autres navigateurs de Mac
  // gardent « Safari » dans leur signature mais y ajoutent la leur.
  const safariMac = /Macintosh/.test(ua) && /Safari/.test(ua)
    && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua);

  let invite = null;   // l'événement de Chrome, s'il se manifeste
  let bloc = null;

  // Le mode d'emploi, faute de bouton. Court : c'est un repère, pas un manuel.
  function modeDEmploi() {
    if (iOS) {
      return `<strong>Partager</strong> <span aria-hidden="true">▸</span>
              <strong>Sur l'écran d'accueil</strong>`;
    }
    if (safariMac) {
      return `<strong>Fichier</strong> <span aria-hidden="true">▸</span>
              <strong>Ajouter au Dock</strong>`;
    }
    return `menu du navigateur <span aria-hidden="true">▸</span>
            <strong>Installer</strong>`;
  }

  function contenu() {
    if (invite) {
      return `<span class="installer-texte">Installe l'agenda comme une application.</span>
              <button type="button" class="installer-go">Installer</button>`;
    }
    return `<span class="installer-texte">Garde l'agenda à portée de main :
            ${modeDEmploi()}.</span>`;
  }

  function poser() {
    // Le refus est relu à chaque passage, pas seulement au chargement : la
    // bannière est reconstruite quand l'événement arrive en retard, et une
    // bannière refermée ne doit pas resurgir.
    if (localStorage.getItem(MEMOIRE)) return;
    const hote = document.querySelector("header .wrap");
    if (!hote) return;

    const neuf = document.createElement("div");
    neuf.className = "installer";
    neuf.innerHTML = contenu() +
      `<button type="button" class="installer-fermer" aria-label="Ne plus proposer">×</button>`;
    bloc ? bloc.replaceWith(neuf) : hote.appendChild(neuf);
    bloc = neuf;

    bloc.querySelector(".installer-fermer").addEventListener("click", () => {
      // Un refus vaut pour de bon : réafficher à chaque visite se retournerait
      // contre le site.
      localStorage.setItem(MEMOIRE, "1");
      bloc.remove();
      bloc = null;
    });

    bloc.querySelector(".installer-go")?.addEventListener("click", async () => {
      bloc.remove();
      bloc = null;
      invite.prompt();
      // Un refus ici n'est pas définitif : le navigateur reproposera
      // l'événement à la visite suivante, on ne mémorise donc rien.
      await invite.userChoice;
      invite = null;
    });
  }

  // Chrome peut émettre l'événement avant comme après le chargement. S'il
  // arrive après que le mode d'emploi est posé, on remplace celui-ci par le
  // bouton : un clic vaut mieux qu'une consigne.
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    invite = e;
    poser();
  });

  addEventListener("appinstalled", () => {
    localStorage.setItem(MEMOIRE, "1");
    bloc?.remove();
    bloc = null;
  });

  // Court délai : laisser à Chrome l'occasion de proposer son bouton avant
  // d'afficher un mode d'emploi qu'il rendrait inutile.
  if (document.readyState === "complete") setTimeout(poser, 900);
  else addEventListener("load", () => setTimeout(poser, 900));
})();
