// Playwright: гоняем сайт в РЕАЛЬНОМ движке WebKit (Safari) + Chromium, с эмуляцией
// мобильного iPhone (dpr 3). Именно WebKit ловит iOS-специфику (горизонтальный
// скролл, швы фикс-слоёв), которую Chromium-превью не показывает.
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:8123",
    trace: "on-first-retry",
  },
  // Playwright сам поднимет статический сервер на время тестов.
  webServer: {
    command: "python3 -m http.server 8123",
    url: "http://localhost:8123",
    reuseExistingServer: true,
    timeout: 30000,
  },
  projects: [
    { name: "iphone-safari", use: { ...devices["iPhone 13"] } },
    { name: "android-chrome", use: { ...devices["Pixel 7"] } },
  ],
});
