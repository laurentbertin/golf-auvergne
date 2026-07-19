// Connecteur Golf Club du Forez — page « Compétitions » rédigée à la main.
//
// Le club énumère sa saison en toutes lettres, une entrée par bloc séparé par
// une ligne de tirets bas :
//   « 04/07  samedi 04 juillet 2026  Compétition MR GOLF  Départs Brut Net »
//   « 28-29-30/08  vendredi 28, samedi 29 et dimanche 30 aout 2026  Grand Prix… »
//
// On repère la date longue (du premier jour de semaine jusqu'à l'année), puis
// l'intitulé qui la suit. Le club publie aussi sur /agenda-1 une grille annuelle
// illisible par une machine : c'est bien cette page-ci qu'il faut lire.

import { fetchTexte, texte } from "./html.mjs";
import { toISO } from "../normalize.mjs";

const JOURS = "lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche";
const MOIS = "janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre";

// La date va du premier nom de jour jusqu'à l'année : elle peut énumérer
// plusieurs quantièmes (« vendredi 28, samedi 29 et dimanche 30 aout 2026 »)
// ou une plage (« du lundi 21 au vendredi 25 septembre 2026 »).
const DATE = new RegExp(
  `(?:du\\s+)?(?:${JOURS})\\s*\\d{1,2}(?:[^]{0,60}?)?(${MOIS})\\s*(\\d{4})`,
  "i",
);

const NOMS_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// Le club écrit parfois le mois en chiffres au milieu d'une énumération :
// « vendredi11, samedi 12 et dimanche13/09 2026 ». On le réécrit en toutes
// lettres avant l'analyse, plutôt que de multiplier les motifs de date.
function normaliserMois(bloc) {
  return bloc.replace(/(\d{1,2})\/(\d{1,2})\s+(\d{4})/g, (tout, jour, mois, annee) => {
    const nom = NOMS_MOIS[+mois - 1];
    return nom ? `${jour} ${nom} ${annee}` : tout;
  });
}

// Ce qui suit l'intitulé et n'en fait pas partie : liens de résultats,
// mentions de règlement, colonnes de départs.
const FIN_DU_NOM = /d[ée]parts|brut|net|challenge|r[èe]glement|r[ée]sultats|ringer|messieurs|dames|inscription/i;

// Entrées qui ne sont pas des compétitions, ou qui n'ont plus lieu.
const A_ECARTER = /a[ée]ration|carottage|d[ée]compactage|annul[ée]e|ferm[ée]/i;

export async function fetchForez(golf) {
  const brut = texte(await fetchTexte(golf.page));

  // Chaque compétition occupe son propre bloc, délimité par les tirets bas.
  const blocs = brut.split(/_{3,}/).map((b) => b.trim()).filter(Boolean);
  const out = [];
  const vus = new Set();

  for (const brutBloc of blocs) {
    const bloc = normaliserMois(brutBloc);
    const m = bloc.match(DATE);
    if (!m) continue;

    const dateEntiere = m[0];
    const mois = m[1];
    const annee = m[2];

    // Tous les quantièmes cités dans la date : le premier ouvre l'épreuve,
    // le dernier la ferme. Pas de limite de mot ici : le club colle parfois le
    // quantième au nom du jour (« vendredi11 »), et \b y échouerait.
    const jours = [...dateEntiere.matchAll(/\d+/g)]
      .map((j) => +j[0])
      .filter((j) => j >= 1 && j <= 31);
    if (!jours.length) continue;

    const debut = toISO(`${jours[0]} ${mois} ${annee}`);
    const fin = toISO(`${jours[jours.length - 1]} ${mois} ${annee}`);
    if (!debut) continue;

    // L'intitulé suit immédiatement la date.
    const apres = bloc.slice(bloc.indexOf(dateEntiere) + dateEntiere.length);
    const coupure = apres.search(FIN_DU_NOM);
    const nom = (coupure > 0 ? apres.slice(0, coupure) : apres)
      .replace(/[\s​·,;_-]+$/u, "")
      .trim();

    if (!nom || nom.length > 90) continue;
    if (A_ECARTER.test(nom) || A_ECARTER.test(bloc)) continue;

    const cle = `${debut}|${nom}`;
    if (vus.has(cle)) continue;
    vus.add(cle);

    out.push({
      nom,
      date_debut: debut,
      date_fin: fin && fin >= debut ? fin : debut,
      format: null,
      source_url: golf.page,
      url_inscription: golf.page,
    });
  }

  if (!out.length) throw new Error("aucune compétition reconnue (rédaction changée ?)");
  return out;
}
