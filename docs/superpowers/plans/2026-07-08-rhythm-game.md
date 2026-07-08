# Ритм-игра «в такт с Л» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development или superpowers:executing-plans. Шаги — чекбоксы `- [ ]`.

**Goal:** Добавить на финальный экран «Л» простую ритм-игру под уже играющую песню — одна полоса, одна кнопка, проиграть нельзя.

**Architecture:** Обобщённый движок `js/rhythm.js` (полоса, планирование нот по аудио-часам `audio.currentTime`, детект попаданий, конец-на-границе-трека) + данные песни `js/rhythm-beatmap.js` (запечённая карта битов). Привязка к сайту — в `js/main.js` через колбэки. Движок не трогает аудио (не перематывает, не останавливает) — только читает время.

**Tech Stack:** Чистые HTML+CSS+JS без сборки. Тесты — Playwright (WebKit iPhone + Chrome). Извлечение битов — librosa (оффлайн, разово).

## Global Constraints

- Чистые HTML+CSS+JS, без сборки, без фреймворка, без рантайм-CDN.
- Палитра/шрифты — только через `:root` в `css/styles.css`.
- `config.js` — только персонализация (тексты). Данные битов туда НЕ кладём.
- iPhone-first: `pointerdown` не `click`; `dvh` не `vh`; полоса не даёт горизонтальный скролл (`contain` + ноты в границах); уважать `prefers-reduced-motion`.
- PWA-пути относительные (`./`, `js/...`). Поднять версию кэша `birthday-vN` в `sw.js` при смене закэшированных ассетов.
- Проиграть нельзя: промахи не карают, нет game over.
- Не возвращать удалённые секции (торт/галерея/письмо).
- Держать доки в синхроне (скилл `update-docs`).

---

## Task 1: Карта битов (тулинг + данные)

Извлечь тайминги долей из mp3 в `js/rhythm-beatmap.js`. Тулинг (`tools/beatmap/`) уже создан: `extract.py`, venv, `.gitignore` обновлён.

**Files:**
- Создан: `tools/beatmap/extract.py` (готов)
- Создать (сгенерить): `js/rhythm-beatmap.js`
- Изменён: `.gitignore` (готов — venv/wav в игноре)

**Produces:** `window.RHYTHM_BEATMAP = { src: string, duration: number, beats: number[] }` — `beats` отсортированы по возрастанию, все в `[0, duration)`.

- [ ] **Step 1: Сгенерить карту**

```bash
tools/beatmap/.venv/bin/python tools/beatmap/extract.py \
  assets/audio/mary-on-a-cross-loop.mp3 \
  --src assets/audio/mary-on-a-cross-loop.mp3 \
  --out js/rhythm-beatmap.js --min-gap 0.28
```
Ожидаемо: `OK: N долей, duration≈72.744s -> js/rhythm-beatmap.js`. Если долей слишком много/мало или бит «грязный» — подобрать `--min-gap`, либо фолбэк `--bpm 143 --offset <сек>`.

- [ ] **Step 2: Санити-проверка данных**

```bash
node -e "global.window={}; require('./js/rhythm-beatmap.js'); var m=window.RHYTHM_BEATMAP; \
  var ok = m.beats.length>10 && m.beats.every((b,i)=>b>=0 && b<m.duration && (i===0||b>m.beats[i-1])); \
  console.log(ok?'OK '+m.beats.length+' beats':'BAD'); if(!ok) process.exit(1)"
```
Ожидаемо: `OK <N> beats`.

- [ ] **Step 3: Commit**

```bash
git add tools/beatmap/extract.py js/rhythm-beatmap.js .gitignore
git commit -m "feat(rhythm): beat-extraction tooling + baked beatmap"
```

---

## Task 2: Движок `js/rhythm.js`

Обобщённый портируемый движок. Фабрика `window.RhythmGame(opts)` → `{ start, stop }`. Плюс чистые хелперы на `RhythmGame.util` для тестируемости.

**Files:**
- Создать: `js/rhythm.js`
- Test: через Playwright `page.evaluate` (Task 6) — чистые хелперы `RhythmGame.util`.

