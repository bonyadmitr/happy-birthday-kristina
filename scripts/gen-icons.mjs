// ============================================================================
//  Генератор PWA-иконок из ❤️ — разовый запуск: `npm run icons`.
//  Рендерит SVG (сердечко на фирменном розовом градиенте сайта) в PNG через
//  уже установленный Playwright (chromium). Никаких внешних утилит (ImageMagick
//  и т.п.) не нужно. Результат кладётся в assets/icons/ и коммитится — в рантайме
//  сайт ничего не генерирует.
// ============================================================================
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "assets", "icons");

// Палитра сайта (css/styles.css :root). Держать в синхроне при смене темы.
const GRAD_TOP = "#fff2f7"; // --rose-50
const GRAD_BOT = "#ffc9dd"; // --rose-200
const HEART = "#e23a72"; // --accent-deep
const HEART_HI = "#ff7eb3"; // блик (theme-color)

// Симметричный путь-сердечко (Material "favorite") в боксе 0..24,
// зеркальный относительно x=12. Строго по центру — не «кривой».
const HEART_PATH =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

// Один SVG-иконки. size — сторона в px. rounded — скруглять углы плитки
// (для "any"/apple). heartFrac — доля стороны под сердечко (для maskable меньше,
// чтобы влезть в safe-zone Android-маски). full — заливать весь квадрат фоном.
function svg({ size, rounded, heartFrac, glow }) {
  const r = rounded ? Math.round(size * 0.22) : 0;
  const hs = size * heartFrac; // сторона сердечка
  const hx = (size - hs) / 2;
  const hy = (size - hs) / 2;
  const scale = hs / 24;
  return `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:transparent}</style>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${GRAD_TOP}"/>
      <stop offset="1" stop-color="${GRAD_BOT}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.46" r="0.5">
      <stop offset="0" stop-color="${HEART_HI}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${HEART_HI}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="heart" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${HEART_HI}"/>
      <stop offset="0.35" stop-color="${HEART}"/>
      <stop offset="1" stop-color="${HEART}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#bg)"/>
  ${glow ? `<rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#glow)"/>` : ""}
  <g transform="translate(${hx},${hy}) scale(${scale})">
    <path d="${HEART_PATH}" fill="url(#heart)"/>
  </g>
</svg>`;
}

const TARGETS = [
  { file: "icon-192.png", size: 192, rounded: true, heartFrac: 0.62, glow: true },
  { file: "icon-512.png", size: 512, rounded: true, heartFrac: 0.62, glow: true },
  // maskable: фон на весь квадрат (углы срежет маска), сердечко в safe-zone ~52%.
  { file: "icon-maskable-512.png", size: 512, rounded: false, heartFrac: 0.52, glow: true },
  // apple-touch: iOS сам скругляет; фон на весь квадрат, без прозрачности.
  { file: "apple-touch-icon-180.png", size: 180, rounded: false, heartFrac: 0.62, glow: true },
];

// Реальный установленный Chrome (channel:"chrome") — как в playwright.config.js.
// Скачанный Chromium в проекте намеренно отсутствует (кэшируется только WebKit).
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
await mkdir(OUT, { recursive: true });

for (const t of TARGETS) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(svg(t), { waitUntil: "load" });
  const el = await page.$("svg");
  // rounded → углы вне плитки прозрачны; maskable/apple → квадрат непрозрачный.
  await el.screenshot({ path: join(OUT, t.file), omitBackground: t.rounded });
  console.log(`✓ ${t.file} (${t.size}×${t.size})`);
}

await browser.close();
console.log("Готово: assets/icons/");
