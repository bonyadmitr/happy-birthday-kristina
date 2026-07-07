/* ============================================================================
 *  Логика сайта. Персонализация — в config.js, стили/темы — в styles.css.
 * ========================================================================== */
(function () {
  "use strict";

  var CFG = window.BIRTHDAY_CONFIG || {};
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Запрет масштабирования (Safari на iOS игнорирует user-scalable=no) —
  // гасим pinch-жесты. Двойной-тап-зум снимается через touch-action: manipulation в CSS.
  ["gesturestart", "gesturechange", "gestureend"].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false });
  });

  function $(id) {
    return document.getElementById(id);
  }
  function setText(id, value) {
    var el = $(id);
    if (el && value != null && value !== "") el.textContent = value;
  }

  /* ---- Наполнение из конфига ------------------------------------------- */
  setText("gift-hint", (CFG.gift && CFG.gift.hint) || "Нажми на подарок 🎁");
  setText("hero-greeting", CFG.hero && CFG.hero.greeting);
  setText("hero-name", CFG.name || "С днём рождения");
  setText("hero-subtitle", CFG.hero && CFG.hero.subtitle);

  var finale = CFG.finale || {};
  setText("finale-letter", finale.letter || "Л");
  if (finale.caption) {
    var cap = $("finale-caption");
    cap.textContent = finale.caption;
    cap.hidden = false;
  }
  setText("btn-replay", finale.replay || "Ещё раз сначала");

  document.title = "С днём рождения, " + (CFG.name || "") + " 🎂";

  /* ---- Конфетти --------------------------------------------------------- */
  function confettiColors() {
    var raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--confetti-colors")
      .trim();
    return raw
      ? raw.split(",").map(function (c) {
          return c.trim();
        })
      : undefined;
  }
  function boom(opts) {
    if (typeof confetti !== "function") return;
    var base = { colors: confettiColors(), disableForReducedMotion: true };
    confetti(Object.assign(base, opts));
  }
  function celebrate() {
    boom({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
    setTimeout(function () {
      boom({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.65 } });
      boom({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.65 } });
    }, 180);
  }
  // Разные сердечки-эмодзи как формы для конфетти (создаём один раз).
  var heartShapes = null;
  function getHeartShapes() {
    if (heartShapes === null && typeof confetti === "function" && confetti.shapeFromText) {
      // Красных больше, чем розовых: ❤️ повторён + ❤️‍🔥 (шансы взвешиваются частотой в массиве).
      heartShapes = ["❤️", "❤️", "❤️‍🔥", "❤️‍🔥", "🩷", "💕", "💖", "💘"].map(function (t) {
        return confetti.shapeFromText({ text: t, scalar: 2.6 });
      });
    }
    return heartShapes;
  }
  // Салют из сердечек, вылетающих из самой буквы «Л».
  function heartsBurst(originEl) {
    if (typeof confetti !== "function") return;
    var origin = { y: 0.5 };
    if (originEl) {
      var r = originEl.getBoundingClientRect();
      origin = {
        x: (r.left + r.width / 2) / window.innerWidth,
        y: (r.top + r.height / 2) / window.innerHeight,
      };
    }
    var opts = {
      particleCount: 26,
      spread: 90,
      startVelocity: 40,
      scalar: 2.6,
      gravity: 0.9,
      ticks: 220,
      flat: true,
      origin: origin,
      disableForReducedMotion: true,
    };
    var shapes = getHeartShapes();
    if (shapes && shapes.length) opts.shapes = shapes;
    confetti(opts);
  }

  /* ---- Распаковка подарка ---------------------------------------------- */
  var giftScreen = $("gift-screen");
  var gift = $("gift");
  var opened = false;

  function openGift() {
    if (opened) return;
    opened = true;
    giftScreen.classList.add("opening");
    celebrate();
    setTimeout(function () {
      giftScreen.classList.add("gone");
      var site = $("site");
      site.hidden = false;
      // Запустить reveal для первой секции сразу.
      requestAnimationFrame(initReveal);
      startFloaties();
    }, 620);
  }

  giftScreen.addEventListener("click", openGift);
  gift.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openGift();
    }
  });

  // Распаковка встряхиванием телефона (если доступно и разрешено).
  function enableShake() {
    if (typeof DeviceMotionEvent === "undefined") return;
    window.addEventListener("devicemotion", function onMotion(e) {
      var a = e.accelerationIncludingGravity;
      if (!a) return;
      var force = Math.abs(a.x || 0) + Math.abs(a.y || 0) + Math.abs(a.z || 0);
      if (force > 32) {
        window.removeEventListener("devicemotion", onMotion);
        openGift();
      }
    });
  }
  enableShake();

  /* ---- Reveal on scroll (IntersectionObserver) ------------------------- */
  var io;
  function initReveal() {
    var items = document.querySelectorAll(".site .reveal:not(.in)");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("in");
      });
      return;
    }
    if (!io) {
      io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.18 }
      );
    }
    items.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ---- Финал: буква «Л» ------------------------------------------------- */
  var finaleLetter = $("finale-letter");
  if (finaleLetter) {
    finaleLetter.addEventListener("click", function () {
      heartsBurst(finaleLetter);
    });
    finaleLetter.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        heartsBurst(finaleLetter);
      }
    });
  }

  /* ---- Кнопка «ещё раз» ------------------------------------------------- */
  var replay = $("btn-replay");
  if (replay) {
    replay.addEventListener("click", function () {
      celebrate();
    });
  }

  /* ---- Плавающие частицы ------------------------------------------------ */
  var EMOJI = ["🎈", "❤️", "🩷", "✨", "🎉", "💫"];
  var floatiesStarted = false;
  function startFloaties() {
    if (floatiesStarted || reduceMotion) return;
    floatiesStarted = true;
    var host = $("floaties");
    if (!host) return;
    var count = window.innerWidth < 480 ? 10 : 16;

    function spawn(i) {
      var el = document.createElement("span");
      el.className = "floaty";
      el.textContent = EMOJI[i % EMOJI.length];
      el.style.left = Math.random() * 100 + "vw";
      el.style.setProperty("--sz", 1.2 + Math.random() * 1.8 + "rem");
      el.style.setProperty("--op", (0.35 + Math.random() * 0.45).toFixed(2));
      el.style.setProperty("--dur", 11 + Math.random() * 12 + "s");
      el.style.setProperty("--delay", -Math.random() * 12 + "s");
      el.style.setProperty("--drift", (Math.random() * 16 - 8).toFixed(1) + "vw");
      el.style.setProperty("--spin", Math.floor(Math.random() * 120 - 60) + "deg");
      host.appendChild(el);
    }
    for (var i = 0; i < count; i++) spawn(i);
  }

  /* ---- Музыка (опционально, старт по тапу) ----------------------------- */
  var music = CFG.music || {};
  if (music.url) {
    var audio = $("bg-audio");
    var toggle = $("music-toggle");
    audio.src = music.url;
    toggle.hidden = false;
    toggle.setAttribute("aria-label", music.title || "Музыка");
    var playing = false;
    toggle.addEventListener("click", function () {
      if (playing) {
        audio.pause();
        toggle.classList.remove("playing");
      } else {
        audio.play().catch(function () {});
        toggle.classList.add("playing");
      }
      playing = !playing;
    });
    // Автостарт при первой распаковке (в рамках пользовательского жеста).
    giftScreen.addEventListener(
      "click",
      function once() {
        audio.play().then(function () {
          playing = true;
          toggle.classList.add("playing");
        }).catch(function () {});
        giftScreen.removeEventListener("click", once);
      }
    );
  }
})();
