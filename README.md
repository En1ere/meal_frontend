# Meal frontend

Текущие версии исходников: root `0.0.41`, frontend app `0.0.150`; последний проверенный deployed runtime — root `0.0.40` / app `0.0.149`. Контракты соответствуют backend `0.0.149` и schema v30. Docker Compose, immutable digest deploy-helper и rollback подтверждены на VPS; технические HTTPS origins остаются активными до появления DNS для `meal.royalexander.online` и `admin.meal.royalexander.online`.

Самостоятельный клиент Meal Planner: `front/` (Next.js, порт 3000) и локальная `design-system/`. Админка вынесена в независимый `meal_admin` (Vite, порт 3002), сервер и SQL находятся в `meal_backend` (API, порт 3001). Каждый репозиторий устанавливается отдельно, без исходников соседей и без исходного `test-roject`.

Целевая FSD-подобная структура, правила направлений зависимостей и порядок доменной миграции описаны в [ARCHITECTURE.md](ARCHITECTURE.md). Базовые границы проверяются командой `npm --workspace front run architecture:check`.

## Подготовка

Нужны Node.js 24.19+ в ветке 24 и npm 11. Из корня:

```sh
npm ci
npm run dev
```

Клиент и дизайн-система входят в локальный npm workspace с единым lock-файлом и общей установкой React. Development по умолчанию использует браузерные моки и работает без API и БД. Production-сборки используют реальный API; моки в них запрещены.

В подготовленном локальном checkout ignored `front/.env.local` уже включает real API. Для независимой работы с моками явно задать `NEXT_PUBLIC_API_MODE=mock` перед `npm run dev`; постоянные настройки не попадут в Git.

## Совместный запуск с API

Запустить `meal_backend` на порту 3001 по его README. Создать `front/.env.local`:

```dotenv
NEXT_PUBLIC_API_MODE=real
BACKEND_ORIGIN=http://127.0.0.1:3001
```

Для админки аналогичный файл создаётся в корне отдельного `meal_admin`:

```dotenv
VITE_API_MODE=real
BACKEND_ORIGIN=http://127.0.0.1:3001
```

Из `meal_frontend` выполнить `npm run dev`, из `meal_admin` — собственный `npm ci` и `npm run dev`. Backend запускается независимо по его README; для тестовой БД на VPS сначала открыть SSH-туннель согласно backend runbook. Стартеры не применяют миграции и не загружают seed.

После запуска всех трёх приложений выполнить `npm run test:integration` в `meal_frontend`. Проверка подтверждает готовность БД, CSRF/cookie и отсутствие доступа без сессии через API и оба интерфейса. `BACKEND_ORIGIN`, `CLIENT_ORIGIN` и `ADMIN_ORIGIN` позволяют явно выбрать адреса стенда.

Оба интерфейса обращаются к `/api` своего origin; Next rewrites и Vite dev proxy направляют запросы в API. Клиент и админка используют отдельные контексты авторизации. Пароли БД и сервера браузеру не нужны.

## Проверки и сборка

```sh
npm run check
npm test
npm run build
npm run test:e2e:front
```

E2E использует Chromium по умолчанию; установить браузер можно командой `npx playwright install chromium`. `QA_OUTPUT_DIR` должен указывать отдельную папку внутри `D:\Agents\EP Frontend projects\projects\tempFiles`. Актуальная подробная ручная приёмка сохранена в `FRONTEND_TESTING.md`; `TESTs.md` содержит историческую расширенную матрицу и требует выбора соответствующего нового репозитория для старых команд монорепозитория.

Результаты текущих проверок и исторического разделения записаны в начале `TESTs.md`. Тесты админки находятся в `meal_admin`; они не входят в клиентские команды этого репозитория. Полная бизнес-приёмка и весь E2E-набор проверяются отдельно.

Контрактная сверка с явно выбранным backend-артефактом: `node front/scripts/check-backend-contract.mjs ../meal_backend/contracts/openapi.json`. Генерация валидаторов: `npm --workspace front run contracts:generate`. Проверка принимает путь к артефакту явно; соседний checkout не нужен для обычной установки, проверки типов и сборки.

После сборки клиент запускается через `npm start`; production image использует Next standalone output и непривилегированный процесс на порту `3000`. `NEXT_PUBLIC_API_MODE`, `NEXT_PUBLIC_APP_VERSION` и используемый Next rewrites `BACKEND_ORIGIN` фиксируются во время `next build`: production image собирается с `real`, версией app manifest и Docker-origin `http://backend:3001`. Runtime не должен выдавать эти параметры за изменяемую конфигурацию. Настройки статического hosting админки описаны в отдельном `meal_admin`. Две копии дизайн-системы версионируются локально; общие изменения компонентов нужно явно переносить и проверять в обоих проектах.

Тестовый production-стенд развёрнут на `https://abstract-usable-gazebo.ruweb.place` в single-host Docker Compose с immutable GHCR digest, host Nginx/TLS и loopback ingress. Админка доступна отдельно на `https://admin.abstract-usable-gazebo.ruweb.place`. Сборка, smoke и rollback клиента описаны в [DEPLOYMENT.md](DEPLOYMENT.md); общая серверная инфраструктура, backup и миграции — в `meal_backend/docs/DEPLOYMENT.md`. Пароли и MFA-секреты в Git не хранятся. Каталог `/legal` показывает 11 allowlisted предварительных текстов с заглушкой `[Тут будут данные]`; пакет остаётся `draft_blocked`, а внешние провайдеры — отдельными условиями публичной готовности.
