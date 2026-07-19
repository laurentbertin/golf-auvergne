// Connecteur Vichy Forêt de Montpensier — plugin Modern Events Calendar (MEC).
//
// La page /competitions/ n'affiche qu'un mois à la fois et sa navigation passe
// par un appel AJAX qui exige de rejouer toute la configuration du calendrier :
// trop fragile. On procède en deux temps, sur des points d'entrée stables :
//   1. l'API REST WordPress liste tous les événements (titre + lien) ;
//   2. chaque fiche porte sa date dans un attribut schema.org (itemprop="startDate").
//
// Une requête par fiche, une fois par jour : négligeable pour le club.

import { fetchTexte, fetchJson, texte } from "./html.mjs";
import { toPlageISO } from "../normalize.mjs";

const PAR_PAGE = 100;
const CONCURRENCE = 5; // on reste courtois avec le serveur du club

async function listerEvenements(base) {
  const out = [];
  for (let page = 1; page <= 5; page++) {
    const url = `${base}/wp-json/wp/v2/mec-events?per_page=${PAR_PAGE}&page=${page}&_fields=id,link,title`;
    let lot;
    try {
      lot = await fetchJson(url);
    } catch {
      break; // au-delà de la dernière page, WordPress répond 400
    }
    if (!Array.isArray(lot) || !lot.length) break;
    out.push(...lot);
    if (lot.length < PAR_PAGE) break;
  }
  return out;
}

async function dateDeLaFiche(lien) {
  try {
    const html = await fetchTexte(lien);
    // <span class="mec-start-date-label" itemprop="startDate">22 Juil 2026</span>
    const m = html.match(/itemprop="startDate"[^>]*>([^<]+)</);
    if (!m) return null;
    const heure = html.match(/class="mec-single-event-time[^"]*"[\s\S]{0,300}?(\d{1,2}\s*h\s*\d{2})/i);
    return { date: texte(m[1]), depart: heure ? texte(heure[1]) : null };
  } catch {
    return null;
  }
}

// Exécute les lectures de fiches par petits paquets plutôt qu'en rafale.
async function parPaquets(items, taille, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += taille) {
    out.push(...(await Promise.all(items.slice(i, i + taille).map(fn))));
  }
  return out;
}

export async function fetchMontpensier(golf) {
  const evenements = await listerEvenements(golf.base);
  if (!evenements.length) throw new Error("l'API REST ne renvoie aucun événement");

  const fiches = await parPaquets(evenements, CONCURRENCE, async (e) => {
    const detail = await dateDeLaFiche(e.link);
    if (!detail?.date) return null;
    // Les épreuves sur deux jours s'écrivent "06 - 07 Juin 2026" : on les résout ici,
    // le format brut n'étant pas reconnaissable par le parseur de date simple.
    const { debut, fin } = toPlageISO(detail.date);
    if (!debut) return null;
    return {
      nom: texte(e.title?.rendered || ""),
      date_debut: debut,
      date_fin: fin,
      format: null, // MEC ne porte pas la formule de jeu chez ce club
      depart: detail.depart,
      url_inscription: e.link,
      source_url: golf.page,
    };
  });

  const out = fiches.filter((f) => f && f.nom);
  if (!out.length) throw new Error("aucune date exploitable sur les fiches");
  return out;
}
