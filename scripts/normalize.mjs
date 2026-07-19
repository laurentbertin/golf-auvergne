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

const MOIS = {
  janvier: 1, fevrier: 2, "février": 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, "août": 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, "décembre": 12,
};

// Parse une date FR vers ISO YYYY-MM-DD. Gère "19/07/2026", "2026-07-19", "12.02", "5 juin 2026".
// anneeParDefaut : utilisée si l'année est absente (ex "12.02").
export function toISO(input, anneeParDefaut = new Date().getFullYear()) {
  if (!input) return null;
  const s = String(input).trim();

  // Déjà ISO (éventuellement avec heure)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // JJ/MM/AAAA ou JJ/MM ou JJ.MM
  m = s.match(/^(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?$/);
  if (m) {
    const d = +m[1], mo = +m[2];
    let y = m[3] ? +m[3] : anneeParDefaut;
    if (y < 100) y += 2000;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // "5 juin 2026" / "5 juin"
  m = s.toLowerCase().match(/^(\d{1,2})\s+([a-zûéèô]+)\.?(?:\s+(\d{4}))?/i);
  if (m && MOIS[m[2]]) {
    const d = +m[1], mo = MOIS[m[2]], y = m[3] ? +m[3] : anneeParDefaut;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

// Détection légère de sponsor à partir du titre. Liste extensible.
const MARQUES = [
  "BMW", "Porsche", "Mercedes", "Audi", "Renault", "Peugeot", "DS Automobiles", "DS",
  "Partouche", "Home Box", "Thelem", "Abeille", "Citya", "Philipponnat", "Mercedes-Benz",
  "Ynov", "Volkswagen", "Toyota", "Lexus", "Jaguar",
];
export function detectSponsor(nom = "") {
  const n = nom.toLowerCase();
  for (const marque of MARQUES) {
    if (n.includes(marque.toLowerCase())) return marque;
  }
  return null;
}

// Construit un enregistrement complet et normalisé à partir d'un "raw" produit par un connecteur.
export function toRecord(raw, golf, sourceType, aujourdhui = isoToday()) {
  const dateDebut = toISO(raw.date_debut);
  const dateFin = toISO(raw.date_fin) || dateDebut;
  return {
    id: makeId(golf.id, dateDebut, raw.nom),
    golf_id: golf.id,
    golf_nom: golf.nom,
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
