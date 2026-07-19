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
import { fetchForez } from "./connectors/forez.mjs";
import { fetchLigueAura } from "./connectors/ligueAura.mjs";
import { toRecord, merge, isoToday } from "./normalize.mjs";

// Chaque club a son propre outil de publication : un connecteur par site.
// Tous lisent du balisage régulier — aucun ne dépend d'un LLM.
const CONNECTEURS = {
  volcans: fetchVolcans,
  royat: fetchRoyat,
  valdauzon: fetchValdauzon,
  montpensier: fetchMontpensier,
  champlong: fetchChamplong,
  forez: fetchForez,
  "calendrier-image": fetchCalendrierImage,
};

// Import paresseux : le connecteur LLM (et sa dépendance @anthropic-ai/sdk) n'est
// chargé que si un golf en a besoin. Ainsi la collecte des golfs structurés
// (Vichy…) tourne sans aucune installation.
async function loadHtmlLlm() {
  const m = await import("./connectors/htmlLlm.mjs");
  return m.fetchHtmlLlm;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const F_GOLFS = join(ROOT, "data", "golfs.json");
const F_LIGUE = join(ROOT, "data", "ligue.json");
const F_COMPS = join(ROOT, "data", "competitions.json");
const F_SITEDATA = join(ROOT, "site", "data.js");

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch { return fallback; }
}

async function collectGolf(golf, since) {
  const mode = golf.connecteur || "auto";

  const dedie = CONNECTEURS[mode];
  if (dedie) return { raws: await dedie(golf), type: mode };

  if (mode === "events-calendar") {
    return { raws: await fetchEventsCalendar(golf, since), type: "events-calendar" };
  }
  if (mode === "html-llm") {
    const fetchHtmlLlm = await loadHtmlLlm();
    return { raws: await fetchHtmlLlm(golf), type: "html-llm" };
  }
  // auto : structuré d'abord, LLM en secours
  try {
    return { raws: await fetchEventsCalendar(golf, since), type: "events-calendar" };
  } catch (e) {
    console.log(`   ↳ Events Calendar KO (${e.message}) → bascule LLM`);
    const fetchHtmlLlm = await loadHtmlLlm();
    return { raws: await fetchHtmlLlm(golf), type: "html-llm" };
  }
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
        // Tout ce qui est lu dans du balisage régulier (flux structuré ou
        // connecteur dédié) est fiable -> publié automatiquement.
        // Seule une extraction par IA resterait en attente de relecture humaine.
        .map((r) => (r.source_type === "html-llm" ? r : { ...r, valide: true }));
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

  const fusion = merge(existants, nouveaux);
  await writeFile(F_COMPS, JSON.stringify(fusion, null, 2) + "\n");
  await writeFile(F_SITEDATA, `window.COMPETITIONS = ${JSON.stringify(fusion, null, 2)};\n`);

  const valides = fusion.filter((c) => c.valide).length;
  console.log(`\n✔ ${fusion.length} compétitions au total — ${valides} validées (affichées), ${fusion.length - valides} à relire.`);
  console.log(`  data/competitions.json et site/data.js mis à jour.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
