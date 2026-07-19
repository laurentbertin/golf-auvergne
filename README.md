# Golf Auvergne — agrégateur de compétitions (MVP)

Regroupe sur une page les compétitions des golfs du **bassin clermontois** — surtout la longue traîne (scrambles, coupes sponsorisées, compètes internes) que la FFG ne liste pas.

Pilote : Sporting Vichy · Vichy Montpensier · Val d'Auzon · Riom · Volcans · Royat-Charade.

## Ça marche déjà

Le projet est **amorcé avec les vraies compétitions du Sporting de Vichy** (18, jusqu'en octobre 2026). Pour voir la page tout de suite :

```bash
# 1. ouvre simplement le fichier dans un navigateur
open site/index.html          # macOS
# (ou double-clic sur site/index.html)
```

La page lit `site/data.js`. Aucun serveur, aucune installation requise pour cette étape.

## Rafraîchir / élargir les données

```bash
npm install                        # une seule fois (pour le connecteur LLM)
cp .env.example .env               # puis mets ta clé ANTHROPIC_API_KEY (voir plus bas)

node scripts/collect.mjs vichy-sc  # collecte le Sporting de Vichy (structuré, sans clé)
node scripts/collect.mjs           # collecte les 6 golfs
node scripts/validate.mjs          # liste les compètes à relire
node scripts/validate.mjs --all    # les valide (elles s'affichent alors sur la page)
```

Rien ne s'affiche tant que tu n'as pas **validé** : `collect` importe en `valide:false`, la page n'affiche que `valide:true`. C'est le garde-fou fraîcheur.

## Comment ça marche

- **`data/golfs.json`** — la config des 6 golfs (id, site, type de connecteur).
- **`data/competitions.json`** — la sortie normalisée (source de vérité, éditable à la main).
- **`site/`** — la page publique (statique). `data.js` est régénéré par les scripts.
- **`scripts/collect.mjs`** — orchestrateur. Pour chaque golf :
  - **connecteur A** (`events-calendar`) : API du plugin WordPress *The Events Calendar*, sinon flux iCal. **Zéro LLM.** Confirmé sur Vichy.
  - **connecteur B** (`html-llm`) : récupère la page, Claude en extrait les compétitions. Pour Volcans, Royat, et tout golf sans flux structuré.
  - `auto` : essaie A, bascule sur B si échec.
- **`scripts/validate.mjs`** — relecture humaine avant publication.

### Sonder les golfs `auto`

Montpensier, Val d'Auzon et Riom sont en `auto`. Vérifie quel connecteur marche :

```bash
curl -s "https://www.golf-vichy-montpensier.com/wp-json/tribe/events/v1/events?per_page=1"
curl -s "https://www.golfduvaldauzon.fr/wp-json/tribe/events/v1/events?per_page=1"
curl -s "https://www.golf-riom.fr/wp-json/tribe/events/v1/events?per_page=1"
```

Si ça renvoie du JSON d'événements → passe leur `connecteur` à `events-calendar` dans `golfs.json`. Sinon ils resteront en LLM automatiquement.

## Clé API (connecteur LLM uniquement)

Le connecteur B appelle Claude. Mets ta clé dans `.env` :
```
ANTHROPIC_API_KEY=sk-ant-...
```
Vichy et l'amorce n'en ont pas besoin.

## Étapes suivantes (hors MVP)

Planifier `collect.mjs` (cron / GitHub Action), déployer `site/` (Netlify / Vercel / GitHub Pages), puis attaquer la couche business (mise en avant sponsors). Voir le brief `MVP-Agregateur-Golf-Auvergne-SPEC.md`.
