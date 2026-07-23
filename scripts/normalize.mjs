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
  // « DS » nu n'est pas gardé : à peine deux lettres, il désigne bien plus
  // souvent des initiales (« Trophée DS ») que la marque, qui écrit de toute
  // façon « DS Automobiles ». On ne conserve que la forme longue.
  "BMW", "Porsche", "Mercedes", "Audi", "Renault", "Peugeot", "DS Automobiles",
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

// --------------------------------------------------------------- formules
// Les clubs décrivent leur formule de jeu comme ils veulent, et un tiers des
// compétitions n'en indiquent aucune. On classe donc sur le nom ET la formule :
// « Seniors scramble » chez l'un vaut « Scramble à 2 » chez l'autre.
//
// Une compétition peut relever de plusieurs familles : « Individuel ou
// Scramble à 2 » se joue dans les deux, et doit ressortir des deux filtres.
const FAMILLES = [
  { id: "scramble-2", motif: /s[ck]ramble\s*(?:à|a)?\s*2|scramble\s*à\s*deux/i },
  { id: "scramble", motif: /s[ck]ramble(?!\s*(?:à|a)?\s*2)|am[ée]ricaine/i },
  { id: "double", motif: /green\s?some|greensome|chapman|shamble|4\s*balles|quatre\s*balles|am\s*[-\/]\s*am|pro\s*[-–]?\s*am|foursome|doublettes?/i },
  { id: "individuel", motif: /stableford|stroke\s?play|strokeford|individuel|classement|medal|simple|score\s*maximum/i },
];

// Épreuves qui se jouent le soir : elles n'intéressent pas qui cherche une
// compétition de journée, et noyaient la liste (after work, nocturnes…).
const EN_SOIREE = /after\s*work|nocturne|soir[ée]e|tomb[ée]e de la nuit|18\s*h\s*30|19\s*h|20\s*h(?!\d)/i;

// Compétitions par équipe : interclubs, Tour Auvergne, championnats par équipe.
// Le site vise les compétitions ludiques qu'un golfeur choisit seul ; les
// épreuves d'équipe ne concernent qu'une poignée de licenciés sélectionnés, et
// « par équipe » se confondait avec « scramble » (qui se joue aussi à plusieurs).
// On les repère pour les écarter, on ne les propose plus comme filtre.
const PAR_EQUIPE = /^[ée]quipe|par [ée]quipes?|interclub|inter[-\s]club|tour auvergne|coupe de france|promotion (?:s[ée]niors|mid|dames|messieurs)|arverne? trophy/i;

// Compétitions fermées : réservées, sans inscription possible. Inutile de les
// montrer sur un site dont le seul intérêt est de pouvoir s'inscrire.
// « compétition privée » et « réservé aux membres » relèvent du même cas : une
// épreuve à laquelle un visiteur ne peut pas se joindre n'a rien à y faire.
const FERMEE = /ferm[ée]e?\b|priv[ée]e?\b|r[ée]serv[ée]e?\s+aux\s+membres/i;

export function classerFormules(nom = "", format = "") {
  const texteComplet = `${nom} ${format || ""}`;
  const familles = FAMILLES.filter((f) => f.motif.test(texteComplet)).map((f) => f.id);
  // « Scramble à 2 » satisfait aussi bien « scramble » : on évite le doublon.
  if (familles.includes("scramble-2")) {
    const i = familles.indexOf("scramble");
    if (i >= 0) familles.splice(i, 1);
  }
  return familles.length ? familles : ["autre"];
}

export function detectMoment(nom = "", format = "") {
  return EN_SOIREE.test(`${nom} ${format || ""}`) ? "soiree" : "journee";
}

export function estParEquipe(nom = "", format = "") {
  return PAR_EQUIPE.test(nom) || PAR_EQUIPE.test(format || "");
}

// Le motif « fermée / privée / réservé aux membres » se loge tantôt dans la
// formule, tantôt dans l'intitulé (« Seniors des 4 Ligues (compétition
// privée) ») : on regarde les deux.
export function estOuverte(nom = "", format = "") {
  return !FERMEE.test(`${nom} ${format || ""}`);
}

