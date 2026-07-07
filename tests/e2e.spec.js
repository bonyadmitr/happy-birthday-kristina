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
