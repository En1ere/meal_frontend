# Meal frontend version-list

0.0.43 - 29.10.2026 | 18:22 - Release metadata синхронизирована с backend runtime 0.0.152 и admin 0.0.128 после устранения APP_VERSION drift; OpenAPI 0.0.61, schema v31 и wire-контракты не менялись.

0.0.42 - 29.10.2026 | 18:05 - Production readiness и полный OpenAPI snapshot 0.0.61 синхронизированы с backend 0.0.151 / additive schema v31; wire paths и payload не менялись. Target gate повышен до `database_v31_verified`, technical origins остаются активными, custom origins — `pending_dns`.

0.0.41 - 29.10.2026 | 16:52 - Синхронизированы production readiness и полный OpenAPI snapshot 0.0.61 с фактическим VPS: Docker runtime, immutable deploy-helper и digest rollback больше не считаются открытыми blockers, target обновлён до schema v30, а будущие custom origins явно остаются `pending_dns`; runtime и wire-контракты не менялись.

0.0.40 - 29.10.2026 | 12:34 - Закрыт остаточный архитектурный checkpoint без изменения URL и контрактов: inventory-ingest mock adapter перенесён в feature-owned boundary, gate теперь защищает public API для app/widgets и изолирует mock API, а multi-route finance, AI и moderation разделены на внутренние route-сценарии с неизменными публичными экспортами.

0.0.39 - 29.10.2026 | 12:06 - Опубликован безопасный каталог 11 предварительных legal-текстов: allowlisted server-side routes, единая заглушка `[Тут будут данные]`, public shell/navigation и 404 для неизвестного slug. Demonstration manifest больше не считается опубликованным вне mock-режима, consent/registration остаются fail-closed; обновлены тесты и инструкции ручной приёмки.

0.0.38 - 29.10.2026 | 10:17 - Deployment runbook получил краткую карту для агента/оператора и фактический container inventory после VPS cutover: границы репозитория, `main`/GHCR digest/helper, build-time env, loopback/Nginx, smoke и UI-only rollback; legacy systemd runtime отключён, секреты не добавлялись.

0.0.37 - 28.10.2026 | 17:54 - Подготовлен container release path без фактического деплоя: digest-pinned Next standalone image запускается непривилегированно с frontend-only `/healthz`, GHCR workflow дважды блокирует stale SHA, публикует commit tag и immutable digest без `latest`/semver tags и передаёт его ограниченному server helper; все Actions закреплены по commit SHA. Документация фиксирует build-time семантику `NEXT_PUBLIC_*` и `BACKEND_ORIGIN`, read-only/tmpfs hardening и rollback. Deployment readiness отражает Docker Compose/GHCR/host Nginx решения, но остаётся blocked до runtime/helper/rollback evidence; deployed runtime остаётся root/app `0.0.28` / `0.0.137`.

0.0.36 - 28.10.2026 | 17:31 - Детерминированный moderator recovery harness получил явный sticky fault-control: параллельные совпадающие запросы продолжают получать заданную ошибку до удаления cookie, тогда как существующие fault-controls остаются одноразовыми. Recovery E2E очищает control только после появления error UI и затем использует штатный Retry; runtime и wire-контракты не менялись, deployed runtime остаётся root/app `0.0.28` / `0.0.137`.

0.0.35 - 28.10.2026 | 14:49 - Финальный public API checkpoint устранил оставшиеся 14 app-to-feature deep imports recipes и обнулил архитектурный долг: route-модули теперь входят в features только через client/server/index public APIs, а gate немедленно блокирует любое нарушение. URL, runtime-семантика и wire-контракты не менялись; deployed runtime остаётся root/app `0.0.28` / `0.0.137`.

0.0.34 - 28.10.2026 | 14:47 - Пятый public API checkpoint сократил app-to-feature deep imports с 39 до 14: 25 route-импортов inventory, preserves и shopping переведены на client public APIs, а shell styles остались в server-safe APIs. URL, personal/family scope, runtime и wire-контракты не менялись; deployed runtime остаётся root/app `0.0.28` / `0.0.137`.

0.0.33 - 28.10.2026 | 14:31 - Четвёртый public API checkpoint сократил app-to-feature deep imports с 50 до 39: 11 route-импортов family и family notes переведены на узкие client public APIs для overview, setup, invite, access, ownership и notes list/editor/detail. URL, family scope, runtime и wire-контракты не менялись; deployed runtime остаётся root/app `0.0.28` / `0.0.137`.

0.0.32 - 28.10.2026 | 14:15 - Третий public API checkpoint сократил app-to-feature deep imports с 67 до 50: 17 route-импортов auth, AI и AI appeals переведены на явные client public APIs. URL, session/MFA семантика, runtime и wire-контракты не менялись; deployed runtime остаётся root/app `0.0.28` / `0.0.137`.

0.0.31 - 28.10.2026 | 14:05 - Второй public API checkpoint сократил app-to-feature deep imports с 87 до 67: 20 route/composition импортов news, notifications, support, moderation, offline, personalization и achievements переведены на явные client public APIs. Server-only moderation shell остался в `server.ts`; URL, runtime-семантика и wire-контракты не менялись. Deployed runtime остаётся root/app `0.0.28` / `0.0.137`.