**Interfaces:**
- Consumes: `window.RHYTHM_BEATMAP` передаётся снаружи как `beats`/`duration`.
- Produces:
  - `RhythmGame(opts) -> { start(), stop() }`, opts: `{ audio, mount, tapTargets:Element[], beats:number[], duration:number, leadTime=2.0, hitWindow=0.18, minPlay=10, onHit(info), onMiss(info), onComplete(stats), reducedMotion=false }`.
  - `RhythmGame.util.endTarget(startAbs, duration, minPlay) -> number` — абсолютное время конца (наименьшее `k*duration >= startAbs + minPlay`).
  - `RhythmGame.util.noteX(dt, leadTime) -> number` — доля пути 0..1 (1 = у цели, когда `dt=0`; 0 = справа при `dt=leadTime`).
  - `RhythmGame.util.nextLaps(prevT, curT, laps, duration) -> number` — счётчик оборотов при обёртке `currentTime`.

**Ключевая логика (реальный код для чистых функций):**

```js
// endTarget: конец = ближайшая граница k*duration с зазором >= minPlay от старта.
function endTarget(startAbs, duration, minPlay) {
  var k = Math.ceil((startAbs + minPlay) / duration);
  return k * duration;
}
// noteX: dt = t - now (сек до доли). 0 у цели, leadTime — на старте справа.
function noteX(dt, leadTime) {
  var p = 1 - dt / leadTime;      // 0..1
  return p < 0 ? 0 : p > 1 ? 1 : p;
}
// nextLaps: currentTime резко упал (конец->начало лупа) => +1 оборот.
function nextLaps(prevT, curT, laps, duration) {
  return (curT + 0.5 < prevT) ? laps + 1 : laps;  // 0.5с гистерезис
}
```

- [ ] **Step 1: Написать `js/rhythm.js`** — IIFE, `window.RhythmGame = factory`, хелперы на `factory.util`. Тело:
  - `start()`: запомнить `startAbs = audio.currentTime` (laps=0), `endAbs = endTarget(startAbs, duration, minPlay)`; навесить `pointerdown` на каждый `tapTargets[i]` → `tryHit()`; запустить rAF-цикл `tick()`.
  - `tick()`: `now = audio.currentTime`; `laps = nextLaps(prevT, now, laps, duration); prevT = now`; `absNow = laps*duration + now`; если `absNow >= endAbs` → `stop(); onComplete({combo, maxCombo, hits})`; return. Иначе: спавн нот для долей в окне `leadTime` (учитывая доли следующего лупа как `t+duration` у стыка), обновить X всех живых нот через `noteX`, снять пролетевшие мимо (`now - t > hitWindow`) как miss → `onMiss`, комбо=0.
  - `tryHit()`: найти ближайшую живую ноту с `|t - now| <= hitWindow`; есть → пометить hit, убрать, `combo++`, `maxCombo=max`, `onHit({combo})`; нет → «пустой» тап (ничего).
  - `stop()`: отменить rAF, снять слушатели, удалить ноты из `mount`. **Аудио не трогать.**
  - Ноты — `<span class="rg-note">` в `mount`; позиция через `style.left` в % (0%→100% слева-направо к цели слева? — см. Task 3: цель слева, ноты едут справа налево, значит X=`(1-p)*100%`). Держать в границах, без выхода за `mount`.
  - `reducedMotion`: спавнить/детектить так же, но без CSS-переходов (позиция ставится покадрово) — уже покадрово, так что просто без доп. эффектов.

- [ ] **Step 2: Проверить синтаксис**

```bash
node -e "global.window={}; require('./js/rhythm.js'); \
  var u=window.RhythmGame.util; \
  console.log(u.endTarget(10,72.744,10)===72.744?'e1 OK':'e1 BAD'); \
  console.log(u.endTarget(68,72.744,10)===145.488?'e2 OK':'e2 BAD'); \
  console.log(Math.abs(u.noteX(0,2)-1)<1e-9?'n1 OK':'n1 BAD'); \
  console.log(u.noteX(2,2)===0?'n2 OK':'n2 BAD'); \
  console.log(u.nextLaps(72.0,0.1,0,72.744)===1?'l1 OK':'l1 BAD'); \
  console.log(u.nextLaps(10,10.5,0,72.744)===0?'l2 OK':'l2 BAD')"
```
Ожидаемо: все `OK`.

- [ ] **Step 3: Commit**

