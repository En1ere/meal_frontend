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