0.0.30 - 28.10.2026 | 13:42 - Первый low-coupling public API checkpoint сократил app-to-feature deep imports с 100 до 87: 13 route-модулей public-info, legal, pro, search, subscription, privacy, account lifecycle, diary, exports, family chat и nutrition переведены на явные client/server public APIs. URL, runtime-семантика и wire-контракты не менялись; deployed runtime остаётся root/app `0.0.28` / `0.0.137`.

0.0.29 - 28.10.2026 | 13:12 - Docs-only root revision синхронизирует live admin `0.0.117` и immutable release `20261028-0757`: root/deep-link, password → mandatory MFA и `coffee-light` / `nature-dark` smoke прошли без runtime errors. Deployed frontend остаётся root/app `0.0.28` / `0.0.137`; runtime-код и контракты не менялись.

0.0.28 - 28.10.2026 | 12:27 - Read-only production acceptance runner поддерживает явный абсолютный `PLAYWRIGHT_EXECUTABLE_PATH` для уже установленного управляемого Chromium/Edge, сохраняя запрет mutation requests и неизменный набор desktop/mobile проверок. Инициализация online API/session больше не ждёт best-effort offline Service Worker, поэтому запрещённый или зависший worker не оставляет защищённые страницы на бесконечной проверке сессии. Root/app `0.0.28` / `0.0.137` развёрнуты; live desktop/mobile acceptance прошёл 24/24 без mutation requests и runtime errors.

0.0.27 - 28.10.2026 | 12:16 - Документация синхронизирована с фактическим тестовым rollout: frontend root/app `0.0.26` / `0.0.135`, backend `0.0.128` на schema v29 и admin `0.0.114`. Зафиксированы immutable release, HTTP/browser smoke, авторизованный профиль, пустое состояние рецептов, четыре темы и безопасный clients-first порядок; это docs-only revision без новой runtime-сборки.

0.0.26 - 28.10.2026 | 11:39 - Frontend синхронизирован с backend 0.0.128/schema v29: workspace рецептов разделяет текущую review-редакцию и активную publication, безопасно переживает совместимый rollout со старым полным ответом, отклоняет частичные/смешанные контракты и мигрирует offline snapshots без продвижения capability. Обновлены моки, unit/E2E, инструкция приёмки и порядок rollout/rollback; frontend app 0.0.135.

0.0.25 - 27.10.2026 | 18:56 - Добавлен воспроизводимый frontend deployment/rollback runbook с immutable releases, pre/post-traffic smoke и безопасной read-only production acceptance. Provider-neutral readiness validator возвращён владельцу frontend, schema gate обновлён до v28; runtime, URL и backend-контракты не менялись.

0.0.24 - 27.10.2026 | 18:38 - Устранены последние три feature-to-feature зависимости: critical re-auth вынесен в общую account-security entity, а стили AI-апелляций и privacy локализованы в своих доменах. Architecture gate теперь фиксирует нулевой baseline междоменных feature-импортов; lifecycle E2E дожидается готовности auth runtime перед вводом, не меняя URL, продуктовую семантику или backend-контракты.

0.0.23 - 27.10.2026 | 18:29 - Recommendation actions перенесены в account-scoped entity, а profile/account screens собираются через widget composition и явные feature client APIs; стили user home локализованы в auth. Архитектурный baseline уменьшен до 3 cross-feature связей и 100 app deep imports без изменения URL или backend-контрактов.

0.0.22 - 27.10.2026 | 18:12 - Создание семьи и выход из неё получили замороженные payload/idempotency key, обязательный readback и отдельный безопасный exact retry после неизвестного исхода; ввод нельзя незаметно превратить в новую команду со старым ключом. Конфликт отправки рецепта на модерацию теперь дожидается перечитывания workspace перед повторным действием.

0.0.21 - 27.10.2026 | 18:00 - 12 идентичных nested layouts консолидированы в четыре URL-neutral Next route groups: browser chunks снижены с 200 до 192 без изменения scope/offline policy. Performance gate теперь сохраняет raw/gzip caps и дополнительно ограничивает total/unique-content JS, а также requests и gzip transfer каждого route по полному набору Next manifests.

0.0.20 - 27.10.2026 | 17:46 - Architecture gate получил точный уменьшаемый baseline cross-feature и app deep imports; preserves отделён от inventory internals, shopping routes переведены с recipes shim на public client API, а общая оценка стоимости вынесена из finance page в finance-cost entity. Finance и meal-plan получили явные client entrypoints.

0.0.19 - 27.10.2026 | 14:02 - Receipt creation/detail flows собраны внутри shopping bounded context, generic image validation вынесена в shared/media, а shopping отделён от inventory feature internals через entity-level measurement/location contracts и architecture gate.

0.0.18 - 27.10.2026 | 13:52 - Inventory ingest отделён от внутреннего inventory feature: routes и scope/query models в entities, app routes используют client API, no-op shell удалён; catalog/locations cache привязан к user/scope, а невозможный commit без location убран из UI.

