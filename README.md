# Meal frontend

Самостоятельный frontend Meal Planner: клиентское приложение `front/` (Next.js, порт 3000), административное приложение `frontend_admin/` (React/Vite, порт 3002) и общая `design-system/`. Серверный код и SQL находятся в [meal_backend](https://github.com/En1ere/meal_backend). Ни одно приложение не требует исходного `test-roject` или backend-репозитория для установки и сборки.

## Подготовка

Нужны Node.js 24.19+ в ветке 24 и npm 11. Из корня:

```sh
npm ci
npm run dev
```

Все три пакета входят в npm workspace с единым корневым lock-файлом и общей установкой React. Раздельный запуск: `npm run dev:client` и `npm run dev:admin`. Development по умолчанию использует браузерные моки; это позволяет работать без API и БД. Тестовые аккаунты и ограничения описаны в локальных README и `TESTs.md`. Моки запрещены в production-сборках.

## Совместный запуск с API

Запустить `meal_backend` на порту 3001 по его README. Создать `front/.env.local`:

```dotenv
NEXT_PUBLIC_API_MODE=real
BACKEND_ORIGIN=http://127.0.0.1:3001
```

И `frontend_admin/.env.local`:

```dotenv
VITE_API_MODE=real
BACKEND_ORIGIN=http://127.0.0.1:3001
```

Затем `npm run dev` и `npm run test:integration`. Оба интерфейса обращаются к `/api` своего origin; Next rewrites и Vite dev proxy направляют запросы в API. Клиент и админка используют отдельные контексты авторизации. Никакие пароли БД или сервера не нужны браузеру.

## Проверки и сборка

```sh
npm run check
npm test
npm run build
npm run test:e2e:front
npm run test:e2e:admin
```

E2E использует Chromium по умолчанию; установить браузер можно командой `npx playwright install chromium`. `QA_OUTPUT_DIR` должен указывать отдельную папку для временных результатов, на Windows — внутри `D:\AITemp`. Полная ручная матрица сохранена в `TESTs.md`; исторические команды монорепозитория в ней требуют выбора соответствующего нового репозитория.

Результаты разделения и известный исходный дефект очистки подтверждения входа администратора после семи дней записаны в начале `TESTs.md`. Полная бизнес-приёмка и весь E2E-набор не выполнялись.

Контрактная сверка с явно выбранным backend-артефактом: `node front/scripts/check-backend-contract.mjs ../meal_backend/contracts/openapi.json`. Генерация клиентских валидаторов: `npm --prefix front run contracts:generate` и аналогично для `frontend_admin`.

После сборки клиент запускается через `npm --prefix front start`. Админка создаёт статические файлы в `frontend_admin/build`; production web-сервер должен обслуживать SPA fallback на `index.html` и проксировать `/api` в backend. Vite preview проверяет статические файлы и не заменяет production reverse proxy.

Тестовый VPS: Ubuntu 24.04, технический домен `abstract-usable-gazebo.ruweb.place`. Этот перенос не разворачивает frontend/backend на VPS. Их дальнейший деплой потребует reverse proxy, TLS и отдельных настроек окружения. Юридические документы остаются draft, внешние провайдеры — отдельными условиями готовности.
