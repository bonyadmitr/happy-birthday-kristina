#!/usr/bin/env python3
"""
Извлечение карты битов из mp3 в js/rhythm-beatmap.js (разовый оффлайн-шаг).

Не деплоится и не нужен в рантайме — сайт использует уже готовый
js/rhythm-beatmap.js. Запускать заново только при смене песни.

Использование:
    tools/beatmap/.venv/bin/python tools/beatmap/extract.py \
        assets/audio/mary-on-a-cross-loop.mp3 \
        --src assets/audio/mary-on-a-cross-loop.mp3 \
        --out js/rhythm-beatmap.js

Опции:
    --min-gap  минимальный интервал между нотами (сек), прореживает частые доли
    --bpm      фолбэк: ровная сетка по BPM вместо анализа (если анализ «грязный»)
    --offset   сдвиг первой доли для --bpm (сек)
"""
import argparse
import sys


def beats_from_analysis(path, min_gap):
    import librosa
    y, sr = librosa.load(path, sr=None, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)
    _, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units="frames")
    times = librosa.frames_to_time(beat_frames, sr=sr)
    beats = thin(list(times), min_gap)
    return duration, beats


def beats_from_bpm(path, bpm, offset, min_gap):
    import librosa
    y, sr = librosa.load(path, sr=None, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)
    step = 60.0 / bpm
    beats, t = [], offset
    while t < duration:
        beats.append(t)
        t += step
    return duration, thin(beats, min_gap)


def thin(beats, min_gap):
    """Убрать доли ближе min_gap друг к другу (сохраняя первую в группе)."""
    out = []
    for b in sorted(beats):
        if not out or b - out[-1] >= min_gap:
            out.append(round(float(b), 3))
    return out


def write_js(out_path, src, duration, beats):
    rows = []
    for i in range(0, len(beats), 10):
        rows.append("    " + ", ".join(f"{b:.3f}" for b in beats[i : i + 10]))
    beats_js = ",\n".join(rows)
    js = (
        "// Карта битов Mary on a Cross — СГЕНЕРЕНО tools/beatmap/extract.py.\n"
        "// Не редактировать руками; пересобрать: см. tools/beatmap/extract.py.\n"
        "// Данные конкретной песни, отдельно от движка (js/rhythm.js).\n"
        "window.RHYTHM_BEATMAP = {\n"
        f'  src: "{src}",\n'
        f"  duration: {duration:.3f}, // длина лупа, сек\n"
        f"  beats: [ // {len(beats)} долей, времена в секундах от начала лупа\n"
        f"{beats_js}\n"
        "  ],\n"
        "};\n"
    )
    with open(out_path, "w") as f:
        f.write(js)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("--src", required=True, help="путь к аудио как в рантайме сайта")
    ap.add_argument("--out", default="js/rhythm-beatmap.js")
    ap.add_argument("--min-gap", type=float, default=0.28)
    ap.add_argument("--bpm", type=float, default=None)
    ap.add_argument("--offset", type=float, default=0.0)
    args = ap.parse_args()

    if args.bpm:
        duration, beats = beats_from_bpm(args.audio, args.bpm, args.offset, args.min_gap)
    else:
        duration, beats = beats_from_analysis(args.audio, args.min_gap)

    if not beats:
        print("НЕТ долей — проверь файл/опции", file=sys.stderr)
        sys.exit(1)

    write_js(args.out, args.src, duration, beats)
    print(f"OK: {len(beats)} долей, duration={duration:.3f}s -> {args.out}")


if __name__ == "__main__":
    main()
