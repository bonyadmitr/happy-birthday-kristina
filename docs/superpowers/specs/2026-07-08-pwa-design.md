# PWA для сайта-поздравления — дизайн

Дата: 2026-07-08
Статус: утверждён к реализации

## Цель

Превратить статический сайт-поздравление в устанавливаемое PWA:

1. **Установка на «Домой»** — Кристина добавляет сайт иконкой-приложением на iPhone,
   открывается в полноэкранном `standalone` без адресной строки Safari.
2. **Офлайн** — после первого визита сайт полностью открывается без интернета
   (HTML/CSS/JS/аудио/иконки + Google Fonts).
3. **Иконка/сплэш** — своя иконка из ❤️ и светло-розовый сплэш в тон сайта.

## Ограничения и контекст

- Стек без сборки: чистые HTML+CSS+JS. PWA-артефакты — тоже статика, без бандлера.
- **iPhone-first (Safari):** на iOS манифест частично игнорируется → обязательны
  apple-мета-теги и `apple-touch-icon`.
- **Деплой в подпапку GitHub Pages** (`/happy-birthday-kristina/`) → **все пути
  относительные** (`./`, `manifest.json`, `assets/...`). Абсолютные (`/...`) сломают
  офлайн и установку на Pages, хотя локально с корня работали бы.
- Внешняя загрузка ровно одна — Google Fonts. Кэшируется в рантайме.
- Уважать `prefers-reduced-motion` — PWA-слой на анимации не влияет.

## Компоненты

### 1. Иконки — `assets/icons/` + генератор `scripts/gen-icons.mjs`

- Скрипт на уже установленном Playwright: `page.setContent(<html с SVG>)`,
  `setViewportSize(N×N)`, `screenshot({ path })`. Без ImageMagick/внешних утилит.
- SVG: сердечко `❤` цветом `--accent-deep` (#e23a72) на скруглённой плитке с
  градиентом сайта (`#fff2f7 → #ffc9dd`), мягкое свечение.
- Выход (коммитим PNG, генерация разовая — не в рантайме):
  - `icon-192.png`, `icon-512.png` — `purpose: "any"`.
  - `icon-maskable-512.png` — сердечко в safe-zone (≈80% центра, padding под Android-маску),
    фон-плитка на весь квадрат, `purpose: "maskable"`.
  - `apple-touch-icon-180.png` — для iOS «Домой» (без прозрачности, фон залит).
- Скрипт добавить как `npm run icons` в `package.json`.

### 2. `manifest.json` (корень)

```json
{
  "name": "С днём рождения, Кристина",
  "short_name": "Кристине ❤️",
  "lang": "ru",
  "dir": "ltr",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffe1ec",
  "theme_color": "#ff7eb3",
  "icons": [
    { "src": "assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "assets/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 3. Мета-теги в `index.html` (`<head>`)

- `<link rel="manifest" href="manifest.json">`
- `<link rel="apple-touch-icon" href="assets/icons/apple-touch-icon-180.png">`
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- `<meta name="apple-mobile-web-app-title" content="Кристине">`
- `theme-color` уже есть (#ff7eb3) — оставить.

### 4. Service worker — `sw.js` (корень, scope `./`)

- **install:** `caches.open('birthday-v1')` → предкэш app-shell относительными путями:
  `./`, `index.html`, `css/styles.css`, `js/config.js`, `js/main.js`, `js/confetti.js`,
  `manifest.json`, все иконки, `assets/audio/mary-on-a-cross-loop.mp3`. `skipWaiting()`.
- **activate:** удалить кэши с именем ≠ текущей версии; `clients.claim()`.
- **fetch:**
  - Локальные (тот же origin) GET → **cache-first**, при промахе сеть + положить в кэш.
  - Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`) → **stale-while-revalidate**
    в отдельном кэше `birthday-fonts-v1`.
  - Не-GET и прочее → просто `fetch` (не трогаем).
- Версия кэша меняется при обновлении ассетов → старое чистится на activate.

### 5. Регистрация SW — инлайн в конце `index.html`

```html
<script>
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
</script>
```

Тихо, без UI. Условие `!file:` — чтобы прямое открытие файлом не бросало ошибку.

### 6. Тесты — `tests/e2e.spec.js`

- Манифест: `fetch('manifest.json')` → 200, JSON парсится, `icons.length >= 2`,
  `start_url`/`scope` относительные.
- Иконки: каждый `src` из манифеста + apple-touch-icon → HTTP 200 (не 404).
- SW: после `navigator.serviceWorker.register(...)` резолвится `navigator.serviceWorker.ready`.
- Существующий тест «нет ошибок консоли» остаётся зелёным (иконки не 404, регистрация без throw).
- Аудио заглушено как раньше (`addInitScript` в `beforeEach`).

## Явно НЕ делаем (YAGNI)

- Кастомный `beforeinstallprompt`-баннер установки.
- Push-уведомления.
- Тостер «доступна новая версия» / принудительный update.
- Отдельные iOS `apple-touch-startup-image` сплэши под каждое разрешение.

## Гочи (записать в CLAUDE.md при реализации)

- **Относительные пути везде** (манифест `scope`/`start_url`, регистрация SW, precache) —
  из-за подпапки GitHub Pages. Абсолютные `/...` ломают офлайн/установку на Pages.
- **iOS ≠ манифест:** установка на «Домой» на iPhone держится на apple-мета + `apple-touch-icon`,
  а не только на `manifest.json`.
- **Версия кэша** `birthday-vN` — поднимать при изменении закэшированных ассетов, иначе
  у установивших останется старая версия (cache-first не сходит в сеть за свежим).
- **SW не регистрируем на `file:`** — иначе ошибка при прямом открытии файла.
- **Иконки коммитим как PNG**, генерятся разово скриптом; в рантайме ничего не рендерим.

## Документация при реализации

Обновить `CLAUDE.md` (новые файлы, гочи, `npm run icons`), `docs/DOCUMENTATION.md`,
`README.md` (установка/офлайн как пользовательская фича). Через скилл `update-docs`.
