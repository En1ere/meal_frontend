# Правила administrative frontend

Сначала применяются корневые `AGENTS.md`, OpenAPI и `TESTs.md`.

- Соблюдать существующую React/Vite архитектуру, API-клиент и design-system.
- Каждое критичное действие: permission check → re-auth/MFA → preview → confirm → execute → audit/readback.
- Покрывать пустые, загрузочные, stale, validation, forbidden, conflict, partial/unknown и provider-failure состояния.
- Не раскрывать internal notes, персональные данные и технические payloads без соответствующего grant.
- Не подменять недоступного провайдера фиктивной успешной операцией.
- Изменения маршрутов/контрактов синхронизировать с E2E и `../TESTs.md`.
- После изменения повысить patch-версию `frontend_admin`, обновить lock и `version-list.md`.