0.0.17 - 27.10.2026 | 13:42 - Устранена зависимость products от внутренних inventory UI/CSS: measurement и inventory primitives вынесены в entities, command-error — в shared/api, product routes переведены на public client API, private locations cache/query унифицированы.

0.0.16 - 27.10.2026 | 13:30 - Разорван цикл recipes ↔ community: public recipe feed/comments вошли в recipes bounded context, image/rating и wire-code справочники вынесены в entities/recipe; новые cross-feature CSS запрещены, 8 legacy-связей зафиксированы как явный долг.

0.0.15 - 27.10.2026 | 13:20 - Разорван архитектурный цикл recipes ↔ offline: IndexedDB store/queue/snapshots и owner state перенесены в entities/offline, read-only recipe cache — в entities/recipe-cache; UI/sync остаются feature-слоем, storage/DB keys и offline semantics сохранены.

0.0.14 - 27.10.2026 | 13:15 - Удалены 19 междоменных связей и 3 внутренних auth-импорта misplaced инфраструктуры: общий AbortController hook перенесён в shared/api, consent query и четыре consent-required кода — в entities/consent, legacy пути запрещены architecture gate.

0.0.13 - 27.10.2026 | 13:04 - Session Guard поднят из auth feature в widgets/session-guard: app routes стали единственными владельцами auth/offline policy, 19 feature-level обёрток удалены, `/settings/account` получил явную fail-closed защиту, а architecture gate запрещает возврат legacy Guard.

0.0.12 - 27.10.2026 | 12:55 - Family context оформлен как отдельная entity с каноническими query keys и единым hook; create/join/leave синхронизируют account-bound workspace scope, 26 app-импортов shell-стилей переведены на server-safe public API, а OwnershipNotice опубликован через client entrypoint.

0.0.11 - 27.10.2026 | 12:46 - Workspace scope выделен из технического shared/runtime в entities/workspace-scope: account-bound инициализация и reset централизованы, дублирующие scope-эффекты пяти доменных shell удалены, устранена гонка personal/family при навигации и добавлен архитектурный запрет возврата бизнес-состояния в runtime.

0.0.10 - 27.10.2026 | 12:37 - Session выделена в первую domain entity: 70 client-потребителей переведены с feature-internal auth/session на entities/session, точные user/staff query keys и cache writes централизованы, offline lifecycle подключён app composition port, а architecture gate запрещает обход entity при записи user-session.

0.0.9 - 27.10.2026 | 12:13 - Route-matrix после shell-layer рефакторинга усилена устойчивым fail-closed retry DOM-аудита при ожидаемой service-worker смене документа; canonical isolated runner зафиксирован как обязательный memory-safe прогон, а ранняя тема подключена через Next Script без React runtime warning.

0.0.8 - 27.10.2026 | 11:44 - Завершён shell-layer frontend: UserAppShell и стили перенесены в widgets, legacy src/ui запрещён architecture gate, scope-aware оболочки inventory/shopping/recipes/preserves/plan/moderation подключаются из Next app с сохранением family/personal, offline и moderator semantics.

0.0.7 - 27.10.2026 | 11:37 - Authenticated personal-shell композиция поднята из 25 feature-файлов в app/widgets: единый widget владеет auth Guard, UserAppShell и OwnershipNotice, маршруты подключают его через layouts и точечные wrappers без обратной зависимости feature → widget.

0.0.6 - 27.10.2026 | 11:28 - Начат подъём cross-domain оболочек в FSD composition-слой: public shell и offline status стали widgets, ThemeControl перемещён в shared UI, а публичные feature возвращают только доменный контент и больше не зависят от оболочек.

0.0.5 - 27.10.2026 | 11:15 - Начат последовательный FSD-подобный рефакторинг: зафиксированы целевые слои и порядок доменной миграции, добавлен автоматический контроль базовых границ, runtime вынесен из Next composition root, а shared API transport освобождён от зависимости на offline feature.

0.0.4 - 27.10.2026 | 11:05 - Production build развёрнут на `https://abstract-usable-gazebo.ruweb.place` за Nginx/TLS с systemd и same-origin `/api`. Деплой-smoke подтвердил HTTPS, авторизацию тестового пользователя, authenticated shell, основные ссылки и переключение четырёх сохраняемых тем.

0.0.3 - 10.26.2026 | 15:37 - Production-readiness: ранняя инициализация четырёх тем, полный запрет локальных CSS-цветов вне дизайн-системы, усиленный аудит 117 маршрутов и всех видимых контролов, memory-safe Chromium runner с малыми изолированными пакетами сценариев, production-only и bundle-budget gates, подробная ручная матрица FRONTEND_TESTING.md.

0.0.2 - 10.24.2026 | 19:31 - Административный интерфейс и его тесты вынесены в независимый meal_admin; клиент устанавливается и запускается без исходников админки.

0.0.1 - 10.24.2026 | 18:48 - Выделены клиент Next.js, административный Vite frontend, общая дизайн-система и тесты в самостоятельный npm workspace; исключены старые QA-артефакты, пустая корневая оболочка и посторонние проекты. Next.js и Zod обновлены до исправленных patch-версий.
