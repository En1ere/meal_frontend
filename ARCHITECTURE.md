# Архитектура Meal frontend

Клиент постепенно приводится к практичной FSD-подобной структуре по доменным моделям. Референс `staff_management_frontend` используется только как пример доменной группировки; его React Router/Vite-подходы и нарушения границ сюда не переносятся.

## Слои и направление зависимостей

```text
app → widgets → features → entities → shared
```

- `front/src/app` — только Next App Router: routes, layouts, metadata, loading/error boundaries и composition root.
- `front/src/widgets` — крупные блоки, которые компонуют несколько доменов: authenticated/public shell, навигация, общие панели состояния.
- `front/src/features/<domain>` — пользовательские сценарии конкретного домена. По мере миграции код делится на реально необходимые `api`, `model`, `lib`, `ui`, а наружу публикуется через `index.ts`.
- `front/src/entities` — только устойчивые модели, используемые несколькими сценариями. Не нужно создавать entity для каждого DTO.
- `front/src/shared` — transport, технический runtime, config, общие утилиты и UI без бизнес-знаний.

Разрешённые зависимости направлены только вправо. Нижний слой не импортирует верхний. `app` является composition root и связывает runtime с auth/offline интеграциями. Междоменный импорт допускается только через публичный API домена; чужие page-файлы, CSS Modules и внутренние сегменты не являются API.

## Next.js и публичные API

