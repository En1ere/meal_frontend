# Frontend version-list

0.0.267 - 11.07.2026 | 00:55 - Исправлена переносимость architecture/query-key/transport fixture tests: рабочая станция сохраняет строгую границу `projects/tempFiles`, а clean GitHub Actions runner безопасно использует свой `RUNNER_TEMP`. CI больше не зависит от имени родительской директории checkout; escape-проверка `QA_OUTPUT_DIR` сохранена.

0.0.266 - 11.07.2026 | 00:05 - Первичный AI-запуск и continuation переведены на `202 Accepted` через canonical operation routes и owner-scoped polling. Экраны отдельно показывают очередь, выполнение, подтверждённую ошибку и неизвестный provider outcome; автоматический повтор для `unknown` запрещён, stable idempotency key сохраняется до принятия операции, а данные беседы обновляются только после `succeeded`. Generated OpenAPI обновлён до 0.0.70; добавлены mock/readback и подробный ручной тест-кейс.

0.0.265 - 06.11.2026 | 23:12 - Синхронизирован OpenAPI 0.0.68 и типизирован безопасный `GET /ai/operations/{id}` для будущего bounded polling: lifecycle и financial state разделены, неизвестный provider outcome виден как reconciliation hold, а prompt/context/raw provider data отсутствуют. UI пока не переключён на polling до публикации durable create/worker lifecycle.

0.0.264 - 06.11.2026 | 23:10 - Закрыт frontend AI transport slice: все 13 feature-level вызовов сведены в один domain-owned `entities/ai` adapter, transport debt уменьшен 13→0, capabilities cache стал account-scoped. Run, continuation, archive, package и family-transfer команды сохраняют один idempotency key для неизменного intent при ручном повторе, поэтому ambiguous network outcome не создаёт новую операцию; ключ сбрасывается только после подтверждённого успеха или смены payload.

0.0.263 - 06.11.2026 | 22:45 - Синхронизирован канонический backend OpenAPI 0.0.67 после добавления read-only admin AI control plane. Клиентский operation allowlist и пользовательское поведение не изменились; contract metadata/hash актуализированы.

0.0.262 - 06.11.2026 | 22:20 - Синхронизирован канонический backend OpenAPI 0.0.66 после schema v36 AI context policy. Generated runtime contracts теперь знают источники `preferences` и `nutrition_profile`; пользовательские маршруты и поведение пока не менялись. Подготовлена типобезопасная основа для следующего frontend AI orchestration slice.

0.0.261 - 06.11.2026 | 22:05 - Синхронизирован канонический backend OpenAPI 0.0.65 после schema v35 AI task-entitlement policy. Generated runtime contracts обновлены штатным генератором; маршруты, DTO и пользовательское поведение не менялись, изменился только contract hash/metadata. Подготовлена совместимая база для последующей account-scoped AI catalog миграции.

0.0.260 - 06.11.2026 | 21:06 - Последние три direct recipe transport sites вынесены в отдельные private `mine-api` и `allergens-api`: paged workspace list сохраняет exact filters/signal/data, четыре workspace action используют explicit union с caller-owned persistent UUID/version/body без нового `If-Match`, allergen report сохраняет caller fingerprint/UUID и exact ticket projection. Offline queue/snapshots, unknown-outcome recovery, consent, cache/router/dialog остаются UI-owned. Transport baseline снижен 16→13 sites, 6→4 files, 2→1 contexts; recipe context закрыт.
0.0.259 - 06.11.2026 | 20:55 - Пять recipe editor transport sites вынесены в private typed `editor-api`: product search и два workspace read сохраняют q/limit, scope/id/signals/projections; create/update выбираются explicit action union и принимают исходные caller body, persistent UUID, expectedVersion и AbortSignal без добавления If-Match. Offline queue/snapshots/draft state, validation/fingerprint, unknown outcome/conflict, router и cache fan-out остаются UI-owned. Transport baseline снижен 21→16 sites, 7→6 files; reads 10→7, commands 11→9.

0.0.258 - 06.11.2026 | 20:43 - Три recipe detail read site и bookmark command вынесены в private typed `detail-api`: public/personal/statistics projections сохраняют id, servings, signals и response shapes; bookmark принимает исходный persistent caller body/idempotency key и AbortSignal без генерации или error translation. Initial/stale/enabled state, 401 session reset, abort guards, rating, cache invalidation и recovery остаются UI-owned. Transport baseline снижен 25→21 sites, 8→7 files; reads 13→10, commands 12→11.

0.0.257 - 06.11.2026 | 20:32 - Шесть cooking read transport sites вынесены в private `cooking-read-api`: list/detail сохраняют exact view/id/signals и прежнюю offline snapshot precedence/save lifecycle; stock-options и locations сохраняют full response и намеренное отсутствие scope/localDate query; recipe read сохраняет public-first и только 404 workspace fallback с прежней projection. Cooking commands, persistent UUID, unknown-outcome и cache fan-out не изменены. Transport baseline снижен 31→25 sites, 9→8 files; reads 19→13.

0.0.256 - 06.11.2026 | 20:21 - Пять оставшихся bounded recipe read transport sites распределены по владельцам без god-adapter: catalog/community projections расширяют private recipes read adapter, recipe/author recommendations используют canonical recommendation entity adapter через client entrypoint, reminder preferences — отдельный cooking-reminders adapter. Filters/pagination/signals/discriminant projections, query/cache lifecycle, recommendation actions и paired reminder/community commands остаются прежними. Transport baseline снижен 36→31 sites, 12→9 files; reads 24→19.

0.0.255 - 06.11.2026 | 20:10 - Пять read-only recipe leaf transport sites вынесены в приватный typed adapter: public feed/comments сохраняют normalized filters, conditional cursor/category/author и limits 12/20; prepared stock options — full response без query; family workspace/products — exact scope family, path id, limit100 и recipe/items projections. Infinite pagination, batch filtering, product lookup/edit UI и commands остаются UI-owned. Transport baseline снижен 41→36 sites, 15→12 files; reads 29→24.

