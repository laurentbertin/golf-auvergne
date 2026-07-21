// Générateur du digest hebdomadaire — « Les compétitions de la semaine ».
//
// Lit data/competitions.json et produit un email HTML autonome, prêt à être
// déposé comme brouillon de campagne. Ce script n'envoie RIEN et ne contacte
// aucun service : il écrit un fichier, qu'on relit avant de l'utiliser.
//
//   node scripts/digest.mjs            -> dist/digest.html + dist/digest.txt
//   node scripts/digest.mjs --jours 7  -> fenêtre de 7 jours au lieu de 14
//   node scripts/digest.mjs --ligue    -> ajoute les épreuves fédérales
//   node scripts/digest.mjs --depuis 3 -> fenêtre décalée (relecture avant envoi)
//
// Le mail est écrit en HTML de messagerie, pas en HTML de site : styles en
// ligne, tableaux, largeur fixe. Les clients de messagerie ignorent les
// feuilles de style externes, flexbox et grid.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const F_COMPS = join(ROOT, "data", "competitions.json");
const D_SORTIE = join(ROOT, "dist");

const SITE = "https://agendagolf.fr/";

// Fenêtre par défaut : 14 jours. Les inscriptions ferment souvent 1 à 2 jours
// avant l'épreuve — n'annoncer que 7 jours laisserait peu de marge pour
// s'organiser, surtout pour un déplacement.
const JOURS_PAR_DEFAUT = 14;

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
  "août", "septembre", "octobre", "novembre", "décembre"];
const JOURS_SEMAINE = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

const LIBELLE_TYPE = {
  "grand-prix": "Grand Prix",
  "seniors": "Trophée Seniors",
  "mid-amateurs": "Classic Mid-Am",
  "equipes": "Compétition d'équipe",
};

function argJours() {
  const i = process.argv.indexOf("--jours");
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : JOURS_PAR_DEFAUT;
}

// Premier jour annoncé. Vaut 1 (demain) pour une lecture immédiate, davantage
// quand le numéro est préparé plusieurs jours avant d'être envoyé : sans ce
// décalage, il listerait des compétitions déjà jouées à la lecture.
function argDepuis() {
  const i = process.argv.indexOf("--depuis");
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) && v >= 1 ? v : 1;
}

