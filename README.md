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
node scripts/collect.mjs            # collecte les 14 golfs + la ligue
node scripts/collect.mjs royat      # un seul golf (par son id)
node scripts/collect.mjs ligue      # seulement les épreuves fédérales
node scripts/digest.mjs             # génère l'e-mail dans dist/ (n'envoie rien)
node scripts/campagne.mjs --apercu  # idem, sans appeler Brevo
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

## L'e-mail aux abonnés

Un digest paraît **une quinzaine sur deux**. Le **mardi**, l'Action prépare la
campagne en **brouillon** et envoie un rappel par mail ; on la relit et on
l'expédie soi-même, en visant le **jeudi**. Rien ne part sans un clic humain.

Le brouillon étant préparé deux jours avant l'envoi, la fenêtre annoncée démarre
d'autant plus tard (`decalage_envoi`) : sans cela le numéro listerait des
compétitions déjà jouées au moment de la lecture.

Deux refus évitent les envois absurdes : aucune compétition sur la période, ou
aucun abonné confirmé. `--envoyer` expédie sans relecture, si un jour la
confiance est acquise.

- **`data/newsletter.json`** — liste, expéditeur, objet, fenêtre en jours.
  La liste est désignée par son nom, résolu à l'exécution.
- **`scripts/digest.mjs`** — construit l'e-mail (HTML de messagerie : styles en
  ligne, tableaux ; les clients ignorent CSS externe, flex et grid).
- **`scripts/campagne.mjs`** — compose la campagne et l'envoie via l'API Brevo.
  La clé vit dans le secret GitHub `BREVO_API_KEY`, jamais dans le dépôt.

Deux pièges déjà rencontrés, à ne pas refaire :

- **L'expéditeur doit être sur `agendagolf.fr`** (domaine authentifié par DKIM).
  Parti d'un sous-domaine partagé de Brevo, l'e-mail est écarté sans bruit par
  Gmail — le journal Brevo affiche « Envoyé », jamais « Délivré ».
- **Les golfs favoris ne sont pas collectés.** Personnaliser le contenu par
  abonné imposerait un envoi par personne ou des dizaines de segments : hors de
  proportion tant que le digest tient en une trentaine de lignes.

Le site collecte aussi deux formulaires, sans back-end : l'inscription poste
directement chez Brevo, le contact chez Formspree. `site/formulaires.js` envoie
en arrière-plan et affiche la réponse sur place, ce qui évite la redirection
payante de Brevo.

## S'installer comme une application

Le site est une PWA : depuis le navigateur, « Ajouter à l'écran d'accueil »
pose une icône, et la page s'ouvre ensuite en plein écran, sans barre d'adresse.
Aucun store, aucun compte développeur, aucune mise à jour à publier.

- **`site/manifest.webmanifest`** — nom, icônes, couleurs, mode `standalone`.
- **`site/sw.js`** — service worker en **réseau d'abord**, cache en secours.
  L'ordre inverse est l'usage courant mais serait faux ici : tout l'intérêt du
  site tient à la fraîcheur de `data.js`, réécrit chaque matin. Le cache ne sert
  qu'au hors-ligne (le réseau manque souvent sur un parcours) et au premier
  écran quand la connexion traîne.
- **`site/pwa.js`** — l'enregistrement, chargé par les cinq pages.

Les PNG sont rendus depuis les deux SVG (`favicon.svg`, et `icone-masquable.svg`
dont le contenu tient dans la zone sûre d'Android). La machine n'a aucun
convertisseur SVG→PNG installé ; `qlmanage -t -s 512 -o <dossier> <fichier.svg>`
fait l'affaire sur macOS. Après modification d'un SVG, régénérer les trois PNG
**et** incrémenter `CACHE` dans `sw.js`, sinon les anciens fichiers resservent.

## Publication

Une GitHub Action (`.github/workflows/deploy.yml`) relance la collecte chaque
matin, commite les données rafraîchies et republie le site sur GitHub Pages,
servi sur le domaine `agendagolf.fr` (fichier `site/CNAME`).
