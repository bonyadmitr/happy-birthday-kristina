// E2E-проверки сайта-поздравления. Гоняются в WebKit (iPhone) и Chrome (Android).
// Покрывают именно то, что мы чинили руками: переполнение по X, центрирование,
// границы частиц, «тап только по подарку», отсутствие ошибок в консоли.
const { test, expect } = require("@playwright/test");

// Собираем ошибки консоли/страницы для каждого теста.
function trackErrors(page) {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

// Глушим звук во ВСЕХ тестах (init-скрипт ставится до загрузки страницы,
// патчит прототип audio: muted+volume 0 при каждом play). Это выключает только
// звук — состояние воспроизведения (paused) не меняется, поэтому спец-тест музыки
// ниже всё равно может проверить, что трек «играет».
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const proto = HTMLMediaElement.prototype;
    const origPlay = proto.play;
    proto.play = function () {
      this.muted = true;
      this.volume = 0;
      return origPlay.apply(this, arguments);
    };
  });
});

// Открыть подарок и дождаться показа основного сайта.
// force:true — подарок постоянно анимируется (gift-idle), Playwright иначе
// бесконечно ждёт «стабильности» элемента.
async function openGift(page) {
  await page.locator("#gift").click({ force: true });
  await expect(page.locator("#site")).toBeVisible();
  await page.waitForTimeout(800); // reveal + частицы
}