0.0.254 - 06.11.2026 | 20:00 - Два read-only recipe reports transport sites вынесены в приватный typed adapter: account-scoped paged history сохраняет exact page/limit, detail — path id, оба сохраняют caller AbortSignal, data projection и native errors. Query lifecycle, pagination UI, retry/loading/empty states и hidden-recipe fallback остаются UI-owned; recipe commands, offline/cooking/editor flows не затронуты. Transport baseline снижен 43→41 sites, 16→15 files; reads 31→29.

0.0.253 - 06.11.2026 | 19:52 - Восемь auth lifecycle transport sites вынесены в приватный typed adapter: register/resend/recovery/email verify/change confirm/cancel/reset check/reset принимают caller-prepared legal evidence, tokens, password и AbortSignal, сохраняя exact projections/native errors и отсутствие idempotency key в текущем контракте. Legal manifest/refetch, stale evidence reset, gcTime/retry, history cleanup и session/WebPush termination остаются UI-owned. Transport baseline снижен 51→43 sites, 17→16 files, 3→2 contexts; commands 20→12.

0.0.252 - 06.11.2026 | 19:37 - Восемь account-security transport sites перенесены в существующий entity typed adapter: settings, password/email, PIN и authenticator setup/confirm/recovery сохраняют caller AbortSignal, exact generated inputs/projections и native errors. Validation/drafts, refresh ordering, enrollment expiry/recovery display, broadcast и session/WebPush termination остаются UI-owned; auth lifecycle не затронут. Transport baseline снижен 59→51 sites, 18→17 files; reads 32→31, commands 27→20.

0.0.251 - 06.11.2026 | 19:36 - Пять user/staff sign-in transport sites вынесены в приватный typed adapter с explicit password/TOTP/PIN и moderator challenge/MFA dispatch, caller AbortSignal, exact projections и native errors. Form drafts, AbortError/ApiError UI mapping, MFA expiry/recovery codes, runtime reset/invalidate/cache/broadcast и safe returnTo/router остаются UI-owned. Transport baseline снижен 64→59 sites, 19→18 files; commands 32→27, computed debt остаётся 1.

0.0.250 - 06.11.2026 | 19:13 - Sessions user/staff list/logout/revoke и dev-only mailbox transport вынесены в два узких приватных adapters с explicit action dispatch, AbortSignal и exact response projections. WebPush cleanup, runtime reset/broadcast, list invalidation, error UI, redirects и production mailbox gate остаются UI/route-owned. Transport baseline снижен 68→64 sites, 21→19 files; computed debt 4→1.

0.0.249 - 06.11.2026 | 19:04 - Два read-only user-home transport site перенесены в приватный typed adapter: home aggregate и recipe recommendation сохраняют AbortSignal, personal→private/family query, limit 3 и recipe-only projection; независимый partial-source loading/error recovery и recommendation actions остаются UI/entity-owned. Credential, session, registration, reset и account-security flows не затронуты. Transport baseline снижен 70→68 sites, 22→21 files.

0.0.248 - 06.11.2026 | 18:51 - Family context/setup, invitations/members/leave и ownership/notice reads и commands перенесены в единый приватный typed adapter: signals, token/path/query params, exact projections и caller-prepared version/idempotency bodies сохранены; roles, persistent ExactAttempt/useRef retry, unknown-outcome readback, session/workspace, cache/notification fan-out и router остаются UI-owned. Transport baseline снижен 89→70 sites, 27→22 files, 4→3 contexts.

0.0.247 - 06.11.2026 | 18:39 - Shopping list/detail/history/recipe, catalog/location/purchase и receipt capability/detail/duplicate reads вместе с тремя preview commands перенесены в единый приватный typed adapter: prepared queries/bodies, signals, params и exact projections сохранены; offline snapshots, visibility, persistent UUID/unknown-outcome, OCR/PDF, drafts, cache/router остаются UI-owned. Transport baseline снижен 104→89 sites, 34→27 files, 5→4 contexts.

0.0.246 - 06.11.2026 | 18:27 - Meal-plan recipe/entitlement/family/plan/portion reads и change/shopping/portion/automation commands перенесены в единый приватный typed adapter: exact selection object, scope/date/query, signals, params, projections и prepared UUID/version bodies сохранены; preview/frozen state, recovery, router/refetch и cache fan-out остаются в UI. Transport baseline снижен 118→104 sites, 36→34 files, 6→5 contexts.

0.0.245 - 06.11.2026 | 18:14 - Inventory product/location/list/batch/history reads и batch/location commands перенесены в единый приватный typed adapter: scope/localDate/search/pagination, signals, response projections, prepared UUID/version bodies и conditional If-Match сохранены; unknown-outcome/conflict recovery, drafts/dialogs, routing и cache fan-out остаются в UI. Transport baseline снижен 131→118 sites, 41→36 files, 7→6 contexts.

0.0.244 - 06.11.2026 | 17:52 - Finance analytics/prices/expenses/overview/detail reads и price/expense/budget commands перенесены в единый приватный typed adapter: date/category omission, signals, params, projections, caller-prepared bodies/version и If-Match сохранены; consent, form validation, UUID, budget branch selection, recovery и cache fan-out остаются в UI. Transport baseline снижен 143→131 sites, 46→41 files, 8→7 contexts.

0.0.243 - 06.11.2026 | 17:42 - Subscription settings read, trial/four preview commands, explicit plan/renewal/downgrade commit dispatch и combination consent перенесены в приватный typed adapter: caller-prepared bodies/keys/versions, exact data projections и native errors сохранены; persistent refs, review/dialog/recovery, combination settings projection и related cache fan-out остаются в UI. Transport baseline снижен 154→143 sites, 47→46 files, 9→8 contexts.

0.0.242 - 06.11.2026 | 17:30 - Preserves list/detail/history/QR, location и recipe-source reads, а также consume preview перенесены в приватный typed adapter: filters/local date/scope/page, signals, params, exact projections, caller-prepared preview body и native errors сохранены; QR/Blob/print, drafts/conflicts/router и persistent command unknown-outcome/fan-out остаются в UI. Transport baseline снижен 165→154 sites, 51→47 files, 10→9 contexts.