```bash
git add js/rhythm.js
git commit -m "feat(rhythm): portable rhythm-game engine (audio-clock scheduling)"
```

---

## Task 3: Разметка + стили полосы

**Files:**
- Изменить: `index.html` (секция `#finale`, подключение скриптов)
- Изменить: `css/styles.css` (стили полосы; переменные в `:root`)

- [ ] **Step 1: Разметка в `#finale`** (после `finale-letter`, до `finale-caption`):

```html
<!-- Ритм-игра: призыв + кнопка старта + полоса (скрыто до входа) -->
<button class="btn-play" id="btn-play" type="button" hidden></button>
<div class="rhythm" id="rhythm" hidden aria-hidden="true">
  <div class="rhythm-lane" id="rhythm-lane">
    <span class="rhythm-target" aria-hidden="true"></span>
  </div>
  <p class="rhythm-combo" id="rhythm-combo"></p>
</div>
```
Плюс подключить скрипты перед `main.js`:
```html
<script src="js/rhythm-beatmap.js"></script>
<script src="js/rhythm.js"></script>
```

- [ ] **Step 2: Стили в `css/styles.css`** — добавить переменные в `:root` (`--rg-target`, `--rg-note`, `--rg-lane`), затем:
  - `.btn-play` — как `.btn-replay`, крупнее, акцентная.
  - `.rhythm` — контейнер под «Л»; `.rhythm[hidden]{display:none}` (гоча `[hidden]`+`display`).
  - `.rhythm-lane` — горизонтальная линия, `position:relative; overflow:hidden; contain:layout paint;` фикс. высота в `dvh`/px, ширина в `min(92vw, ...)`. **Цель — слева.**
  - `.rhythm-target` — кольцо у левого края (`left`), центр по вертикали.
  - `.rhythm-note` — абсолютная точка/сердечко-блик; позиция через `left:%`; держать внутри lane.
  - `.rhythm-target.flash` / `.rhythm-note.hit` / `.rhythm-note.miss` — краткие вспышки/угасание.
  - `.finale.playing .finale-letter` — снять idle-анимацию (`animation:none`), курсор pointer.

- [ ] **Step 3: Визуальная проверка** (превью) — полоса рисуется под «Л», цель слева, нет горизонтального скролла.

- [ ] **Step 4: Commit**

```bash
git add index.html css/styles.css
git commit -m "feat(rhythm): finale lane markup + styles; wire scripts"
```

---

## Task 4: Тексты в config + связка в main.js

**Files:**
- Изменить: `js/config.js` (тексты)
- Изменить: `js/main.js` (инициализация игры, колбэки, пауза idle «Л»)

- [ ] **Step 1: config.js** — в `finale` добавить:
```js
play: "Играть в такт",
playHint: "Сыграй со мной — жми в ритм",
gameEnd: "люблю в ритм ❤️",
```

- [ ] **Step 2: main.js** — после блока финала:
  - Наполнить `#btn-play` текстом `finale.play`; показать (`hidden=false`) только если есть `window.RHYTHM_BEATMAP` и `RhythmGame`.
  - Хендлер `#btn-play` (`pointerdown`/`click`): гарантировать `audio.play()` (жест); `finale.classList.add("playing")` (снимает idle «Л»); скрыть кнопку, показать `#rhythm`; создать `RhythmGame({ audio, mount:#rhythm-lane, tapTargets:[finaleLetter, #rhythm-lane], beats, duration, onHit, onMiss, onComplete, reducedMotion })`; `game.start()`.
  - `onHit`: `boom({particleCount:30, spread:70, origin: <центр «Л»>})` (лёгкий залп конфетти вместо сердечек), обновить `#rhythm-combo` (`×N`), добавить класс яркости на `finale` по мере роста комбо.
  - `onMiss`: сбросить `#rhythm-combo`.
  - `onComplete`: `celebrate()` (большой залп) + показать `finale.gameEnd` (в `#rhythm-combo` или отдельной строке), `finale.classList.remove("playing")`, вернуть кнопку → текст «Ещё раз» (перезапуск игры), скрыть полосу.
  - **Разграничение тапа по «Л»:** существующий click→`heartsBurst` работает только когда НЕ `finale.classList.contains("playing")`; в игре тап по «Л» идёт движку (движок сам вешает свой `pointerdown` на `tapTargets`). Проверить, что не двоится (движок вешает свой listener; старый heartsBurst-хендлер добавить guard `if (finale.classList.contains('playing')) return;`).

