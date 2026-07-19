// Page publique — lit window.COMPETITIONS (injecté par data.js) et affiche
// les compétitions VALIDÉES et À VENIR, filtrables par période et par golf.

(function () {
  // Délai minimum avant le départ, en jours. Les inscriptions ferment en amont :
  // une compétition qui se joue aujourd'hui n'est plus une information utile.
  //   1 = on masque le jour même     2 = on masque aussi la veille
  const DELAI_JOURS = 1;

  // On compare à la date de DÉBUT, pas de fin : une épreuve sur deux jours
  // commencée hier est déjà close aux inscriptions, même si elle finit demain.
  const PREMIER_JOUR = dateDans(DELAI_JOURS);

  // `type` n'existait pas avant l'ajout des épreuves fédérales : un
  // enregistrement collecté par une version antérieure est une coupe de club.
  const ALL = (window.COMPETITIONS || [])
    .filter((c) => c.valide && c.date_debut >= PREMIER_JOUR)
    .map((c) => ({ ...c, type: c.type || "club" }));

  const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const MOIS_COURT = ["janv","févr","mars","avr","mai","juin","juil","août","sept","oct","nov","déc"];

  // Épreuves de la ligue : facultatives pour le joueur, donc masquées par défaut.
  // On ne les impose pas dans une page dont le sujet reste les coupes de club.
  const TYPES = [
    { id: "grand-prix", label: "Grands Prix" },
    { id: "seniors", label: "Trophées Seniors" },
    { id: "mid-amateurs", label: "Classic Mid-Am" },
  ];
  const typesActifs = new Set();
  let equipesVisibles = false;

  const elPeriodes = document.getElementById("periodes");
  const elTypes = document.getElementById("types");
  const elEquipes = document.getElementById("equipes");
  const elFiltres = document.getElementById("filtres");
  const elBascule = document.getElementById("bascule-golfs");
  const elListe = document.getElementById("liste");
  const elVide = document.getElementById("vide");
  const elCompteur = document.getElementById("compteur");

  // ---------------------------------------------------------------- périodes
  // La question qu'on se pose en ouvrant la page est « qu'est-ce que je peux
  // jouer bientôt ? ». On répond d'abord par des raccourcis de temps, et non
  // par un fil de six mois qu'il faudrait faire défiler.
  const periodes = construirePeriodes();
  let periode = periodes[0];

  function construirePeriodes() {
    const liste = [
      { id: "30j", label: "30 jours", jusqua: dateDans(30) },
      { id: "90j", label: "3 mois", jusqua: dateDans(90) },
      { id: "tout", label: "Tout", jusqua: "9999-12-31" },
    ];
    // Une période vide n'aide personne : on démarre sur la première qui a du contenu.
    const premiere = liste.find((p) => ALL.some((c) => c.date_debut <= p.jusqua));
    return premiere ? [...liste.slice(liste.indexOf(premiere))] : liste;
  }

  periodes.forEach((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = p.label;
    b.setAttribute("aria-pressed", String(p === periode));
    b.onclick = () => {
      periode = p;
      [...elPeriodes.children].forEach((el) =>
        el.setAttribute("aria-pressed", String(el === b)));
      render();
    };
    elPeriodes.appendChild(b);
  });

  // ------------------------------------------------------- épreuves fédérales
  TYPES.forEach((t) => {
    const dispo = ALL.some((c) => c.type === t.id);
    if (!dispo) return; // catégorie absente de la collecte : on n'affiche pas un filtre mort
    const b = document.createElement("button");
    b.type = "button";
    b.className = `chip chip-${t.id}`;
    b.textContent = t.label;
    b.setAttribute("aria-pressed", "false");
    b.onclick = () => {
      if (typesActifs.has(t.id)) typesActifs.delete(t.id); else typesActifs.add(t.id);
      b.setAttribute("aria-pressed", typesActifs.has(t.id) ? "true" : "false");
      render();
    };
    elTypes.appendChild(b);
  });

  elEquipes.onchange = () => {
    equipesVisibles = elEquipes.checked;
    render();
  };

  // ------------------------------------------------------------------ golfs
  // Seuls les clubs suivis alimentent le filtre « Où » : le lieu d'un grand prix
  // change chaque année et n'a pas à encombrer cette liste.
  const golfs = [...new Map(
    ALL.filter((c) => c.type === "club").map((c) => [c.golf_id, c.golf_nom])
  ).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const actifs = new Set(golfs.map(([id]) => id)); // tout coché au départ
  const boutonsGolf = new Map();

  golfs.forEach(([id, nom]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = nom;
    b.setAttribute("aria-pressed", "true");
    b.onclick = () => {
      if (actifs.has(id)) actifs.delete(id); else actifs.add(id);
      b.setAttribute("aria-pressed", actifs.has(id) ? "true" : "false");
      majBascule();
      render();
    };
    boutonsGolf.set(id, b);
    elFiltres.appendChild(b);
  });

  // Un seul bouton, dont le sens s'inverse selon l'état : tout sélectionné -> il
  // propose de vider ; sinon -> il propose de tout reprendre.
  function majBascule() {
    elBascule.textContent = actifs.size === golfs.length ? "tout décocher" : "tout cocher";
  }

  elBascule.onclick = () => {
    const toutCocher = actifs.size !== golfs.length;
    actifs.clear();
    if (toutCocher) golfs.forEach(([id]) => actifs.add(id));
    boutonsGolf.forEach((b, id) =>
      b.setAttribute("aria-pressed", actifs.has(id) ? "true" : "false"));
    majBascule();
    render();
  };

  // ------------------------------------------------------------------ rendu
  // Trois régimes distincts : les coupes de club se filtrent par golf, les
  // épreuves facultatives par catégorie, les compétitions d'équipe par leur
  // seule case à cocher.
  function visible(c) {
    if (c.type === "club") return actifs.has(c.golf_id);
    if (c.type === "equipes") return equipesVisibles;
    return typesActifs.has(c.type);
  }

  function render() {
    const list = ALL
      .filter((c) => visible(c) && c.date_debut <= periode.jusqua)
      .sort((a, b) => (a.date_debut < b.date_debut ? -1 : 1));

    elListe.innerHTML = "";
    elVide.hidden = list.length > 0;
    elCompteur.textContent = list.length
      ? `${list.length} compétition${list.length > 1 ? "s" : ""}`
      : "";

    let moisCourant = "";
    for (const c of list) {
      const d = new Date(c.date_debut + "T12:00:00");
      const cleMois = `${MOIS[d.getMonth()]} ${d.getFullYear()}`;
      if (cleMois !== moisCourant) {
        moisCourant = cleMois;
        const h = document.createElement("div");
        h.className = "mois";
        h.textContent = cleMois;
        elListe.appendChild(h);
      }
      elListe.appendChild(carte(c, d));
    }
  }

  const LIBELLE_TYPE = {
    "grand-prix": "Grand Prix",
    "seniors": "Trophée Seniors",
    "mid-amateurs": "Classic Mid-Am",
    "equipes": "Équipe",
  };

  function carte(c, d) {
    const el = document.createElement("article");
    el.className = `comp comp-${c.type}`;
    const plage = c.date_fin && c.date_fin !== c.date_debut
      ? `<div class="plage">→ ${new Date(c.date_fin + "T12:00:00").getDate()}</div>` : "";
    const meta = [c.format, c.depart, c.trous ? `${c.trous} trous` : null, c.ville]
      .filter(Boolean).join(" · ");
    const badge = c.sponsor ? `<span class="badge">${esc(c.sponsor)}</span>` : "";
    // La catégorie est nommée en toutes lettres : la couleur seule ne suffit pas
    // à distinguer cinq natures d'épreuve, et exclurait les daltoniens.
    const etiquette = c.type !== "club"
      ? `<span class="type type-${c.type}">${esc(LIBELLE_TYPE[c.type] || c.type)}</span>` : "";
    // Le lien mène à la page du club, qui n'est pas toujours un formulaire
    // d'inscription : le libeller « S'inscrire » promettrait plus qu'il ne tient.
    const libelleLien = c.type === "club" ? "Voir au club ↗" : "Fiche ligue ↗";
    const cta = c.url_inscription
      ? `<a href="${esc(c.url_inscription)}" target="_blank" rel="noopener">${libelleLien}</a>`
      : "";
    el.innerHTML = `
      <div class="date"><div class="j">${d.getDate()}</div>
        <div class="m">${MOIS_COURT[d.getMonth()]}</div>${plage}</div>
      <div class="infos">
        <div class="nom">${etiquette}${esc(c.nom)}${badge}</div>
        <div class="meta"><span class="golf">${esc(c.golf_nom)}</span>${meta ? " · " + esc(meta) : ""}</div>
      </div>
      <div class="cta">${cta}</div>`;
    return el;
  }

  function esc(s){return String(s).replace(/[&<>"]/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));}
  function dateDans(n){const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);}

  if (!ALL.length) {
    elVide.hidden = false;
    elVide.textContent = "Pas encore de compétition à venir. La collecte tourne chaque matin.";
  }
  majBascule();
  render();
})();
