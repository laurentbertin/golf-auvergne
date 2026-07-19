// Connecteur B — HTML + LLM. Pour les golfs sans flux structuré (Volcans, Royat, …).
// Récupère la page, la réduit en texte, et demande à Claude d'en extraire un JSON normalisé.
// Nécessite ANTHROPIC_API_KEY dans l'environnement (.env).

import Anthropic from "@anthropic-ai/sdk";
import { isoToday } from "../normalize.mjs";

const UA = "golf-auvergne-mvp/0.1 (+contact: lbertin78@gmail.com)";
const MODEL = "claude-sonnet-4-5"; // suffisant et économique pour de l'extraction

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 16000); // large mais borné
}

function buildPrompt(golfNom, contenu) {
  return `Tu extrais les compétitions de golf À VENIR depuis le contenu d'une page web.

Golf : ${golfNom}
Date du jour : ${isoToday()} (ignore toute compétition déjà passée).

Renvoie UNIQUEMENT un tableau JSON valide, sans texte autour. Chaque élément :
{
  "nom": string,
  "date_debut": "YYYY-MM-DD",
  "date_fin": "YYYY-MM-DD",
  "format": string|null,
  "depart": string|null,
  "trous": number|null,
  "sponsor": string|null,
  "url_inscription": string|null
}

Règles :
- Convertis les dates françaises (19/07/2026, 12.02, "11, 12 & 13.09") en ISO. Déduis l'année du contexte si absente.
- Pour une plage "11, 12 & 13.09" : date_debut = 11, date_fin = 13.
- N'invente rien. Champ absent -> null.
- Ne renvoie que des compétitions dont la date_fin est >= la date du jour.

Contenu de la page :
${contenu}`;
}

export async function fetchHtmlLlm(golf) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY manquante (voir .env.example)");

  const res = await fetch(golf.page, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${golf.page}`);
  const texte = htmlToText(await res.text());

  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{ role: "user", content: buildPrompt(golf.nom, texte) }],
  });

  const raw = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  const jsonTxt = raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1);
  let arr;
  try {
    arr = JSON.parse(jsonTxt);
  } catch {
    throw new Error(`Réponse LLM non-JSON pour ${golf.nom}`);
  }
  return arr.map((r) => ({ ...r, source_url: golf.page }));
}