- [ ] **Step 3: Проверка в превью** — кнопка «Играть» → полоса, ноты едут, тап по «Л» даёт конфетти и растит комбо, «Л» перестаёт idle-дёргаться; по концу — большой залп и «Ещё раз».

- [ ] **Step 4: Commit**

```bash
git add js/config.js js/main.js
git commit -m "feat(rhythm): wire game into finale (play button, confetti-on-hit, combo, end)"
```

---

## Task 5: PWA-кэш

**Files:**
- Изменить: `sw.js` (добавить новые файлы, поднять версию)

- [ ] **Step 1:** В `sw.js` добавить в список кэша `js/rhythm.js`, `js/rhythm-beatmap.js`; поднять `birthday-vN` → `birthday-v(N+1)`.
- [ ] **Step 2: Проверка** — `grep -n "rhythm" sw.js` показывает оба файла; версия увеличена.
- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "feat(rhythm): cache rhythm scripts in service worker, bump cache version"
```

---

## Task 6: E2E-тесты

**Files:**
- Изменить: `tests/e2e.spec.js`

Звук глушится в `beforeEach` (muted), но `currentTime` идёт. Клики по анимируемым элементам — `{ force: true }`.

- [ ] **Step 1: Тесты чистых хелперов** (быстро, через `page.evaluate` на загруженной странице):
```js
test("rhythm util: endTarget/noteX/nextLaps", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(() => {
    const u = window.RhythmGame.util, d = 72.744;
    return [
      u.endTarget(10, d, 10) === d,
      u.endTarget(68, d, 10) === 2 * d,
      Math.abs(u.noteX(0, 2) - 1) < 1e-9,
      u.noteX(2, 2) === 0,
      u.nextLaps(72.0, 0.1, 0, d) === 1,
      u.nextLaps(10, 10.5, 0, d) === 0,
    ];
  });
  expect(r.every(Boolean)).toBe(true);
});
```
- [ ] **Step 2: Тест старта игры** — открыть подарок, доскроллить до финала, `#btn-play` виден, тап (`force`) → `#rhythm` виден, `#finale.playing`, за ~1.5с в `#rhythm-lane` появляются `.rhythm-note`.
- [ ] **Step 3: Тест попадания** — во время игры несколько тапов по `#finale-letter`; `#rhythm-combo` непустой (комбо росло). (Без проверки точного числа — таймингозависимо.)
- [ ] **Step 4: Тест «нет горизонтального переполнения при видимой полосе»** — в игре `document.documentElement.scrollWidth <= innerWidth + 1` (ключевой iOS-тест).
- [ ] **Step 5: Прогнать всё**

```bash
npm test
```
Ожидаемо: все проекты (WebKit+Chrome) зелёные, включая старые тесты.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e.spec.js
git commit -m "test(rhythm): e2e — util, game start, hit combo, no horizontal overflow"
```

---

## Task 7: Документация

**Files:**
- Изменить: `CLAUDE.md`, `docs/DOCUMENTATION.md` (и `README.md` при необходимости)

- [ ] **Step 1:** Через скилл `update-docs`: в `CLAUDE.md` — сцена (финал + ритм-игра), новые файлы (`js/rhythm.js`, `js/rhythm-beatmap.js`, `tools/beatmap/`), гочи (аудио-часы, конец-на-границе, портируемость). В `docs/DOCUMENTATION.md` — раздел про движок и карту битов.
- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md docs/DOCUMENTATION.md README.md
git commit -m "docs: rhythm game (scene, files, gotchas)"
```

---

## Self-review заметки

- Спека покрыта: старт-с-позиции (Task 2 `start`), конец-на-границе+minPlay=10 (Task 2 `endTarget`), конфетти-на-тап (Task 4 `onHit`), «Л»-кнопка+пауза idle (Task 3/4), портируемость (Task 2 API), тулинг+gitignore (Task 1), iOS-гочи (Task 3/6), тесты (Task 6), доки (Task 7).
- Типы согласованы: `endTarget/noteX/nextLaps` одинаково названы в Task 2 и Task 6.
- Плейсхолдеров нет; фолбэк BPM описан в Task 1.
