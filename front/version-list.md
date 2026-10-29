# Frontend version-list

0.0.151 - 29.10.2026 | 18:05 - Full OpenAPI 0.0.61 metadata synchronized with backend 0.0.151 and additive schema v31. Generated contracts, package/lock and release documentation were updated; wire paths, payloads and frontend runtime behavior are unchanged.

0.0.150 - 29.10.2026 | 16:52 - Production release metadata and the full OpenAPI 0.0.61 snapshot now reflect backend `0.0.149` and schema v30. Verified Docker runtime, deploy-helper and digest rollback are no longer false deployment blockers; technical origins remain active while the two royalexander custom origins are explicitly pending DNS. Runtime behavior and wire contracts are unchanged.

0.0.149 - 29.10.2026 | 12:34 - Closed the residual architecture checkpoint without URL, payload, query-key, or behavior changes: inventory-ingest owns its explicit mock adapter, the architecture gate enforces feature public APIs for both app and widgets and restricts mock entrypoints, while finance, AI, and moderation are split into internal route scenarios behind unchanged client barrels.

0.0.148 - 29.10.2026 | 12:06 - Added the public draft legal catalog with 11 allowlisted server-rendered documents, a single `[Тут будут данные]` placeholder, clear non-approved status, catalog/footer navigation, stable routes and unknown-slug 404. Demonstration legal manifests now remain drafts outside explicit mock mode, so real registration and consent mutations cannot be unlocked by test evidence.

0.0.147 - 29.10.2026 | 10:17 - The deployment runbook now records the verified VPS container cutover and starts with a concise operator/agent map covering repository ownership, main-to-GHCR digest delivery, build-time API settings, server helper, loopback/Nginx routing, smoke checks, and UI-only digest rollback; no secrets or application behavior were added.

0.0.146 - 28.10.2026 | 17:54 - The production build now emits a digest-pinned Next standalone server with a frontend-only, non-cacheable `/healthz` endpoint. The GHCR pipeline rejects stale main SHAs before build and deploy, publishes only a commit tag plus immutable digest, pins every Action by commit SHA, and runs through the allowlisted server helper. The container is non-root with a read-only-compatible runtime layout; build-time API mode, app version and backend rewrite origin are documented explicitly. No deployment was performed, and the deployed app remains `0.0.137`.

0.0.145 - 28.10.2026 | 17:31 - The moderator recovery harness now has an explicit sticky fault-control mode: concurrent matching requests keep receiving the configured failure until the cookie is cleared, while all existing controls remain one-shot by default. The recovery E2E clears the control only after observing the error UI and then uses the existing Retry action; runtime and wire contracts are unchanged, and the deployed app remains `0.0.137`.

0.0.144 - 28.10.2026 | 14:49 - The final public API checkpoint eliminates the remaining 14 recipes app-to-feature deep imports and reduces the architecture debt to zero. Route modules now enter features only through client/server/index public APIs, and the gate immediately blocks any violation. URLs, runtime behavior, and wire contracts are unchanged; the deployed app remains `0.0.137`.

0.0.143 - 28.10.2026 | 14:47 - The fifth public API checkpoint reduces app-to-feature deep imports from 39 to 14. Twenty-five inventory, preserves, and shopping route imports now consume client public APIs while shell styles remain server-safe. URLs, personal/family scope, runtime behavior, and wire contracts are unchanged; the deployed app remains `0.0.137`.

0.0.142 - 28.10.2026 | 14:31 - The fourth public API checkpoint reduces app-to-feature deep imports from 50 to 39. Eleven family and family-notes route imports now consume narrow client APIs for overview, setup, invite, access, ownership, and notes list/editor/detail. URLs, family scope, runtime behavior, and wire contracts are unchanged; the deployed app remains `0.0.137`.

0.0.141 - 28.10.2026 | 14:15 - The third public API checkpoint reduces app-to-feature deep imports from 67 to 50. Seventeen auth, AI, and AI appeals route imports now consume explicit client public APIs. URLs, session/MFA semantics, runtime behavior, and wire contracts are unchanged; the deployed app remains `0.0.137`.

0.0.140 - 28.10.2026 | 14:05 - The second public API checkpoint reduces app-to-feature deep imports from 87 to 67. Twenty news, notifications, support, moderation, offline, personalization, and achievements route/composition imports now consume explicit client public APIs, while the server-only moderation shell remains in `server.ts`. URLs, runtime semantics, and wire contracts are unchanged; deployed app remains `0.0.137`.

0.0.139 - 28.10.2026 | 13:42 - The first low-coupling public API checkpoint reduces app-to-feature deep imports from 100 to 87. Thirteen public-info, legal, pro, search, subscription, privacy, account lifecycle, diary, exports, family chat, and nutrition routes now consume explicit client/server feature APIs. URLs, runtime semantics, and wire contracts are unchanged; deployed app remains `0.0.137`.

0.0.138 - 28.10.2026 | 13:12 - Deployment documentation now records the linked admin `0.0.117` immutable release `20261028-0757`, successful root/deep-link and password-to-mandatory-MFA checks, and `coffee-light` / `nature-dark` smoke with zero runtime errors. The deployed frontend remains root/app `0.0.28` / `0.0.137`; runtime code and public contracts are unchanged.

0.0.137 - 28.10.2026 | 12:27 - Repository production acceptance can launch an already installed managed Chromium/Edge through an explicit absolute `PLAYWRIGHT_EXECUTABLE_PATH`, while preserving mutation denial and the exact desktop/mobile check matrix. Online API/session initialization no longer waits for best-effort offline Service Worker readiness, so a blocked or stalled worker cannot leave protected pages at an endless session check. The release is deployed and passed 24/24 live desktop/mobile checks with zero mutation requests and runtime errors.

0.0.136 - 28.10.2026 | 12:16 - Deployment documentation now records the verified test runtime at root/app `0.0.26` / `0.0.135`, backend `0.0.128` with schema v29, admin `0.0.114`, immutable release identity, authenticated recipes smoke and persisted four-theme behavior. This is a documentation-only repository revision; no new runtime build was deployed.

