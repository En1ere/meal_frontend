# Правила frontend

Сначала применяются корневые `AGENTS.md`, продуктовая спецификация и `TESTs.md`.

- Соблюдать Next App Router, существующие границы server/client, Query/Zustand и API-клиент.
- Переиспользовать design-system; не копировать примитивы в `src/ui`.
- Для каждого действия покрывать loading, empty, validation, forbidden, conflict, timeout/offline, unknown outcome, retry и reload/readback.
- Не терять пользовательский draft при сетевой ошибке или неопределённом результате.
- Тариф, роль, family scope и consent проверяются перед эффектом. Заблокированная функция объясняет причину и даёт переход к нужному соглашению/настройке.
- Не объявлять provider-bound действие успешным на основании mock-ответа.
- Изменения маршрутов или контрактов синхронизировать с E2E и `../TESTs.md`.
- После изменения повысить patch-версию `front`, обновить lock и `version-list.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