// « En ligne » comme mode de départ prête à confusion (on lit « inscription en
// ligne »). Le terme désigne des départs échelonnés au trou 1, par opposition
// au shotgun. On le réécrit une fois pour toutes.
export function lisibiliserDepart(depart) {
  if (!depart) return null;
  return /^en ligne$/i.test(depart.trim()) ? "départs échelonnés" : depart;
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
    formules: classerFormules(raw.nom, raw.format),
    moment: detectMoment(raw.nom, raw.format),
    equipe: estParEquipe(raw.nom, raw.format),
    ouverte: estOuverte(raw.nom, raw.format),
    nom: (raw.nom || "").trim(),
    date_debut: dateDebut,
    date_fin: dateFin,
    format: raw.format ?? null,
    depart: lisibiliserDepart(raw.depart),
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

// ------------------------------------------------------------ récurrences
// Beaucoup de clubs tiennent un rendez-vous hebdomadaire ou mensuel : « Les
// Jeudis d'Etienne », « Compétition 9 trous », « GHA n°12 »…
//
// La récurrence n'est PAS un filtre proposé au visiteur : le découpage était
// discutable — deux dates espacées de deux mois font-elles une série ? — et
// la question « qu'est-ce que je peux jouer » se pose en termes de formule,
// pas de fréquence. Elle ne sert plus qu'à une chose, ci-dessous : déduire
// qu'un rendez-vous qui revient sans formule annoncée est une individuelle.
//
// On les repère par répétition plutôt que par une liste de noms tenue à la
// main : un même intitulé, dans un même club, revenant au moins deux fois.
//
// Deux et non trois : on ne voit que les mois à venir, et un rendez-vous
// mensuel n'y apparaît que deux ou trois fois. À trois, « Jeudi de Champlong »
// ou « Am-Am » des Étangs passaient au travers. Les quatre paires observées
// étaient toutes de vraies séries — le risque d'un homonyme fortuit dans un
// même club reste théorique, et se solderait au pire par une compétition
// masquée quand on demande à masquer les séries.
const SEUIL_RECURRENCE = 2;

// Retire d'un intitulé ce qui varie d'une occurrence à l'autre — le numéro
// d'ordre, la date glissée dans le nom, l'année — pour comparer le reste.
function radical(nom = "") {
  return nom
    .replace(/\d{1,2}\s*[./]\s*\d{1,2}/g, " ")   // « SUNSHINE SWING 19.07 »
    .replace(/\bn[°o]\s*\d+\b/gi, " ")           // « GHA n°12 »
    .replace(/\b20\d\d\b/g, " ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Marque en place les compétitions appartenant à une série récurrente.
export function marquerRecurrences(liste = []) {
  const groupes = new Map();
  for (const c of liste) {
    if (c.type !== "club") continue;
    const cle = `${c.golf_id}|${radical(c.nom)}`;
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(c);
  }
  for (const c of liste) c.recurrent = false;
  for (const groupe of groupes.values()) {
    if (groupe.length < SEUIL_RECURRENCE) continue;
    for (const c of groupe) {
      c.recurrent = true;
      // Un rendez-vous de club qui revient chaque semaine se joue en individuel :
      // c'est la compétition de classement ordinaire. On ne l'applique qu'aux
      // séries dont le club n'annonce AUCUNE formule — plusieurs disent
      // explicitement le contraire (« Les Jeudis d'Etienne » est un scramble
      // à 2, l'« Am-Am » des Étangs se joue à deux), et leur mot fait foi.
      if (c.formules?.length === 1 && c.formules[0] === "autre" && !c.format) {
        c.formules = ["individuel"];
        c.formule_deduite = true;
      }
    }
  }
  return liste;
}

// --------------------------------------------------------------- exclusions
// Applique la liste d'exclusions manuelle (data/exclusions.json) : marque en
// place `exclu: true` les compétitions dont le nom correspond à un motif.
function sansAccent(s = "") {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function marquerExclusions(liste = [], motifs = []) {
  for (const c of liste) {
    const nom = sansAccent(c.nom);
    c.exclu = motifs.some((m) =>
      (!m.golf || m.golf === c.golf_id) && nom.includes(sansAccent(m.contient)));
  }
  return liste;
}

// Fusionne les nouvelles compétitions avec l'existant : dédoublonnage par id,
// la version fraîchement collectée l'emportant toujours.
//
// On ne préserve plus aucun champ de l'ancien enregistrement. Cette préservation
// datait de l'époque où le JSON était relu et corrigé à la main : elle gardait
// l'ancien `format` même quand le club l'avait changé à la source, si bien que
// l'étiquette affichée (« Scramble à 2 ») pouvait contredire le classement
// recalculé sur le nouveau format (« à deux »). Tout étant désormais recollecté,
// la donnée fraîche fait foi. Les enregistrements qui ne sont plus collectés
// (absents de `nouveaux`) restent tels quels, jusqu'à leur élagage par date.
export function merge(existants = [], nouveaux = []) {
  const parId = new Map(existants.map((c) => [c.id, c]));
  for (const n of nouveaux) parId.set(n.id, n);
  return [...parId.values()].sort((a, b) => (a.date_debut < b.date_debut ? -1 : 1));
}