0.0.135 - 28.10.2026 | 11:39 - Recipe workspace now renders independent review/publication axes, preserves an active published r1 while r2 is pending/rejected, replaces it with approved r3, and removes public links after hide/unpublish/archive. A narrow two-phase legacy response/cache normalizer supports frontend-first rollout without inventing public reasons or timestamps and rejects partial/mixed payloads; mocks, unit/E2E, schema-v29 readiness and testing docs are updated.

0.0.134 - 27.10.2026 | 18:56 - Frontend release operations now have a reproducible deployment/rollback runbook, immutable artifact checks, pre/post-traffic smoke and mutation-denying production acceptance. The provider-neutral readiness validator is owned by this repository and requires schema v28; runtime behavior and backend contracts are unchanged.

0.0.133 - 27.10.2026 | 18:38 - The final three feature-to-feature dependencies are removed: critical re-auth now lives in the shared account-security entity, while AI appeals and privacy own their CSS modules. The architecture gate enforces a zero cross-feature baseline; lifecycle E2E waits for auth runtime readiness before input without changing URLs, product behavior, or backend contracts.

0.0.132 - 27.10.2026 | 18:29 - Recommendation actions now live in an account-scoped entity, while profile/account screens compose through widgets and explicit feature client APIs; user-home styles are localized in auth. The exact architecture baseline drops to 3 cross-feature edges and 100 app deep imports with unchanged URLs and backend contracts.

0.0.131 - 27.10.2026 | 18:12 - Family create/leave now freeze the full payload with its idempotency key, reconcile server state after every failed outcome, and expose a locked exact retry for unknown results. Recipe submission conflicts await a current workspace readback before another moderation attempt.

0.0.130 - 27.10.2026 | 18:00 - Twelve byte-identical nested layouts now share four URL-neutral route groups with unchanged personal/family/offline policies, reducing browser chunks from 200 to 192. The release gate retains raw/gzip caps and adds total files, unique SHA-256 payloads, plus complete manifest-backed per-route request and gzip-transfer budgets.

0.0.129 - 27.10.2026 | 17:46 - Exact architecture debt baseline now blocks new cross-feature and route deep imports; preserves consumes measurement/date entities directly, shopping routes use its public API, and reusable finance-cost UI moved from a page implementation into an account-scoped entity. Finance and meal-plan expose client entrypoints.

0.0.128 - 27.10.2026 | 14:02 - Receipts co-located with shopping purchase intake, shared byte-level image validation reused by receipt/inventory flows, canonical inventory location keys and measurement/date entities remove shopping→inventory internals; family pickers hide personal pending products and unknown-outcome retries freeze the complete receipt form.

0.0.127 - 27.10.2026 | 13:52 - Inventory ingest переведён на entities/inventory, entities/measurement и shared command-error без sibling-feature imports; canonical user/scope query keys и public client API защищены gate, а UI теперь честно требует locationId, как wire commit contract.

0.0.126 - 27.10.2026 | 13:42 - Добавлены entities/measurement и entities/inventory с pure scope/query/date models, command-error вынесен в shared/api; products получил локальные async-state/CSS и client API, а architecture gate запрещает возврат к inventory internals и deep route imports.

0.0.125 - 27.10.2026 | 13:30 - Recipe presentation и wire-code справочники вынесены в entities/recipe; public community feed/comments перенесены в recipes bounded context и открыты через client API, цикл recipes ↔ community устранён; новые cross-feature CSS блокируются поверх явного debt-allowlist.

0.0.124 - 27.10.2026 | 13:20 - Offline runtime оформлен как entities/offline, recipe read cache — как entities/recipe-cache: recipes/shopping/widgets/app больше не импортируют внутренности offline feature, offline-store не зависит от recipes feature, а architecture gate блокирует оба удалённых legacy пути.

0.0.123 - 27.10.2026 | 13:15 - `useRequestSignal` вынесен из auth в shared/api для 15 transport-потребителей, а `useConsent`/`isConsentRequiredError` — из legal feature в entities/consent для семи доменов; query key, retry policy и четыре 403-кода сохранены, прямые импорты старых путей заблокированы.

0.0.122 - 27.10.2026 | 13:04 - Добавлен widgets/session-guard, который единожды компонует auth redirect, family/workspace initialization и offline fallback; все дублирующие Guard в achievements, profile, inventory, shopping, preserves, plan, recipes и moderation удалены, legacy features/auth/session удалён, route-level offline матрица сохранена.

0.0.121 - 27.10.2026 | 12:55 - Добавлена entities/family: canonical `['family', userId]` централизован без изменения wire/query contracts, invitation accept сразу переключает account-bound scope; app routes используют server-safe feature entrypoints, widget получает OwnershipNotice через публичный client API, architecture gate и 145-й unit-тест фиксируют границы.

0.0.120 - 27.10.2026 | 12:46 - Добавлена entities/workspace-scope с отдельным Zustand store/provider: выбранный personal/family workspace привязан к user id и атомарно сбрасывается при auth transitions; Guard стал единственной route-aware точкой инициализации, а inventory/shopping/preserves/recipes/plan больше не создают конкурирующие эффекты.

0.0.119 - 27.10.2026 | 12:37 - Добавлена entities/session с чистым model и client entrypoint: useSession мигрирован из auth feature во всех 70 потребителях, user cache writes синхронизируют offline owner/recipe cache через app-owned lifecycle port; 143 unit-теста фиксируют keys и ручные переходы authenticated/unauthorized.

0.0.118 - 27.10.2026 | 12:13 - Exhaustive route smoke корректно переживает service-worker document swap: DOM-аудит повторяется после восстановления session-loader и landmark, memory-safe fresh-server контракт задокументирован, а theme-init загружается через Next Script beforeInteractive без React warning и без вспышки неверной темы.

