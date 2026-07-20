# Agenda golf — Auvergne & Loire

Regroupe sur une page les compétitions des golfs d'Auvergne et de la Loire —
surtout la longue traîne (scrambles, coupes sponsorisées, compétitions internes)
que la FFG ne liste pas. Y sont ajoutées, en option, les épreuves de la ligue
Auvergne-Rhône-Alpes (grands prix, trophées seniors, classic mid-am, équipes).

En ligne : **https://agendagolf.fr** — 13 clubs suivis, mis à jour chaque matin.

## Voir la page en local

```bash
open site/index.html          # macOS — aucun serveur requis
npm run serve                 # ou via un petit serveur local
```

La page lit `site/data.js`, régénéré par la collecte. Rien à installer.

## Rafraîchir les données

Aucune dépendance : tout tourne avec Node ≥ 20 et ses modules natifs.

```bash
node scripts/collect.mjs            # collecte les 13 golfs + la ligue
node scripts/collect.mjs royat      # un seul golf (par son id)
node scripts/collect.mjs ligue      # seulement les épreuves fédérales
node scripts/digest.mjs             # génère l'email hebdo dans dist/ (n'envoie rien)
```

La collecte écrit `data/competitions.json` et `site/data.js`. Chaque source
étant lue dans du balisage régulier, rien n'est deviné : tout est publié
directement, sans étape de validation.

## Comment ça marche

- **`data/golfs.json`** — la config des clubs (id, site, connecteur, département).
- **`data/ligue.json`** — les pages de la ligue AURA, par catégorie.
- **`data/manuel/*.json`** — transcriptions des clubs qui ne publient qu'une
  affiche (image ou PDF) : Riom, Mont-Dore, Haute Auvergne, Puy-en-Velay,
  Sainte-Agathe, Les Étangs.
- **`data/competitions.json`** — la sortie normalisée (source de vérité).
- **`site/`** — la page publique (HTML/CSS/JS statique).
- **`scripts/collect.mjs`** — orchestrateur : un connecteur par club, tous
  dans `scripts/connectors/`. Chacun lit le site à sa façon (API WordPress,
  grille Wix, texte libre, affiche transcrite…). Aucun n'utilise de LLM.
- **`scripts/normalize.mjs`** — dates FR→ISO, familles de formules, détection
  des séries récurrentes, fusion idempotente par `id`.
- **`scripts/digest.mjs`** — génère l'email hebdomadaire depuis les données.

## Ajouter un golf

1. Écrire un connecteur dans `scripts/connectors/` qui renvoie un tableau de
   `{ nom, date_debut, date_fin, format, depart, trous, url_inscription }`.
2. L'enregistrer dans la table `CONNECTEURS` de `collect.mjs`.
3. Ajouter le club à `data/golfs.json` (avec son `connecteur` et sa `zone`).

Pour un club qui ne publie qu'une affiche, réutiliser `calendrier-image` et
déposer la transcription dans `data/manuel/<id>.json`.

## Publication

Une GitHub Action (`.github/workflows/deploy.yml`) relance la collecte chaque
matin, commite les données rafraîchies et republie le site sur GitHub Pages,
servi sur le domaine `agendagolf.fr` (fichier `site/CNAME`).