test.describe("Экран подарка", () => {
  test("грузится без ошибок консоли", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    await expect(page.locator("#gift")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("открывается только по тапу на подарок, не по всему экрану", async ({ page }) => {
    await page.goto("/");
    // клик мимо подарка (по подсказке) — не открывает
    await page.locator("#gift-hint").click({ force: true });
    await expect(page.locator("#site")).toBeHidden();
    // клик по подарку — открывает
    await page.locator("#gift").click({ force: true });
    await expect(page.locator("#site")).toBeVisible();
  });
});

test.describe("После раскрытия", () => {
  test("нет горизонтального скролла", async ({ page }) => {
    await page.goto("/");
    await openGift(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("имя влезает по ширине и центрировано", async ({ page }) => {
    await page.goto("/");
    await openGift(page);
    const m = await page.evaluate(() => {
      const r = document.getElementById("hero-name").getBoundingClientRect();
      return {
        vw: window.innerWidth,
        width: r.width,
        centerOffset: (r.left + r.right) / 2 - window.innerWidth / 2,
      };
    });
    expect(m.width).toBeLessThanOrEqual(m.vw * 0.96);
    expect(Math.abs(m.centerOffset)).toBeLessThanOrEqual(1.5);
  });

  test("плавающие частицы не выходят за вьюпорт", async ({ page }) => {
    await page.goto("/");
    await openGift(page);
    const b = await page.evaluate(() => {
      let maxRight = 0,
        minLeft = 1e9;
      document.querySelectorAll(".floaty").forEach((f) => {
        const r = f.getBoundingClientRect();
        maxRight = Math.max(maxRight, r.right);
        minLeft = Math.min(minLeft, r.left);
      });
      return { maxRight, minLeft, vw: window.innerWidth };
    });
    expect(b.maxRight).toBeLessThanOrEqual(b.vw + 1);
    expect(b.minLeft).toBeGreaterThanOrEqual(-1);
  });

  test("буква «Л» оптически по центру", async ({ page }) => {
    await page.goto("/");
    await openGift(page);
    await page.locator("#finale").scrollIntoViewIfNeeded();
    const offset = await page.evaluate(() => {
      const el = document.getElementById("finale-letter");
      const cs = getComputedStyle(el);
      const fs = parseFloat(cs.fontSize);
      const r = el.getBoundingClientRect();
      const c = document.createElement("canvas").getContext("2d");
      c.font = `${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
      const t = el.textContent;
      const mt = c.measureText(t);
      const penX = r.left + parseFloat(cs.paddingLeft) + parseFloat(cs.textIndent);
      const inkCenter = penX + (-mt.actualBoundingBoxLeft + mt.actualBoundingBoxRight) / 2;
      return inkCenter - window.innerWidth / 2;
    });
    // порог 6px: сдвиг < 2% ширины буквы (незаметно), с запасом на разницу
    // метрик шрифта WebKit/Chromium; реальные регрессии центра были 40px+.
    expect(Math.abs(offset)).toBeLessThanOrEqual(6);
  });

  test("тап по «Л» не выделяет текст", async ({ page }) => {
    await page.goto("/");
    await openGift(page);
    await page.locator("#finale-letter").dblclick({ force: true });
    const sel = await page.evaluate(() => window.getSelection().toString());
    expect(sel).toBe("");
  });
});

// PWA: манифест, иконки, регистрация service worker. Пути относительные —
// из-за подпапки GitHub Pages (см. sw.js / manifest.json).
test.describe("PWA", () => {
  test("манифест слинкован и валиден, пути относительные", async ({ page, request }) => {
    await page.goto("/");
    // ссылка в <head>
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "manifest.json");
    // сам файл отдаётся и парсится
    const res = await request.get("/manifest.json");
    expect(res.status()).toBe(200);
    const m = await res.json();
    expect(m.icons.length).toBeGreaterThanOrEqual(2);
    // относительные (не начинаются с "/") — иначе сломается в подпапке Pages
    expect(m.start_url).toBe("./");
    expect(m.scope).toBe("./");
    for (const ic of m.icons) expect(ic.src.startsWith("/")).toBe(false);
  });

  test("все иконки отдаются (нет 404)", async ({ page, request }) => {
    const res = await request.get("/manifest.json");
    const m = await res.json();
    const srcs = m.icons.map((i) => i.src);
    // apple-touch-icon берём из DOM
    await page.goto("/");
    const apple = await page.getAttribute('link[rel="apple-touch-icon"]', "href");
    srcs.push(apple);
    for (const src of srcs) {
      const r = await request.get("/" + src);
      expect(r.status(), src).toBe(200);
    }
  });

  test("service worker регистрируется", async ({ page }) => {
    await page.goto("/");
    // register() висит на window.load; ждём готовности с запасом по времени
    const scope = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return null;
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((r) => setTimeout(() => r(null), 8000)),
      ]);
      return reg ? reg.scope : null;
    });
    expect(scope).toBeTruthy();
  });
});

// Спец-тест: музыка работает (звук по-прежнему заглушён init-скриптом выше —
// проверяем именно состояние воспроизведения, а не слышимость).
test.describe("Музыка", () => {
  test("кнопка появляется и трек играет после тапа по подарку", async ({ page }) => {
    await page.goto("/");
    await openGift(page);
    await expect(page.locator("#music-toggle")).toBeVisible();
    // play() внутри жеста тапа — дождёмся, что аудио перестало быть на паузе
    await expect
      .poll(async () => page.evaluate(() => document.getElementById("bg-audio").paused))
      .toBe(false);
    const a = await page.evaluate(() => {
      const el = document.getElementById("bg-audio");
      return { hasSrc: !!el.getAttribute("src"), loop: el.loop };
    });
    expect(a.hasSrc).toBe(true);
    expect(a.loop).toBe(true);
  });

  test("кнопкой можно поставить на паузу и снова включить", async ({ page }) => {
    await page.goto("/");
    await openGift(page);
    const toggle = page.locator("#music-toggle");
    await expect.poll(() => page.evaluate(() => document.getElementById("bg-audio").paused)).toBe(false);
    await toggle.click({ force: true }); // пауза
    await expect.poll(() => page.evaluate(() => document.getElementById("bg-audio").paused)).toBe(true);
    await toggle.click({ force: true }); // снова играть
    await expect.poll(() => page.evaluate(() => document.getElementById("bg-audio").paused)).toBe(false);
  });
});

// Ритм-игра под «Л»: чистые хелперы движка + флоу (старт, попадания, границы).
// Звук заглушён (beforeEach), но currentTime идёт — игру можно гонять.
test.describe("Ритм-игра", () => {
  // Довести до финала и запустить игру (музыка = часы, ждём что играет).
  async function startRhythm(page) {
    await openGift(page);
    await expect.poll(() => page.evaluate(() => document.getElementById("bg-audio").paused)).toBe(false);
    await page.locator("#finale").scrollIntoViewIfNeeded();
    const btn = page.locator("#btn-play");
    await expect(btn).toBeVisible();
    await btn.click({ force: true });
    await expect(page.locator("#rhythm")).toBeVisible();
  }

  test("util: endTarget/noteX/nextLaps считают верно", async ({ page }) => {
    await page.goto("/");
    const r = await page.evaluate(() => {
      const u = window.RhythmGame.util,
        d = 72.716;
      return [
        u.endTarget(10, d, 10) === d, // старт в начале → конец на 1-й границе
        u.endTarget(68, d, 10) === 2 * d, // старт под конец → следующая граница
        Math.abs(u.noteX(0, 2) - 1) < 1e-9, // у цели
        u.noteX(2, 2) === 0, // только заспавнилась
        u.noteX(1, 2) === 0.5, // на полпути
        u.noteX(-0.3, 2) > 1, // прошла долю («в минус») → уезжает СКВОЗЬ кольцо влево
        u.nextLaps(72.0, 0.1, 0, d) === 1, // обёртка лупа → +1
        u.nextLaps(10, 10.5, 0, d) === 0, // обычный ход времени
      ];
    });
    expect(r.every(Boolean)).toBe(true);
  });

  test("у конца трека не спавнятся ноты, которые не успеть нажать", async ({ page }) => {
    // Детерминированно, на фейковом аудио: у границы лупа все будущие доли —
    // следующего прохода (absT > endAbs), их спавнить нельзя (иначе выедут, но
    // игра кончится раньше, чем доедут до кольца → нажать невозможно).
    await page.goto("/");
    const r = await page.evaluate(async () => {
      function frames(n) {
        return new Promise((res) => {
          let i = 0;
          (function s() {
            if (i++ >= n) return res();
            requestAnimationFrame(s);
          })();
        });
      }
      const mount = document.createElement("div");
      document.body.appendChild(mount);
      const fake = {
        currentTime: 0.1,
        duration: 10,
        play: () => Promise.resolve(),
        addEventListener() {},
        removeEventListener() {},
      };
      const g = window.RhythmGame({
        audio: fake,
        mount,
        tapTargets: [],
        beats: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        duration: 10,
        leadTime: 2,
        hitWindow: 0.3,
        minPlay: 3, // startAbs 0.1 → endAbs = 10
      });
      g.start();
      fake.currentTime = 4.0;
      await frames(4);
      const midLive = mount.querySelectorAll(".rhythm-note:not(.miss):not(.hit)").length;
      fake.currentTime = 9.5; // у конца: дальше только доли следующего лупа (>10)
      await frames(6);
      const endLive = mount.querySelectorAll(".rhythm-note:not(.miss):not(.hit)").length;
      g.stop();
      mount.remove();
      return { midLive, endLive };
    });
    expect(r.midLive).toBeGreaterThan(0); // в середине ноты есть
    expect(r.endLive).toBe(0); // у конца новых (нажимаемых) нот нет
  });

  test("кнопка «Играть» включает режим игры: полоса, класс, ноты", async ({ page }) => {
    await page.goto("/");
    await startRhythm(page);
    expect(
      await page.evaluate(() => document.getElementById("finale").classList.contains("playing"))
    ).toBe(true);
    // idle-анимация «Л» снята в режиме игры
    expect(
      await page.evaluate(() => getComputedStyle(document.getElementById("finale-letter")).animationName)
    ).toBe("none");
    // ноты появляются по мере хода трека
    await expect
      .poll(() => page.evaluate(() => document.querySelectorAll("#rhythm-lane .rhythm-note").length), {
        timeout: 4000,
      })
      .toBeGreaterThan(0);
  });

  test("тап по «Л» в такт растит комбо", async ({ page }) => {
    await page.goto("/");
    await startRhythm(page);
    const combo = await page.evaluate(async () => {
      const letter = document.getElementById("finale-letter");
      const lane = document.getElementById("rhythm-lane");
      const comboEl = document.getElementById("rhythm-combo");
      let maxText = "";
      const end = performance.now() + 5000;
      while (performance.now() < end) {
        const notes = lane.querySelectorAll(".rhythm-note:not(.hit):not(.miss)");
        for (const n of notes) {
          const L = parseFloat(n.style.left);
          if (L >= 9 && L <= 15) {
            // нота у кольца-цели
            letter.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
            break;
          }
        }
        if (comboEl.textContent) maxText = comboEl.textContent;
        await new Promise((r) => setTimeout(r, 25));
      }
      return maxText;
    });
    expect(combo).toMatch(/×\d+/);
  });

  test("нет горизонтального переполнения при видимой полосе", async ({ page }) => {
    await page.goto("/");
    await startRhythm(page);
    await page.waitForTimeout(1500); // дать нотам заспавниться и поехать
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
