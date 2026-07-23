// Service worker — le minimum pour que le site s'installe et survive au tunnel.
//
// Stratégie : RÉSEAU D'ABORD, cache en secours. L'inverse (cache d'abord) est
// l'usage courant, mais il serait faux ici : tout l'intérêt du site tient à la
// fraîcheur de `data.js`, réécrit chaque matin. Un cache prioritaire afficherait
// des compétitions déjà jouées, sans que personne comprenne pourquoi.
//
// Le cache ne sert donc qu'à deux choses : l'affichage hors ligne (sur un
// parcours, le réseau est souvent absent) et le premier écran instantané quand
// la connexion traîne.

const CACHE = "agendagolf-v4";

// Le strict nécessaire pour afficher quelque chose sans réseau dès la première
// visite. Le reste entre dans le cache au fil de la navigation.
const SOCLE = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/pwa.js",
  "/data.js",
  "/favicon.svg",
  "/icon-192.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  // Un fichier manquant ne doit pas faire échouer toute l'installation : on
  // ajoute au coup par coup plutôt qu'en bloc.
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SOCLE.map((u) => cache.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;

  // On ne touche ni aux envois de formulaire, ni aux domaines tiers (Brevo,
  // Formspree) : les intercepter n'apporterait rien et casserait les réponses.
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith((async () => {
    try {
      const reponse = await fetch(req);
      // Seules les réponses complètes sont conservées : une 404 ou une réponse
      // partielle mise en cache resservirait une page cassée hors ligne.
      if (reponse.ok && reponse.type === "basic") {
        const cache = await caches.open(CACHE);
        cache.put(req, reponse.clone());
      }
      return reponse;
    } catch {
      const enCache = await caches.match(req);
      if (enCache) return enCache;
      // Hors ligne sur une page jamais visitée : on sert l'accueil plutôt que
      // l'écran d'erreur du navigateur.
      if (req.mode === "navigate") {
        const accueil = await caches.match("/index.html");
        if (accueil) return accueil;
      }
      throw new Error("hors ligne et absent du cache");
    }
  })());
});
