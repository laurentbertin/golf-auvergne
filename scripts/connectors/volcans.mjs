// Connecteur Golf des Volcans — grille WPBakery + champs ACF étiquetés.
// La page liste toute la saison d'un coup ; chaque vignette porte ses champs
// dans des <div> libellés ("Date:", "Parcours:", "Formule:", "Départ:").
// Aucun LLM : le balisage est régulier et stable.

import { fetchTexte, texte, tranches } from "./html.mjs";

const ITEM = /<div class="vc_grid-item[^"]*"/;

// Lit un champ ACF par son libellé : <span class="vc_gitem-acf-label">Date:</span> 12/02/2026 10:00
function champ(bloc, libelle) {
  const re = new RegExp(
    `<span class="vc_gitem-acf-label">\\s*${libelle}\\s*:?\\s*</span>([^<]*)`,
    "i",
  );
  const m = bloc.match(re);
  return m ? texte(m[1]) || null : null;
}

// "Fougères 9 Trous" -> 9 ; "18 Trous" -> 18
function trousDepuisParcours(parcours) {
  const m = String(parcours || "").match(/(\d{1,2})\s*trous/i);
  return m ? +m[1] : null;
}

export async function fetchVolcans(golf) {
  const html = await fetchTexte(golf.page);
  const out = [];

  for (const bloc of tranches(html, ITEM)) {
    const titre = bloc.match(/<h3[^>]*>(.*?)<\/h3>/s);
    const nom = titre ? texte(titre[1]) : null;
    const date = champ(bloc, "Date");
    if (!nom || !date) continue;

    // Le club range aussi des billets non sportifs dans cette grille (RGPD,
    // inscriptions à l'école de golf). Eux seuls n'ont ni formule ni départ.
    const format = champ(bloc, "Formule");
    const depart = champ(bloc, "D[ée]part");
    if (!format && !depart) continue;
    if (/^prot[ée]g[ée]\s*:/i.test(nom)) continue; // billet protégé par mot de passe

    const lien = bloc.match(/href="([^"]*\/competition\/[^"]*)"/);
    const parcours = champ(bloc, "Parcours");

    out.push({
      nom,
      date_debut: date,
      date_fin: date,
      format,
      depart,
      trous: trousDepuisParcours(parcours),
      url_inscription: lien ? lien[1] : null,
      source_url: golf.page,
    });
  }

  if (!out.length) throw new Error("aucune compétition trouvée (balisage changé ?)");
  return out;
}