0.0.117 - 27.10.2026 | 11:44 - UserAppShell стал widget с guarded entrypoint; inventory/products, shopping/receipts/purchases, preserves, recipes/reports, meal-plan и moderation получают shell из app layouts/pages. Feature сохраняют только domain scope/context, а architecture gate запрещает возврат legacy src/ui.

0.0.116 - 27.10.2026 | 11:37 - PersonalShell перенесён в widgets с сохранением порядка Guard → UserAppShell → OwnershipNotice; 25 feature-потребителей очищены от shell/route guard, а 40 authenticated routes получают композицию через шесть Next layouts и 18 page wrappers.

0.0.115 - 27.10.2026 | 11:28 - Public-shell композиция поднята из community/news/public-info/profile/achievements в Next app routes; PublicShell и OfflineStatus получили widget-owned стили и публичные entrypoints, ThemeControl перенесён в shared UI. Architecture gate подтверждает отсутствие `features → widgets`.

0.0.114 - 27.10.2026 | 11:15 - Архитектурный foundation: 84 feature/UI импорта больше не зависят от `app/providers`, runtime и UI store получили нижележащую shared-границу, API transport сообщает об успешном запросе через callback composition root вместо импорта offline feature; добавлены архитектурный gate и unit-регрессия callback.

0.0.113 - 27.10.2026 | 11:05 - Next.js production build развёрнут на тестовом VPS; проверены root/deep navigation, real API login/me, отрисовка главной и переключение четырёх тем. Публичный origin и эксплуатационные ограничения зафиксированы в README и backend deployment runbook.

0.0.112 - 10.26.2026 | 15:37 - Production-readiness: все локальные цвета приложения заменены семантическими токенами, четыре темы применяются до гидрации и сохраняются в public/authenticated desktop/mobile shell; добавлены регрессии токенов, полный контроль маршрутов/интерактивов, budget и пакетно-изолированные memory-safe production-проверки, руководство ручной приёмки.

0.0.111 - 10.24.2026 | 19:31 - Административный интерфейс и его тесты вынесены в независимый meal_admin; клиент устанавливается и запускается без исходников админки.

0.0.110 - 10.24.2026 | 18:34 - Перенос в самостоятельный meal_frontend; переносимые проверки и отсутствие зависимости от исходников backend.

0.0.103 - 14.10.2026 | 15:21 - Account lifecycle проверен desktop/mobile: export expiry, archive redirect, session alerts, draft при 503, stale 412, PIN/TOTP/recovery и 10-minute reauth. Mock синхронизирован с 200 blocked, export_not_ready и retention gates; OpenAPI обновлён.

0.0.102 - 14.10.2026 | 13:25 - Исправлено завершение Plus/Pro при выключенном продлении и прекращение обеих исходных Plus-записей после объединения в Pro; сообщение неопределённого commit больше не заявляет об отсутствии эффекта без readback.

0.0.101 - 14.10.2026 | 12:18 - AI run повторно объясняет отзыв согласия между preview/commit и предлагает перейти к документу без потери preview; diary mutations получили consent CTA, subscription commit errors стали видимыми. Добавлен desktop/mobile preview→revoke→run race-сценарий.

0.0.100 - 14.10.2026 | 12:00 - Moderator mock синхронизирован с серверными переходами и assignment isolation, добавлен закрытый support fixture; форма решения очищается после успеха, добавлены unit и desktop/mobile action-сценарии.

0.0.99 - 14.10.2026 | 07:58 - Support mock больше не передаёт внутренний `userId` в strict public detail DTO; добавлены unit regression и desktop/mobile dynamic-route scope/action сценарии для inventory, preserves, shopping, receipts, purchases, support, finance, recipes и reports.

0.0.98 - 14.10.2026 | 05:37 - Moderator mock разделяет строгие list/detail DTO и больше не отдаёт лишние поля в detail `200`; AI appeal E2E наследует desktop/mobile device-профиль. Три полных dynamic-route прохода и отдельные 3× AI device-прогоны успешны.

0.0.97 - 10.14.2026 | 06:10 - Family shopping/receipts/purchases mock теперь требует активное членство и изолирует private/family scopes; неизвестная moderator queue показывает 404 вместо loader; добавлены валидный приватный AI-appeal fixture и dynamic-route browser scenarios.

0.0.96 - 10.14.2026 | 05:40 - Consent gate smoke теперь проверяет полный accept/revoke/reaccept цикл четырёх независимых согласий; добавлена трёхитерационная Edge desktop/mobile матрица Guest/Free/AI40/Plus/Pro/trial с отдельными JSON-отчётами, всего 48/48 PASS.

0.0.95 - 10.14.2026 | 05:10 - Cross-browser audit сохраняет отдельные I1/I2/I3 evidence-пакеты с версией приложения, временем, версиями Chromium/Firefox/WebKit, результатами и скриншотами вместо перезаписи единственного отчёта.

0.0.94 - 10.14.2026 | 03:23 - About/auth raster payload переведён на фактически размерные `srcset`/cover/brand варианты; auth query читается на сервере без Suspense shell replacement. Slow 4G + 4×CPU: about/auth LCP и CLS проходят три итерации.

0.0.93 - 10.14.2026 | 02:20 - Browser telemetry error handlers устанавливаются идемпотентно и не дублируются при dev/HMR; три 30-minute desktop/mobile authenticated soak-сессии подтвердили bounded heap/DOM/listener growth без ошибок.

0.0.92 - 10.14.2026 | 00:26 - Mobile inventory filters используют стабильную двухколоночную grid-сетку; асинхронная загрузка названий мест больше не перестраивает строки и не сдвигает список.

0.0.91 - 10.14.2026 | 00:08 - Client runtime Zod registry больше не включает 68 привилегированных admin-операций, которые не исполняются client/moderator поверхностями; полный OpenAPI snapshot и backend coverage сохранены.

0.0.90 - 10.13.2026 | 23:59 - Крупные реально используемые public/auth/profile raster assets переведены на WebP без изменения размеров/layout; исходные PNG сохранены для отката и сравнения.

