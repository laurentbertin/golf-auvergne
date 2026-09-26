// Le calcul de l'état de la collecte, partagé par la page (scripts/etat.mjs) et
// le mail hebdo (scripts/etat-mail.mjs). Un seul endroit pour la logique, sinon
// les deux vues finiraient par se contredire.

import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const F_GOLFS = join(ROOT, "data", "golfs.json");
const F_COMPS = join(ROOT, "data", "competitions.json");
const D_MANUEL = join(ROOT, "data", "manuel");

export const SEUIL_A_SEC = 21;   // jours : en deçà, le calendrier est « bientôt à sec »

const lire = async (f) => JSON.parse(await readFile(f, "utf8"));
export const jourISO = (d = new Date()) => d.toISOString().slice(0, 10);
export const echappe = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function frDate(iso) {
  if (!iso) return "—";
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a.slice(2)}`;
}

async function relevesManuels() {
  const map = {};
  let fichiers = [];
  try { fichiers = await readdir(D_MANUEL); } catch { return map; }
  for (const f of fichiers) {
    if (!f.endsWith(".json")) continue;
    try {
      const d = JSON.parse(await readFile(join(D_MANUEL, f), "utf8"));
      map[f.replace(/\.json$/, "")] = d.releve_le || null;
    } catch { /* fichier illisible : on l'ignore */ }
  }
  return map;
}

function drapeau(aVenir, joursAvantSec) {
  if (aVenir === 0) return { cle: 0, txt: "🔴 vide", classe: "vide" };
  if (joursAvantSec !== null && joursAvantSec <= SEUIL_A_SEC) return { cle: 1, txt: "🟠 bientôt à sec", classe: "sec" };
  return { cle: 2, txt: "🟢 ok", classe: "ok" };
}

// Renvoie { jour, golfs, lignes, resume }. lignes est trié « le plus à
// surveiller d'abord » : vides, puis bientôt à sec, puis par horizon.
export async function etatDesGolfs() {
  const [golfs, comps, releves] = await Promise.all([lire(F_GOLFS), lire(F_COMPS), relevesManuels()]);
  const jour = jourISO();
  const auj = new Date(jour + "T00:00:00Z");

  const parGolf = {};
  for (const g of golfs) parGolf[g.id] = { aVenir: 0, horizon: null };
  let ligueAVenir = 0;
  for (const c of comps) {
    if ((c.date_debut || "") < jour) continue;
    if (parGolf[c.golf_id]) {
      parGolf[c.golf_id].aVenir++;
      if (!parGolf[c.golf_id].horizon || c.date_debut > parGolf[c.golf_id].horizon) parGolf[c.golf_id].horizon = c.date_debut;
    } else if (c.golf_id.startsWith("ligue-")) {
      ligueAVenir++;
    }
  }

  const lignes = golfs.map((g) => {
    const { aVenir, horizon } = parGolf[g.id];
    const joursAvantSec = horizon ? Math.round((new Date(horizon + "T00:00:00Z") - auj) / 86400000) : null;
    return { g, aVenir, horizon, joursAvantSec, releve: releves[g.id], etat: drapeau(aVenir, joursAvantSec) };
  });
  lignes.sort((a, b) => a.etat.cle - b.etat.cle || (a.horizon || "9999").localeCompare(b.horizon || "9999") || a.g.nom.localeCompare(b.g.nom));

  const resume = {
    nbVides: lignes.filter((l) => l.aVenir === 0).length,
    nbSec: lignes.filter((l) => l.etat.classe === "sec").length,
    totalAVenir: lignes.reduce((s, l) => s + l.aVenir, 0),
    ligueAVenir,
  };

  return { jour, golfs, lignes, resume };
}
