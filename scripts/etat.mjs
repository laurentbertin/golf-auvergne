// Génère site/etat.html : un tableau de bord en lecture seule de la santé de la
// collecte, un golf par ligne. Régénéré à chaque passage de l'Action.
//
//   node scripts/etat.mjs
//
// À quoi ça sert : voir d'un coup d'œil quel golf n'affiche plus rien, lequel
// est bientôt à sec, et depuis quand date la dernière transcription manuelle.
// C'est ce qui manquait quand l'affiche de Riom a changé sans que personne ne
// le voie pendant deux mois. Aucune donnée sensible : la page est simplement
// tenue hors des moteurs (noindex + robots) parce qu'elle n'intéresse que toi.
//
// Le calcul vit dans scripts/etat-donnees.mjs, partagé avec le mail hebdo.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { etatDesGolfs, frDate, echappe, SEUIL_A_SEC } from "./etat-donnees.mjs";

const F_SORTIE = join(dirname(fileURLToPath(import.meta.url)), "..", "site", "etat.html");

async function principal() {
  const { jour, golfs, lignes, resume } = await etatDesGolfs();

  const rangs = lignes.map((l) => `      <tr class="${l.etat.classe}">
        <td class="nom">${echappe(l.g.nom)}</td>
        <td>${echappe(l.g.zone || "—")}</td>
        <td class="type">${echappe(l.g.connecteur)}</td>
        <td class="num">${l.aVenir}</td>
        <td class="date">${frDate(l.horizon)}${l.joursAvantSec !== null && l.aVenir ? ` <span class="j">(J-${l.joursAvantSec})</span>` : ""}</td>
        <td class="date">${l.releve ? frDate(l.releve) : ""}</td>
        <td class="etat">${l.etat.txt}${l.g.page ? ` <a href="${echappe(l.g.page)}">↗</a>` : ""}</td>
      </tr>`).join("\n");

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>État — Agenda golf</title>
<style>
  :root { color-scheme: light dark;
    --fond:#fff; --texte:#1a1a1a; --doux:#666; --trait:#e5e5e5; --entete:#f5f5f5;
    --vide:#fde8e8; --sec:#fdf3e2; }
  @media (prefers-color-scheme: dark) { :root {
    --fond:#161616; --texte:#eaeaea; --doux:#9a9a9a; --trait:#2c2c2c; --entete:#1f1f1f;
    --vide:#3a1e1e; --sec:#382c18; } }
  * { box-sizing:border-box; }
  body { margin:0; padding:24px 16px 48px; background:var(--fond); color:var(--texte);
    font:15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width:920px; margin:0 auto; }
  h1 { font-size:22px; margin:0 0 4px; }
  .sous { color:var(--doux); font-size:13px; margin:0 0 20px; }
  .resume { display:flex; flex-wrap:wrap; gap:10px 20px; margin:0 0 20px; font-size:14px; }
  .resume b { font-size:20px; display:block; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:left; padding:9px 10px; border-bottom:1px solid var(--trait); }
  th { background:var(--entete); font-size:12px; text-transform:uppercase; letter-spacing:.03em; color:var(--doux); position:sticky; top:0; }
  .nom { font-weight:600; }
  .type { color:var(--doux); font-family:ui-monospace, monospace; font-size:12px; }
  .num, .date { white-space:nowrap; }
  .num { text-align:center; font-variant-numeric:tabular-nums; }
  .j { color:var(--doux); font-size:12px; }
  tr.vide { background:var(--vide); }
  tr.sec { background:var(--sec); }
  .etat a, .nom a { text-decoration:none; }
  footer { color:var(--doux); font-size:12px; margin-top:20px; }
  @media (max-width:640px) { th:nth-child(2), td:nth-child(2) { display:none; } }
</style>
</head>
<body>
<main>
  <h1>État de la collecte</h1>
  <p class="sous">Tableau de bord interne d'agendagolf.fr — les golfs les plus à surveiller en haut.</p>
  <div class="resume">
    <span><b>${golfs.length}</b> golfs suivis</span>
    <span><b>${resume.totalAVenir}</b> compétitions à venir</span>
    <span><b>${resume.nbVides}</b> vides</span>
    <span><b>${resume.nbSec}</b> bientôt à sec</span>
    <span><b>${resume.ligueAVenir}</b> grands prix ligue</span>
  </div>
  <table>
    <thead>
      <tr><th>Golf</th><th>Zone</th><th>Connecteur</th><th>À venir</th><th>Dernière prog.</th><th>Relevé manuel</th><th>État</th></tr>
    </thead>
    <tbody>
${rangs}
    </tbody>
  </table>
  <footer>Généré le ${frDate(jour)}. « Bientôt à sec » = dernière compétition programmée dans ${SEUIL_A_SEC} jours ou moins. « Relevé manuel » ne concerne que les golfs en connecteur <code>calendrier-image</code>.</footer>
</main>
</body>
</html>
`;

  await writeFile(F_SORTIE, html);
  console.log(`site/etat.html écrit — ${golfs.length} golfs, ${resume.nbVides} vide(s), ${resume.nbSec} bientôt à sec.`);
}

principal().catch((e) => { console.error("État :", e.message); process.exit(1); });