0.0.89 - 10.13.2026 | 23:49 - Добавлен компактный SVG favicon через Next app metadata; production browser baseline больше не получает лишний 404 на первом открытии клиента.

0.0.88 - 10.13.2026 | 19:20 - Browser legal-gate smoke расширен на все четыре независимых согласия: AI personal data, health/allergens, публикации и marketing delivery; каждый command ждёт фактическую смену состояния своей карточки, домены изолированы по browser contexts, три последовательные итерации PASS.

0.0.87 - 10.13.2026 | 17:36 - Browser-smoke сценарии синхронизированы с текущими auth/theme/legal UI, поддерживают системный браузер и отдельно проверяют блокировку, выдачу и отзыв AI-согласия.

0.0.86 - 10.13.2026 | 16:05 - Публичные страницы условий и политики показывают полный подготовленный draft из docs/legal с заметной пометкой, незаполненными реквизитами и запретом считать черновик действующей регистрационной версией.

0.0.85 - 10.13.2026 | 13:00 - Добавлены version-bound register/v2, canonical legal API через общий клиент, две регистрационные галочки и центр независимых согласий; mock-отзыв блокирует AI personal data/history, health/allergens, новые публикации и marketing, сохраняя unrelated функции и owner actions.

0.0.84 - 12.10.2026 | 18:34 - AI-consent остаётся fail closed без versioned document: кнопка включения требует consentVersion, а ошибка подтверждения теперь объявляется внутри открытого диалога.

0.0.83 - 12.10.2026 | 17:28 - Добавлена first-party browser telemetry без Sentry: глобальные handlers и route/root boundaries отправляют в backend только фиксированный код и публичную версию; OpenAPI синхронизирован до 0.0.59.

0.0.82 - 12.10.2026 | 15:49 - Security release-gate обновил Next.js 16.3.6 → 16.4.0, sharp 0.35.4 → 0.35.5 и source-map-js 1.2.1 → 1.2.2; production npm audit теперь сообщает 0 уязвимостей.

0.0.81 - 12.10.2026 | 15:24 - Хлебные крошки finance/account/subscription, вкладки recipe workspace и подписи checkbox уведомлений получили область взаимодействия не меньше 44 px; свежий Edge-аудит desktop/mobile подтвердил 0 малых controls и наложений на 234 состояниях.

0.0.80 - 12.10.2026 | 15:02 - Реальный Edge-прогон подтвердил keyboard navigation, имя и focus lifecycle recipe dialog, labels уведомлений, состояние периода плана, family chat composer и offline headings; внешние AT/device-пункты задокументированы как открытые.

0.0.79 - 12.10.2026 | 14:40 - Accessibility acceptance проверяет landmarks, headings, accessible names, 24 Tab-stop, dialog focus, reflow и forced colors; filters dialog связан с заголовком, family chat grid использует сжимаемую колонку.

0.0.78 - 12.10.2026 | 14:26 - Единый browser matrix Chromium/Firefox/WebKit проверяет desktop, mobile dialog, focus, landscape и reduced-motion; recipe filters явно возвращают фокус, а family chat toolbar стабильно растягивается во всех движках.

0.0.77 - 12.10.2026 | 13:52 - Добавлен аудит 320px/landscape/forced-colors/reduced-motion; family, family notes и plan уважают системное сокращение движения, account smoke и полный inventory/scanner smoke выполняются детерминированно.

0.0.76 - 12.10.2026 | 12:46 - Проверены оставшиеся browser-native confirmations семейного чата, повторного OCR-разбора, привязки чека и offline-удаления; добавлен 200% text-size reflow audit без потери состояния и horizontal overflow.

0.0.75 - 12.10.2026 | 12:30 - Зафиксирован mobile state-recovery audit: задержанный поиск, пустая выдача, inventory 503 с touch-sized retry и отмена ухода из dirty preserve form проходят без overflow, потери ввода и перекрытия действий нижним dock.

0.0.74 - 12.10.2026 | 12:09 - Touch/dialog QA исправил фактическую высоту вкладок поиска до доступных 44px и начальный фокус offline destructive dialog: «Отмена» теперь первая и безопасная по умолчанию; scanner touch/upload recovery и account lifecycle подтверждены.

0.0.73 - 12.10.2026 | 11:43 - Добавлен воспроизводимый Playwright-аудит мобильных взаимодействий: drawer «Ещё» удерживает и возвращает фокус, закрывается Escape, recipe filters помещаются в viewport, активное поле остаётся видимым при keyboard-height proxy, а финальная кнопка длинной формы доступна над mobile dock.

0.0.72 - 12.10.2026 | 11:24 - Повторный полный Design QA подтверждён на 117 маршрутах desktop/mobile (234 состояния): чекбоксы уведомлений получили заметный размер и цвет темы, а route-audit изолирует поздние client redirects и повторяет навигацию при кратком рестарте dev-сервера.

0.0.71 - 10.09.2026 | 20:45 - Завершён route-by-route Design QA 117 маршрутов на desktop/mobile: исправлены mobile overflow AI, privacy heading, поля и вкладки модерации, 44px selects/summary/checkbox/reaction targets, главная mock-рекомендаций и совместимость mock scope для чеков/готовки; итог 234/234 без navigation/render/overflow/fixed-overlap ошибок.

0.0.70 - 10.09.2026 | 15:54 - Design QA: diary/family переведены на нативные доступные dialog, общие recipe/subscription/offline dialog ограничены viewport, восстановлена mobile-секция рецептов, исправлен узкий landing reflow и увеличены touch-targets текстовых действий и plan checkbox-label.

0.0.69 - 10.09.2026 | 12:25 - `/settings/subscription` расширен до полного simulation lifecycle Plus/Pro с promo, renewal, downgrade, upgrade credit и Combine; mock parity и тесты добавлены.