0.0.241 - 06.11.2026 | 17:20 - Support list/meta/detail reads и create/reply/close/reopen/edit commands перенесены в приватный typed adapter: filters, signals, params, exact data projections, caller-prepared keys/versioned bodies и native errors сохранены; signature/useRef retry, drafts, state machine, cache fan-out и router остаются в UI. Transport baseline снижен 174→165 sites, 52→51 files, 11→10 contexts.

0.0.240 - 06.11.2026 | 17:10 - Family chat paginated read и read/send/edit/draft/reaction/pin/hide/remove commands перенесены в приватный typed adapter: q/before omission, signals, params, full envelopes, caller-prepared UUID/version bodies и native errors сохранены; persistent read retry key, drafts/sessionStorage, confirmations, recovery и refresh остаются в UI. Transport baseline снижен 183→174 sites, 53→52 files, 12→11 contexts.

0.0.239 - 06.11.2026 | 16:59 - Moderation overview/queue/item/support reads и assignment/decision/reopen/reply commands перенесены в приватный typed adapter: signals, filters/cursor, params, projections, caller-owned version/UUID и native errors сохранены без добавления If-Match; staff-session recovery, stale refetch, roles, drafts, router и fan-out остаются в UI. Transport baseline снижен 191→183 sites, 57→53 files, 13→12 contexts.

0.0.238 - 06.11.2026 | 16:50 - Family notes list/detail/history reads и create/edit/archive/checklist commands перенесены в приватный typed adapter: signals, params, exact projections, full envelopes, caller-prepared UUID/version bodies и native errors сохранены; drafts/checklist preparation, recovery, cache refresh и router transitions остаются в UI. Transport baseline снижен 199→191 sites, 60→57 files, 14→13 contexts.

0.0.237 - 06.11.2026 | 16:34 - Account lifecycle reads и archive/deletion/cancel/finalize commands перенесены в приватный typed adapter: signals, export limit, projections/native errors, caller-owned reauth tokens, persistent idempotency keys и optimistic version сохранены; freshness timers/gates, recovery/cache/session orchestration остаются в UI. Transport baseline снижен 205→199 sites, 61→60 files, 15→14 contexts.

0.0.236 - 06.11.2026 | 16:20 - Diary day/source reads и create/archive/update/portion commands перенесены в приватный typed adapter: signals, exact queries, full command envelopes, fresh UUID и expectedVersion/If-Match сохранены; consent/date/decisions/drafts/dialogs и exact diary/Pro/inventory fanout остаются в UI. Transport baseline снижен 211→205 sites, 62→61 files, 16→15 contexts.

0.0.235 - 06.11.2026 | 16:06 - Products reference/detail/inventory/location reads и proposal command перенесены в приватный typed adapter: signals, params, exact queries/projections и caller-owned prepared command identity сохранены; fingerprint, persistent key/body, AbortSignal guards, unknown-outcome и cache/router effects остаются в UI. Transport baseline снижен 216→211 sites, 64→62 files, 17→16 contexts.

0.0.234 - 06.11.2026 | 15:57 - Notification center/preferences reads и commands перенесены в приватный typed adapter: exact category/unread pagination, signals, path params, expectedVersion, fresh UUID, `.data` и native errors сохранены; URL filters, on-settled refresh, BroadcastChannel, drafts/recovery и Web Push browser lifecycle остаются в UI. Transport baseline снижен 221→216 sites, 65→64 files, 18→17 contexts.

0.0.233 - 06.11.2026 | 15:46 - Exports history/download/preview/create перенесены в приватный typed adapter: AbortSignal, cursor omission, path params, exact bodies/data projections и native error identity сохранены; polling, critical reauth, persistent unknown-outcome idempotency ref и Blob URL/download lifecycle остаются в UI. Transport baseline снижен 225→221 sites, 66→65 files, 19→18 contexts.

0.0.232 - 06.11.2026 | 15:34 - Nutrition settings/analytics reads и profile/target commands перенесены в приватный typed adapter: consent gating остаётся до query effects, AbortSignal/date query, `.data` reads, full command envelopes, native errors, conditional If-Match и fresh UUID сохранены; drafts/read-only и exact three-cache fanout не изменены. Transport baseline снижен 229→225 sites, 67→66 files, 20→19 contexts.

0.0.231 - 06.11.2026 | 15:24 - AI appeals list/detail reads, appeal create и support reply перенесены в приватный typed adapter: AbortSignal/path params, exact bodies, fresh UUID per explicit call, expectedVersion, `.data` и error identity сохранены; draft очищается только после success, router/cache side effects не изменены. Transport baseline снижен 233→229 sites, 68→67 files, 21→20 contexts.

0.0.230 - 06.11.2026 | 15:05 - Inventory ingest review catalog/location reads и commit перенесены в приватный typed adapter: exact barcode/q и scope queries, AbortSignal/data projections, error identity и один pending command с тем же UUID/object на unknown-outcome retry сохранены; FormData import/scan uploads не изменены. Transport baseline снижен 236→233 sites, 69→68 files, 22→21 contexts.

0.0.229 - 06.11.2026 | 14:55 - Recommendation event и author follow команды перенесены из React entity client в существующий приватный typed adapter: exact payload/params, fresh UUID per call, void/data projections, error identity, impression rollback, cache write и following invalidation сохранены. Transport baseline снижен 238→236 sites, 70→69 files, 23→22 contexts; entity direct transport закрыт до нуля.

0.0.228 - 06.11.2026 | 14:43 - Critical re-auth GET/POST перенесены из React entity component в приватный `entities/account-security` typed adapter: AbortSignal, exact factor/body, `.data`, error identity, RISK_HELD и dialog reset/success lifecycle сохранены. Transport baseline снижен 240→238 sites, 71→70 files, 24→23 contexts.

