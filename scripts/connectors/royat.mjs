// Connecteur Golf de Royat-Charade — site Wix, tableau en "répéteur".
// Chaque ligne est un élément .wixui-repeater__item dont les cellules arrivent
// toujours dans le même ordre : date, nom, formule, trous, heure de départ.
// Wix noie le texte sous des <span> de style : on aplatit chaque cellule.

import { fetchTexte, texte, tranches } from "./html.mjs";
import { toPlageISO } from "../normalize.mjs";

const ITEM = /wixui-repeater__item"/;

// Récupère le texte de chaque bloc riche (une cellule du tableau), dans l'ordre.
function cellules(bloc) {
  return [...bloc.matchAll(/data-testid="richTextElement"[^>]*>(.*?)<\/div>/gs)]
    .map((m) => texte(m[1]))
    .filter(Boolean);
}

// La page groupe les lignes par mois ; l'année n'apparaît que dans les en-têtes.
// On la déduit du titre de page, à défaut de l'année courante.
function anneeDeLaSaison(html) {
  const m = html.match(/Comp[ée]titions?\s+(\d{4})/i) || html.match(/Saison\s+(\d{4})/i);
  return m ? +m[1] : new Date().getFullYear();
}

// Le club scinde sa saison sur deux pages (janvier-juin, puis juillet-décembre).
// On lit toutes celles déclarées dans golfs.json, en dédupliquant à la fin.
export async function fetchRoyat(golf) {
  const pages = golf.pages?.length ? golf.pages : [golf.page];
  const out = [];
  const vus = new Set();

  for (const page of pages) {
    out.push(...(await lirePage(page, vus)));
  }

  if (!out.length) throw new Error("aucune compétition trouvée (balisage changé ?)");
  return out;
}

async function lirePage(page, vus) {
  const html = await fetchTexte(page);
  const annee = anneeDeLaSaison(html);
  const out = [];

  for (const bloc of tranches(html, ITEM)) {
    const cs = cellules(bloc);
    if (cs.length < 2) continue;

    // Première cellule = date ("08/01", "29-30/08"). Si elle ne parse pas,
    // la ligne est un en-tête de mois, pas une compétition.
    const { debut, fin } = toPlageISO(cs[0], annee);
    if (!debut) continue;

    const nom = cs[1];
    if (!nom || /^formule|^date$/i.test(nom)) continue;

    const cle = `${debut}|${nom}`;
    if (vus.has(cle)) continue; // Wix duplique le répéteur (versions mobile/desktop)
    vus.add(cle);

    const trous = cs.find((c) => /^\d{1,2}$/.test(c));
    const heure = cs.find((c) => /^\d{1,2}h\d{0,2}$/i.test(c));

    out.push({
      nom,
      date_debut: debut,
      date_fin: fin,
      format: cs[2] || null,
      depart: heure || null,
      trous: trous ? +trous : null,
      url_inscription: page,
      source_url: page,
    });
  }

  return out;
}
