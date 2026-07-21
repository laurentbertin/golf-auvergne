// Dépose le digest hebdomadaire comme campagne EN BROUILLON dans Brevo.
//
// Ce script n'envoie JAMAIS d'e-mail. Il crée une campagne que Laurent relit
// puis expédie lui-même depuis Brevo. L'envoi automatique viendra plus tard, une
// fois la confiance établie — et ce sera un changement explicite, pas un effet
// de bord de ce script.
//
//   BREVO_API_KEY=… node scripts/campagne.mjs
//   BREVO_API_KEY=… node scripts/campagne.mjs --apercu   (n'appelle pas Brevo)
//
// La clé ne vit que dans les secrets GitHub : elle n'apparaît ni dans le dépôt,
// ni dans les journaux d'exécution.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const F_REGLAGES = join(ROOT, "data", "newsletter.json");
const API = "https://api.brevo.com/v3";

const apercu = process.argv.includes("--apercu");

// Une quinzaine, pas une semaine : on s'inscrit à une compétition plusieurs
// jours à l'avance, et un e-mail hebdomadaire finirait par lasser pour un
// calendrier qui bouge peu.
//
// cron ne sait pas dire « une semaine sur deux » : on programme donc tous les
// jeudis et on saute les semaines impaires. L'envoi tombe ainsi toujours un
// jeudi, au lieu de dériver dans le mois. Un déclenchement manuel passe outre.
function semaineISO(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));   // jeudi de la semaine
  const jourAn = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - jourAn) / 86400000 + 1) / 7);
}

function semaineDEnvoi() {
  if (process.env.DECLENCHEMENT === "workflow_dispatch") return true;  // à la demande
  return semaineISO() % 2 === 0;
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
  if (!res.ok) {
    // On ne renvoie que le message de Brevo : jamais l'en-tête, qui porte la clé.
    throw new Error(`Brevo ${res.status} sur ${chemin} — ${corps.slice(0, 300)}`);
  }
  return corps ? JSON.parse(corps) : {};
}

// Retrouve l'identifiant de la liste à partir de son nom, en parcourant les
// pages si le compte en contient beaucoup.
async function idDeLaListe(nom) {
  const toutes = [];
  for (let offset = 0; offset < 500; offset += 50) {
    const { lists = [] } = await brevo(`/contacts/lists?limit=50&offset=${offset}`);
    toutes.push(...lists);
    if (lists.length < 50) break;
  }
  const trouvee = toutes.find(
    (l) => l.name.trim().toLowerCase() === nom.trim().toLowerCase());
  if (trouvee) return { id: trouvee.id, abonnes: trouvee.totalSubscribers };

  // Se tromper de nom est l'erreur la plus probable : autant afficher ce qui
  // existe plutôt que de laisser chercher dans l'interface.
  const dispo = toutes.length
    ? toutes.map((l) => `      « ${l.name} » (${l.totalSubscribers} abonné(s))`).join("\n")
    : "      (ce compte ne contient aucune liste)";
  throw new Error(
    `aucune liste nommée « ${nom} ».\n    Listes disponibles :\n${dispo}\n` +
    `    Corrige le champ « liste » dans data/newsletter.json.`);
}

function nomDeCampagne(reglages) {
  const d = new Date();
  const jj = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${reglages.objet} — ${jj}/${mm}/${d.getFullYear()}`;
}

async function main() {
  const reglages = JSON.parse(await readFile(F_REGLAGES, "utf8"));

  if (!semaineDEnvoi()) {
    console.log(`⏭ Semaine ${semaineISO()} (impaire) : pas de numéro cette semaine, ` +
      `le digest paraît une quinzaine sur deux.`);
    return;
  }

  // On régénère le digest à l'instant : la campagne doit refléter les données
  // du jour, pas un fichier oublié dans dist/.
  const execFileP = promisify(execFile);
  const { stdout } = await execFileP(process.execPath,
    [join(ROOT, "scripts", "digest.mjs"), "--jours", String(reglages.jours)]);
  process.stdout.write(stdout);

  const html = await readFile(join(ROOT, "dist", "digest.html"), "utf8");
  const nbCompetitions = (html.match(/<tr>\s*<td style="padding:9px 0/g) || []).length;

  // Une semaine sans compétition arrive (creux de saison) : on ne crée pas une
  // campagne vide, qui ne servirait qu'à user la patience des abonnés.
  if (nbCompetitions === 0) {
    console.log("\n⏹ Aucune compétition sur la période : pas de brouillon créé.");
    return;
  }

  if (apercu) {
    console.log(`\n👁 Aperçu seul : ${nbCompetitions} compétitions, aucun appel à Brevo.`);
    return;
  }

  const { id: listId, abonnes } = await idDeLaListe(reglages.liste);
  console.log(`\n• Liste « ${reglages.liste} » : ${abonnes} abonné(s) confirmé(s)`);

  const campagne = await brevo("/emailCampaigns", {
    method: "POST",
    body: JSON.stringify({
      name: nomDeCampagne(reglages),
      subject: reglages.objet,
      sender: { name: reglages.expediteur.nom, email: reglages.expediteur.email },
      replyTo: reglages.repondre_a,
      htmlContent: html,
      recipients: { listIds: [listId] },
      // Ni scheduledAt ni sendNow : la campagne reste en brouillon.
      inlineImageActivation: false,
    }),
  });

  console.log(`✔ Brouillon créé (campagne ${campagne.id}) — ${nbCompetitions} compétitions.`);
  console.log("  Rien n'a été envoyé. Relis-la dans Brevo puis expédie-la toi-même :");
  console.log(`  https://app.brevo.com/camp/message/${campagne.id}`);
}

main().catch((e) => { console.error(`✖ ${e.message}`); process.exit(1); });
