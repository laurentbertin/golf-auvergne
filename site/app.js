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
    .map((c) => ({ ...c, type: c.type || "club",
      formules: c.formules || ["autre"], moment: c.moment || "journee",
      recurrent: c.recurrent === true }));

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

  // Familles de formules. Contrairement aux golfs, on part de RIEN de coché :
  // on cherche « les scrambles à 2 », pas « tout sauf cinq familles ».
  const FORMULES = [
    { id: "scramble-2", label: "Scramble à 2" },
    { id: "individuel", label: "Individuel" },
    { id: "double", label: "À deux" },
    { id: "scramble", label: "Autre scramble" },
    { id: "equipe", label: "Par équipe" },
    { id: "autre", label: "Formule non précisée" },
  ];
  const formulesActives = new Set();
  // Les deux cases disent « masquer » : une seule formulation, un seul sens de
  // lecture, même si l'une est cochée d'origine et l'autre non.
  let masquerSoiree = true;      // after work et nocturnes : rarement ce qu'on cherche
  let masquerReguliers = false;  // 28 % du calendrier : les cacher d'office surprendrait

  const elPeriodes = document.getElementById("periodes");
  const elTypes = document.getElementById("types");
  const elFormules = document.getElementById("formules");
  const elSoiree = document.getElementById("soiree");
  const elReguliers = document.getElementById("reguliers");
  const elEquipes = document.getElementById("equipes");
  const elFiltres = document.getElementById("filtres");
  const elPlier = document.getElementById("plier-golfs");
  const elBascule = document.getElementById("bascule-golfs");
  const elListe = document.getElementById("liste");
  const elVide = document.getElementById("vide");
  const elCompteur = document.getElementById("compteur");
  const elIndex = document.getElementById("mois-index");

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

  // ---------------------------------------------------------------- formules
  const boutonsFormule = new Map();
  FORMULES.forEach((f) => {
    if (!ALL.some((c) => (c.formules || []).includes(f.id))) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = `${f.label}<span class="compte"></span>`;
    b.onclick = () => {
      if (formulesActives.has(f.id)) formulesActives.delete(f.id);
      else formulesActives.add(f.id);
      b.setAttribute("aria-pressed", formulesActives.has(f.id) ? "true" : "false");
      render();
    };
    boutonsFormule.set(f.id, b);
    elFormules.appendChild(b);
  });

  elSoiree.onchange = () => {
    masquerSoiree = elSoiree.checked;
    render();
  };

  elReguliers.onchange = () => {
    masquerReguliers = elReguliers.checked;
    render();
  };

  // Le nombre affiché sur chaque puce rend visible ce qu'on ne sait pas :
  // un tiers des compétitions n'annoncent aucune formule, et filtrer sur
  // « Scramble à 2 » les écarte toutes en silence sans ce repère.
  function majComptesFormule(base) {
    boutonsFormule.forEach((b, id) => {
      const n = base.filter((c) => (c.formules || []).includes(id)).length;
      b.querySelector(".compte").textContent = n ? ` ${n}` : "";
      b.disabled = n === 0 && !formulesActives.has(id);
    });
  }

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
      majPlierLigue();
      render();
    };
    elTypes.appendChild(b);
  });

  elEquipes.onchange = () => {
    equipesVisibles = elEquipes.checked;
    majPlierLigue();
    render();
  };

  // Bloc secondaire, éteint par défaut : on le replie pour que la page s'ouvre
  // sur des compétitions et non sur quatre rangées de réglages.
  const elPlierLigue = document.getElementById("plier-ligue");
  const elBlocLigue = document.getElementById("bloc-ligue");

  elPlierLigue.onclick = () => {
    const ouvert = elBlocLigue.hidden;
    elBlocLigue.hidden = !ouvert;
    elPlierLigue.setAttribute("aria-expanded", String(ouvert));
    majPlierLigue();
  };

  function majPlierLigue() {
    const n = typesActifs.size + (equipesVisibles ? 1 : 0);
    elPlierLigue.textContent = elBlocLigue.hidden
      ? (n ? `épreuves de la ligue AURA — ${n} activée${n > 1 ? "s" : ""}` : "épreuves de la ligue AURA")
      : "replier";
  }

  // ------------------------------------------------------------------ golfs
  // Seuls les clubs suivis alimentent le filtre « Où » : le lieu d'un grand prix
  // change chaque année et n'a pas à encombrer cette liste.
  const golfs = [...new Map(
    ALL.filter((c) => c.type === "club").map((c) => [c.golf_id, c]))
    .entries()]
    .map(([id, c]) => ({ id, nom: c.golf_nom, zone: c.zone || "Ailleurs" }))
    .sort((a, b) => a.nom.localeCompare(b.nom));
  const actifs = new Set(golfs.map((g) => g.id)); // tout coché au départ
  const boutonsGolf = new Map();

  // Douze clubs en vrac ne se lisent pas. On les range par département :
  // c'est le repère qui compte quand on décide où l'on est prêt à rouler.
  const ORDRE_ZONES = ["Puy-de-Dôme", "Allier", "Cantal", "Haute-Loire", "Loire"];
  const parZone = [...new Set(golfs.map((g) => g.zone))].sort(
    (a, b) => (ORDRE_ZONES.indexOf(a) + 1 || 99) - (ORDRE_ZONES.indexOf(b) + 1 || 99),
  );

  parZone.forEach((zone) => {
    const bloc = document.createElement("div");
    bloc.className = "zone";
    const titre = document.createElement("h3");
    titre.className = "zone-titre";
    titre.textContent = zone;
    bloc.appendChild(titre);

    const rangee = document.createElement("div");
    rangee.className = "rangee";
    golfs.filter((g) => g.zone === zone).forEach((g) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = g.nom;
      b.setAttribute("aria-pressed", "true");
      b.onclick = () => {
        if (actifs.has(g.id)) actifs.delete(g.id); else actifs.add(g.id);
        b.setAttribute("aria-pressed", actifs.has(g.id) ? "true" : "false");
        majBascule();
        render();
      };
      boutonsGolf.set(g.id, b);
      rangee.appendChild(b);
    });
    bloc.appendChild(rangee);
    elFiltres.appendChild(bloc);
  });

  // Le détail des clubs reste replié : la page doit s'ouvrir sur des
  // compétitions, pas sur un panneau de réglages.
  elPlier.onclick = () => {
    const ouvert = elFiltres.hidden;
    elFiltres.hidden = !ouvert;
    elPlier.setAttribute("aria-expanded", String(ouvert));
    majPlier();
  };

  function majPlier() {
    const n = actifs.size;
    const tous = n === golfs.length;
    elPlier.textContent = elFiltres.hidden
      ? `${tous ? "les " + n : n + " / " + golfs.length} golfs — choisir`
      : "replier";
    elBascule.hidden = elFiltres.hidden;
  }

  // Un seul bouton, dont le sens s'inverse selon l'état : tout sélectionné -> il
  // propose de vider ; sinon -> il propose de tout reprendre.
  function majBascule() {
    elBascule.textContent = actifs.size === golfs.length ? "tout décocher" : "tout cocher";
    majPlier();
  }

  elBascule.onclick = () => {
    const toutCocher = actifs.size !== golfs.length;
    actifs.clear();
    if (toutCocher) golfs.forEach((g) => actifs.add(g.id));
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

  // Les épreuves fédérales sont déjà catégorisées par leur nature : le filtre
  // de formule ne s'applique qu'aux compétitions de club.
  function formuleRetenue(c) {
    if (c.type !== "club" || !formulesActives.size) return true;
    return (c.formules || []).some((f) => formulesActives.has(f));
  }

  function momentRetenu(c) {
    if (masquerSoiree && c.moment === "soiree") return false;
    // Une série récurrente n'est masquée que côté club : une épreuve fédérale
    // n'est jamais un rendez-vous hebdomadaire.
    if (masquerReguliers && c.type === "club" && c.recurrent) return false;
    return true;
  }

  function render() {
    // Base servant à compter les formules : tout sauf le filtre de formule
    // lui-même, pour que les nombres reflètent la sélection en cours.
    const base = ALL.filter((c) =>
      visible(c) && momentRetenu(c) && c.date_debut <= periode.jusqua && c.type === "club");
    majComptesFormule(base);

    const list = ALL
      .filter((c) => visible(c) && formuleRetenue(c) && momentRetenu(c)
        && c.date_debut <= periode.jusqua)
      .sort((a, b) => (a.date_debut < b.date_debut ? -1 : 1));

    elListe.innerHTML = "";
    elVide.hidden = list.length > 0;
    elCompteur.textContent = list.length
      ? `${list.length} compétition${list.length > 1 ? "s" : ""}`
      : "";

    let moisCourant = "";
    let bloc = null;
    const ancres = [];
    for (const c of list) {
      const d = new Date(c.date_debut + "T12:00:00");
      const cleMois = `${MOIS[d.getMonth()]} ${d.getFullYear()}`;
      if (cleMois !== moisCourant) {
        moisCourant = cleMois;
        // Un bloc par mois : sans cela, les titres collants s'empilent tous en
        // haut de l'écran au lieu de se relayer.
        bloc = document.createElement("section");
        bloc.className = "bloc-mois";
        const h = document.createElement("h2");
        h.className = "mois";
        h.textContent = cleMois;
        h.id = `mois-${d.getFullYear()}-${d.getMonth()}`;
        bloc.appendChild(h);
        elListe.appendChild(bloc);
        ancres.push({ id: h.id, court: MOIS_COURT[d.getMonth()] });
      }
      bloc.appendChild(carte(c, d));
    }
    majIndexMois(ancres, list.length);
  }

  // Passé une trentaine de résultats, faire défiler devient pénible : on offre
  // un raccourci par mois. En deçà, la barre n'apporterait rien.
  const SEUIL_INDEX = 30;

  function majIndexMois(ancres, nbResultats) {
    elIndex.innerHTML = "";
    elIndex.hidden = nbResultats < SEUIL_INDEX || ancres.length < 2;
    if (elIndex.hidden) return;
    ancres.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mois-lien";
      b.textContent = a.court;
      // Saut direct : sur une liste de vingt écrans, un défilement animé
      // durerait plusieurs secondes.
      b.onclick = () => document.getElementById(a.id)
        ?.scrollIntoView({ block: "start" });
      elIndex.appendChild(b);
    });
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
    // Treize clubs sur cinq départements : « c'est où ? » est la question posée
    // à chaque ligne. Le département y répond sans alourdir la carte.
    const lieu = c.type === "club" && c.zone
      ? `<span class="dept">${esc(c.zone)}</span>` : "";
    const badge = c.sponsor ? `<span class="badge">${esc(c.sponsor)}</span>` : "";
    // La catégorie est nommée en toutes lettres : la couleur seule ne suffit pas
    // à distinguer cinq natures d'épreuve, et exclurait les daltoniens.
    const etiquette = c.type !== "club"
      ? `<span class="type type-${c.type}">${esc(LIBELLE_TYPE[c.type] || c.type)}</span>` : "";
    // Le lien mène à la page du club, qui n'est pas toujours un formulaire
    // d'inscription : le libeller « S'inscrire » promettrait plus qu'il ne tient.
    const libelleLien = c.type === "club" ? "Voir le site" : "Fiche ligue";
    // Sur téléphone, le libellé cède la place à un chevron et c'est toute la
    // carte qui devient cliquable (voir .cta a::after) : sur près de 200 lignes,
    // une ligne de lien par carte coûtait un écran et demi de défilement.
    // Le lien reste un vrai lien, donc utilisable au clavier et par un lecteur
    // d'écran, où seul le libellé est annoncé.
    const cta = c.url_inscription
      ? `<a href="${esc(c.url_inscription)}" target="_blank" rel="noopener">` +
        `<span class="cta-texte">${libelleLien} ↗</span>` +
        `<span class="chevron" aria-hidden="true">›</span></a>`
      : "";
    el.innerHTML = `
      <div class="date"><div class="j">${d.getDate()}</div>
        <div class="m">${MOIS_COURT[d.getMonth()]}</div>${plage}</div>
      <div class="infos">
        <div class="nom">${etiquette}${esc(c.nom)}${badge}</div>
        <div class="meta"><span class="golf">${esc(c.golf_nom)}</span>${lieu}${meta ? " · " + esc(meta) : ""}</div>
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
  // Le pied de page listait six clubs en dur, devenus treize : on le construit
  // à partir des données, pour qu'il ne puisse plus se désynchroniser.
  const elPied = document.getElementById("pied-golfs");
  if (elPied && golfs.length) {
    elPied.textContent = `${golfs.length} clubs suivis — ` +
      golfs.map((g) => g.nom.replace(/^Golf (Club )?(du |de la |de |des |d')?/i, "")).join(" · ");
  }

  const nbReguliers = ALL.filter((c) => c.type === "club" && c.recurrent).length;
  const elCompteReg = document.getElementById("compte-reguliers");
  if (elCompteReg) {
    elCompteReg.textContent = nbReguliers
      ? `— ${nbReguliers} sur les prochains mois` : "— séries hebdomadaires";
  }

  majBascule();
  majPlierLigue();
  render();
})();
