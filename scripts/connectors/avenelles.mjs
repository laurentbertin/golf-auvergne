// Connecteur Golf de Moulins les Avenelles — tableau HTML paginé.
//
// Le club publie un vrai tableau, une ligne par compétition :
//   Compétition | Dates | Formule | Statut | Détails
// rendu côté serveur (rien à exécuter), et paginé par « ?page=0,1,2… ».
//
// Deux subtilités du site :
//   - les premières pages se recouvrent largement (la page 0 et la page 1
//     listent presque les mêmes épreuves) : on déduplique par nom + date ;
//   - chaque page est aussi rendue une seconde fois en version « responsive »,
//     d'où deux <table> par page. On ne lit que la première, celle en colonnes.

import { fetchTexte, texte } from "./html.mjs";

// Garde-fou : le club tient une saison sur deux ou trois pages. On s'arrête dès
// qu'une page ne porte plus aucune ligne ; le plafond n'existe que pour ne pas
// boucler si la pagination changeait de forme.
const PAGES_MAX = 8;

const cellules = (tr) => [...tr.matchAll(/<t[dh]\b[^>]*>(.*?)<\/t[dh]>/gs)].map((m) => m[1]);

export async function fetchAvenelles(golf) {
  const vues = new Set();
  const out = [];

  for (let p = 0; p < PAGES_MAX; p++) {
    const html = await fetchTexte(`${golf.page}?page=${p}`);

    // La première table est la vue en colonnes ; la seconde, sa reprise
    // responsive, porte les mêmes lignes sous une autre forme.
    const table = html.match(/<table\b[\s\S]*?<\/table>/i);
    if (!table) break;

    const lignes = [...table[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((m) => m[0]).slice(1);
    if (!lignes.length) break;

    for (const tr of lignes) {
      const c = cellules(tr);
      if (c.length < 4) continue;

      const nom = texte(c[0]);
      const statut = texte(c[3]);
      // « Terminée » : épreuve passée. Le tri par date l'écarterait de toute
      // façon, mais l'exclure ici garde la sortie honnête page par page.
      if (!nom || /termin[ée]/i.test(statut)) continue;

      // La cellule Dates s'écrit « 06/09/2026 (1 jour) » ou
      // « 25/07/2026 au 26/07/2026 (2 jours) » : le premier quantième est le
      // début, le dernier la fin.
      const dates = texte(c[1]).match(/\d{2}\/\d{2}\/\d{4}/g);
      if (!dates) continue;

      // Doublon d'une page à l'autre : même intitulé, même début.
      const cle = `${nom}@${dates[0]}`;
      if (vues.has(cle)) continue;
      vues.add(cle);

      // Lien propre à la compétition, présent dans la ligne (la fiche du club,
      // libellée « Voir » côté site). À défaut, la page des compétitions.
      const lien = tr.match(/href="([^"]+)"/);

      out.push({
        nom,
        date_debut: dates[0],
        date_fin: dates[dates.length - 1],
        format: texte(c[2]) || null,
        source_url: golf.page,
        url_inscription: lien ? lien[1] : golf.page,
      });
    }
    // Les pages se recouvrant, on ne s'arrête pas sur une page sans nouveauté :
    // seule une page vide (plus aucune ligne, plus haut) marque la fin.
  }

  if (!out.length) throw new Error("aucune ligne reconnue (tableau modifié ?)");
  return out;
}
