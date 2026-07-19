// Connecteur des calendriers publiés en image.
//
// Plusieurs clubs ne mettent en ligne qu'une affiche : une photo ou une image
// de leur tableau des compétitions. Aucun texte à lire, donc aucune collecte
// automatique possible. Les compétitions viennent d'une transcription rangée
// dans data/manuel/<fichier>.json.
//
// Le connecteur a deux rôles :
//   - restituer cette transcription comme n'importe quelle autre source ;
//   - surveiller l'affiche et prévenir dès que le club en publie une nouvelle,
//     afin que la transcription soit refaite plutôt que de vieillir en silence.
//
// La surveillance suppose que l'image figure dans le HTML servi. Sur les sites
// qui se construisent dans le navigateur (Mont-Dore), elle reste muette : on
// préfère le silence à une alerte quotidienne qui ne veut rien dire.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchTexte } from "./html.mjs";
import { toPlageISO } from "../normalize.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Retient les images qui ressemblent à un calendrier, en écartant logos et décor.
function imagesCalendrier(html) {
  const srcs = [...html.matchAll(/src="([^"]+\.(?:png|jpe?g|webp))"/gi)].map((m) => m[1]);
  return srcs.filter((s) => /calendrier|competition|compet/i.test(s));
}

// L'adresse d'une image peut porter une signature temporaire (CDN) : on ne
// compare que la partie stable, sinon l'alerte se déclencherait chaque jour.
function empreinte(url) {
  return String(url || "").split("?")[0];
}

export async function fetchCalendrierImage(golf) {
  const fichier = join(ROOT, "data", "manuel", `${golf.manuel || golf.id}.json`);
  const manuel = JSON.parse(await readFile(fichier, "utf8"));

  try {
    const trouvees = imagesCalendrier(await fetchTexte(golf.page)).map(empreinte);
    const connue = empreinte(manuel.image_source);
    if (trouvees.length && !trouvees.includes(connue)) {
      console.log(
        `   ⚠ ${golf.nom} : nouvelle affiche en ligne (${trouvees[0]}).\n` +
        `     La transcription date du ${manuel.releve_le} — à refaire ` +
        `dans data/manuel/${golf.manuel || golf.id}.json.`,
      );
    }
  } catch (e) {
    console.log(`   ⚠ ${golf.nom} : affiche non vérifiable (${e.message}) — transcription conservée.`);
  }

  return (manuel.competitions || []).map((c) => {
    const { debut, fin } = toPlageISO(c.date, manuel.annee);
    return {
      nom: c.nom,
      date_debut: debut,
      date_fin: fin,
      format: c.format ?? null,
      depart: c.depart ?? null,
      trous: c.trous ?? null,
      url_inscription: golf.page,
      source_url: manuel.image_source || golf.page,
    };
  });
}
