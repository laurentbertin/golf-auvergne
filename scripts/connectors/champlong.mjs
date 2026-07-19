// Connecteur Golf du Domaine de Champlong — annonces en texte libre.
//
// Le club n'utilise pas d'agenda : il écrit ses compétitions en toutes lettres
// dans un paragraphe, une par ligne :
//   « Dimanche 9 Août : Coupe de classement départ en ligne 8h30 DJ : 10 € »
//   « Mercredi 22 au Vendredi 24 Juillet : After Work, 3 jours de golf… »
//
// On lit donc la phrase : jour de semaine, quantième, mois, puis l'intitulé.
// L'année n'est jamais écrite — voir anneeProbable().

import { fetchTexte, texte, decode } from "./html.mjs";
import { toISO } from "../normalize.mjs";

const JOURS = "lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche";
const MOIS = "janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre";

// Une date simple  : « Dimanche 9 Août : … »
const SIMPLE = new RegExp(`^(?:${JOURS})\\s+(\\d{1,2})\\s+(${MOIS})\\s*:\\s*(.+)$`, "i");
// Une date étalée  : « Mercredi 22 au Vendredi 24 Juillet : … »
const PLAGE = new RegExp(
  `^(?:${JOURS})\\s+(\\d{1,2})\\s+au\\s+(?:${JOURS})\\s+(\\d{1,2})\\s+(${MOIS})\\s*:\\s*(.+)$`,
  "i",
);

// Le club n'écrit pas l'année. On suppose l'année courante, sauf pour une date
// déjà bien passée : en janvier, « Dimanche 6 Décembre » désigne l'année à venir.
function anneeProbable(jour, mois, aujourdhui = new Date()) {
  const annee = aujourdhui.getFullYear();
  const essai = toISO(`${jour} ${mois} ${annee}`);
  if (!essai) return annee;
  const ecart = (new Date(essai) - aujourdhui) / 86400000;
  return ecart < -60 ? annee + 1 : annee;
}

// Sépare l'intitulé de la compétition du reste de la phrase (formule, horaire,
// tarif). Le nom s'arrête à la première virgule ou au premier mot de logistique ;
// le complément sert de formule de jeu, tronqué pour rester lisible en liste.
function decouper(reste) {
  const brut = texte(reste)
    .replace(/\s*DJ\s*:\s*\d+\s*€.*$/i, "")   // droit de jeu : hors sujet ici
    .replace(/\s+/g, " ")
    .trim();
  const coupure = brut.search(/,| d[ée]part | formule | stableford sur | shotgun /i);
  const nom = (coupure > 0 ? brut.slice(0, coupure) : brut).replace(/[.\s]+$/, "").trim();
  const complement = coupure > 0 ? brut.slice(coupure).replace(/^[,\s]+/, "").trim() : "";
  return {
    nom: nom || brut,
    detail: complement && complement.length <= 70 ? complement : null,
  };
}

export async function fetchChamplong(golf) {
  const html = await fetchTexte(golf.page);

  // Chaque annonce vit dans son propre paragraphe.
  const lignes = [...html.matchAll(/<p>(.*?)<\/p>/gs)]
    .map((m) => texte(decode(m[1])))
    .filter(Boolean);

  const out = [];
  for (const ligne of lignes) {
    let m = ligne.match(PLAGE);
    if (m) {
      const [, d1, d2, mois, reste] = m;
      const annee = anneeProbable(d1, mois);
      const { nom, detail } = decouper(reste);
      out.push({
        nom,
        date_debut: toISO(`${d1} ${mois} ${annee}`),
        date_fin: toISO(`${d2} ${mois} ${annee}`),
        format: detail,
        source_url: golf.page,
        url_inscription: golf.page,
      });
      continue;
    }

    m = ligne.match(SIMPLE);
    if (!m) continue;
    const [, jour, mois, reste] = m;
    const annee = anneeProbable(jour, mois);
    const date = toISO(`${jour} ${mois} ${annee}`);
    if (!date) continue;
    const { nom, detail } = decouper(reste);
    out.push({
      nom,
      date_debut: date,
      date_fin: date,
      format: detail,
      source_url: golf.page,
      url_inscription: golf.page,
    });
  }

  if (!out.length) throw new Error("aucune annonce reconnue (rédaction changée ?)");
  return out;
}
