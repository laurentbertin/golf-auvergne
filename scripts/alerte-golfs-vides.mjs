// Prévient Laurent quand un golf suivi n'affiche plus AUCUNE compétition à venir.
//
//   BREVO_API_KEY=… node scripts/alerte-golfs-vides.mjs
//   node scripts/alerte-golfs-vides.mjs --apercu   (n'appelle pas Brevo, montre juste)
//
// Pourquoi ce garde-fou : un golf vide n'est pas toujours un bug. En fin de
// saison, un club s'arrête normalement. Mais un calendrier-image dont l'affiche
// a changé (cf. Riom) devient vide en silence, et personne ne le voit.
//
// Anti-spam : on n'envoie un mail que lorsqu'un golf BASCULE dans le vide —
// jamais tant qu'il y reste, sinon ce serait un mail par jour tout l'hiver.
// L'état précédent vit dans data/etat-alertes.json, versionné, et l'Action le
// committe après chaque passage.
//
// La clé Brevo ne vit que dans les secrets GitHub : ni dans le dépôt, ni dans
// les journaux (on ne renvoie jamais l'en-tête qui la porte).

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const F_GOLFS = join(ROOT, "data", "golfs.json");
const F_COMPS = join(ROOT, "data", "competitions.json");
const F_REGLAGES = join(ROOT, "data", "newsletter.json");
const F_ETAT = join(ROOT, "data", "etat-alertes.json");
const API = "https://api.brevo.com/v3";

const apercu = process.argv.includes("--apercu");

const lire = async (f, secours = null) => {
  try { return JSON.parse(await readFile(f, "utf8")); }
  catch (e) { if (secours !== null) return secours; throw e; }
};

function aujourdhui() {
  return new Date().toISOString().slice(0, 10);   // AAAA-MM-JJ (UTC, suffisant ici)
}

async function brevo(chemin, options = {}) {
  const cle = process.env.BREVO_API_KEY;
  if (!cle) throw new Error("BREVO_API_KEY absente de l'environnement");
  const res = await fetch(API + chemin, {
    ...options,
    headers: {
      "api-key": cle,
      "content-type": "application/json",
      accept: "application/json",
      ...(options.headers || {}),
    },
  });
  const corps = await res.text();
  if (!res.ok) throw new Error(`Brevo ${res.status} : ${corps}`);   // jamais l'en-tête
  return corps ? JSON.parse(corps) : {};
}

function corpsHtml(nouveauxVides, golfsById, jour) {
  const ligne = (id) => {
    const g = golfsById[id];
    const page = g.page || g.base || "";
    const lien = page ? ` — <a href="${page}">voir son calendrier</a>` : "";
    return `<li><strong>${g.nom}</strong> <em>(${g.connecteur})</em>${lien}</li>`;
  };
  return `<p>Bonjour Laurent,</p>
<p>Ces golfs suivis par Agenda golf n'affichent plus aucune compétition à venir. À vérifier — souvent une affiche qui a changé (comme Riom), parfois une fin de saison normale :</p>
<ul>${nouveauxVides.map(ligne).join("")}</ul>
<p style="color:#666;font-size:13px">Relevé du ${jour}. Vous ne recevrez plus de mail pour ces golfs tant qu'ils restent vides ; un nouveau mail partira si un autre golf bascule à son tour.</p>`;
}

async function principal() {
  const [golfs, comps, reglages, etat] = await Promise.all([
    lire(F_GOLFS),
    lire(F_COMPS),
    lire(F_REGLAGES),
    lire(F_ETAT, { golfs_vides: [] }),
  ]);

  const jour = aujourdhui();
  const golfsById = Object.fromEntries(golfs.map((g) => [g.id, g]));

  // Un golf est « vide » s'il n'a aucune compétition datée d'aujourd'hui ou après.
  const aVenir = new Set();
  for (const c of comps) if ((c.date_debut || "") >= jour) aVenir.add(c.golf_id);
  const vides = golfs.filter((g) => !aVenir.has(g.id)).map((g) => g.id);

  const avant = new Set(etat.golfs_vides || []);
  const nouveauxVides = vides.filter((id) => !avant.has(id));
  const revenus = [...avant].filter((id) => !vides.includes(id) && golfsById[id]);

  // Journal (visible dans l'Action)
  console.log(`Golfs vides : ${vides.length ? vides.join(", ") : "aucun"}`);
  if (revenus.length) console.log(`Revenus avec des compètes : ${revenus.join(", ")}`);
  if (nouveauxVides.length) console.log(`⚠ Nouveaux golfs vides : ${nouveauxVides.join(", ")}`);

  // On écrit l'état AVANT l'envoi : même si le mail échoue, on ne réalertera pas
  // en boucle pour les mêmes golfs. La perte d'une alerte vaut mieux qu'un spam.
  await writeFile(F_ETAT, JSON.stringify({
    _lisezmoi: "Golfs sans compétition à venir au dernier passage. Sert à n'alerter qu'au basculement, jamais en boucle. Réécrit par scripts/alerte-golfs-vides.mjs.",
    maj: jour,
    golfs_vides: vides,
  }, null, 2) + "\n");

  if (!nouveauxVides.length) { console.log("Rien à signaler."); return; }

  if (apercu) {
    console.log("\n--- Aperçu du mail (non envoyé) ---");
    console.log(corpsHtml(nouveauxVides, golfsById, jour).replace(/<[^>]+>/g, ""));
    return;
  }

  await brevo("/smtp/email", {
    method: "POST",
    body: JSON.stringify({
      sender: { name: reglages.expediteur.nom, email: reglages.expediteur.email },
      to: [{ email: reglages.repondre_a }],
      subject: `⛳ Agenda golf — ${nouveauxVides.length} golf(s) sans compétition à venir`,
      htmlContent: corpsHtml(nouveauxVides, golfsById, jour),
    }),
  });
  console.log(`Mail envoyé à ${reglages.repondre_a}.`);
}

principal().catch((e) => { console.error("Alerte golfs vides :", e.message); process.exit(1); });