0.0.227 - 06.11.2026 | 14:32 - Единственный direct transport site profiles перенесён в canonical `entities/profile` typed adapter: PUT body/data/error semantics и fresh UUID сохранены, mutation UI/theme/session/cache recovery не изменены. Transport baseline снижен 241→240 sites, 72→71 files, 25→24 contexts.

0.0.226 - 06.11.2026 | 14:25 - Добавлен fail-closed TypeScript AST ratchet прямых production transport requests: exact baseline 241 sites / 72 files / 25 contexts, 123 reads / 118 commands, 233 literal / 8 computed routes. Growth и stale snapshot блокируются без изменения runtime consumers, API или bundle source.

0.0.225 - 06.11.2026 | 14:10 - Разорван единственный runtime-цикл shopping purchase review/resolution через приватный `purchase-lines.tsx` с сохранением compatibility exports. Architecture AST gate теперь fail-closed проверяет нулевой baseline runtime SCC, игнорируя type-only/assets и разрешая aliases; query baseline и UI/API не изменены.

0.0.224 - 06.11.2026 | 13:51 - Design route audit использует testable canonical discovery для 119 routes: route groups/parallel slots исключены из URL, dynamic placeholders материализуются fail-closed, а stale progress фильтруется по текущему pattern set. Исправлены 33 ложных group-path проверки без изменения приложения.

0.0.223 - 06.11.2026 | 13:44 - Route-matrix синхронизирован с intentional public legal catalog routes `/legal` и `/legal/[slug]`: inventory 119/111, явные assertions и безопасная materialization `personal-data-consent`. Application routes, access policy и runtime behavior не изменены.

0.0.222 - 06.11.2026 | 13:35 - `entities/consent` получил canonical account-scoped legal settings query key; privacy и consent gates используют один owner с прежним shared cache, refetch и setQueryData lifecycle. Raw baseline остаётся 0/0/0, legacy factory debt закрыт 2→0 без изменения legal content, transports или DTO.

0.0.221 - 06.11.2026 | 13:25 - Canonical entity roots для shopping/receipts/purchases, cooking/workspace и offline draft state заменили три computed invalidation loops явными ordered calls. Success/active/401 guards, Promise.all membership/order, default options и command recovery не изменены; raw query-key baseline закрыт 8/3/3→0/0/0, два legacy legal factory sites остаются отдельно.

0.0.220 - 06.11.2026 | 13:13 - Пять broad cooking invalidations и completion fan-out на personal/community roots используют exact private recipe owners. Promise.all order, success-only timing, inventory/preserve roots, commands/lifecycle и UI не изменены; recipe raw context закрыт 14→0, общий baseline 22/4/4→8/3/3.

0.0.219 - 06.11.2026 | 13:07 - Cooking list, attempt detail и recipe fallback reads получили distinct exact private owners. Owner/view/attempt/recipe tuples, 60s polling, offline snapshots, public→workspace fallback и UI не изменены; broad/cross-domain invalidations оставлены отдельным cluster. Recipe debt снижен 17→14, общий baseline 25→22 sites при неизменных 4 files/4 contexts.

0.0.218 - 06.11.2026 | 13:00 - Recipe detail public, personal-scaled и statistics reads, personal-detail refresh и personal-root logout removal получили distinct exact private owners. Owner/id/servings, response projections, bookmark idempotency, session invalidation и UI не изменены; recipe debt снижен 24→17, общий baseline 32→25 sites и 5→4 files при неизменных 4 contexts.

0.0.217 - 06.11.2026 | 12:52 - Recipe mine filtered workspace list и обе broad workspace invalidations получили exact private owners. Owner/scope/q/status/page values, pagination, offline snapshots, recovery/refetchType, command idempotency и UI не изменены; recipe debt снижен 29→24, общий baseline 37→32 sites и 6→5 files при неизменных 4 contexts.

0.0.216 - 06.11.2026 | 12:45 - Recipe editor workspace detail, offline-new draft, offline recovery state и broad workspace refresh получили distinct exact private owners. Scope/id/owner/draft tuples, offline recovery, retry polling, idempotency, transports и UI не изменены; recipe debt снижен 34→29, общий baseline 42→37 sites и 7→6 files при неизменных 4 contexts.

0.0.215 - 06.11.2026 | 12:37 - Recipe community scoped read, broad community refresh и public-detail refresh получили distinct exact private owners. GET payload, enabled gate, comment/rating/report commands, success-only refresh breadth и UI не изменены; recipe debt снижен 39→34, общий baseline 47→42 sites и 8→7 files при неизменных 4 contexts.

0.0.214 - 06.11.2026 | 12:28 - Cooking reminder preferences и broad cooking refresh получили exact private owners. Scoped GET, timezone fallback/omission, POST body, success-only invalidation, switch accessibility и reminder UI не изменены; recipe debt снижен 42→39, общий baseline 50→47 sites и 9→8 files при неизменных 4 contexts.

0.0.213 - 06.11.2026 | 12:21 - Public recipe feed и public comments infinite reads получили distinct private exact owners. Author/q/category/sort и recipeId tuples, null pageParam, cursor omission, limits, next-page recovery, dedupe и UI не изменены; recipe debt снижен 44→42, общий baseline 52→50 sites и 10→9 files при неизменных 4 contexts.

0.0.212 - 06.11.2026 | 12:01 - Recipe catalog, family detail и prepared stock-options leaf reads получили distinct private exact owners. Catalog state-object identity, family `.data.recipe`, stock-options payload, user/id tuples, batch view-only filtering, transports/enabled/UI не изменены; recipe debt снижен 47→44, общий baseline 55→52 sites и 13→10 files при неизменных 4 contexts.

0.0.211 - 06.11.2026 | 11:54 - Recipe report list/detail read projections получили private exact owners. Account/page и account/id tuples, numeric-to-wire page conversion, limit, GET params, loading/error recovery и reporter-only UI не изменены; recipe raw debt снижен 49→47, общий baseline 57→55 sites и 14→13 files при неизменных 4 contexts.

