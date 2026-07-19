// normalize.mjs — utilitaires de normalisation partagés par tous les connecteurs.
// Aucune dépendance externe.

// Enlève les accents et met en slug URL-safe.
export function slug(str = "") {
  return String(str)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

// id déterministe : golf + date + nom  → sert à dédupliquer et à repérer les changements.
export function makeId(golfId, dateDebut, nom) {
  return `${golfId}__${dateDebut}__${slug(nom)}`;
}

// Mois de référence, sans accents (les entrées sont désaccentuées avant comparaison).
const MOIS_CANON = [
  "janvier", "fevrier", "mars", "avril", "mai", "juin",
  "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
];

// Résout un nom de mois FR, complet ou abrégé : "juillet", "juil", "Juil.", "sept", "fév"…
// Les sites des clubs abrègent chacun à leur façon, d'où la comparaison par préfixe.
// "juin"/"juillet" partagent le préfixe "jui" : on exige alors une levée d'ambiguïté.
function moisVers(numero) {
  const n = String(numero || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\.$/, "").trim();
  if (!n) return null;
  const exact = MOIS_CANON.indexOf(n);
  if (exact >= 0) return exact + 1;
  const candidats = MOIS_CANON.filter((m) => m.startsWith(n));
  return candidats.length === 1 ? MOIS_CANON.indexOf(candidats[0]) + 1 : null;
}

// Parse une date FR vers ISO YYYY-MM-DD. Gère "19/07/2026", "2026-07-19", "12.02", "5 juin 2026".
// anneeParDefaut : utilisée si l'année est absente (ex "12.02").
export function toISO(input, anneeParDefaut = new Date().getFullYear()) {
  if (!input) return null;
  const s = String(input).trim();

  // Déjà ISO (éventuellement avec heure)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // JJ/MM/AAAA ou JJ/MM ou JJ.MM, éventuellement suivi d'une heure ("12/02/2026 10:00")
  m = s.match(/^(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?(?=$|[\s,])/);
  if (m) {
    const d = +m[1], mo = +m[2];
    let y = m[3] ? +m[3] : anneeParDefaut;
    if (y < 100) y += 2000;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // "5 juin 2026" / "5 juin" / "3 août, 2026" / "22 Juil 2026" (abrégé)
  // La virgule avant l'année est tolérée : plusieurs clubs l'écrivent ainsi.
  m = s.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\.?\s*,?\s*(\d{4})?/);
  if (m) {
    const mo = moisVers(m[2]);
    if (mo) {
      const d = +m[1], y = m[3] ? +m[3] : anneeParDefaut;
      return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return null;
}

// Étend toISO aux plages écrites en un seul bloc : "29-30/08", "3-4 mai 2026".
// Renvoie { debut, fin } — fin vaut debut quand il n'y a pas de plage.
export function toPlageISO(input, anneeParDefaut = new Date().getFullYear()) {
  const s = String(input || "").trim();

  // "29-30/08/2026" ou "29-30/08" : deux quantièmes, un seul mois.
  let m = s.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})([\/.])(\d{1,2})(?:\3(\d{2,4}))?$/);
  if (m) {
    const reste = `${m[2]}${m[3]}${m[4]}${m[5] ? m[3] + m[5] : ""}`;
    const fin = toISO(reste, anneeParDefaut);
    const debut = toISO(`${m[1]}${m[3]}${m[4]}${m[5] ? m[3] + m[5] : ""}`, anneeParDefaut);
    return { debut, fin: fin || debut };
  }

  // "3-4 mai 2026" : deux quantièmes, mois en toutes lettres.
  m = s.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\.?\s*,?\s*(\d{4})?$/);
  if (m) {
    const suffixe = `${m[3]}${m[4] ? " " + m[4] : ""}`;
    const debut = toISO(`${m[1]} ${suffixe}`, anneeParDefaut);
    const fin = toISO(`${m[2]} ${suffixe}`, anneeParDefaut);
    return { debut, fin: fin || debut };
  }

  const seul = toISO(s, anneeParDefaut);
  return { debut: seul, fin: seul };
}

// Détection légère de sponsor à partir du titre. Liste extensible.
const MARQUES = [
  "BMW", "Porsche", "Mercedes", "Audi", "Renault", "Peugeot", "DS Automobiles", "DS",
  "Partouche", "Home Box", "Thelem", "Abeille", "Citya", "Philipponnat", "Mercedes-Benz",
  "Ynov", "Volkswagen", "Toyota", "Lexus", "Jaguar",
];
export function detectSponsor(nom = "") {
  // Comparaison sur des mots entiers : une marque courte comme « DS » se
  // retrouverait sinon dans « Bords de Loire ».
  for (const marque of MARQUES) {
    const motif = new RegExp(
      `(^|[^a-zàâçéèêëîïôûùüÿñ])${marque.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-zàâçéèêëîïôûùüÿñ])`,
      "i",
    );
    if (motif.test(nom)) return marque;
  }
  return null;
}

// Construit un enregistrement complet et normalisé à partir d'un "raw" produit par un connecteur.
export function toRecord(raw, golf, sourceType, aujourdhui = isoToday()) {
  const dateDebut = toISO(raw.date_debut);
  const dateFin = toISO(raw.date_fin) || dateDebut;
  // Les épreuves fédérales portent leur propre lieu et leur catégorie : elles
  // ne se rattachent pas à un club suivi, contrairement aux coupes de club.
  const golfId = raw.golf_id ?? golf.id;
  const golfNom = raw.golf_nom ?? golf.nom;
  return {
    id: makeId(golfId, dateDebut, raw.nom),
    golf_id: golfId,
    golf_nom: golfNom,
    type: raw.type ?? "club",
    zone: raw.zone ?? golf.zone ?? null,
    ville: raw.ville ?? null,
    nom: (raw.nom || "").trim(),
    date_debut: dateDebut,
    date_fin: dateFin,
    format: raw.format ?? null,
    depart: raw.depart ?? null,
    trous: raw.trous ?? null,
    sponsor: raw.sponsor ?? detectSponsor(raw.nom),
    url_inscription: raw.url_inscription ?? null,
    source_url: raw.source_url ?? golf.page ?? null,
    source_type: sourceType,
    derniere_maj: aujourdhui,
    valide: false,
  };
}

export function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

// Fusionne les nouvelles compétitions avec l'existant.
// - dédup par id
// - PRÉSERVE une validation humaine (valide:true) et les corrections manuelles déjà faites
export function merge(existants = [], nouveaux = []) {
  const parId = new Map(existants.map((c) => [c.id, c]));
  for (const n of nouveaux) {
    const ancien = parId.get(n.id);
    if (ancien) {
      // On garde le flag de validation et les champs édités à la main ;
      // on rafraîchit seulement la date de maj et les champs encore vides.
      parId.set(n.id, {
        ...n,
        valide: ancien.valide,
        sponsor: ancien.sponsor ?? n.sponsor,
        url_inscription: ancien.url_inscription ?? n.url_inscription,
        format: ancien.format ?? n.format,
      });
    } else {
      parId.set(n.id, n);
    }
  }
  return [...parId.values()].sort((a, b) => (a.date_debut < b.date_debut ? -1 : 1));
}
