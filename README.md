# 🎂 С днём рождения, Кристина

Интерактивный сайт-поздравление. Чистые HTML/CSS/JS, без сборки — просто открывается в браузере.
Сделан iPhone-first (Safari): распаковка подарка → тёплое поздравление → финальная буква «Л»
с мини ритм-игрой под песню (жми в такт, стиль сердцебиения).
Это **PWA**: можно добавить на экран «Домой» иконкой-приложением (открывается в полный экран)
и открывать офлайн.

**Живой сайт:** https://bonyadmitr.github.io/happy-birthday-kristina/

## Как посмотреть локально

```bash
python3 -m http.server 8000
# открой http://localhost:8000
```

(Можно и просто открыть `index.html` двойным кликом, но локальный сервер ближе к боевому.)

## Как проверить (тесты)

```bash
npm install            # один раз: ставит Playwright (dev-only)
npm test               # E2E в WebKit(iPhone) + реальном Chrome, ~25с
```

Тесты (`tests/e2e.spec.js`) — быстрая замена ручной проверки: ловят горизонтальный скролл,
центрирование, границы частиц, работу музыки и т.п. WebKit важен — он воспроизводит движок
Safari/iOS, где всплывает специфика, невидимая в обычном Chrome. Подробности — в
[docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) §9. Тесты в деплой не попадают.

## Как персонализировать

Всё редактируется в одном файле — **`js/config.js`**. Логику трогать не нужно.

- **Имя, тексты** — поля `name`, `hero`, `finale`.
- **Финальная буква** — `finale.letter` (по умолчанию «Л») и необязательная `finale.caption`.
- **Оформление** — одна тёплая розовая тема; вся палитра и шрифты в `:root` (`css/styles.css`).
  Меняешь переменные — меняется весь сайт.
- **Музыка** (необязательно) — положи mp3 в `assets/audio/` и впиши путь в `music.url`.
  Запускается по тапу (политика автоплея iOS). Пусто → кнопки музыки нет.
- **Ритм-игра** — тексты в `finale.play`/`playHint`/`replayGame`/`gameEnd`. Ритм-карта под
  песню — `js/rhythm-beatmap.js` (генерится, при смене песни пере-собрать — см.
  [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) §13).

## Деплой на GitHub Pages

Уже задеплоено (репозиторий `bonyadmitr/happy-birthday-kristina`, Pages включён).
Повторный деплой после правок:

```bash
git add -A && git commit -m "..." && git push   # Pages пересоберётся сам за ~1 мин
```

Есть пошаговый скилл `/deploy` (`.claude/skills/deploy/SKILL.md`) — создание репо,
включение Pages и проверка живого сайта. Первичная настройка (если делать заново):
**Settings → Pages → Source: Deploy from a branch → Branch: `main` / `root`**.

## Структура

```
index.html            — разметка + фон-слой .bg + фавикон + PWA-мета/регистрация SW
manifest.json         — PWA-манифест (иконки, standalone, цвета)
sw.js                 — service worker (офлайн-кэш)
css/styles.css        — стили + палитра/шрифты (CSS-переменные в :root) + фон
js/config.js          — ВСЯ персонализация
js/main.js            — логика (распаковка, конфетти, сердечки, частицы, музыка, зум-гард, ритм-игра)
js/rhythm.js          — движок ритм-игры (портируемый)
js/rhythm-beatmap.js  — карта битов песни (генерится)
js/confetti.js        — вшитый canvas-confetti (без внешнего CDN)
assets/audio/         — сюда mp3 для музыки
assets/icons/         — PWA-иконки (PNG из ❤️; `npm run icons`)
scripts/gen-icons.mjs — генератор иконок (dev-only, не деплоится)
tools/beatmap/        — извлечение карты битов (librosa, dev-only, не деплоится)
tests/e2e.spec.js     — Playwright E2E (dev-only, не деплоится)
playwright.config.js  — WebKit(iPhone) + реальный Chrome
```