0.0.210 - 06.11.2026 | 11:47 - Оставшиеся static shopping catalog search/detail и purchase detail projections получили private exact owners. User/scope/discriminator/null ingredient tuples, GET filters, approved-product visibility и scoped purchase payload не изменены; computed command loops остаются явным raw debt. Query-key baseline снижен 60→57 sites и 16→14 files при неизменных 4 contexts.

0.0.209 - 06.11.2026 | 11:37 - Shopping page получил private exact owners для filtered lists, scoped detail, distinct online history и recipe preview. Filter-object identity, owner/scope/id/recipe/servings tuple order, offline snapshots, GET payloads и commands не изменены; query-key debt снижен 64→60 sites и 17→16 files при неизменных 4 contexts.

0.0.208 - 06.11.2026 | 11:29 - Shopping receipt read projections получили private exact query-key owner: singleton capabilities, scoped receipt detail и отдельный duplicates payload. GET routes, scope/user/id isolation, draft gating, commands, idempotency, dynamic multi-domain invalidation loops и UI не изменены; query-key debt снижен 67→64 sites и 19→17 files при неизменных 4 contexts.

0.0.207 - 11.06.2026 | 11:18 - AI overview получил private singleton capabilities key и использует exact account history refresh owner. GET capabilities/balance, POST preview/run bodies, fresh UUID, provider recovery, result/draft reset, cache invalidations, route transition и UI не изменены; AI raw context закрыт, query-key debt снижен 70→67 sites, 20→19 files и 5→4 contexts.

0.0.206 - 11.06.2026 | 11:12 - AI history получил private exact filtered infinite-query owner и использует distinct account history/exact conversation invalidation owners. Archived filter, cursor omission, limit/pagination payload, PUT archive/restore expectedVersion/fresh UUID, recovery UI и routes не изменены; query-key debt снижен 75→70 sites и 21→20 files при неизменных 5 contexts.

0.0.205 - 11.06.2026 | 11:06 - AI conversation получил private exact detail key и отдельный account-scoped history refresh prefix. GET task, POST message body/fresh UUID/familyReserveAccepted, exact setQueryData response, balance invalidation, draft reset, consent recovery, UI и routes не изменены; query-key debt снижен 78→75 sites и 22→21 files при неизменных 5 contexts.

0.0.204 - 11.06.2026 | 10:59 - AI family-sharing получил private exact account-scoped query-key owner, отдельный от canonical AI balance payload. GET sharing, transfer/decision commands, expectedVersion/decision/fresh UUID, scoped refresh, balance invalidation, UI и routes не изменены; query-key debt снижен 81→78 sites и 23→22 files при неизменных 5 contexts.

0.0.203 - 11.06.2026 | 10:52 - Finance detail получил private singular query-key ownership и distinct detail/list/overview refresh roots. GET/PUT route, expectedVersion/If-Match, fresh UUID, response shape, Promise.all fan-out, read-only UI и routes не изменены; finance raw context закрыт, query-key debt снижен 88→81 sites, 24→23 files и 6→5 contexts.

0.0.202 - 11.06.2026 | 10:45 - Finance overview получил private exact query-key ownership для range overview, account budgets и их раздельных broad refresh prefixes. GET params/.data, enabled, POST/PUT selection, expectedVersion/If-Match, category:null, fresh UUID, UI и routes не изменены; query-key debt снижен 94→88 sites и 25→24 files при неизменных 6 contexts.

0.0.201 - 11.06.2026 | 10:38 - Finance expenses list получил private exact query-key ownership для account/range/category projection и раздельных broad expenses/overview refresh prefixes. GET category omission, response shape, POST consent/body/fresh UUID, Pro overview fan-out, UI и routes не изменены; query-key debt снижен 99→94 sites и 26→25 files при неизменных 6 contexts.

0.0.200 - 11.06.2026 | 10:30 - Finance prices получили private exact query-key ownership для account-scoped history, отдельного catalog payload и broad refresh prefix. GET/POST routes, response shapes, fresh idempotency UUID, consent/body, invalidation breadth, UI и routes не изменены; query-key debt снижен 103→99 sites и 27→26 files при неизменных 6 contexts.

0.0.199 - 11.06.2026 | 00:39 - Finance analytics query-key ownership начат с private exact projection `['finance-analytics', userId, from, to, category]`. Range/category tuple, empty-category isolation, GET query omission, enabled/retry, response payload, UI и routes не изменены; query-key debt снижен 104→103 sites и 28→27 files при неизменных 6 contexts.

0.0.198 - 11.06.2026 | 00:31 - Remaining meal-plan query-key ownership завершён: `familyKeys.planContext` сохраняет отдельный legacy-compatible `['family-context', userId]` lifecycle, а `mealPlanKeys.portions` — exact scope/user tuple полного portion workspace. Family/portions GET payloads, enabled/refetch, assign/decision commands, UUID/version, UI и routes не изменены; query-key debt снижен 106→104 sites, 29→28 files и 7→6 contexts.

0.0.197 - 11.06.2026 | 00:20 - Preserve query-key ownership вынесен в canonical `entities/preserve`: broad root и exact list/detail/history/QR-label projections сохраняют прежние tuples, filter identity и cached payload shapes; recipe cooking invalidation и 401 cleanup используют тот же root. Dynamic five-domain invalidation loop остаётся двумя видимыми raw computed sites; transports, scope/page, command UUID/version, UI и routes не изменены. Query-key debt снижен 114→106 sites, 32→29 files при неизменных 7 contexts.

0.0.196 - 11.06.2026 | 00:11 - Subscription settings query-key ownership вынесен в private `features/subscription/query-keys.ts`: GET overview и точная cache write после команд используют прежний exact account tuple и один `Overview` shape. Trial/plan/renewal/downgrade/combination transports, preview/commit UUID/expectedVersion, related invalidations, UI и routes не изменены; query-key debt снижен 115→114 sites, 33→32 files и 8→7 contexts.

