// Connecteur Golf de Riom — calendrier publié sous forme d'image.
//
// Le club met en ligne une photo de son tableau des compétitions : aucun texte
// à lire, donc aucune collecte automatique possible. Les compétitions viennent
// d'une transcription manuelle (data/manuel/riom.json).
//
// Le rôle du connecteur est double :
//   - restituer cette transcription comme n'importe quelle autre source ;
//   - surveiller l'image et prévenir dès que le club en publie une nouvelle,
//     afin que la transcription soit refaite plutôt que de vieillir en silence.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchTexte } from "./html.mjs";
import { toPlageISO } from "../normalize.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const F_MANUEL = join(ROOT, "data", "manuel", "riom.json");

// Retient les images qui ressemblent à un calendrier, en écartant logos et décor.
function imagesCalendrier(html) {
  const srcs = [...html.matchAll(/src="([^"]+\.(?:png|jpe?g|webp))"/gi)].map((m) => m[1]);
  return srcs.filter((s) => /calendrier|competition/i.test(s));
}

export async function fetchRiom(golf) {
  const manuel = JSON.parse(await readFile(F_MANUEL, "utf8"));

  // Surveillance : l'image en ligne correspond-elle encore à ce qu'on a transcrit ?
  try {
    const trouvees = imagesCalendrier(await fetchTexte(golf.page));
    if (trouvees.length && !trouvees.includes(manuel.image_source)) {
      console.log(
        `   ⚠ Riom : nouvelle image de calendrier en ligne (${trouvees[0]}).\n` +
        `     La transcription date du ${manuel.releve_le} — à refaire ` +
        `dans data/manuel/riom.json.`,
      );
    }
  } catch (e) {
    console.log(`   ⚠ Riom : image non vérifiable (${e.message}) — transcription conservée.`);
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
