// Boutons de partage. Aucune dépendance, aucun traceur : rien n'est chargé, le
// clic ouvre simplement la page de partage du réseau.
//
// Les URL ne sont PAS écrites dans la page : elles sont construites au clic. Les
// bloqueurs de pub masquent les boutons de réseaux sociaux en reconnaissant les
// mots « facebook », « twitter », « share »… dans le code. Sans URL ni classe
// parlante au repos, il n'y a rien à reconnaître, et les boutons restent visibles.
//
// Instagram n'a pas d'URL de partage web (Meta l'a fermée) : le seul chemin vers
// Instagram — comme WhatsApp ou Messages — est le partage natif, proposé ici en
// premier quand l'appareil le gère (surtout les téléphones).

(() => {
  const bloc = document.querySelector(".relais-liste");
  if (!bloc) return;

  const URL_SITE = "https://agendagolf.fr/";
  const MESSAGE = "L'agenda des compétitions de golf en Auvergne & Loire, sur une seule page ⛳";
  const u = encodeURIComponent(URL_SITE);
  const t = encodeURIComponent(MESSAGE);

  // Facebook et LinkedIn ne reprennent que l'URL (ils ignorent tout texte) ;
  // X et WhatsApp acceptent le message.
  const liens = {
    x: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
    fb: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    wa: `https://wa.me/?text=${encodeURIComponent(MESSAGE + " " + URL_SITE)}`,
    in: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
  };

  // Partage natif : surtout présent sur mobile (et sur Safari Mac). Absent, on
  // laisse le bouton caché plutôt que d'afficher une action morte.
  const natif = bloc.querySelector('[data-c="native"]');
  if (natif && navigator.share) natif.hidden = false;

  const echo = document.querySelector(".relais-echo");

  bloc.addEventListener("click", async (e) => {
    const cible = e.target.closest("[data-c]");
    if (!cible) return;
    e.preventDefault();
    const c = cible.dataset.c;

    if (liens[c]) {
      window.open(liens[c], "_blank", "noopener");
      return;
    }
    if (c === "native") {
      navigator.share?.({ title: "Agenda golf", text: MESSAGE, url: URL_SITE }).catch(() => {});
      return;
    }
    if (c === "copy") {
      try {
        await navigator.clipboard.writeText(URL_SITE);
        if (echo) { echo.classList.add("ok"); setTimeout(() => echo.classList.remove("ok"), 2000); }
      } catch {
        // Presse-papiers refusé (contexte non sécurisé, permission) : on montre
        // le lien à copier à la main.
        window.prompt("Copie ce lien :", URL_SITE);
      }
    }
  });
})();