0.0.195 - 11.06.2026 | 00:01 - Product query-key ownership вынесен в canonical `entities/product`: пять exact ingest/editor/family-catalog/detail/reference projections сохраняют прежние tuple и разные cached response shapes. Product transports, barcode/q selection, recipe/product commands, idempotency, UI и routes не изменены; query-key debt снижен 120→115 sites, 36→33 files и 10→8 contexts.

0.0.194 - 11.05.2026 | 18:48 - Meal-plan query-key ownership вынесен в canonical `entities/meal-plan`: broad/account prefixes, exact selection tuple и раздельные page/automation recipe projections сохраняют прежние cache shapes и invalidation semantics. Selection identity/value, transports, preview/commit UUID/expectedVersion, shopping/automation commands, UI и routes не изменены; query-key debt снижен 129→120 sites, 37→36 files при неизменных 10 contexts.

0.0.193 - 11.05.2026 | 18:40 - Entitlement query-key ownership вынесен в canonical `entities/entitlement`: meal-plan capability gates и personal/family receipt creation используют единый exact account-scoped tuple. GET `/entitlements`, AbortSignal/data/enabled semantics, receipt capabilities, planning/shopping commands, UI и routes не изменены; query-key debt снижен 131→129 sites при неизменных 37 files / 10 contexts.

0.0.192 - 11.05.2026 | 18:31 - AI balance query-key ownership вынесен в canonical `entities/ai-balance`: overview, balance, conversation и subscription используют единый exact account-scoped tuple для query, purchase cache write и invalidation. GET balance, purchase payload, UUID/expectedVersion, family/meal-plan invalidations, UI и routes не изменены; query-key debt снижен 142→131 sites при неизменных 37 files / 10 contexts.

0.0.191 - 11.05.2026 | 18:18 - Export query-key ownership вынесен из private feature в canonical `entities/export`: broad root, account history и lifecycle projection доступны через public model entrypoint. Exports history/invalidation и account-lifecycle export gate мигрированы без изменения preview/reauth/create, polling, download, idempotency, deletion gates, UI или routes; zero-consumer private owner удалён. Query-key debt снижен 143→142 sites, 38→37 files, 11→10 contexts.

0.0.190 - 11.05.2026 | 18:11 - Account lifecycle и deletion-preview queries/scoped refresh переведены на private `features/account-lifecycle` key owner с exact user tuple. Cross-context raw exports projection намеренно оставлена до отдельной миграции; archive/request/cancel/finalize transports, reauth/export gates, expectedVersion/UUID/idempotency/readback, drafts, errors, UI и routes не изменены. Query-key debt снижен 147→143 sites; 38 files / 11 contexts без изменений.

0.0.189 - 11.05.2026 | 18:01 - Moderation overview/queue/item/support queries и broad/scoped invalidations переведены на private `features/moderation` key owner с exact queue/filter/id positions. Staff-session 401 recovery, pagination, assignment/decision/reopen/reply transports, expectedVersion/If-Match/UUID, errors, UI и routes не изменены. Query-key debt снижен 161→147 sites, 42→38 files, 12→11 contexts.

0.0.188 - 11.05.2026 | 17:51 - Nutrition settings/analytics queries и broad refresh переведены на private `features/nutrition` key owner с exact user/from/to tuple positions. Health-consent gating, GET/PUT/POST transports, expectedVersion/If-Match/UUID, Pro overview invalidation, drafts, errors, read-only UI и routes не изменены. Query-key debt снижен 167→161 sites, 43→42 files, 13→12 contexts.

0.0.187 - 11.05.2026 | 17:44 - Family Notes list/detail/history queries и account-scoped list refresh переведены на private `features/family-notes` key owner с exact user/tab/query/id tuple positions. Create/edit/archive/checklist transports, expectedVersion, UUID, drafts, errors, readback, UI и routes не изменены. Query-key debt снижен 173→167 sites, 46→43 files, 14→13 contexts.

0.0.186 - 11.05.2026 | 17:32 - Diary day/source queries и broad diary refresh переведены на private `features/diary` key owner с exact `['diary', userId, date]` и `['diary-sources', sourceType, search]` tuples. CRUD/archive/portion decision transports, expectedVersion/If-Match/UUID, inventory/Pro invalidations, consent gates, dialogs, drafts, UI и routes не изменены. Query-key debt снижен 177→173 sites, 47→46 files, 15→14 contexts.

0.0.185 - 11.05.2026 | 17:25 - Family Chat infinite query и broad post-command refresh переведены на private `features/family-chat` key owner с exact `['family-chat', userId, q]` tuple. GET q/before pagination, signals, read receipts, drafts, send/edit/reply/reaction/pin/hide/remove transports, expectedVersion, UUID, errors, UI и routes не изменены. Query-key debt снижен 180→177 sites, 48→47 files, 16→15 contexts.

0.0.184 - 11.05.2026 | 17:16 - Support list/meta/detail queries, detail cache write reuse и account-prefix invalidation переведены на private `features/support` key owner с exact user/category/status/id tuple positions. Все 9 transport call sites, create signature/idempotency reuse, expectedVersion reply/close/reopen/edit state machine, drafts, errors, UI и routes не изменены. Query-key debt снижен 186→180 sites, 49→48 files, 17→16 contexts.

0.0.183 - 11.05.2026 | 17:07 - AI appeals list/detail queries и invalidations переведены на private `features/ai-appeals` key owner с exact list `['ai-appeals', userId]` и detail `['ai-appeal', userId, id]` tuples. List/create/detail/support-reply transports, draft, expectedVersion, UUID/idempotency, success/error UI и routes не изменены. Query-key debt снижен 190→186 sites, 50→49 files, 18→17 contexts.

0.0.182 - 11.05.2026 | 16:56 - Exports history query и post-create invalidation переведены на private `features/exports` key owner с exact `['exports', userId]` tuple и broad prefix. Preview→critical reauth→create, polling, Blob download, idempotency ref lifecycle, transports, signals, UI и routes не изменены. Query-key debt снижен 193→190 sites, 51→50 files, 19→18 contexts.

