# Meal Planner administrative frontend

Отдельное Vite/React SPA для администраторов и служебных операций. Оно использует собственный staff auth/MFA-контекст и не разделяет browser storage с пользовательским frontend. Текущая версия берётся из `package.json`.

## Запуск и проверки

```powershell
# Установка всего workspace: выполнить npm ci в корне meal_frontend.
npm run dev
npm run contracts:check
npm run typecheck
npm run lint
npm test
npm run build
```

## Границы

- Доступ определяется серверными staff roles/grants; скрытая кнопка не является защитой.
- Критичные действия требуют re-auth/MFA, preview, явного подтверждения, audit и readback.
- Очереди, списки и detail routes сохраняют фильтры/пагинацию и корректно обрабатывают stale/409/412/503.
- Refund, export, delivery, storage и иные provider-bound операции не имитируют успех.
- Internal notes и чувствительные данные не попадают в публичные ответы или пользовательский интерфейс.
- Development mock изолирован и служит только для локального UI; production использует реальный API.

Полная ручная приёмка ролей администратора и модератора находится в `../TESTs.md`.
