// validate.mjs — petit outil de relecture : liste les compétitions non validées,
// et permet de toutes les valider, ou d'en valider par golf.
// La page publique n'affiche QUE les compétitions valide:true.
//
//   node scripts/validate.mjs            -> liste ce qui reste à relire
//   node scripts/validate.mjs --all      -> tout valider
//   node scripts/validate.mjs --golf riom-> valider un golf
// Après validation, régénère aussi site/data.js.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const F_COMPS = join(ROOT, "data", "competitions.json");
const F_SITEDATA = join(ROOT, "site", "data.js");

const comps = JSON.parse(await readFile(F_COMPS, "utf8"));
const args = process.argv.slice(2);
const golfArg = args.includes("--golf") ? args[args.indexOf("--golf") + 1] : null;

if (args.includes("--all") || golfArg) {
  let n = 0;
  for (const c of comps) {
    if (c.valide) continue;
    if (golfArg && c.golf_id !== golfArg) continue;
    c.valide = true; n++;
  }
  await writeFile(F_COMPS, JSON.stringify(comps, null, 2) + "\n");
  await writeFile(F_SITEDATA, `window.COMPETITIONS = ${JSON.stringify(comps, null, 2)};\n`);
  console.log(`${n} compétition(s) validée(s). site/data.js régénéré.`);
} else {
  const areli = comps.filter((c) => !c.valide);
  if (!areli.length) { console.log("Rien à relire — tout est validé."); }
  else {
    console.log(`À relire (${areli.length}) :\n`);
    for (const c of areli) {
      console.log(`  [${c.golf_id}] ${c.date_debut}  ${c.nom}  — ${c.format || "?"}  ${c.sponsor ? "(sponsor: " + c.sponsor + ")" : ""}`);
    }
    console.log(`\nPour valider : node scripts/validate.mjs --all  (ou --golf <id>)`);
  }
}
