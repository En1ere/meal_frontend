# Meal Planner frontend

Клиентское Next.js-приложение для публичных, пользовательских и модераторских сценариев. Текущая версия берётся из `package.json`.

Административный интерфейс вынесен в независимый `meal_admin`; его исходники и установка для запуска клиента не нужны. Backend находится в `meal_backend`.

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

Локальный dev-сервер использует порт `3000`. Production-like запуск: `npm run build`, затем `npm run start`.

## Архитектурные границы

- Маршрутизация — Next App Router; server/client границы не обходить прямым доступом к browser API.
- Данные API — через существующий клиент и TanStack Query; Zustand используется только для локального UI-state.
- Development-моки изолированы от production и не доказывают доступность PostgreSQL или внешнего провайдера.
- Авторизация, тарифы, семейный scope, consent и capability перепроверяются перед эффектом и после reload/readback.
- Неизвестный исход сохраняет ввод и предлагает безопасный повтор с тем же idempotency key.
- Offline разрешён только для явно поддержанных операций; секреты, session tokens и произвольный API cache не сохраняются.
- OCR/импорт выполняется локально, требует ручного подтверждения и не создаёт данные до явного commit. Происхождение runtime описано в `public/ocr/README.md`.
- UI-примитивы берутся из `@meal-planner/design-system`; локальный `src/ui` содержит только адаптеры и композицию.

Полный ручной набор маршрутов, ролей, тарифов, ошибок, accessibility и browser-проверок находится в `../TESTs.md`.

## Production-зависимости

Реальные email/push, payment, storage/scanner, AI, production API/БД, физические устройства и screen readers остаются отдельными release gates. Интерфейс обязан явно сообщать о недоступной интеграции и не имитировать успешный эффект.
