// html.mjs — briques communes aux connecteurs qui lisent du HTML.
// Aucune dépendance externe : les sites visés ont un balisage régulier,
// un parseur DOM complet serait disproportionné.

export const UA = "golf-auvergne/0.2 (+contact: lbertin78@gmail.com)";

export async function fetchTexte(url, options = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return res.text();
}

export async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return res.json();
}

const ENTITES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", acirc: "â",
  ccedil: "ç", ocirc: "ô", ugrave: "ù", ucirc: "û", icirc: "î", deg: "°",
  // Ponctuation typographique : WordPress la produit en masse dans les titres.
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  hellip: "…", ndash: "–", mdash: "—", laquo: "«", raquo: "»",
  euro: "€", middot: "·", times: "×", ordm: "º", sup2: "²",
};

export function decode(str = "") {
  return String(str)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, nom) => ENTITES[nom.toLowerCase()] ?? m);
}

// Retire les balises et normalise les blancs (y compris l'espace insécable).
export function texte(html = "") {
  return decode(String(html).replace(/<[^>]+>/g, " "))
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Découpe un document sur un marqueur d'ouverture répété.
// Chaque tranche va d'un marqueur au suivant — suffisant pour des listes régulières.
export function tranches(html, marqueur) {
  return String(html).split(marqueur).slice(1);
}