- `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, route handlers и metadata остаются в `app`.
- Server Components не импортируют browser-only barrel. Если домен имеет серверные экспорты, для них создаётся отдельный `server.ts`.
- `'use client'` ставится на минимальной границе. Общий barrel не должен случайно переводить серверный код в клиентский bundle.
- Generated API contracts остаются единым generated artifact и вручную не редактируются.
- Query keys, storage keys, IndexedDB names, BroadcastChannel names и URL worker-ов считаются совместимыми runtime-контрактами.

### Route groups и release budget

Route group не является URL-сегментом. Он применяется только для доказанно идентичных nested layouts; единственный root layout остаётся `app/layout.tsx`, поэтому группы не создают переходов между разными root layouts и полных перезагрузок.

- `(personal-shell)` объединяет прежние layouts `ai`, `diary`, `finance`, `support`.
- `family/(personal-shell)` объединяет `notes` и `ownership`.
- `(shopping-workflows)` объединяет personal `shopping`, `purchases`, `receipts` с прежними `allowOffline`, `scope="personal"` и shopping shell class.
- `family/(shopping-workflows)` объединяет семейные `shopping`, `purchases`, `receipts` с прежним `scope="family"` без offline-расширения.

Все page-файлы и lazy route chunks остаются раздельными, URL не содержат имён групп. Production build должен сохранять полный набор page client-reference manifests.

Browser budget измеряет не только число файлов. Baseline после консолидации — 192 JS-файла и 166 уникальных SHA-256 payloads; caps 196/170 дают малый headroom, но не допускают возврата прежней фрагментации. Неизменные caps остаются 900 КБ raw/140 КБ gzip на файл и 3,8 МБ raw/1 МБ gzip суммарно. Для каждого app page вычисляется union `build-manifest.rootMainFiles` и chunk paths его Next client-reference manifest; должны присутствовать manifests всех путей из `app-paths-manifest`. Route caps: не более 28 JS requests и 390 000 gzip bytes. Текущий максимум — 26 requests и 374 521 bytes.

## Этапы миграции

1. Убрать зависимости доменов от `app` и инфраструктурные циклы.
2. Перенести shell-композиции в `widgets`, оставив визуальное поведение без изменений.
3. Добавлять public API и внутренние сегменты сначала низкосвязанным доменам.
4. Последовательно мигрировать bounded contexts: account/session, family, inventory, shopping, recipes, planning/subscription/AI, public/operations.
5. Только после стабилизации границ декомпозировать крупные файлы.

## Зафиксированные границы

- `entities/session/model.ts` владеет точными query keys и единственной записью user-session в cache.
- `entities/session/client.ts` владеет browser-hook `useSession`; feature-домены больше не импортируют session model из `features/auth`.
- Offline owner и очистка recipe cache остаются feature-эффектами, подключёнными к session entity через порт composition root в `app/providers.tsx`.
- `entities/workspace-scope/model.ts` владеет выбранным personal/family workspace и его привязкой к текущему user id; технический `shared/runtime` больше не хранит бизнес-состояние scope.
- `entities/workspace-scope/client.tsx` предоставляет изолированный provider/hook, а `app/providers.tsx` атомарно сбрасывает scope вместе с session cache при logout, смене аккаунта и BroadcastChannel-событии.
- Только auth/session boundary и явные family create/join/leave-команды меняют workspace scope. Доменные page-shell больше не конкурируют за него эффектами; UI scope `personal|family` не смешивается с API scope `private|family`.
- `entities/family/model.ts` владеет canonical query keys `['family']` и `['family', userId]`, типами family context и стабильной account-scoped моделью. `entities/family/client.ts` является единственной точкой canonical family query; отдельный meal-plan key `['family-context', userId]` намеренно не объединён.
- Server Components импортируют shell-классы только через server-safe `features/<domain>/server.ts`. Внутренние `shell-styles.ts` и client-only feature-файлы не являются API слоя `app`.
- Client-only межслойные экспорты feature публикуются отдельным `client.ts`; например, `OwnershipNotice` не импортируется widget напрямую из внутреннего файла family feature.
- `widgets/session-guard` компонует session entity, family/workspace scope и offline policy. Auth redirect, loader и fail-closed error живут только здесь; feature-компоненты не охраняют маршруты самостоятельно.
- Доступ к защищённым экранам задаётся только в `app` через `SessionGuard`, `PersonalShell` или `GuardedUserAppShell`. Offline разрешение объявляется на route boundary и не может расширяться внутренним feature.
- Публичные `/recipes/[id]` и `/authors/[username]/**`, а также pre-session `/moderation/sign-in` и `/moderation/mfa` намеренно не получают session guard.
- `shared/api/use-request-signal.ts` владеет технической отменой transport-запросов при повторном действии и unmount; auth feature не является источником общих инфраструктурных hooks.
- `entities/consent/client.ts` владеет account-scoped legal-consent query и распознаванием согласованных consent-required error codes. AI, diary, nutrition, notifications, personalization и recipes не импортируют внутреннее состояние legal feature.
- `entities/offline` владеет стабильными IndexedDB store/queue/snapshot контрактами и browser owner state; UI настроек и sync coordinator остаются в offline feature.
- `entities/recipe-cache/model.ts` владеет read-only recipe cache и неизменным storage key. Offline runtime зависит только от этой entity, поэтому циклическая связь `recipes ↔ offline` запрещена.
- `entities/recipe/model.ts` владеет стабильными wire-code справочниками единиц, категорий и методов, а `entities/recipe/client.tsx` — общим recipe image/rating presentation без feature-зависимостей.
- Публичный recipe feed, comments и `/community` являются сценариями recipes bounded context и публикуются через `features/recipes/client.ts`; бывший цикл `recipes ↔ community` удалён.
- `entities/measurement/model.ts` владеет общими quantity unit wire-codes, `entities/inventory` — inventory scope, canonical query keys и expiry presentation, а локальная календарная дата остаётся чистой утилитой `shared/lib/date.ts`.
- Products не имортирует inventory feature: async-state и CSS локальны, pure inventory/measurement модели берутся из entities, а routes входят только через `features/products/client.ts`. Private product locations и inventory screens используют один cache key и explicit `scope=private`.
- Inventory ingest сохраняет собственные preview/review/commit UI и worker, но scope, routes, query keys, units и command errors берёт только из entities/shared. Sibling-feature зависимостей нет; routes входят через `features/inventory-ingest/client.ts`, а no-op shell не дублирует app layout. Catalog и locations cache привязаны к user/scope; UI не предлагает commit без обязательного `locationId`.
- Receipts являются сценариями shopping/purchase bounded context и хранятся в `features/shopping/receipts`; purchase review/resolution, command runtime и CSS теперь внутри одного feature, а receipt routes входят через `features/shopping/client.ts`.
- `shared/media/image-validation.ts` владеет единой pre-decode проверкой JPEG/PNG/WebP, animation и 20 MP limit для receipt и inventory ingest; media security больше не зависит от feature.
- Shopping list routes используют только `features/shopping/client.ts`; legacy re-export через recipes удалён, поэтому recipes больше не зависит от shopping feature.
- `entities/finance-cost/client.tsx` владеет общей account-scoped моделью примерной стоимости рецепта, списка покупок и плана питания. Meal plan, recipes и shopping не импортируют finance page internals.
- Preserves получает единицы измерения из `entities/measurement`, а локальную календарную дату — из `shared/lib/date`; inventory feature не является библиотекой соседнего домена.
- Finance и meal-plan routes входят через `features/finance/client.ts` и `features/meal-plan/client.ts`.
- `entities/recommendation/client.tsx` владеет общей моделью recommendation actions, feedback и follow-команд. Impression-дедупликация учитывает id текущей user-session, поэтому logout/login не переносит состояние между аккаунтами; auth, community, profiles и recipes больше не связаны с sibling recommendation feature.
- Profile feature владеет загрузкой, редактированием и presentation профиля, но получает following, follow action, public progress и recipe feed композиционными слотами. `widgets/profile-pages` связывает эти домены через их client APIs; route-модули не импортируют внутренности profile feature.
- `widgets/account-security` компонует account security и sessions через `features/auth/client.ts`; layout CSS локален widget, а внутренние формы и `.sessions-panel` стили остаются во владении auth feature.
- `entities/account-security/client.ts` владеет общей critical re-auth boundary для account lifecycle и защищённого экспорта. Одноразовый token не хранится в глобальном состоянии, а purpose остаётся частью серверной проверки; потребители получают только типизированный результат подтверждения.
- CSS Modules апелляций AI и privacy принадлежат своим feature-доменам. Support и personalization больше не выступают неявными библиотеками стилей соседних сценариев.
- Низкосвязанные route-экраны public-info, pro, search, subscription, privacy, account lifecycle, diary, exports, family chat и nutrition входят только через client public APIs. Legal draft documents входят через отдельный server-safe API и не попадают в browser barrel.
- Inventory, preserves и shopping route-экраны публикуются через client APIs; shell classes остаются в отдельных server-safe APIs. Route-модули больше не импортируют внутренние list/detail/shared файлы этих доменов.

## Контролируемый архитектурный долг

Architecture gate не использует открытые allowlist: любой cross-feature import или deep import из `app` немедленно ломает проверку. Route-модули могут входить в feature только через `client.ts`, `server.ts` или `index.ts`, включая узкие доменные subpath API с таким basename.

- Feature-to-feature imports полностью устранены; baseline в `front/scripts/check-architecture.mjs` пуст и запрещает появление новой междоменной связи.
- App-to-feature deep imports полностью устранены. Шесть checkpoint убрали все 100 связей: low-coupling маршруты, news/notifications/support/moderation/offline/personalization/achievements, auth/AI/AI appeals, family/family notes, inventory/preserves/shopping и recipes. URL, runtime-семантика и wire-контракты не менялись.
- Следующий порядок: стабилизация public APIs и измеримая декомпозиция крупных файлов без изменения внешнего поведения.
- `front/src/mocks/ingest.ts` пока зависит от внутренних contracts/worker inventory-ingest. Mock adapters будут включены в отдельный boundary checkpoint и не считаются production public API.

Проверка `npm --workspace front run architecture:check` блокирует обратные зависимости слоёв, cross-feature imports и любое обращение route-модуля к внутреннему feature-файлу.
