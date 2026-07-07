#!/usr/bin/env bash
# PreToolUse-хук (matcher: Bash). Не даёт закоммитить изменения ИСХОДНИКОВ сайта
# без обновления документации — чтобы доки обновлялись после любого фикса.
#
# Логика: если в рабочем дереве изменены index.html / css/ / js/main.js,
# а доки (CLAUDE.md / README.md / docs/) — нет, блокируем `git commit` (exit 2)
# и просим сначала обновить доку. Правки только в config.js/confetti.js/tests/
# документацию не требуют и не блокируются.
#
# Читает JSON события со stdin. Проверяется весь рабочий tree (git status),
# т.к. типичный коммит идёт как `git add -A && git commit` — staged-диффа
# на момент PreToolUse ещё нет.

c=$(jq -r '.tool_input.command // ""')
case "$c" in
  *"git commit"*)
    changed=$(git status --porcelain 2>/dev/null | sed 's/^...//')
    src=$(printf '%s\n' "$changed" | grep -E '^(index\.html|css/|js/main\.js)' || true)
    docs=$(printf '%s\n' "$changed" | grep -E '^(CLAUDE\.md|README\.md|docs/)' || true)
    if [ -n "$src" ] && [ -z "$docs" ]; then
      echo "Коммит меняет исходники сайта, но не трогает документацию. Обнови под изменения CLAUDE.md / README.md / docs/DOCUMENTATION.md, сделай git add и повтори коммит. Если правка на доку не влияет — пропусти осознанно (закоммить иначе)." >&2
      exit 2
    fi
    ;;
esac
exit 0
