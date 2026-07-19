// Connecteur A — "The Events Calendar" (WordPress). Zéro LLM.
// Tente l'API REST du plugin, puis le flux iCal en secours.
// Renvoie un tableau de "raw" { nom, date_debut, date_fin, format, depart, url_inscription, source_url }.

const UA = "golf-auvergne-mvp/0.1 (+contact: lbertin78@gmail.com)";

function dateOnly(s) {
  // "2026-07-19 08:30:00" ou "2026-07-19T08:30:00" -> "2026-07-19"
  return String(s || "").slice(0, 10);
}

function formatFromCategories(cats = []) {
  const noms = cats.map((c) => (typeof c === "string" ? c : c.name)).filter(Boolean);
  // On préfère un vrai format de jeu au mot générique "Compétition".
  const jeu = noms.find((n) => !/^comp[ée]tition$/i.test(n));
  return jeu || noms[0] || null;
}

async function viaRest(golf, since) {
  const url = `${golf.base}/wp-json/tribe/events/v1/events?per_page=50&start_date=${since}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`REST ${res.status}`);
  const data = await res.json();
  const events = data.events || [];
  if (!events.length) throw new Error("REST: 0 événement");
  return events.map((e) => ({
    nom: (e.title || "").trim(),
    date_debut: dateOnly(e.start_date),
    date_fin: dateOnly(e.end_date) || dateOnly(e.start_date),
    format: formatFromCategories(e.categories),
    depart: null,
    url_inscription: e.url || null,
    source_url: url,
  }));
}

function parseICal(txt) {
  const out = [];
  const blocks = txt.split("BEGIN:VEVENT").slice(1);
  for (const b of blocks) {
    const get = (k) => (b.match(new RegExp(`${k}[^:]*:(.+)`)) || [])[1]?.trim();
    const dt = (v) => (v ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null);
    const start = dt(get("DTSTART"));
    if (!start) continue;
    out.push({
      nom: (get("SUMMARY") || "").replace(/\\,/g, ","),
      date_debut: start,
      date_fin: dt(get("DTEND")) || start,
      format: null,
      depart: null,
      url_inscription: get("URL") || null,
      source_url: `${"iCal"}`,
    });
  }
  return out;
}

async function viaICal(golf) {
  const url = `${golf.base}/events/?ical=1`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`iCal ${res.status}`);
  const txt = await res.text();
  const evts = parseICal(txt);
  if (!evts.length) throw new Error("iCal: 0 événement");
  return evts.map((e) => ({ ...e, source_url: url }));
}

export async function fetchEventsCalendar(golf, since) {
  try {
    return await viaRest(golf, since);
  } catch (e1) {
    try {
      return await viaICal(golf);
    } catch (e2) {
      throw new Error(`Events Calendar KO (${e1.message} ; ${e2.message})`);
    }
  }
}