0.0.68 - 10.09.2026 | 11:42 - `/exports` добавляет дневник, финансы, питание и all-Pro manifest в CSV/PDF/JSON; mock повторяет Active/former-Pro gate.

0.0.67 - 10.09.2026 | 10:58 - `/ai` показывает каталог из 18 задач, class/cost, Pro priority, token budgets, context manifest и правило компенсации; mock parity обновлён.

0.0.66 - 10.08.2026 | 18:45 - В план добавлен Pro deterministic-v1 режим с альтернативами, приоритетом, бюджетом и объяснимым preview ранжирования.

0.0.65 - 10.08.2026 | 18:20 - Добавлен реальный Pro-only месячный календарь плана с навигацией и сохранением preview/commit поведения.

0.0.64 - 10.08.2026 | 18:05 - Добавлен `/finance/analytics` с фильтрами, метриками чеков/магазинов, coverage подтверждённой экономии и fail-honest прогнозом.

0.0.63 - 10.08.2026 | 17:07 - Добавлены Pro electronic receipt source, финансовые поля строк/чека, receipt detail summary, mock finance linkage и честно отключённый PDF до внешних адаптеров.

0.0.62 - 10.08.2026 | 16:38 - Добавлен `/finance/prices`, private price mock parity и approximate cost badge в рецептах, личных списках и планах; неполная оценка не выдаётся за итог.

0.0.61 - 10.08.2026 | 15:42 - Реализованы `/finance`, `/finance/expenses` и `/finance/expenses/:id`: private Pro overview, exact manual expenses, общий бюджет, read-only former Pro, mock parity и browser QA; pricing дополнен честными Pro/trial карточками.

0.0.60 - 10.08.2026 | 15:06 - Hover `@author` внутри recipe card теперь использует локальный soft highlight без обводки карточки; card hover ограничен overlay-link рецепта, `focus-visible` сохранён.

0.0.59 - 10.08.2026 | 15:03 - `/community` получил selected-подобные search/category/card hierarchy и mobile list; вся recipe card ведёт в рецепт, `@author` остаётся отдельной ссылкой; scrollbar синхронизирован через DS 0.0.6.

0.0.58 - 10.08.2026 | 14:49 - `/auth` сверен с desktop/mobile selected и получает vertical mobile AuthShell на 852 px; `/about` больше не использует случайные blue/info accents, fresh auth evidence сохранены.

0.0.57 - 10.08.2026 | 14:32 - `/about` реализован по `UI/landing` desktop/mobile selected: согласованы тексты, hero, CTA, steps, tools и desktop recipe strip; исправлены public header overflow и mobile stacking, сохранены fresh QA captures.

0.0.56 - 10.08.2026 | 14:09 - Public/auth/profile/achievements/community переведены на DS PublicShell/AuthShell; исправлены mobile stacking публичной оболочки и responsive community container/filter, удалены прежние shell CSS-дубли.

0.0.55 - 10.08.2026 | 13:08 - Единый DS application shell подключён к home/settings/support/family, recipes, inventory, plan, shopping, preserves и moderator: канонические 9/5 пунктов, topbar, mobile sheet и очищенные feature CSS.

0.0.54 - 10.08.2026 | 12:24 - Подключён локальный Meal Planner Design System: coffee-light по умолчанию, четыре темы, общий theme switcher и loading primitives; legacy admin entry points удалены из Next-клиента, moderator сохранён; API/моки без изменений.

0.0.53 - 10.08.2026 | 11:25 - `/diary/analytics`: период, КБЖУ и полнота, ручной профиль/цели, история версий, former-Pro read-only и contract-faithful mock/tests без новых макетов.

0.0.52 - 10.08.2026 | 10:24 - `/diary`: предложения семейных порций, ручные решения, отметка auto-confirmed, former-Pro late cancel, unavailable media state и mock/test parity.

0.0.51 - 10.07.2026 | 20:13 - `/diary` по выбранной композиции: source-first plate composer, day/meal states, summary, edit/archive, active/read-only/locked и contract-faithful mocks/tests.

0.0.50 - 07.10.2026 | 19:21 - Добавлена страница `/pro` по выбранной существующей композиции: active/read-only/locked/error/loading состояния, фактические цели, пробелы данных, счётчики и AI-квоты; development mock синхронизирован с OpenAPI 0.0.46.

0.0.49 - 07.10.2026 | 18:29 - Актуализированы регресс-тесты AI privacy consent, versioned family invitation acceptance и публичного числа рецептов; полный frontend-набор проходит.

0.0.48 - 07.10.2026 | 18:20 - Support mock больше не имитирует вложения: upload недоступен, текстовые обращения и ответы продолжают работать.

0.0.47 - 07.10.2026 | 18:03 - Export mock больше не создаёт готовый JSON: preview/reauth/history сохранены, job завершается storage_unavailable как backend runner.

0.0.46 - 06.10.2026 | 13:20 - Реализованы выбранные moderator overview/queue/item/support экраны и контрактные development-моки.

## 0.0.45 — 6 октября 2026

Добавлен `/settings/account/lifecycle`: серверная проверка готовности, экспорт с одноразовой critical reauth, блокеры семьи и подписки, обратимое архивирование, запрос/отмена/финализация удаления с версиями и идемпотентностью, а также состояния конфликта, неизвестного исхода и risk hold. Development-мок повторяет lifecycle state machine, не придумывает юридические сроки и поэтому fail-closed блокирует финализацию без policy. После архивирования и подтверждённого удаления клиент очищает сессию. Тесты и browser QA не запускались по ограничению задачи.

## 0.0.44 — 6 октября 2026

Контрактный слой синхронизирован с OpenAPI 0.0.44: типизированному клиенту доступны account lifecycle/export DTO и расширенная схема административных релизов. Пользовательский lifecycle-интерфейс не реализован и ждёт отдельного согласования макета. Поведение и development-моки не менялись; тесты и browser QA не запускались.

## 0.0.43 — 6 октября 2026

