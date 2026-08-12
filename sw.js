// Service worker — sivupohja ja fontit talteen, jotta sovellus avautuu myös
// ilman verkkoa.
//
// Ruokalistadataa EI säilötä täällä. Osoite /api/week?offset=0 tarkoittaa eri
// viikkoa eri päivinä, joten välimuisti tarjoilisi viime viikon listan tämän
// viikon kohdalle. Sivu tallentaa listat itse localStorageen viikon maanantai
// avaimenaan ja tietää siten, milloin tallennettu lista on vanhentunut.
//
// Kun sivua muuttaa, nosta VERSION — vanhat välimuistit siivotaan activate-
// vaiheessa.

const VERSION = "v1";
const SHELL_CACHE = `aromi-shell-${VERSION}`;
const FONT_CACHE = `aromi-fonts-${VERSION}`;

const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== FONT_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Tallennettu versio heti ruudulle, tuore haetaan taustalla seuraavaa
// avausta varten.
function staleWhileRevalidate(event, cacheName, cacheKey) {
  return (async () => {
    const cache = await caches.open(cacheName);
    const key = cacheKey || event.request;
    const cached = await cache.match(key);

    const update = fetch(event.request)
      .then(async (response) => {
        // Opaque-vastaus (status 0) tulee fonttien CSS-pyynnöstä; se ei ole
        // luettavissa mutta kelpaa sellaisenaan välimuistista tarjoiltavaksi.
        if (response.ok || response.type === "opaque") {
          await cache.put(key, response.clone());
        }
        return response;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(update);
      return cached;
    }
    return (await update) || Response.error();
  })();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isFont = FONT_HOSTS.includes(url.hostname);
  const isOwn = url.origin === self.location.origin;

  // Kaikki muu — ennen kaikkea workerin /api/week — menee suoraan verkkoon.
  if (!isFont && !isOwn) return;

  // Sivulle mennään aina saman avaimen kautta, jotta /index.html ja / eivät
  // päädy välimuistiin erillisinä kopioina.
  if (request.mode === "navigate") {
    event.respondWith(staleWhileRevalidate(event, SHELL_CACHE, "./"));
    return;
  }

  event.respondWith(staleWhileRevalidate(event, isFont ? FONT_CACHE : SHELL_CACHE));
});
