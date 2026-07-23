// Orchestrateur : lit data/golfs.json, lance le bon connecteur par golf,
// normalise, fusionne avec l'existant (en préservant les validations humaines),
// réécrit data/competitions.json ET site/data.js (pour la page statique).
//
// Usage :
//   node scripts/collect.mjs                 -> tous les golfs
//   node scripts/collect.mjs vichy-sc royat  -> seulement ceux-là

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchEventsCalendar } from "./connectors/eventsCalendar.mjs";
import { fetchVolcans } from "./connectors/volcans.mjs";
import { fetchRoyat } from "./connectors/royat.mjs";
import { fetchValdauzon } from "./connectors/valdauzon.mjs";
import { fetchMontpensier } from "./connectors/montpensier.mjs";
import { fetchCalendrierImage } from "./connectors/calendrierImage.mjs";
import { fetchChamplong } from "./connectors/champlong.mjs";
import { fetchAvenelles } from "./connectors/avenelles.mjs";
import { fetchForez } from "./connectors/forez.mjs";
import { fetchLigueAura } from "./connectors/ligueAura.mjs";
import { toRecord, merge, isoToday, marquerRecurrences, marquerExclusions } from "./normalize.mjs";

// Chaque club a son propre outil de publication : un connecteur par site.
// Tous lisent du balisage régulier — aucun ne dépend d'un LLM.
const CONNECTEURS = {
  volcans: fetchVolcans,
  royat: fetchRoyat,
  valdauzon: fetchValdauzon,
  montpensier: fetchMontpensier,
  champlong: fetchChamplong,
  avenelles: fetchAvenelles,
  forez: fetchForez,
  "calendrier-image": fetchCalendrierImage,
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const F_GOLFS = join(ROOT, "data", "golfs.json");
const F_LIGUE = join(ROOT, "data", "ligue.json");
const F_EXCLUS = join(ROOT, "data", "exclusions.json");
const F_COMPS = join(ROOT, "data", "competitions.json");
const F_SITEDATA = join(ROOT, "site", "data.js");

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch { return fallback; }
}

async function collectGolf(golf, since) {
  const mode = golf.connecteur;

  const dedie = CONNECTEURS[mode];
  if (dedie) return { raws: await dedie(golf), type: mode };

  if (mode === "events-calendar") {
    return { raws: await fetchEventsCalendar(golf, since), type: "events-calendar" };
  }
  throw new Error(`connecteur inconnu « ${mode} »`);
}

async function main() {
  const filtre = process.argv.slice(2);
  const golfs = (await readJson(F_GOLFS, []))
    .filter((g) => filtre.length === 0 || filtre.includes(g.id));
  const existants = await readJson(F_COMPS, []);
  const since = isoToday();

  let nouveaux = [];
  for (const golf of golfs) {
    process.stdout.write(`• ${golf.nom} … `);
    try {
      const { raws, type } = await collectGolf(golf, since);
      const recs = raws
        .map((r) => toRecord(r, golf, type, since))
        .filter((r) => r.date_debut && r.date_fin >= since)
        // Tout est lu dans du balisage régulier : rien n'est deviné, donc tout
        // est publié directement (le champ valide, hérité du premier jet à
        // relecture humaine, reste true partout).
        .map((r) => ({ ...r, valide: true }));
      nouveaux.push(...recs);
      console.log(`${recs.length} compétition(s) [${type}]`);
    } catch (e) {
      console.log(`ERREUR — ${e.message}`);
    }
  }

  // La ligue est une source transverse : ses épreuves ne dépendent d'aucun des
  // clubs suivis, on la collecte donc à part (sauf filtre explicite en argument).
  if (!filtre.length || filtre.includes("ligue")) {
    process.stdout.write("• Ligue Auvergne-Rhône-Alpes …\n");
    try {
      const source = await readJson(F_LIGUE, null);
      if (!source) throw new Error("data/ligue.json introuvable");
      const raws = await fetchLigueAura(source);
      const recs = raws
        .map((r) => toRecord(r, { id: "ligue", nom: "Ligue AURA" }, "ligue-aura", since))
        .filter((r) => r.date_debut && r.date_fin >= since)
        .map((r) => ({ ...r, valide: true }));
      nouveaux.push(...recs);
      console.log(`  → ${recs.length} épreuve(s) fédérale(s) à venir`);
    } catch (e) {
      console.log(`  ERREUR — ${e.message}`);
    }
  }

  // On élague avant de marquer : les compétitions passées ne servent plus (site
  // et digest ne montrent que l'à-venir) et faisaient enfler le fichier au fil
  // des collectes ; le type « equipes », abandonné, laissait des résidus que la
  // fusion perpétuait faute d'être recollectés.
  //
  // Sur une collecte COMPLÈTE, on retire aussi les clubs disparus de golfs.json :
  // sans cela, un club retiré laisserait ses compétitions futures indéfiniment,
  // la fusion ne les recollectant plus mais les conservant par id.
  const clubsConnus = new Set(
    (await readJson(F_GOLFS, [])).map((g) => g.id),
  );
  const collecteComplete = filtre.length === 0;
  const vivantes = merge(existants, nouveaux)
    .filter((c) => c.date_fin >= since && c.type !== "equipes")
    .filter((c) => !collecteComplete || c.type !== "club" || clubsConnus.has(c.golf_id));

  // La récurrence se juge sur l'ensemble du calendrier, pas source par source.
  // Les exclusions manuelles s'appliquent ensuite.
  const exclusions = (await readJson(F_EXCLUS, {})).motifs || [];
  const fusion = marquerExclusions(marquerRecurrences(vivantes), exclusions);
  await writeFile(F_COMPS, JSON.stringify(fusion, null, 2) + "\n");
  await writeFile(F_SITEDATA, `window.COMPETITIONS = ${JSON.stringify(fusion, null, 2)};\n`);

  // Ce que la page finit par montrer : ni équipe, ni fermée, ni exclue, ni soir.
  const masquees = fusion.filter((c) =>
    c.equipe || c.ouverte === false || c.exclu || c.moment === "soiree").length;
  const recurrentes = fusion.filter((c) => c.recurrent).length;
  console.log(`\n✔ ${fusion.length} compétitions collectées — ${fusion.length - masquees} affichables.`);
  console.log(`  écartées : ${masquees} (équipe, fermée, exclue ou soirée) · dont ${recurrentes} rendez-vous réguliers repérés.`);
  console.log(`  data/competitions.json et site/data.js mis à jour.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
