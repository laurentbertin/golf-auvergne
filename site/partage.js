// Boutons de partage. Aucune dépendance, aucun traceur : ce sont de simples
// liens vers les pages de partage des réseaux, plus le menu natif du téléphone.
//
// Instagram n'a pas d'URL de partage web (Meta l'a fermée) : le seul chemin vers
// Instagram — comme vers WhatsApp ou Messages — est le partage natif, proposé
// ici en premier sur mobile.

(() => {
  const bloc = document.querySelector(".partage-boutons");
  if (!bloc) return;

  const URL_SITE = "https://agendagolf.fr/";
  const MESSAGE = "L'agenda des compétitions de golf en Auvergne & Loire, sur une seule page ⛳";
  const u = encodeURIComponent(URL_SITE);
  const t = encodeURIComponent(MESSAGE);

  // Facebook et LinkedIn ne reprennent que l'URL (ils ignorent tout texte
  // pré-rempli) ; X accepte le message.
  const liens = {
    x: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
  };
  for (const [cle, href] of Object.entries(liens)) {
    const a = bloc.querySelector(`[data-partage="${cle}"]`);
    if (a) { a.href = href; a.target = "_blank"; a.rel = "noopener"; }
  }

  // Partage natif : présent surtout sur mobile. Absent, on cache le bouton
  // plutôt que d'afficher une action morte.
  const natif = bloc.querySelector('[data-partage="natif"]');
  if (natif && navigator.share) {
    natif.hidden = false;
    natif.addEventListener("click", () => {
      navigator.share({ title: "Agenda golf", text: MESSAGE, url: URL_SITE }).catch(() => {});
    });
  }

  // Copier le lien, avec un accusé de réception discret.
  const copier = bloc.querySelector('[data-partage="copier"]');
  const echo = document.querySelector(".partage-copie");
  if (copier) {
    copier.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(URL_SITE);
        if (echo) { echo.classList.add("ok"); setTimeout(() => echo.classList.remove("ok"), 2000); }
      } catch {
        // Presse-papiers refusé (contexte non sécurisé, permission) : on montre
        // le lien à copier à la main.
        window.prompt("Copie ce lien :", URL_SITE);
      }
    });
  }
})();
