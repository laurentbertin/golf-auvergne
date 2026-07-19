// seed-vichy.mjs — amorce le projet avec les 18 compétitions RÉELLES du Sporting de Vichy
// (récupérées le 18/07/2026 via l'API du club). Marque ces compétitions comme validées
// pour que la page affiche du contenu réel immédiatement, sans réseau.
//
//   node scripts/seed-vichy.mjs

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { toRecord, merge } from "./normalize.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const golf = { id: "vichy-sc", nom: "Sporting Club de Vichy", page: "https://www.golf-vichy.fr/calendrier-des-competitions/" };

const RAWS = [
  { nom: "Coupe du restaurateur", date_debut: "2026-07-19", date_fin: "2026-07-19", format: "Scramble à 2", depart: "Départ 8h30", url_inscription: "https://golf-vichy.fr/competition/gold-cup/" },
  { nom: "Coupe J-E de Boissy", date_debut: "2026-07-26", date_fin: "2026-07-26", format: "Strokeplay", url_inscription: "https://golf-vichy.fr/competition/coupe-j-e-de-boissy/" },
  { nom: "Ynov'IT", date_debut: "2026-08-03", date_fin: "2026-08-03", format: "Simple Stableford", url_inscription: "https://golf-vichy.fr/competition/ynovit/" },
  { nom: "La Montagne", date_debut: "2026-08-04", date_fin: "2026-08-04", format: "Scramble à 2", url_inscription: "https://golf-vichy.fr/competition/la-montagne-2026/" },
  { nom: "Partouche", date_debut: "2026-08-05", date_fin: "2026-08-05", format: "Simple Stableford", url_inscription: "https://golf-vichy.fr/competition/partouche-2026/" },
  { nom: "Home Box", date_debut: "2026-08-07", date_fin: "2026-08-07", format: "Simple Stableford", url_inscription: "https://golf-vichy.fr/competition/home-box-2026/" },
  { nom: "Thevenet/Lagarde", date_debut: "2026-08-08", date_fin: "2026-08-09", format: "Strokeplay", url_inscription: "https://golf-vichy.fr/competition/thevenet-lagarde/" },
  { nom: "Ville de Bellerive", date_debut: "2026-08-10", date_fin: "2026-08-10", format: "Scramble à 2", url_inscription: "https://golf-vichy.fr/competition/ville-de-bellerive/" },
  { nom: "Seguin", date_debut: "2026-08-12", date_fin: "2026-08-12", format: "Simple Stableford", url_inscription: "https://golf-vichy.fr/competition/seguin/" },
  { nom: "Thelem Assurance", date_debut: "2026-08-13", date_fin: "2026-08-13", format: "Simple Stableford", url_inscription: "https://golf-vichy.fr/competition/thelem-assurance/" },
  { nom: "Ville de Vichy", date_debut: "2026-08-14", date_fin: "2026-08-14", format: "Simple Stableford", url_inscription: "https://golf-vichy.fr/competition/ville-de-vichy/" },
  { nom: "Auvergne Marée", date_debut: "2026-08-15", date_fin: "2026-08-15", format: "Chapman", url_inscription: "https://golf-vichy.fr/competition/auvergne-maree/" },
  { nom: "Grand Prix Vichy Communauté 2026", date_debut: "2026-08-21", date_fin: "2026-08-23", format: "Strokeplay", url_inscription: "https://golf-vichy.fr/competition/grand-prix-vichy-communaute-2026/" },
  { nom: "Championnat du club", date_debut: "2026-09-12", date_fin: "2026-09-13", format: "Strokeplay", url_inscription: "https://golf-vichy.fr/competition/championnat-du-club/" },
  { nom: "DS automobiles", date_debut: "2026-09-19", date_fin: "2026-09-19", format: "Scramble à 2", url_inscription: "https://golf-vichy.fr/competition/ds-automobiles/" },
  { nom: "Elsan/Pergola", date_debut: "2026-10-04", date_fin: "2026-10-04", format: "Scramble à 2", url_inscription: "https://golf-vichy.fr/competition/elsan-pergola/" },
  { nom: "Territorial D1", date_debut: "2026-10-15", date_fin: "2026-10-15", format: "Simple Stableford", url_inscription: "https://golf-vichy.fr/competition/territorial-d1/" },
  { nom: "Pour le sourire d'un enfant", date_debut: "2026-10-18", date_fin: "2026-10-18", format: "Scramble à 2", url_inscription: "https://golf-vichy.fr/competition/pour-le-sourire-dun-enfant/" },
];

const records = RAWS
  .map((r) => toRecord(r, golf, "events-calendar", "2026-07-18"))
  .map((r) => ({ ...r, valide: true })); // amorce validée pour affichage immédiat

const fusion = merge([], records);
await writeFile(join(ROOT, "data", "competitions.json"), JSON.stringify(fusion, null, 2) + "\n");
await writeFile(join(ROOT, "site", "data.js"), `window.COMPETITIONS = ${JSON.stringify(fusion, null, 2)};\n`);
console.log(`Amorce écrite : ${fusion.length} compétitions du Sporting de Vichy (validées).`);