0.0.181 - 11.05.2026 | 16:39 - Home и recipes catalog recipe/author recommendation projections переведены на canonical `entities/recommendation` key factories. Exact account/scope/limit tuples сохранены, включая home cache scope `personal|family`, recipes `private/12` и author/3; GET query conversion, enabled, impression/dedupe/follow/mutations, UI и routes не изменены. Query-key debt снижен 196→193 sites, 52→51 files, 20→19 contexts.

0.0.180 - 11.05.2026 | 16:31 - Агрегированная account-scoped home projection переведена на private `features/auth/home/query-keys` owner. Exact tuple, GET `/home`, AbortSignal/data, enabled/loading/error UI и независимая partial recommendation recovery сохранены; recommendation tuple, request и personal→private scope conversion оставлены raw без изменений. Query-key debt снижен 197→196 sites; files 52 и contexts 20 неизменны.

0.0.179 - 11.05.2026 | 16:24 - Registration public legal manifest и password reset-link check получили private `features/auth/lifecycle/query-keys` owner. Exact tuples, manifest/reset-check transports, enabled, `retry:false`, reset `gcTime:0`, token handling, fail-closed legal evidence, UI, errors и routes сохранены; legacy legal settings и home/recommendations не затронуты. Query-key debt снижен 199→197 sites, 53→52 files; contexts 20 неизменны.

0.0.178 - 11.05.2026 | 16:13 - User/staff session list query и revoke-others invalidation переведены на отдельный canonical `sessionListQueryKey`, сохранив exact plural tuple и moderator→staff mapping. Singular current-session owner, enabled, GET/POST routes, AbortSignal/invalidation timing, logout, errors, UI и routes не изменены. Query-key debt снижен 202→199 sites, 54→53 files; contexts 20 неизменны.

0.0.177 - 11.05.2026 | 16:04 - Account settings security query/invalidation и open-gated critical re-auth query переведены на два намеренно раздельных exact `entities/account-security` key owners. GET/POST transports, signals, enabled/refetch lifecycle, email/PIN/authenticator commands, re-auth purpose/factor, errors, UI и routes сохранены. Query-key debt снижен 206→202 sites, 56→54 files, 21→20 contexts.

0.0.176 - 11.05.2026 | 15:48 - Notification list/account prefix, preferences, WebPush config и family ownership-notice broad invalidation переведены на canonical `entities/notification` owner. Exact tuples, broad/account semantics, cache writes, transports, UUID, broadcasts, draft reset, permission/connect/disconnect flows, UI и routes сохранены. Query-key debt снижен 216→206 sites, 58→56 files, 23→21 contexts.

0.0.175 - 11.05.2026 | 15:35 - Invitations, invitation preview, leave preview, ownership overview/request и ownership notice получили private `features/family/query-keys` owner. Exact user/version/token tuples, root-vs-full remove/set/invalidate semantics, transports, UUID/expectedVersion, uncertain readback, drafts, UI и routes сохранены; cross-domain raw `['notifications']` invalidation не изменён. Query-key debt снижен 228→216 sites, 61→58 files; contexts 23 неизменны.

0.0.174 - 11.05.2026 | 15:22 - Legacy preserves/cooking location cache projections получили явные `inventoryKeys.preserveLocations` и `cookingLocations` owners без convergence: exact tuple order, explicit/omitted scope, full `.data` response shape, transports, invalidation root, UI и routes сохранены. Canonical items-array projection не изменён; query-key debt снижен 232→228 sites, 62→61 files, contexts 23 неизменны.

0.0.173 - 11.05.2026 | 15:10 - Exact inventory list/batch/location/cooking-review projections переведены на canonical `inventoryKeys` factories без изменения filters object, tuple values, query functions, transports, enabled/signals, broad invalidations, UI или routes. Reversed preserves locations `[userId, scope]` и short cooking locations `[userId]` намеренно оставлены raw. Query-key debt снижен 236→232 sites, 65→62 files, 24→23 contexts.

0.0.172 - 11.05.2026 | 14:53 - Exact inventory attention/history/product-search queries и broad invalidations переведены на canonical `inventoryKeys` factories/roots без изменения filters, query omission, transports, bodies, UUID/version, UI или routes. Dynamic preserves/shopping history loops и остальные inventory tuples не затронуты. Query-key debt снижен 247→236 sites, 67→65 files; contexts 24 неизменны.

0.0.171 - 11.05.2026 | 14:42 - Четыре factory-compatible inventory locations query переведены на `inventoryKeys.locations(scope, userId)`, а location command invalidation — на `locationsRoot`. Reversed preserves/cooking tuples, scoped inventory keys, transports, POST/idempotency, UI и routes не изменены. Query-key debt снижен 253→247 sites; files 67 и contexts 24 неизменны.

0.0.170 - 11.05.2026 | 14:29 - Staff MFA cache write и moderator item/queue 401 recovery переведены на canonical `sessionQueryKey('moderator')` без изменения login response, clear/broadcast order, 401 conditions, moderator mutations, retry/error UI, routes, transports, user-session или sessions-list keys. Query-key debt снижен 258→253 sites, 68→67 files; contexts 24 неизменны.

0.0.169 - 11.05.2026 | 14:13 - Пять broad inventory invalidations в diary, inventory create/detail и cooking переведены на existing `inventoryKeys.root` без изменения scoped inventory/location/history/attention/products keys, transports, mutations, UUID/expectedVersion, UI или routes. Query-key debt снижен 268→258 sites; files 68 и contexts 24 неизменны.

0.0.168 - 11.05.2026 | 14:02 - Pro overview получил canonical entity owner: exact root/account tuple и typed GET adapter сохраняют signal/data/error semantics, а diary, finance и nutrition используют общий broad invalidation prefix без изменения mutations, bodies, UUID/expectedVersion, drafts, UI, routes или exports. Query-key debt снижен 275→268 sites, 69→68 files, 25→24 contexts.

