// Connecteur Golf du Chambon-sur-Lignon — WordPress « Modern Events Calendar ».
//
// Le plugin injecte, pour chaque compétition, un bloc schema.org (JSON-LD) :
//   { "@type": "Event", "startDate": "2026-07-05", "endDate": "…",
//     "name": "Coupe … / Scramble à 2", "url": "…" }
// On lit ces blocs plutôt que la grille HTML : dates déjà en ISO, intitulé et
// lien à la source, rien à deviner.
//
// L'intitulé porte la formule après une barre oblique :
//   « Coupe des Jardiniers / Scramble à 3 » → nom + formule.
//
// Le club se sert aussi de son agenda pour des annonces qui ne sont pas des
// compétitions (ouverture, fermeture hivernale, portes ouvertes, initiations)
// et pour ses matchs inter-clubs « Ryder » : on les écarte ici. Le privé et le
// « réservé aux membres » sont gérés en aval (normalize), comme une fermeture.

import { fetchTexte, decode, texte } from "./html.mjs";

// Annonces logistiques ou rencontres par équipe : jamais des compétitions
// ouvertes qu'on choisit de jouer seul.
const HORS_SUJET = /^ouverture\b|fermeture\s+hivernale|portes?\s+ouvertes|journ[ée]e\s+(?:golf\s+)?d[ée]couverte|initiations?\b|^ryder\b/i;

function extraireEvenements(html) {
  const blocs = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>(.*?)<\/script>/gis)];
  const events = [];
  for (const [, brut] of blocs) {
    let data;
    try { data = JSON.parse(brut); } catch { continue; }
    for (const it of Array.isArray(data) ? data : [data]) {
      if (it && it["@type"] === "Event") events.push(it);
    }
  }
  return events;
}

// « Coupe X / Stableford ou Scramble à 2 ⓘ » → { nom, format }.
// On sépare sur la première barre ; on nettoie au passage le symbole d'info
// (ⓘ) et le drapeau de « ringer score » (🚩), simples repères visuels du club.
function decouper(nomBrut) {
  const propre = texte(decode(nomBrut)).replace(/[ⓘ🚩️]/g, "").trim();
  const i = propre.indexOf("/");
  if (i < 0) return { nom: propre, format: null };
  const nom = propre.slice(0, i).replace(/[\s–-]+$/, "").trim();
  // La note « / suivie de la Fête du Club en soirée » décrit l'après, pas
  // l'horaire de jeu : la garder ferait passer une épreuve de 9 h 30 pour une
  // compétition du soir, qui serait alors écartée à tort.
  const format = propre.slice(i + 1)
    .replace(/\/\s*suivie?\b.*$/i, "")
    .replace(/^[\s–-]+/, "")
    // Le drapeau retiré laisse une double espace (« Stableford  ou … ») : on
    // recolle.
    .replace(/\s{2,}/g, " ")
    .trim();
  return { nom: nom || propre, format: format || null };
}

export async function fetchChambon(golf) {
  const html = await fetchTexte(golf.page);
  const events = extraireEvenements(html);
  if (!events.length) throw new Error("aucun bloc Event JSON-LD (plugin changé ?)");

  const out = [];
  for (const e of events) {
    if (!e.startDate) continue;
    const { nom, format } = decouper(e.name || "");
    if (!nom || HORS_SUJET.test(nom)) continue;
    out.push({
      nom,
      date_debut: e.startDate,
      date_fin: e.endDate || e.startDate,
      format,
      source_url: golf.page,
      url_inscription: typeof e.url === "string" ? e.url : golf.page,
    });
  }
  if (!out.length) throw new Error("aucune compétition retenue (calendrier vide ?)");
  return out;
}
