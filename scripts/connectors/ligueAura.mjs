// Connecteur Ligue Auvergne-Rhône-Alpes — épreuves fédérales.
//
// Contrairement aux autres connecteurs, celui-ci ne dépend pas d'un club :
// il lit une page par catégorie (grands prix, trophées seniors, classics
// mid-amateurs, compétitions d'équipe) et rattache chaque épreuve à son lieu.
//
// Le site tourne sous JEM (Joomla Event Manager) et publie du schema.org :
// les dates sont déjà au format ISO dans des <meta>, ce qui en fait la source
// la plus fiable du projet — plus qu'aucun site de club.

import { fetchTexte, decode } from "./html.mjs";
import { slug } from "../normalize.mjs";

const EVENEMENT = /<li class="jem-event jem-list-row([\s\S]*?)<\/li>/g;

function extraire(bloc) {
  const debut = bloc.match(/itemprop="startDate" content="([\d-]+)"/);
  const nom = bloc.match(/<meta itemprop="name" content="([^"]*)"/);
  if (!debut || !nom) return null;

  const fin = bloc.match(/itemprop="endDate" content="([\d-]+)"/);
  const lieu = bloc.match(/title="Lieu: ([^"]*)"/);
  const url = bloc.match(/<meta itemprop="url" content="([^"]*)"/);
  const ville = bloc.match(/itemprop="address" content="([^"]*)"/);

  return {
    nom: decode(nom[1]).trim(),
    date_debut: debut[1],
    date_fin: fin ? fin[1] : debut[1],
    lieu: lieu ? decode(lieu[1]).trim() : null,
    ville: ville ? decode(ville[1]).replace(/,\s*$/, "").trim() || null : null,
    url_inscription: url ? decode(url[1]) : null,
  };
}

async function lireCategorie(categorie) {
  const html = await fetchTexte(categorie.page);
  const out = [];

  for (const [, bloc] of html.matchAll(EVENEMENT)) {
    const e = extraire(bloc);
    if (!e) continue;
    out.push({
      ...e,
      type: categorie.type,
      // Le "golf" d'une épreuve fédérale est son lieu d'accueil. On le préfixe
      // pour qu'il ne se confonde pas avec les clubs suivis nominativement.
      golf_id: `ligue-${slug(e.lieu || categorie.type)}`,
      golf_nom: e.lieu || categorie.libelle,
      source_url: categorie.page,
    });
  }

  if (!out.length) {
    throw new Error(`aucune épreuve dans « ${categorie.libelle} » (balisage changé ?)`);
  }
  return out;
}

// `source` est l'entrée de data/ligue.json, pas un golf : la ligue est une
// source transverse et non un club de plus.
export async function fetchLigueAura(source) {
  const out = [];
  const soucis = [];

  for (const categorie of source.categories) {
    try {
      const epreuves = await lireCategorie(categorie);
      out.push(...epreuves);
      console.log(`   ↳ ${categorie.libelle} : ${epreuves.length}`);
    } catch (e) {
      // Une catégorie vide ne doit pas faire tomber les trois autres.
      soucis.push(`${categorie.libelle} (${e.message})`);
    }
  }

  if (!out.length) throw new Error(`toutes les catégories ont échoué — ${soucis.join(" ; ")}`);
  if (soucis.length) console.log(`   ⚠ catégories ignorées : ${soucis.join(" ; ")}`);
  return out;
}