Публичные достижения и репутация: отдельные маршруты автора и владельца профиля, целое число рейтинга и 10 серверных званий, каталог из 60 согласованных достижений с категориями, полученными/закрытыми/секретными состояниями и реальными raster fallback-иконками. Профиль содержит прямые переходы и публичную сводку; development mock повторяет OpenAPI 0.0.42 и не рассчитывает правила на клиенте. Typecheck, lint и production build прошли; тесты и browser QA не запускались по ограничению задачи.

## 0.0.42 — 6 октября 2026

Общий слой Free/Plus: community/авторы/подписки, help/pricing/search/news, privacy AI-access, архив AI, ограниченный export, добровольная передача семьи, AI-апелляции и report detail. OpenAPI 0.0.41. Реальные провайдеры/БД/юридические документы отдельно; достижения только предложены. Проверки: docs/free-plus-completion-iteration.md от корня проекта.

## 0.0.41 — 5 октября 2026

Добавлены кликабельные аллергенные плашки с иконками, модалка со связанными ингредиентами и обращение в поддержку с защитой от повторной отправки. Неполный состав остаётся в рекомендациях без снижения веса. Адаптивность следует существующим паттернам, без отдельных mobile-макетов. OpenAPI 0.0.40; актуализированы recommendation mocks и срок действия выдачи. Тесты и browser QA не запускались.

## 0.0.40 — 5 октября 2026

Подключён отдельный `personalized-v1`: объяснимые рекомендации рецептов и авторов, личные/семейные запасы, safety warning для неполных и неопределённых сведений об аллергенах, feedback-события и идемпотентная подписка/отписка от автора. Development-мок хранит выдачу и события отдельно, включает deterministic diversity и включает collaborative-сигнал только после 5 сильных действий и 20 независимых пользователей. OpenAPI 0.0.38. Тесты и browser QA не запускались. Подробности: docs/recommendations.md.

## 0.0.39 — 5 октября 2026

Добавлен `/settings/subscription`: текущий Free/Plus/Pro-trial, раздельные AI-квоты, одноразовый 7-дневный trial без карты, обязательный preview и подтверждение simulation-перехода Free→Plus, а также отложенный Plus→Free. Development-моки сохраняют версии, идемпотентность, eligibility и купленные остатки. OpenAPI 0.0.37. Тесты и browser QA не запускались. Подробности: ../docs/subscription-trial-iteration.md.

## 0.0.38 — 5 октября 2026

Основная и внутренняя навигация соблюдает семейную область по умолчанию для запасов, рецептов, плана, покупок, чеков и заготовок. Явный личный или семейный маршрут синхронизирует текущую область после проверки аккаунта. OpenAPI остаётся 0.0.36. Тесты и browser QA не запускались. Подробности: ../docs/plus-family-scope-iteration.md.

## 0.0.37 — 5 октября 2026

Preview вступления и выхода из семьи показывает перераспределение неизрасходованной AI-квоты, будущую долю участников, резерв и неизменность уже потраченных/переданных действий. Development-моки синхронизированы с OpenAPI 0.0.36. Тесты и browser QA не запускались. Подробности: ../docs/plus-ai-redistribution-iteration.md.

## 0.0.36 — 5 октября 2026

В балансе AI добавлены запрос действий у участника семьи, подтверждение/отклонение донором и статусы передач. Development-моки синхронизированы с OpenAPI 0.0.35. Тесты и browser QA не запускались. Подробности: ../docs/plus-ai-transfer-iteration.md.

## 0.0.35 — 5 октября 2026

Баланс Plus показывает семейный AI-резерв отдельно; preview и новый платный интервал требуют явного подтверждения перед его списанием. Development-моки синхронизированы с OpenAPI 0.0.34. Тесты и browser QA не запускались. Подробности: ../docs/plus-ai-reserve-iteration.md.

## 0.0.34 — 1 октября 2026

Завершён Plus-интерфейс без Pro: приглашения семьи, семейные заготовки и QR, подбор рецептов по выбранной области запасов и актуальные моки месячной AI-квоты. Добавлены отдельные URL и проверки общей семейной доступности. OpenAPI 0.0.33.

## 0.0.33 — 1 октября 2026

Plus получил горизонты 14/30/90/180 дней и календарный год, форму еженедельного повторения рецепта с preview конфликтов и влияния на покупки, а также тарифную границу умного списка. Моки считают реальные даты и проверяют идемпотентный commit. OpenAPI 0.0.32.

## 0.0.32 — 1 октября 2026

Карточка личной заготовки выпускает QR-этикетки Plus/Pro, показывает QR из безопасного offline payload, скачивает SVG и открывает системную печать. Free видит явную тарифную границу; моки покрывают обе ветки. OpenAPI 0.0.31.

## 0.0.31 — 1 октября 2026

Добавлен `/family/chat` с URL-поиском, хронологической лентой, replies, mentions, авторскими edit/tombstone, личным скрытием, реакциями, закреплениями и приватным черновиком. Моки повторяют membership boundary и права обоих Plus-пользователей. OpenAPI 0.0.30.

## 0.0.30 — 1 октября 2026

Добавлены `/family/notes`, создание, карточка, авторский редактор, архив, история и совместные отметки чек-листа. Поиск и вкладка архива сохраняются в URL; моки содержат сценарии обоих участников. OpenAPI 0.0.29.

## 0.0.29 — 1 октября 2026

Добавлен `/family/plan` с URL-диапазоном, общими записями, распределением порций и рабочим назначением готовой еды. Моки разделяют личный и семейный план, моделируют немедленное списание и автоподтверждение через 24 часа. OpenAPI 0.0.28.

## 0.0.28 — 1 октября 2026

Добавлены `/family/shopping`, семейные карточки списков, чеки и покупки. Моки разделяют личную и общую область, история показывает исполнителя; family scope не сохраняется offline. OpenAPI 0.0.27; frontend-набор — 79/79.

## 0.0.27 — 1 октября 2026

