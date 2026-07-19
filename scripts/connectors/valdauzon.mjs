// Connecteur Golf du Val d'Auzon — listing JetEngine (Elementor).
// Le club publie ses compétitions dans un carrousel "Agenda" limité aux
// 10 prochaines : c'est une fenêtre glissante, pas la saison entière.
// Elle se renouvelle d'elle-même au fil des jours, ce qui suffit pour un agenda.

import { fetchTexte, texte, tranches } from "./html.mjs";

const ITEM = /class="jet-listing-grid__item[^"]*"/;

export async function fetchValdauzon(golf) {
  const html = await fetchTexte(golf.page);
  const out = [];

  for (const bloc of tranches(html, ITEM)) {
    // La date est le seul champ dynamique de la vignette ("3 août, 2026").
    const dateBrute = bloc.match(/jet-listing-dynamic-field__content"\s*>([^<]+)</);
    const titre = bloc.match(/<h3 class="elementor-heading-title[^"]*">([^<]*)<\/h3>/);
    if (!dateBrute || !titre) continue;

    const nom = texte(titre[1]);
    if (!nom) continue;

    const lien = bloc.match(/href="(https?:\/\/[^"]*)"/);
    const date = texte(dateBrute[1]);

    out.push({
      nom,
      date_debut: date,
      date_fin: date,
      format: null, // le club ne publie pas la formule dans cette vue
      depart: null,
      url_inscription: lien ? lien[1] : golf.page,
      source_url: golf.page,
    });
  }

  if (!out.length) throw new Error("aucune compétition trouvée (balisage changé ?)");
  return out;
}