function dateDans(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function esc(s = "") {
  return String(s).replace(/[&<>"]/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
}

function enLettres(iso) {
  const d = new Date(iso + "T12:00:00");
  return `${JOURS_SEMAINE[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}

// ------------------------------------------------------------------ données
async function selection(jours, avecLigue, depuis = 1) {
  const toutes = JSON.parse(await readFile(F_COMPS, "utf8"));
  const debut = dateDans(depuis);     // pas le jour même : inscriptions closes
  const fin = dateDans(jours);

  return toutes
    .filter((c) => c.valide)
    // Mêmes exclusions que le site : ni équipe, ni fermée, ni écartée à la main.
    .filter((c) => !c.equipe && c.ouverte !== false && !c.exclu)
    // Les épreuves fédérales sont hors périmètre par défaut : elles se tiennent
    // dans toute la région, souvent à plus de deux heures, et relèvent d'une
    // démarche volontaire plutôt que d'un agenda de semaine.
    .filter((c) => avecLigue || c.type === "club")
    .filter((c) => c.date_debut >= debut && c.date_debut <= fin)
    // Les épreuves du soir ne sont pas ce qu'on cherche pour planifier sa semaine.
    .filter((c) => c.moment !== "soiree")
    .sort((a, b) => (a.date_debut === b.date_debut
      ? a.golf_nom.localeCompare(b.golf_nom)
      : a.date_debut < b.date_debut ? -1 : 1));
}

function grouperParJour(liste) {
  const jours = new Map();
  for (const c of liste) {
    if (!jours.has(c.date_debut)) jours.set(c.date_debut, []);
    jours.get(c.date_debut).push(c);
  }
  return [...jours.entries()];
}

// Ce qui décrit la compétition sous son nom : formule, lieu, catégorie.
function details(c) {
  const bouts = [];
  if (c.type !== "club") bouts.push(LIBELLE_TYPE[c.type] || c.type);
  bouts.push(c.golf_nom);
  if (c.zone) bouts.push(c.zone);
  const formule = c.format || (c.formule_deduite ? "individuel (supposé)" : null);
  if (formule) bouts.push(formule);
  if (c.depart) bouts.push(c.depart);
  return bouts.filter(Boolean).join(" · ");
}

// -------------------------------------------------------------------- HTML
function ligneCompetition(c) {
  const lien = c.url_inscription
    ? `<a href="${esc(c.url_inscription)}" style="color:#1f7d52;text-decoration:none;font-weight:600;white-space:nowrap">Voir&nbsp;&rsaquo;</a>`
    : "";
  const plage = c.date_fin && c.date_fin !== c.date_debut
    ? ` <span style="color:#8a9a91">→ ${new Date(c.date_fin + "T12:00:00").getDate()}</span>` : "";
  return `
        <tr>
          <td style="padding:9px 0;border-bottom:1px solid #eaefec;font-family:Helvetica,Arial,sans-serif">
            <div style="font-size:15px;font-weight:700;color:#12211a">${esc(c.nom)}${plage}</div>
            <div style="font-size:13px;color:#5c7166;margin-top:2px">${esc(details(c))}</div>
          </td>
          <td style="padding:9px 0 9px 12px;border-bottom:1px solid #eaefec;text-align:right;vertical-align:top;font-family:Helvetica,Arial,sans-serif;font-size:13px">${lien}</td>
        </tr>`;
}

function blocJour(iso, comps) {
  return `
      <tr><td colspan="2" style="padding:20px 0 4px;font-family:Helvetica,Arial,sans-serif;
        font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9a6f16">
        ${esc(enLettres(iso))}
      </td></tr>${comps.map(ligneCompetition).join("")}`;
}

function construireHtml(groupes, total, jours, depuis) {
  const periode = `du ${enLettres(dateDans(depuis))} au ${enLettres(dateDans(jours))}`;
  const corps = groupes.map(([iso, comps]) => blocJour(iso, comps)).join("");

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Les compétitions de la semaine</title></head>
<body style="margin:0;padding:0;background:#f4f7f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f5">
<tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0"
         style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">

    <tr><td style="padding:26px 26px 18px;background:#12211a">
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#ffffff">
        ⛳ Les compétitions de la semaine
      </div>
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#9db0a4;margin-top:5px">
        ${esc(periode)} — ${total} compétition${total > 1 ? "s" : ""}
      </div>
    </td></tr>

    <tr><td style="padding:0 26px 22px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${corps}
      </table>
    </td></tr>

    <tr><td style="padding:18px 26px 24px;background:#f4f7f5;
        font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#5c7166;line-height:1.55">
      <p style="margin:0 0 8px">
        Toutes les compétitions, avec les filtres par golf et par formule :
        <a href="${SITE}" style="color:#1f7d52">agenda des golfeurs</a>.
      </p>
      <p style="margin:0 0 8px">
        Données relevées automatiquement sur les sites des clubs. Vérifiez toujours
        l'horaire auprès du golf avant de vous déplacer.
      </p>
      <p style="margin:0;color:#8a9a91">
        Vous recevez cet email parce que vous vous y êtes inscrit.
        <a href="{{ unsubscribe }}" style="color:#8a9a91">Se désinscrire</a>.
      </p>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;
}

// -------------------------------------------------------------- texte brut
// Toujours fournir une version texte : certains clients l'affichent, et son
// absence pénalise la délivrabilité.
function construireTexte(groupes, total, jours, depuis) {
  const lignes = [
    "LES COMPÉTITIONS DE LA SEMAINE",
    `${`du ${enLettres(dateDans(depuis))} au ${enLettres(dateDans(jours))}`} — ${total} compétition${total > 1 ? "s" : ""}`,
    "",
  ];
  for (const [iso, comps] of groupes) {
    lignes.push(enLettres(iso).toUpperCase());
    for (const c of comps) {
      lignes.push(`  ${c.nom}`);
      lignes.push(`    ${details(c)}`);
      if (c.url_inscription) lignes.push(`    ${c.url_inscription}`);
    }
    lignes.push("");
  }
  lignes.push(`Toutes les compétitions : ${SITE}`);
  lignes.push("Se désinscrire : {{ unsubscribe }}");
  return lignes.join("\n");
}

// -------------------------------------------------------------------- main
async function main() {
  const jours = argJours();
  const avecLigue = process.argv.includes("--ligue");
  const depuis = argDepuis();
  const liste = await selection(jours, avecLigue, depuis);
  const groupes = grouperParJour(liste);

  await mkdir(D_SORTIE, { recursive: true });
  await writeFile(join(D_SORTIE, "digest.html"), construireHtml(groupes, liste.length, jours, depuis));
  await writeFile(join(D_SORTIE, "digest.txt"), construireTexte(groupes, liste.length, jours, depuis));

  const clubs = new Set(liste.map((c) => c.golf_nom));
  console.log(`Digest sur ${jours} jours : ${liste.length} compétition(s), ` +
    `${groupes.length} jour(s), ${clubs.size} club(s)` +
    `${avecLigue ? ", épreuves fédérales incluses" : ""}.`);
  console.log("  dist/digest.html et dist/digest.txt écrits — aucun envoi, aucun appel réseau.");
  if (!liste.length) {
    console.log("  ⚠ Fenêtre vide : ne pas créer de campagne.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
