/* ============================================================================
 *  RhythmGame — обобщённый движок ритм-игры (одна полоса, одна кнопка).
 *
 *  Портируемый: ничего не знает про день рождения. Источник времени — аудио
 *  (audio.currentTime), синк не плывёт при просадке кадров и не нужен Web Audio.
 *  Движок НЕ трогает аудио (не перематывает/не останавливает) — только читает.
 *  Вся привязка к сайту — снаружи через колбэки (onHit/onMiss/onComplete).
 *
 *  window.RhythmGame(opts) -> { start, stop }
 *    opts: {
 *      audio,                 // HTMLAudioElement — часы и звук
 *      mount,                 // элемент полосы (position:relative)
 *      tapTargets: [el,...],  // элементы, pointerdown по которым = попытка попадания
 *      beats: [t,...],        // времена долей в секундах от начала лупа, возрастание
 *      duration,              // длина лупа, сек
 *      leadTime = 2.0,        // за сколько сек нота выезжает справа
 *      hitWindow = 0.18,      // ± сек допуска на попадание
 *      minPlay = 10,          // мин. длительность прохода (правило конца-на-границе)
 *      targetPct = 12,        // позиция кольца-цели от левого края, %
 *      onHit(info), onMiss(info), onComplete(stats),
 *      reducedMotion = false,
 *    }
 *  RhythmGame.util — чистые хелперы (для тестов): endTarget, noteX, nextLaps.
 * ========================================================================== */