0.0.167 - 11.05.2026 | 13:52 - Remaining profile/follow read-cache cluster завершён: account-security и recommendation self-check используют canonical own-profile owner, а exact author-follow tuple и typed GET adapter принадлежат recommendation. Direct PUT follow, fresh UUID, setQueryData/invalidation, UI/routes/exports/wire contracts не изменены. Query-key debt снижен 278→275 sites, 70→69 files, 26→25 contexts.

0.0.166 - 11.05.2026 | 13:40 - Profile pages read/cache ownership переведён на existing profile entity: exact own/public keys, два typed GET adapters и own cache write сохраняют AbortSignal/data semantics без изменения feature-owned PUT, expectedVersion/fresh UUID, draft/error recovery, session/theme side effects, UI, routes или exports. Query-key debt снижен 281→278 sites, 71→70 files, 27→26 contexts.

0.0.165 - 11.05.2026 | 13:30 - Achievements/public-progress переведён на canonical profile read owners: exact own/public achievements/public reputation tuples и typed GET adapters сохраняют AbortSignal, path params и data projections без изменения UI, routes, feature exports или wire contracts. Миграция profile entity остаётся поэтапной; query-key debt снижен 285→281 sites, 72→71 files, 28→27 contexts.

0.0.164 - 11.05.2026 | 13:16 - Community following получил canonical recommendation owners: broad invalidation root и account-scoped list tuple теперь едины для follow-команды и пагинированного списка, typed GET adapter сохраняет limit/cursor/AbortSignal без изменения mutation/idempotency, public APIs, UI, routes или wire contracts. Query-key debt снижен 288→285 sites, 73→72 files, 29→28 contexts.

0.0.163 - 11.05.2026 | 13:02 - Finance-cost entity получил canonical query-key и typed API owners: exact route/resource/user tuple и явный dispatch трёх GET cost operations сохраняют AbortSignal, path params, retry:false и публичный badge API без изменения UI, routes или wire contracts. Query-key debt снижен 289→288 sites, 74→73 files, 30→29 contexts.

0.0.162 - 11.05.2026 | 12:54 - Search получил приватные query-key и typed API owners: exact account/type/query/limit tuple, cursor omission/presence, AbortSignal и четыре параллельных result-типа сохранены без изменения public API, UI, URL, routes или wire contracts. Query-key debt снижен 290→289 sites, 75→74 files, 31→30 contexts.

0.0.161 - 11.05.2026 | 12:40 - News получил приватные query-key и typed API owners: guest/account-isolated list/detail tuples, pagination signals/params и mark-read fresh idempotency per invocation сохранены без изменения public API, UI, routes или wire contracts. Query-key debt снижен 294→290 sites, 76→75 files, 32→31 contexts.

0.0.160 - 11.05.2026 | 12:24 - Personalization получил приватные query-key и typed API owners: два UI-сценария сохраняют exact cache tuple, GET AbortSignal, PUT bodies/expectedVersion и fresh idempotency per invocation без изменения public API, UI, routes или wire contracts. Query-key debt снижен 298→294 sites, 78→76 files, 33→32 contexts.

0.0.159 - 11.05.2026 | 12:21 - Добавлен отдельный TypeScript AST ratchet production query keys: inspectable baseline 298 raw sites / 78 files / 33 contexts, canonical entity/same-feature owners, exact legacy legal factory debt, fail-closed helper policy и безопасные regression fixtures. Runtime, routes, API contracts и bundle source не изменены.

0.0.158 - 11.05.2026 | 11:49 - Architecture gate переведён с regex module-edge discovery на TypeScript AST и штатное module resolution. Проверяются static/type/side-effect imports, re-exports, dynamic import, import-equals, literal require, aliases и CSS assets; nonliteral dynamic imports fail closed, `.next`/`dist` исключены source-root обходом. Добавлены 18 regression fixtures с автоматическим безопасным размещением в `projects/tempFiles`, без изменения runtime, routes, contracts или bundle.

0.0.157 - 11.03.2026 | 14:21 - OpenAPI snapshot и generated client синхронизированы с backend 0.0.65 / 288 operations. Reliability assertions приведены к текущим контрактам legal placeholder, независимых push/email capability и ранней theme initialization; focused Edge desktop/mobile 6/6 и полный unit/check 181/181 PASS. Runtime/UI/API-поведение не изменено.

0.0.155 - 11.02.2026 | 16:39 - OCR preview синхронизирован со строгим OpenAPI-контрактом `requiresReview: true`. Inventory явно помечает OCR как черновик и сохраняет построчную ручную проверку; чек блокирует финальное сохранение до явного подтверждения пользователя. Лимит изображений снижен с 20 до 12 Мп в валидаторе, mock OCR и UI-подсказках.

0.0.153 - 02.11.2026 | 09:09 - Fixed the registration blocker: submit no longer depends on mock API mode, legal-manifest failures expose an explicit retry, draft documents remain reviewable, and consent labels provide full keyboard/pointer targets. Added an explicit approved/demonstration evidence build policy (approved by default) and regression coverage. Account/offline settings retain the shared PersonalShell, including explicit offline access, without duplicate brand/theme controls. Confirmed contrast, warning surfaces and typography now use semantic design tokens. Recipe empty states now lead directly to inventory, preferences and the implemented family collection; unavailable QR labels link to pricing instead of a dead button, and the unsupported locale is presented as readonly information. API payloads and paths are unchanged.

0.0.152 - 29.10.2026 | 18:22 - Release metadata synchronized with backend runtime 0.0.152 and admin 0.0.128 after the backend APP_VERSION drift fix; OpenAPI 0.0.61, schema v31, wire contracts and frontend behavior are unchanged.

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

0.0.154 - 11.02.2026 | 14:24 - OpenAPI/HTTP snapshots и generated client синхронизированы с backend 0.0.160, OpenAPI 0.0.63 и schema v33: 285 public/user/moderator операций. Generator получил строгую поддержку `format: binary` через `Blob` и регрессию, multipart upload остаётся transport-specific, а пользовательская media-функция не включена до capacity/OOM drill.
