// Envoi des formulaires sans quitter la page.
//
// Brevo ne propose la redirection après envoi que dans ses offres payantes, et
// Formspree renvoie par défaut sur sa propre page. Plutôt que de payer ou de
// promener le visiteur sur un site tiers, on poste en arrière-plan et on affiche
// la réponse ici. Les deux services acceptent les requêtes venues d'un autre
// domaine (vérifié), donc on peut lire le résultat et distinguer un vrai succès
// d'un échec — pas question d'annoncer « c'est envoyé » sans le savoir.

(function () {
  document.querySelectorAll("form[data-envoi]").forEach((form) => {
    const service = form.dataset.envoi;                 // "brevo" ou "formspree"
    const bouton = form.querySelector("button[type=submit]");
    const libelleInitial = bouton ? bouton.textContent : "";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;

      if (bouton) { bouton.disabled = true; bouton.textContent = "Envoi…"; }
      retirerMessage(form);

      try {
        const reponse = await fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          // Formspree renvoie du JSON si on le demande ; Brevo s'en moque.
          headers: service === "formspree" ? { Accept: "application/json" } : {},
        });
        if (!reponse.ok) throw new Error(`statut ${reponse.status}`);
        succes(form, service);
      } catch (err) {
        echec(form, err.message);
        if (bouton) { bouton.disabled = false; bouton.textContent = libelleInitial; }
      }
    });
  });

  function retirerMessage(form) {
    const ancien = form.parentElement.querySelector(".reponse-form");
    if (ancien) ancien.remove();
  }

  // On remplace le formulaire par le message : le laisser visible inviterait
  // à renvoyer une seconde fois.
  function succes(form, service) {
    const email = form.querySelector("[name=EMAIL], [name=email]")?.value || "";
    const bloc = document.createElement("div");
    bloc.className = "merci reponse-form";
    bloc.setAttribute("role", "status");
    bloc.innerHTML = service === "brevo"
      ? `<strong>Presque fini.</strong> Un message de confirmation part vers
         <strong>${echapper(email)}</strong> : ton inscription ne sera active qu'une fois
         le lien cliqué. Pense à regarder dans les indésirables.`
      : `<strong>Message envoyé.</strong> Je vous réponds rapidement, sur
         <strong>${echapper(email)}</strong>.`;
    form.replaceWith(bloc);
  }

  function echec(form, detail) {
    const bloc = document.createElement("p");
    bloc.className = "erreur-form reponse-form";
    bloc.setAttribute("role", "alert");
    bloc.textContent = `L'envoi n'a pas abouti (${detail}). Réessaie dans un instant.`;
    form.parentElement.insertBefore(bloc, form);
  }

  function echapper(s) {
    return String(s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
})();