(function () {
  "use strict";

  /* --- Чистые хелперы (тестируемы отдельно) ----------------------------- */

  // Абсолютное время конца игры: ближайшая граница лупа k*duration с зазором
  // >= minPlay от старта. Стартовал под конец лупа → доиграешь до следующей.
  function endTarget(startAbs, duration, minPlay) {
    var k = Math.ceil((startAbs + minPlay) / duration);
    return k * duration;
  }

  // Доля пути ноты: 0 — только заспавнилась справа (dt = leadTime), 1 — дошла до
  // цели (dt = 0). dt = t - now (сек до доли). Сверху НЕ ограничиваем: при dt < 0
  // (доля уже прошла, но ещё в окне попадания «в минус») нота проезжает СКВОЗЬ
  // кольцо и уезжает левее него — иначе она «застревала» в центре цели.
  function noteX(dt, leadTime) {
    var p = 1 - dt / leadTime;
    return p < 0 ? 0 : p;
  }

  // Счётчик оборотов лупа: currentTime резко упал (конец → начало) => +1.
  // Гистерезис 0.5с, чтобы дрожание времени не давало ложных срабатываний.
  function nextLaps(prevT, curT, laps, duration) {
    return curT + 0.5 < prevT ? laps + 1 : laps;
  }

  /* --- Фабрика ---------------------------------------------------------- */

  function RhythmGame(opts) {
    var audio = opts.audio;
    var mount = opts.mount;
    var tapTargets = opts.tapTargets || [];
    var beats = opts.beats || [];
    var duration = opts.duration;
    var leadTime = opts.leadTime != null ? opts.leadTime : 2.0;
    var hitWindow = opts.hitWindow != null ? opts.hitWindow : 0.18;
    var minPlay = opts.minPlay != null ? opts.minPlay : 10;
    var targetPct = opts.targetPct != null ? opts.targetPct : 12;
    var reducedMotion = !!opts.reducedMotion;
    var onHit = opts.onHit || function () {};
    var onMiss = opts.onMiss || function () {};
    var onComplete = opts.onComplete || function () {};

    var raf = 0;
    var running = false;
    var prevT = 0;
    var laps = 0;
    var startAbs = 0;
    var endAbs = 0;
    var combo = 0;
    var maxCombo = 0;
    var hits = 0;
    var notes = []; // { absT, el, judged }
    var spawned = {}; // ключ absT.toFixed(3) -> true

    function absTime() {
      return laps * duration + audio.currentTime;
    }

    // Позиция ноты по X (%): цель слева (targetPct), спавн справа (100%).
    function placeNote(el, p) {
      el.style.left = (targetPct + (1 - p) * (100 - targetPct)).toFixed(2) + "%";
    }

    function spawnNote(absT) {
      var el = document.createElement("span");
      el.className = "rhythm-note";
      placeNote(el, 0);
      mount.appendChild(el);
      notes.push({ absT: absT, el: el, judged: false });
    }

    function removeNote(n, cls) {
      if (n.judged) return;
      n.judged = true;
      if (cls) n.el.classList.add(cls);
      var el = n.el;
      // Дать краткую CSS-вспышку/угасание, затем убрать из DOM.
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, reducedMotion ? 0 : 220);
    }

    function tick() {
      if (!running) return;
      var curT = audio.currentTime;
      laps = nextLaps(prevT, curT, laps, duration);
      prevT = curT;
      var now = absTime();

      if (now >= endAbs) {
        stop();
        onComplete({ maxCombo: maxCombo, hits: hits });
        return;
      }

      // Спавн предстоящих долей (текущий и следующий луп покрывают окно leadTime).
      for (var lap = laps; lap <= laps + 1; lap++) {
        for (var i = 0; i < beats.length; i++) {
          var absT = beats[i] + lap * duration;
          var dt = absT - now;
          if (dt > leadTime || dt < -hitWindow) continue;
          var key = absT.toFixed(3);
          if (!spawned[key]) {
            spawned[key] = true;
            spawnNote(absT);
          }
        }
      }

      // Обновить позиции живых нот; пролетевшие мимо — промах.
      for (var j = notes.length - 1; j >= 0; j--) {
        var n = notes[j];
        var d = n.absT - now;
        if (!n.judged) {
          if (d < -hitWindow) {
            removeNote(n, "miss");
            combo = 0;
            onMiss({ combo: combo });
          } else {
            placeNote(n.el, noteX(d, leadTime));
          }
        }
        // Подчистить массив от давно удалённых.
        if (n.judged && !n.el.parentNode) notes.splice(j, 1);
      }

      raf = requestAnimationFrame(tick);
    }

    // Попытка попадания: ближайшая живая нота в окне hitWindow.
    function tryHit() {
      if (!running) return;
      var now = absTime();
      var best = null;
      var bestAbs = Infinity;
      for (var i = 0; i < notes.length; i++) {
        var n = notes[i];
        if (n.judged) continue;
        var d = Math.abs(n.absT - now);
        if (d <= hitWindow && d < bestAbs) {
          bestAbs = d;
          best = n;
        }
      }
      if (best) {
        removeNote(best, "hit");
        combo++;
        if (combo > maxCombo) maxCombo = combo;
        hits++;
        onHit({ combo: combo });
      }
      // Пустой тап (нет ноты в окне) — ничего плохого, просто без отдачи.
    }

    function onTargetDown(e) {
      // pointerdown отзывчивее click на iOS; гасим прокрутку/зум.
      if (e && e.cancelable) e.preventDefault();
      tryHit();
    }

    function start() {
      if (running) return;
      running = true;
      combo = 0;
      maxCombo = 0;
      hits = 0;
      notes = [];
      spawned = {};
      laps = 0;
      prevT = audio.currentTime;
      startAbs = audio.currentTime;
      endAbs = endTarget(startAbs, duration, minPlay);
      tapTargets.forEach(function (el) {
        el.addEventListener("pointerdown", onTargetDown);
      });
      raf = requestAnimationFrame(tick);
    }

    function stop() {
      if (!running) return;
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      tapTargets.forEach(function (el) {
        el.removeEventListener("pointerdown", onTargetDown);
      });
      notes.forEach(function (n) {
        if (n.el.parentNode) n.el.parentNode.removeChild(n.el);
      });
      notes = [];
      // Аудио НЕ трогаем.
    }

    return { start: start, stop: stop };
  }

  RhythmGame.util = { endTarget: endTarget, noteX: noteX, nextLaps: nextLaps };
  window.RhythmGame = RhythmGame;
})();