Добавлены `/family/recipes`, создание, карточка и авторское редактирование семейного рецепта. Другие участники получают чтение без команд автора; семейные данные не попадают в offline-кэш. OpenAPI 0.0.26; frontend-набор — 78/78.

## 0.0.26 — 1 октября 2026

Добавлены полные `/family/inventory/*` маршруты для списка, партии, создания, мест, истории, сканирования и импорта. Семейные данные общие для участников и изолированы от `/inventory/*`; основной переход учитывает семейный scope по умолчанию. OpenAPI 0.0.25.

## 0.0.25 — 1 октября 2026

В `/family/members` и `/family/access` добавлены исключение участника, выход, выбор преемника и кнопка автоматической передачи; новому владельцу показывается обязательное полноэкранное уведомление. Моки соответствуют OpenAPI 0.0.24 и сохраняют архивную историю; 76 тестов.

## 0.0.24 — 1 октября 2026

Первая итерация Plus: `/family`, создание семьи, состав, состояние доступа и автоматический семейный scope после входа. Development-моки Plus синхронизированы с OpenAPI 0.0.23; будущие семейные разделы обозначены без битых ссылок.

## 0.0.23 — 1 октября 2026

Generated DTO синхронизированы с OpenAPI 0.0.22 после подключения Free-admin persistence. Пользовательский интерфейс и моки основного приложения не менялись.

## 0.0.22 — 1 октября 2026

Generated DTO синхронизированы с OpenAPI 0.0.21 для административного управления Free AI и центра admin-уведомлений. Пользовательский интерфейс и моки основного приложения не менялись.

## 0.0.21 — 30 сентября 2026

Добавлена страница беседы `/ai/[id]`, продолжение с двумя бесплатными уточнениями, ожиданием третьего и следующим платным 10-минутным интервалом. Исправлены строгая публичная проекция AI-моков и контрактные значения по умолчанию строк покупок. OpenAPI 0.0.20; frontend-набор — 72/72. Общий остаток: free-tier-todo.md.

## 0.0.20 — 30 сентября 2026

Generated DTO синхронизированы с OpenAPI 0.0.19 серверной AI orchestration. Mock-flow и интерфейс не менялись; после добавления provider config тот же экран использует реальный preview/run. Тесты не запускались.

## 0.0.19 — 30 сентября 2026

Добавлены `/ai`, `/ai/history`, `/ai/balance` и полные development-моки preview, списания, результата, refund и тестовой покупки 40 действий за 199 ₽. Real UI блокирует запуск по capability. OpenAPI 0.0.18; тесты не запускались. Подробности: ai.md.

## 0.0.18 — 30 сентября 2026

Добавлены `/support`, `/support/new`, `/support/[id]`, URL-фильтры, полные моки очередей/статусов/переписки/вложений, редактирование, закрытие и возобновление. OpenAPI 0.0.17. Бинарные файлы в mock не сохраняются; real upload отключён серверной capability. Тесты не добавлялись и не запускались. Подробности: support.md.

0.0.17 - 09.30.2026 | время не фиксировалось - `/notifications` с URL-вкладками категорий, unread-фильтром и отметками прочтения; `/settings/notifications` с per-category Web Push/email, тихими часами, временем плана и timezone. Моки содержат все категории; внешняя доставка честно помечена неподключённой. OpenAPI 0.0.16; тесты не добавлялись и не запускались.

0.0.16 - 09.30.2026 | время не фиксировалось - Полная личная главная, повторяемый онбординг 3/5/7 шагов, центр настроек, питание/аллергены/техника/цели и редактирование профиля. Моки синхронизированы с OpenAPI 0.0.15 и используют version/idempotency. Тесты не добавлялись и не запускались.

0.0.15 - 09.30.2026 | время не фиксировалось - Offline-команды Free: account-bound IndexedDB queue/snapshots, ручные строки покупок, личные черновики и архив, шаги/таймеры готовки, автоматическая синхронизация с зависимостями, idempotency, backoff и явными conflict/rejected/auth-required состояниями. OpenAPI 0.0.14; тесты не добавлялись и не запускались.

0.0.14 - 09.30.2026 | время не фиксировалось - Offline-чтение Free: глобальный статус сети, PWA manifest/application shell для сохранённых рецептов и `/settings/offline` с объёмом, последней синхронизацией, очередью и безопасной локальной очисткой. API не кэшируется; mock/MSW не конфликтует со вторым worker. Запись offline-команд остаётся следующим блоком. Тесты не добавлялись и не запускались.

0.0.13 - 09.30.2026 | время не фиксировалось - Личный `/plan` Free: день/неделя и навигация в URL, локальный timezone, ручные слоты и рецепты, preview/commit влияния на запасы, мягкие резервы и отдельное создание списка покупок. Моки синхронизированы с OpenAPI 0.0.13. Тесты по поручению пользователя не добавлялись и не запускались.

0.0.12 - 09.30.2026 | 12:34 - Полный онлайн-срез личных покупок и фото-чеков Free: URL-фильтры, lifecycle, reorder, review/commit покупки, OCR-фото с ручной проверкой, дубликаты, позднее уточнение количества и связанные моки. OpenAPI 0.0.12. Тесты по поручению пользователя не добавлялись и не запускались.

0.0.11 - 09.29.2026 | время не фиксировалось - Личные `/preserves` и `/preserves/[id]`: URL-фильтры, создание/редактирование, отдельные банки, открытие, уточнение количества, preview расхода, архив, история, recipe-base и Plus/Pro QR upsell. Моки синхронизированы с OpenAPI 0.0.11. Тесты по поручению пользователя не добавлялись и не запускались.

0.0.10 - 09.29.2026 | время не фиксировалось - Настройки напоминаний о готовке, локальный часовой пояс, текущие/архивные приготовления и внутренние напоминания; моки синхронизированы с OpenAPI 0.0.10. Архив не списывает запасы. По поручению пользователя тесты не добавлялись и не запускались.

