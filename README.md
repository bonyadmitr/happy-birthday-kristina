# 🎂 С днём рождения, Кристина

Интерактивный сайт-поздравление. Чистые HTML/CSS/JS, без сборки — просто открывается в браузере.
Сделан iPhone-first (Safari): распаковка подарка → тёплое поздравление → финальная буква «Л».

## Как посмотреть локально

```bash
python3 -m http.server 8000
# открой http://localhost:8000
```

(Можно и просто открыть `index.html` двойным кликом, но локальный сервер ближе к боевому.)

## Как персонализировать

Всё редактируется в одном файле — **`js/config.js`**. Логику трогать не нужно.

- **Имя, тексты** — поля `name`, `hero`, `finale`.
- **Финальная буква** — `finale.letter` (по умолчанию «Л») и необязательная `finale.caption`.
- **Оформление** — одна тёплая розовая тема; вся палитра и шрифты в `:root` (`css/styles.css`).
  Меняешь переменные — меняется весь сайт.
- **Музыка** (необязательно) — положи mp3 в `assets/audio/` и впиши путь в `music.url`.
  Запускается по тапу (политика автоплея iOS). Пусто → кнопки музыки нет.

## Деплой на GitHub Pages

1. Создай репозиторий `happy-birthday-kristina` на GitHub.
2. Запушь содержимое этой папки:
   ```bash
   git add -A
   git commit -m "Birthday site for Kristina"
   git branch -M main
   git remote add origin https://github.com/<username>/happy-birthday-kristina.git
   git push -u origin main
   ```
3. В репозитории: **Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / `root`** → Save.
4. Через ~1 минуту сайт будет доступен по адресу
   `https://<username>.github.io/happy-birthday-kristina/`.

## Структура

```
index.html          — разметка
css/styles.css      — стили + палитра/шрифты (CSS-переменные в :root)
js/config.js        — ВСЯ персонализация
js/main.js          — логика (распаковка, конфетти, сердечки, частицы, музыка)
js/confetti.js      — вшитый canvas-confetti (без внешнего CDN)
assets/audio/       — сюда mp3 для музыки
```
