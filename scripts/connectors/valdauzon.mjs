// Connecteur Golf du Val d'Auzon — listing JetEngine (Elementor).
// Le club publie ses compétitions dans un carrousel "Agenda" limité aux
// 10 prochaines : c'est une fenêtre glissante, pas la saison entière.
// Elle se renouvelle d'elle-même au fil des jours, ce qui suffit pour un agenda.
//
// Chaque vignette porte l'identifiant WordPress de la compétition
// (data-post-id). On en tire le détail :
// - l'API WordPress (une requête pour toutes) donne l'adresse de la fiche et
//   son texte : tarifs, programme, repas ;
// - la fiche porte trois champs sans libellé, dans cet ordre : « Date de
//   départ … », la formule (« Scramble à 2 », « A définir ») et l'heure
//   (« 09:30 »). La date de la fiche l'emporte sur celle de la vignette.
// Les liens de la vignette ne sont pas fiables (le carrousel mélange les
// cartes) : on ne s'en sert plus. Une fiche illisible laisse la vignette
// telle quelle : le détail est un plus.

import { decode, fetchJson, fetchTexte, texte, tranches } from "./html.mjs";

const ITEM = /class="jet-listing-grid__item[^"]*"/;
const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const sansAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// « 3 septembre, 2026 » → « 2026-09-03 » ; null si la date ne se lit pas.
function dateFiche(s) {
  const m = sansAccent(s).match(/(\d{1,2})\s+([a-z]+),?\s+(\d{4})/);
  const mois = m ? MOIS.indexOf(m[2]) + 1 : 0;
  return mois ? `${m[3]}-${String(mois).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

// Le passage du texte qui parle d'argent (tarifs, droits de jeu), tel quel.
export function extraireTarifs(description) {
  if (!description) return null;
  const debut = description.search(/tarifs?\s*:|droits? de (jeu|participation)|€/i);
  if (debut < 0) return null;
  const suite = description.slice(debut, debut + 500);
  const fin = suite.lastIndexOf("€");
  return suite.slice(0, fin < 0 ? suite.length : fin + 1).trim() || null;
}

export function lireFiche(html) {
  const champs = [...html.matchAll(/jet-listing-dynamic-field__content"\s*>([\s\S]*?)<\/div>/g)].map((m) => texte(m[1]));
  const date = champs.find((c) => /date de d[ée]part/i.test(c));
  const heure = champs.find((c) => /^\d{1,2}\s*[:h]\s*\d{2}$/i.test(c));
  const formule = champs.find((c) => c && c !== date && c !== heure);
  return {
    date: date ? dateFiche(date) : null,
    heure: heure ? heure.replace(/\s*[:h]\s*/i, ":") : null,
    formule: formule && !/^[àa] d[ée](finir|terminer)$/i.test(formule) ? formule : null,
  };
}

export async function fetchValdauzon(golf) {
  const html = await fetchTexte(golf.page);
  const vignettes = [];

  for (const bloc of tranches(html, ITEM)) {
    // La date est le seul champ dynamique de la vignette ("3 août, 2026").
    const dateBrute = bloc.match(/jet-listing-dynamic-field__content"\s*>([^<]+)</);
    const titre = bloc.match(/<h3 class="elementor-heading-title[^"]*">([^<]*)<\/h3>/);
    if (!dateBrute || !titre) continue;

    const nom = texte(titre[1]);
    if (!nom) continue;

    const id = bloc.match(/data-post-id="(\d+)"/)?.[1] ?? null;
    vignettes.push({ id, nom, date: texte(dateBrute[1]) });
  }
  if (!vignettes.length) throw new Error("aucune compétition trouvée (balisage changé ?)");

  // Le détail, en une requête pour toutes les compétitions de la liste.
  const ids = [...new Set(vignettes.map((v) => v.id).filter(Boolean))];
  let fiches = new Map();
  if (ids.length) {
    try {
      const api = `${golf.base}/wp-json/wp/v2/competitions?include=${ids.join(",")}&per_page=100&_fields=id,link,content`;
      fiches = new Map((await fetchJson(api)).map((p) => [String(p.id), p]));
    } catch (e) {
      console.warn(`  val-dauzon : détail indisponible (${e.message})`);
    }
  }

  const out = [];
  for (const v of vignettes) {
    const p = v.id ? fiches.get(v.id) : null;
    const description = p ? texte(p.content?.rendered ?? "").slice(0, 2000) || null : null;
    let fiche = { date: null, heure: null, formule: null };
    if (p?.link) {
      try {
        await pause(500);
        fiche = lireFiche(await fetchTexte(p.link));
      } catch (e) {
        console.warn(`  val-dauzon : fiche illisible ${p.link} (${e.message})`);
      }
    }
    const date = fiche.date ?? v.date;
    out.push({
      nom: v.nom,
      date_debut: date,
      date_fin: date,
      format: fiche.formule,
      depart: fiche.heure,
      tarifs: extraireTarifs(description),
      description,
      url_inscription: p?.link ? decode(p.link) : golf.page,
      source_url: golf.page,
    });
  }
  return out;
}
