---
name: deploy
description: Deploy this birthday site to GitHub Pages. Use when the owner explicitly asks to deploy, publish, or put the site online. Publishes the current committed state to the happy-birthday-kristina repo and returns the live URL.
---

# Деплой на GitHub Pages

Публикует текущий сайт на GitHub Pages. Сайт статический (без сборки), поэтому деплой =
пуш файлов + включение Pages.

<IMPORTANT>
Деплой — публичное действие. Выполнять ТОЛЬКО по явной просьбе владельца.
Репозиторий GitHub Pages **публичный** — ссылку сможет открыть любой, у кого она есть.
Перед публикацией убедись, что в `js/config.js` нет ничего, что владелец не хочет показывать миру.
</IMPORTANT>

## Предусловия (проверить в начале)

1. `gh auth status` — GitHub CLI авторизован. Если нет — сказать владельцу выполнить `gh auth login` и остановиться.
2. `git status --short` — рабочее дерево чистое. Если есть незакоммиченные правки —
   спросить владельца, коммитить ли их (сообщение заканчивать `Co-Authored-By: Claude ...`).
3. Название репозитория: **`happy-birthday-kristina`** (если владелец не указал другое).

## Шаги

Создай задачи (TodoWrite) под каждый шаг и выполняй по порядку.

1. **Определить владельца:** `gh api user --jq .login` → это `<user>`.
2. **Создать репозиторий и запушить** (идемпотентно — если репо уже есть, пропусти создание):
   ```bash
   git branch -M main
   gh repo create happy-birthday-kristina --public --source=. --remote=origin --push
   ```
   Если репо уже существует и remote настроен — просто `git push -u origin main`.
3. **Включить Pages** с ветки `main`, папка `root`:
   ```bash
   gh api -X POST repos/<user>/happy-birthday-kristina/pages \
     -f "source[branch]=main" -f "source[path]=/" 2>/dev/null \
   || gh api -X PUT repos/<user>/happy-birthday-kristina/pages \
     -f "source[branch]=main" -f "source[path]=/"
   ```
   (POST — первое включение; PUT — обновление, если Pages уже был включён.)
4. **Дождаться билда и получить URL:**
   ```bash
   gh api repos/<user>/happy-birthday-kristina/pages --jq .html_url
   ```
   Первый деплой занимает ~1–2 минуты. Опросить статус:
   `gh api repos/<user>/happy-birthday-kristina/pages/builds/latest --jq .status`
   (`built` = готово).
5. **Проверить, что сайт живой:** открыть полученный URL браузерными preview-инструментами
   на мобильном вьюпорте, убедиться что подарок рендерится и консоль без ошибок.
   Сообщить владельцу финальную ссылку.

## Обновление (повторный деплой)

Изменил файлы → закоммить и `git push`. GitHub Pages пересоберётся автоматически;
включать Pages повторно не нужно. Проверить `pages/builds/latest` = `built`.

## Откат

`git revert <commit>` или `git reset --hard <commit>` + `git push --force-with-lease`.
Pages пересоберётся на новый HEAD.
