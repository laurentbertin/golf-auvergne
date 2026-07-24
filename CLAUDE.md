# agendagolf.fr — notes de travail

> Le `CLAUDE.md` du dossier parent parle du **coaching golf de Laurent** (son
> index, son swing). Aucun rapport avec ce dépôt : ne pas les confondre.

## Ce que c'est

Un agenda statique des compétitions de golf d'Auvergne & Loire, publié sur
**https://agendagolf.fr**. Un connecteur par club lit le site du club, la sortie
est normalisée puis figée dans un fichier JS que la page lit. Objectif : la
longue traîne (scrambles, coupes sponsorisées) que la FFG ne liste pas.

**Ce que ce n'est pas** : pas d'application, pas de base de données, pas de
back-end, pas de framework, pas de dépendance npm, aucun LLM dans la collecte.
Node ≥ 20 et ses modules natifs, rien d'autre. Le site est une PWA installable,
mais reste un site statique.

## Commandes

```bash
node scripts/collect.mjs              # collecte TOUS les golfs + la ligue
node scripts/collect.mjs avenelles    # un seul golf, par son id
node scripts/digest.mjs               # écrit l'e-mail dans dist/, n'envoie rien
node scripts/campagne.mjs --apercu    # idem, sans appeler Brevo
```

Voir la page en local : `preview_start` sur la config `site` de
`.claude/launch.json` (sert `site/` sur le port 4173). Un simple
`open site/index.html` marche aussi, mais le service worker n'y tourne pas
(`file://`).

**Déploiement** : rien à lancer. Pousser sur `main` suffit — l'Action
`deploy.yml` reconstruit et publie sur GitHub Pages.

## Règles à ne pas casser

Ces règles viennent d'erreurs réellement commises. Les ignorer les fait revenir.

**Ne jamais conclure sur du HTML servi sans avoir vu la page rendue.** Plusieurs
clubs (Mont-Dore, Haute Auvergne, Forez, Les Étangs) ont été déclarés « ne
publient rien » à tort : le contenu arrivait autrement que prévu. Ouvrir la page
dans le navigateur avant de conclure.

**Chercher les données structurées avant de gratter le HTML.** Chambon expose du
schema.org JSON-LD (dates déjà en ISO) : bien plus robuste que sa grille. Réflexe
à avoir sur tout nouveau club.

**Le service worker est en RÉSEAU D'ABORD**, à l'inverse de l'usage courant.
Tout l'intérêt du site tient à la fraîcheur de `data.js`, réécrit chaque matin :
un cache prioritaire afficherait des compétitions déjà jouées. Après toute
modification d'un fichier de `site/`, **incrémenter `CACHE` dans `site/sw.js`**,
sinon les anciens fichiers resservent aux visiteurs.

**Ne pas faire dépendre l'invitation à installer de `beforeinstallprompt`.**
Première version : elle n'affichait presque jamais rien. Safari ne l'émet pas,
Firefox non plus, et Chrome le coupe dès que le site est installé ailleurs.
`site/installation.js` affiche donc toujours un mode d'emploi, et ne s'en sert
que s'il arrive.

**Les fichiers générés (`data/competitions.json`, `site/data.js`) ne se
fusionnent pas à la main.** L'Action quotidienne les réécrit, donc un `git pull`
conflicte souvent. Résolution : prendre la version distante, puis relancer
`node scripts/collect.mjs` pour régénérer. Ne jamais résoudre ligne à ligne.

**Un connecteur ne devine rien.** Pas de LLM, pas d'heuristique floue. S'il ne
reconnaît plus rien, il doit **lever une erreur** (« balisage changé ? ») plutôt
que renvoyer une liste vide en silence.

**Attention aux marques trop courtes dans `detectSponsor`.** « DS » a été retiré :
« Trophée DS » désigne des initiales, pas DS Automobiles. Même piège auparavant
avec « Bords de Loire ». Ne garder que des jetons non ambigus.

**Attention aux mentions parasites avant d'exclure.** « Coupe du Président /
… Shotgun 9 h 30 / suivie de la Fête du Club **en soirée** » : le mot « soirée »
décrit l'après-match, pas l'horaire. Sans nettoyage, une compétition de journée
disparaissait du site.

**Le garde « aucun abonné » doit normaliser avant de comparer.** Brevo a renvoyé
un compteur qui s'affichait « 0 » sans être le nombre 0 : un brouillon a été créé
pour une liste vide. Comparer après `Number()`, jamais par identité stricte.

**L'expéditeur des e-mails doit être sur `agendagolf.fr`** (domaine authentifié
DKIM). Parti d'un sous-domaine partagé de Brevo, le mail est écarté sans bruit
par Gmail : le journal affiche « Envoyé », jamais « Délivré ».

## Où vit quoi

| Chemin | Ce qu'il porte |
|---|---|
| `data/golfs.json` | Les clubs suivis : id, site, connecteur, département. **La liste de référence** |
| `data/ligue.json` | Les pages de la ligue AURA, par catégorie |
| `data/manuel/*.json` | Transcriptions des clubs qui ne publient qu'une affiche |
| `data/exclusions.json` | Compétitions écartées à la main (éditable sur GitHub) |
| `data/competitions.json` | **Généré.** La sortie normalisée |
| `data/newsletter.json` | Liste, expéditeur, objet et fenêtre du digest |
| `site/` | La page publique (HTML/CSS/JS statique) |
| `site/data.js` | **Généré.** Les données lues par la page |
| `site/app.js` | Filtres (période, jour, golf, formule) et rendu des cartes |
| `site/installation.js` | Enregistre le service worker et propose l'installation |
| `site/sw.js` | Service worker, réseau d'abord |
| `scripts/collect.mjs` | Orchestrateur, et la table `CONNECTEURS` |
| `scripts/connectors/` | Un fichier par club, nommé d'après le club |
| `scripts/normalize.mjs` | Dates, formules, équipe/fermée/soirée, sponsors, fusion |
| `scripts/digest.mjs` | Compose l'e-mail (HTML de messagerie) |
| `scripts/campagne.mjs` | Crée le brouillon Brevo et envoie le rappel |
| `.github/workflows/deploy.yml` | Collecte + publication, chaque jour ~7 h Paris |
| `.github/workflows/digest.yml` | Brouillon du digest, le mardi |

Le **README.md** détaille l'ajout d'un golf et le fonctionnement du digest : s'y
reporter plutôt que de dupliquer ici.

## En attente (au 23 juillet 2026)

- **Prochain digest : mardi 4 août 2026** (brouillon + rappel par mail), à
  relire et envoyer à la main, en visant le jeudi 6. Le mardi 28 juillet est
  sauté : le numéro paraît une semaine ISO paire sur deux.
- **Brouillons vides à supprimer dans Brevo** (dont la campagne n° 5), créés
  avant le correctif du garde « aucun abonné ».
- **Contacts de test à supprimer dans Brevo** : `lbertin78+test@`, `+form@`,
  `+verif@`, `+golfclub@`.
- **Aucune mesure d'audience** : pas d'outil de statistiques posé. Piste retenue
  si besoin : Cloudflare Web Analytics ou GoatCounter (sans cookie, donc sans
  bandeau de consentement — Google Analytics en imposerait un et rendrait faux
  le « aucun cookie de suivi » de `site/confidentialite.html`).
- **Montpensier** ne publie rien : le connecteur renvoie 0 sans erreur, c'est
  normal, ne pas le « réparer ».
- Golfs écartés volontairement : **Val de Cher** (calendrier inexploitable),
  **Saint-Étienne** et **Val Saint-Jean** (refusés).