0.0.9 - 09.29.2026 | время не фиксировалось - Личные рецепты/редактор/варианты, приготовление и таймер, покупки, сообщество, локальное чтение последних рецептов. URL и контракт OpenAPI 0.0.9; CSRF PUT/PATCH. Границы и проверки: ../docs/recipe-workflows-iteration.md.

0.0.8 - 09.29.2026 | время не фиксировалось - Каталог и публичная SSR-карточка рецепта, URL-фильтры/вкладки/порции и безопасный возврат; личная доступность80%, закладки, read-only варианты/комментарии. Общая mock-подборка «Для вас» с TODO алгоритма; создание/редактирование/готовка/покупки отложены. OpenAPI0.0.8; итоговые проверки фиксируются после прогона. Объём: ../docs/recipes-iteration.md.

0.0.7 - 09.28.2026 | время не фиксировалось - Free: личные партии, места, история с фильтрами/пагинацией, продукты и предложения, OCR/штрихкоды и импорт с проверкой перед сохранением. Общий API-клиент, моки OpenAPI0.0.7, If-Match/идемпотентность, unknown/fallback и локальные OCR-ресурсы. PostgreSQL не менялась; 44 теста, 13 браузерных сценариев, lint/typecheck и production-сборка прошли. Объём: ../docs/inventory-iteration.md.

0.0.6 - 09.28.2026 | время не фиксировалось - Общие hover/active/focus/disabled состояния интерактивных элементов, переходы 0.2s и поддержка reduced motion; правило закреплено в инструкции агента.

0.0.3 - 09.28.2026 | 10:08 - По разрешению пользователя выполнен Chromium/Playwright smoke: 22 группы проверок. Исправлены браузерный receiver fetch, отсутствующий Origin до сетевой отправки MSW и потеря Set-Cookie в native Response. Добавлены 2 регрессионных теста (всего 17), воспроизводимый browser runner и скриншоты/сравнения. Визуальные расхождения отмечены отдельно, без объявления полной приёмки дизайна. БД не изменялась.

0.0.2 - 09.25.2026 | 21:27 - Подключены Next App Router, TanStack Query, Zustand, темы, обычный и отдельные staff-входы, MFA/резервные коды, guards/returnTo, управление сессиями, публичная страница и стартовый экран аккаунта. Добавлены React Hooks/Stylelint, Next build в CI, отмена запросов форм и очистка межвкладочного состояния. Полная главная по макету и browser QA ещё не приняты; ограничения описаны в README/design-qa. PostgreSQL не изменялась.

0.0.1 - 09.25.2026 | 19:10 - Создан отдельный npm-проект с собственным lockfile; подготовлены OpenAPI-снимок и генерация типов/валидации, 14 auth/health mock-операций, 8 fixtures, MSW browser/Node, атомарная IndexedDB, настоящий TOTP и одноразовые резервные коды, API-клиент с отменой устаревших ответов, тесты и CI. Старые доменные моки сохранены отдельно. Экраны и live PostgreSQL-интеграция не входят в результат этого среза. Следующие повышения только patch.

## 0.0.4 — 28 сентября 2026

Добавлены GET own/public профилей, строгие DTO и синхронизированные моки, OpenAPI 0.0.2. Front включает страницы профилей, страницу сессий аккаунта и Arc loading-компоненты. Новые тесты приватности, fallback, параметров URL и браузерных состояний. Auth lifecycle ожидает решений пользователя; БД не менялась.

## 0.0.5 — 28 сентября 2026

Auth lifecycle на моках: регистрация/verify/resend, recovery/reset/change password, отложенная смена email с отменой, PIN доверенного браузера и самостоятельный TOTP-вход, подключение/замена аутентификатора и новые recovery-коды. Добавлены страницы auth и настройки безопасности, dev-mailbox, защита от повторов/гонок и контрактные проверки. API 0.0.3, 35 операций; состояния mock IndexedDB обновляются без сброса старых fixtures. Генератор поддерживает Unicode patterns и проверяет форматы email/UUID/date-time. SQL не применялся; production-почта и юридические документы остаются TODO.

0.0.104 - 10.14.2026 | 18:15 - Family collaboration 48/48 PASS: explicit pagination, auto-read recovery, ownership/session resilience. Сохранены готовые static commerce и legal/registration acceptance-наборы; их три browser-итерации отложены до возобновления QA.

0.0.105 - 10.15.2026 | 18:59 - Edge action-пакеты commerce/legal/family/AI/moderator/public/client/domain закрыты в согласованном объёме; preserve create больше не передаёт command metadata в persisted schema. Domain residual diagnostic 20/20 PASS; его final I1–I3 и полный Firefox/WebKit sweep 520×3 оставлены точкой продолжения.

0.0.106 - 10.20.2026 | 21:42 - Финализированы auth/route/recovery нюансы: безопасный returnTo для family/preserves, единая post-login навигация, Guard для offline recipes, восстановление location form после unknown-outcome replay, autofocus meal-plan editor и mobile 44px targets. Domain action+completeness прошли 120/120, client Firefox/WebKit I1 — 540/540; unit 139/139, contracts/type/lint/style/build PASS.

0.0.107 - 10.21.2026 | 11:15 - Односессионный cross-browser E2E получил отдельный memory-safe режим Next/webpack: неактивные маршруты освобождаются через секунду, включена штатная оптимизация памяти и отключён compiler cache только для FRONT_E2E_SINGLE_SESSION=1; обычная разработка и production build не меняются.

0.0.108 - 10.21.2026 | 17:41 - Исправлены double-submit и transient draft состояния inventory/preserves/recipes/family chat; CSV/TSV Worker больше не блокируется на XLSX chunk в Firefox/MSW, а dynamic-route проверки ждут завершения RSC navigation.

0.0.109 - 10.22.2026 | 13:47 - Frontend-документация очищена и актуализирована: оставлены краткие README/AGENTS, OCR provenance и единая ссылка на TESTs.md; устаревшие iteration/design QA и legacy mock-документы удалены без изменения runtime.
