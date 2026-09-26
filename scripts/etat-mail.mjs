// Envoie à Laurent, chaque semaine, le tableau de bord de la collecte par mail.
// Contrairement à l'alerte (qui ne part qu'au basculement d'un golf dans le
// vide), celui-ci part toujours : c'est un point hebdo, pas une alarme.
//
//   BREVO_API_KEY=… node scripts/etat-mail.mjs
//   node scripts/etat-mail.mjs --apercu     (n'appelle pas Brevo, montre le texte)
//
// Le calcul est partagé avec la page via scripts/etat-donnees.mjs. La clé Brevo
// ne vit que dans les secrets GitHub ; on ne renvoie jamais l'en-tête.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { etatDesGolfs, frDate, echappe, SEUIL_A_SEC } from "./etat-donnees.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const F_REGLAGES = join(ROOT, "data", "newsletter.json");
const API = "https://api.brevo.com/v3";
const PAGE = "https://agendagolf.fr/etat.html";

const apercu = process.argv.includes("--apercu");

async function brevo(chemin, options = {}) {
  const cle = process.env.BREVO_API_KEY;
  if (!cle) throw new Error("BREVO_API_KEY absente de l'environnement");
  const res = await fetch(API + chemin, {
    ...options,
    headers: { "api-key": cle, "content-type": "application/json", accept: "application/json", ...(options.headers || {}) },
  });
  const corps = await res.text();
  if (!res.ok) throw new Error(`Brevo ${res.status} : ${corps}`);   // jamais l'en-tête
  return corps ? JSON.parse(corps) : {};
}

// Styles en ligne : les clients mail ignorent le plus souvent une feuille <style>.
const FOND = { vide: "#fde8e8", sec: "#fdf3e2", ok: "#ffffff" };
const cell = "padding:8px 10px;border-bottom:1px solid #e5e5e5;font-size:14px;";

function corpsHtml({ jour, golfs, lignes, resume }) {
  const rangs = lignes.map((l) => {
    const bg = FOND[l.etat.classe] || "#fff";
    const jsem = l.joursAvantSec !== null && l.aVenir ? ` <span style="color:#888">(J-${l.joursAvantSec})</span>` : "";
    const lien = l.g.page ? ` <a href="${echappe(l.g.page)}" style="color:#2a7">↗</a>` : "";
    return `<tr style="background:${bg}">
      <td style="${cell}font-weight:600">${echappe(l.g.nom)}</td>
      <td style="${cell}color:#888;font-family:monospace;font-size:12px">${echappe(l.g.connecteur)}</td>
      <td style="${cell}text-align:center">${l.aVenir}</td>
      <td style="${cell}white-space:nowrap">${frDate(l.horizon)}${jsem}</td>
      <td style="${cell}white-space:nowrap">${l.releve ? frDate(l.releve) : ""}</td>
      <td style="${cell}white-space:nowrap">${l.etat.txt}${lien}</td>
    </tr>`;
  }).join("");

  const th = "text-align:left;padding:8px 10px;background:#f5f5f5;font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:#666;border-bottom:1px solid #e5e5e5;";
  return `<div style="max-width:640px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a">
  <h2 style="font-size:19px;margin:0 0 4px">État de la collecte — point hebdo</h2>
  <p style="color:#666;font-size:13px;margin:0 0 16px">${golfs.length} golfs · ${resume.totalAVenir} compétitions à venir · <strong>${resume.nbVides} vide(s)</strong> · ${resume.nbSec} bientôt à sec · ${resume.ligueAVenir} grands prix ligue</p>
  <table style="width:100%;border-collapse:collapse">
    <thead><tr>
      <th style="${th}">Golf</th><th style="${th}">Connecteur</th><th style="${th}">À&nbsp;venir</th><th style="${th}">Dernière&nbsp;prog.</th><th style="${th}">Relevé</th><th style="${th}">État</th>
    </tr></thead>
    <tbody>${rangs}</tbody>
  </table>
  <p style="color:#888;font-size:12px;margin:16px 0 0">Relevé du ${frDate(jour)}. « Bientôt à sec » = dernière compétition dans ${SEUIL_A_SEC} jours ou moins. Version en ligne : <a href="${PAGE}" style="color:#2a7">${PAGE}</a></p>
</div>`;
}

async function principal() {
  const [reglages, etat] = await Promise.all([JSON.parse(await readFile(F_REGLAGES, "utf8")), etatDesGolfs()]);

  console.log(`État hebdo : ${etat.resume.nbVides} vide(s), ${etat.resume.nbSec} bientôt à sec.`);

  if (apercu) {
    console.log("\n--- Aperçu du mail (non envoyé) ---");
    console.log(corpsHtml(etat).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    return;
  }

  await brevo("/smtp/email", {
    method: "POST",
    body: JSON.stringify({
      sender: { name: reglages.expediteur.nom, email: reglages.expediteur.email },
      to: [{ email: reglages.repondre_a }],
      subject: `⛳ Agenda golf — état hebdo · ${etat.resume.nbVides} vide(s), ${etat.resume.nbSec} bientôt à sec`,
      htmlContent: corpsHtml(etat),
    }),
  });
  console.log(`Mail envoyé à ${reglages.repondre_a}.`);
}

principal().catch((e) => { console.error("État hebdo :", e.message); process.exit(1); });
