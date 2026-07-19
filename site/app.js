// Page publique — lit window.COMPETITIONS (injecté par data.js) et affiche
// les compétitions VALIDÉES et À VENIR, filtrables par golf.

(function () {
  const ALL = (window.COMPETITIONS || []).filter(
    (c) => c.valide && c.date_fin >= isoToday()
  );

  const golfs = [...new Map(ALL.map((c) => [c.golf_id, c.golf_nom])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  const actifs = new Set(golfs.map(([id]) => id)); // tout coché au départ

  const elFiltres = document.getElementById("filtres");
  const elListe = document.getElementById("liste");
  const elVide = document.getElementById("vide");
  const elCompteur = document.getElementById("compteur");

  golfs.forEach(([id, nom]) => {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = nom;
    b.setAttribute("aria-pressed", "true");
    b.onclick = () => {
      if (actifs.has(id)) actifs.delete(id); else actifs.add(id);
      b.setAttribute("aria-pressed", actifs.has(id) ? "true" : "false");
      render();
    };
    elFiltres.appendChild(b);
  });

  const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

  function render() {
    const list = ALL.filter((c) => actifs.has(c.golf_id))
      .sort((a, b) => (a.date_debut < b.date_debut ? -1 : 1));
    elListe.innerHTML = "";
    elVide.hidden = list.length > 0;
    elCompteur.textContent = list.length
      ? `${list.length} compétition${list.length > 1 ? "s" : ""} à venir`
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

  function carte(c, d) {
    const el = document.createElement("article");
    el.className = "comp";
    const plage = c.date_fin && c.date_fin !== c.date_debut
      ? `<div class="plage">→ ${new Date(c.date_fin + "T12:00:00").getDate()}</div>` : "";
    const meta = [c.format, c.depart, c.trous ? `${c.trous} trous` : null]
      .filter(Boolean).join(" · ");
    const badge = c.sponsor ? `<span class="badge">${esc(c.sponsor)}</span>` : "";
    const cta = c.url_inscription
      ? `<a href="${esc(c.url_inscription)}" target="_blank" rel="noopener">S'inscrire</a>`
      : `<span class="none">voir le club</span>`;
    el.innerHTML = `
      <div class="date"><div class="j">${d.getDate()}</div>
        <div class="m">${MOIS[d.getMonth()].slice(0,4)}.</div>${plage}</div>
      <div class="infos">
        <div class="nom">${esc(c.nom)}${badge}</div>
        <div class="meta"><span class="golf">${esc(c.golf_nom)}</span>${meta ? " · " + esc(meta) : ""}</div>
      </div>
      <div class="cta">${cta}</div>`;
    return el;
  }

  function esc(s){return String(s).replace(/[&<>"]/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));}
  function isoToday(){return new Date().toISOString().slice(0,10);}

  if (!ALL.length) {
    elVide.hidden = false;
    elVide.textContent = "Pas encore de compétition validée. Lance la collecte puis valide les compétitions.";
  }
  render();
})();
