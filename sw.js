// ============================================================================
//  Service worker — офлайн-доступ к сайту-поздравлению.
//  Стратегия: cache-first для локального app-shell (предкэш на install),
//  stale-while-revalidate для Google Fonts.
//
//  ВАЖНО: сайт живёт в подпапке GitHub Pages (/happy-birthday-kristina/),
//  поэтому все пути ОТНОСИТЕЛЬНЫЕ (new URL(path, self.registration.scope)).
//  Абсолютные "/..." указали бы в корень домена и сломали бы офлайн на Pages.
//
//  Версию кэша (CACHE) поднимать при изменении закэшированных ассетов — иначе
//  у уже установивших останется старая версия (cache-first не идёт в сеть за свежим).
// ============================================================================
const CACHE = "birthday-v5";
const FONTS_CACHE = "birthday-fonts-v1";

// App-shell — относительно scope воркера (подпапка Pages).
const ASSETS = [
  "./",
  "index.html",
  "manifest.json",
  "css/styles.css",
  "js/config.js",
  "js/confetti.js",
  "js/rhythm-beatmap.js",
  "js/rhythm.js",
  "js/main.js",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-512.png",
  "assets/icons/apple-touch-icon-180.png",
  "assets/audio/mary-on-a-cross-loop.mp3",
].map((p) => new URL(p, self.registration.scope).toString());

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE && k !== FONTS_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

const isFonts = (url) =>
  url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // мутации не трогаем
  const url = new URL(req.url);

  // Локальная разработка (localhost) — network passthrough, никакого cache-first:
  // иначе правки на диске (напр. после regen.sh) не видно. В проде кэшируем как обычно.
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]") {
    return;
  }

  // Google Fonts — stale-while-revalidate: отдаём из кэша сразу, тихо обновляем.
  if (isFonts(url)) {
    e.respondWith(
      caches.open(FONTS_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Свой origin — cache-first, при промахе сеть + докладываем в кэш.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req)
            .then((res) => {
              if (res.ok && res.type === "basic") {
                const copy = res.clone();
                caches.open(CACHE).then((c) => c.put(req, copy));
              }
              return res;
            })
            .catch(() => cached)
      )
    );
  }
  // прочие запросы — пусть идут в сеть по умолчанию
});
