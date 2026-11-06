# Meal frontend version-list

0.0.48 (root unchanged) - 11.07.2026 | 00:05 - Frontend package 0.0.266 синхронизирован с OpenAPI 0.0.70; первичный запуск и продолжение беседы переведены с synchronous legacy-маршрутов на canonical `202` + owner polling. UI различает queued/running/failed/unknown, не повторяет неизвестный provider outcome, сохраняет stable idempotency key до принятия операции и обновляет беседу только после `succeeded`. Mock-контур, generated contract и ручные тест-кейсы обновлены; root и design-system не менялись.

0.0.48 (root unchanged) - 06.11.2026 | 23:12 - Frontend package 0.0.265 синхронизирован с backend OpenAPI 0.0.68 и получил generated contract canonical AI operation readback. Root и design-system не менялись.

0.0.48 (root unchanged) - 06.11.2026 | 23:10 - Frontend package 0.0.264 вынес все AI transport-вызовы в domain entity adapter, обнулил feature transport debt, account-scoped capabilities и стабилизировал idempotency keys для повторов неизменных команд. Root и design-system не менялись.

0.0.48 (root unchanged) - 06.11.2026 | 22:45 - Frontend package 0.0.263 синхронизирован с backend OpenAPI 0.0.67; новый admin-only AI control endpoint не включён в клиентский runtime allowlist. Root и design-system не менялись.

0.0.48 (root unchanged) - 06.11.2026 | 22:20 - Frontend package 0.0.262 синхронизирован с backend OpenAPI 0.0.66/schema v36: generated AI context manifest поддерживает preferences и nutrition profile. Root и design-system не менялись.

0.0.48 (root unchanged) - 06.11.2026 | 21:06 - Frontend package 0.0.260: финальные mine/allergens direct recipe transports перенесены в два private typed adapter с exact filters/action dispatch/caller command identity; offline/unknown-outcome/cache orchestration не затронута. Transport ratchet обновлён до 13 sites / 4 files / 1 AI context, computed 0. Root, design-system и contracts не изменены.
0.0.48 (root unchanged) - 06.11.2026 | 20:55 - Frontend package 0.0.259: три recipe editor read site и POST/PUT workspace transport перенесены в private typed adapter с exact q/scope/signals/projections и caller-owned persistent UUID/body/version; offline queue/snapshots, drafts, conflicts, router/cache orchestration не затронуты. Transport ratchet обновлён до 16 sites / 6 files / 2 contexts, computed 1. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 20:43 - Frontend package 0.0.258: три recipe detail read transport и bookmark command перенесены в private typed adapter с сохранением servings/signals/projections, caller-owned persistent idempotency body, 401 session reset, cache/rating/error UI orchestration. Transport ratchet обновлён до 21 sites / 7 files / 2 contexts, computed 1. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 20:32 - Frontend package 0.0.257: шесть cooking list/detail/stock/location/recipe read sites перенесены в private typed adapter с сохранением signals/query omissions, offline snapshots и 404-only workspace fallback; lifecycle commands, UUID/retry/fan-out не затронуты. Transport ratchet обновлён до 25 sites / 8 files / 2 contexts, computed 1. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 20:21 - Frontend package 0.0.256: пять bounded recipe read sites распределены между private recipes read/cooking-reminders adapters и canonical recommendation entity adapter с сохранением filters/pagination/signals/projections, query/cache lifecycle и UI-owned commands. Transport ratchet обновлён до 31 sites / 9 files / 2 contexts, computed 1. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 20:10 - Frontend package 0.0.255: пять read-only public-community/prepared/family-detail recipe transport sites перенесены в приватный typed adapter с exact filters/cursors/limits/scope/path/signals/projections; infinite pagination, batch/product/edit UI и commands не затронуты. Transport ratchet обновлён до 36 sites / 12 files / 2 contexts, computed 1. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 20:00 - Frontend package 0.0.254: два read-only recipe reports transport sites перенесены в приватный typed adapter с exact page/limit/path/signal/data/error semantics; query/pagination/recovery UI остаются feature-owned, recipe commands/offline/cooking/editor не затронуты. Transport ratchet обновлён до 41 sites / 15 files / 2 contexts, computed 1. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 19:52 - Frontend package 0.0.253: восемь auth lifecycle transport sites перенесены в приватный typed adapter с caller-prepared legal evidence/token/password inputs, signals, exact projections и native errors; legal refetch/evidence reset, token/history и session/WebPush orchestration остаются UI-owned. Transport ratchet обновлён до 43 sites / 16 files / 2 contexts, computed 1. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 19:37 - Frontend package 0.0.252: восемь account-security transport sites перенесены в существующий entity typed adapter с сохранением caller signals, exact generated inputs/projections и native errors; validation, authenticator lifecycle, cache/session/WebPush orchestration остаются UI-owned. Transport ratchet обновлён до 51 sites / 17 files / 3 contexts, computed 1. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 19:36 - Frontend package 0.0.251: пять user/staff sign-in transport sites перенесены в приватный typed adapter с explicit password/TOTP/PIN и moderator challenge/MFA dispatch; auth form, MFA lifecycle, session/runtime/cache/error/router orchestration остаются UI-owned. Transport ratchet обновлён до 59 sites / 18 files / 3 contexts, computed 1. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 19:13 - Frontend package 0.0.250: sessions user/staff list/logout/revoke и dev-only mailbox transport перенесены в два узких приватных adapters с сохранением signals/projections; WebPush cleanup, runtime reset/broadcast, cache invalidation, errors, redirects и production route gate остаются UI-owned. Transport ratchet обновлён до 64 sites / 19 files / 3 contexts, computed 1. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 19:04 - Frontend package 0.0.249: два read-only user-home transport site перенесены в приватный typed adapter с сохранением AbortSignal, exact scope conversion, limit и recipe-only projection; independent partial recovery и recommendation actions остаются UI/entity-owned, security-sensitive auth flows не затронуты. Transport ratchet обновлён до 68 sites / 21 files / 3 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 18:51 - Frontend package 0.0.248: девятнадцать direct family transport sites перенесены в единый приватный typed adapter с сохранением signals, token/path/query params, exact projections и caller-owned version/idempotency bodies; role gates, persistent retry/unknown-outcome readback, session/workspace, cache/notification fan-out и router остаются UI-owned. Transport ratchet обновлён до 70 sites / 22 files / 3 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 18:39 - Frontend package 0.0.247: пятнадцать direct shopping transport sites перенесены в единый приватный typed adapter с сохранением prepared queries/bodies, signals/params и exact projections; offline snapshots, product visibility, persistent UUID/unknown-outcome, OCR/PDF fail-closed, drafts и cache/router orchestration остаются UI-owned. Transport ratchet обновлён до 89 sites / 27 files / 4 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 18:27 - Frontend package 0.0.246: четырнадцать direct meal-plan transport sites перенесены в единый приватный typed adapter с сохранением selection identity, scope/date/query, signals/params/projections и caller-owned UUID/version bodies; preview/frozen state, unknown-outcome recovery, router/refetch и shopping/family/entitlement/cache fan-out остаются UI-owned. Transport ratchet обновлён до 104 sites / 34 files / 5 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 18:14 - Frontend package 0.0.245: тринадцать direct inventory transport sites перенесены в единый приватный typed adapter с сохранением scope/localDate/search/pagination, signals/projections и caller-owned command bodies, UUID/version/If-Match; unknown-outcome/conflict recovery, drafts, dialogs, routing и cache fan-out остаются UI-owned. Transport ratchet обновлён до 118 sites / 36 files / 6 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 17:52 - Frontend package 0.0.244: двенадцать direct finance transport site перенесены в единый приватный typed adapter с сохранением date/category omission, signals/path params/data projections, caller-owned bodies/versions и If-Match/native errors; consent/form validation, fresh UUID, budget POST/PUT selection, stale recovery и finance/Pro cache fan-out остаются UI-owned. Transport ratchet обновлён до 131 sites / 41 files / 7 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 17:42 - Frontend package 0.0.243: одиннадцать direct subscription transport site перенесены в приватный typed adapter с сохранением signal/data projections, caller-owned bodies/keys/versions, explicit commit dispatch и native errors; persistent trial/commit refs, review/dialog/recovery, combination settings projection и AI/family/meal-plan fan-out остаются UI-owned. Transport ratchet обновлён до 143 sites / 46 files / 8 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 17:30 - Frontend package 0.0.242: одиннадцать direct preserves transport site перенесены в приватный typed adapter с сохранением filters/local date/scope/page, signals/path params/data projections, caller-prepared consume-preview body и native errors; QR/Blob/print, drafts/conflicts/routing и persistent command unknown-outcome/cache fan-out остаются UI-owned. Transport ratchet обновлён до 154 sites / 47 files / 9 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 17:20 - Frontend package 0.0.241: девять direct support transport site перенесены в приватный typed adapter с сохранением filters/signals/path params/data projections, caller-owned idempotency keys/versions и native errors; create signature/useRef retry, drafts, ticket state machine, cache updates и router остаются UI-owned. Transport ratchet обновлён до 165 sites / 51 files / 10 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 17:10 - Frontend package 0.0.240: девять direct family-chat transport site перенесены в приватный typed adapter с сохранением q/before pagination, signals/params/full envelopes, caller-owned UUID/version bodies и native errors; persistent same-key read retry, drafts/sessionStorage, confirmations, recovery и cache refresh остаются UI-owned. Transport ratchet обновлён до 174 sites / 52 files / 11 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 16:59 - Frontend package 0.0.239: восемь direct moderation transport site перенесены в приватный typed adapter с сохранением signals/query/params/projections, caller-owned version/UUID bodies и отсутствия If-Match; staff-session 401 recovery, 409/412 refetch, pagination, role gates, drafts, router и cache fan-out остаются UI-owned. Transport ratchet обновлён до 183 sites / 53 files / 12 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 16:50 - Frontend package 0.0.238: восемь direct family-notes transport site перенесены в приватный typed adapter с сохранением signals/query/params/read projections, full command envelopes, caller-owned UUID и optimistic versions; drafts/checklists, error recovery, refresh fan-out и routing остаются UI-owned. Transport ratchet обновлён до 191 sites / 57 files / 13 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 16:34 - Frontend package 0.0.237: шесть direct account-lifecycle transport site перенесены в приватный typed adapter с сохранением signals/query/projections, caller-owned reauth tokens, persistent idempotency keys и optimistic version. Export freshness, reauth expiry, unknown-outcome recovery, cache refresh и session termination остаются UI-owned. Transport ratchet обновлён до 199 sites / 60 files / 14 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 16:20 - Frontend package 0.0.236: шесть direct diary transport site перенесены в приватный typed adapter с сохранением signals/queries, full command envelopes, fresh UUID и expectedVersion/If-Match; consent/date/portion decisions/drafts/dialogs и exact diary/Pro/inventory fanout остаются UI-owned. Transport ratchet обновлён до 205 sites / 61 files / 15 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 16:06 - Frontend package 0.0.235: пять direct products transport site перенесены в приватный typed adapter с сохранением cross-domain inventory/location projections, signals/params/queries и caller-owned proposal command identity; fingerprint/persistent key/body, abort, unknown-outcome и cache/router lifecycle остаются UI-owned. Transport ratchet обновлён до 211 sites / 62 files / 16 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 15:57 - Frontend package 0.0.234: пять direct notification center/preferences transport site перенесены в приватный typed adapter с сохранением filters/signals/params/expectedVersion/fresh UUID/data/errors; URL/cache/BroadcastChannel/drafts и Web Push browser lifecycle остаются UI-owned. Transport ratchet обновлён до 216 sites / 64 files / 17 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 15:46 - Frontend package 0.0.233: четыре direct exports transport site перенесены в приватный typed adapter с сохранением signals/cursor omission/path params/data projections/native errors; polling, critical reauth, persistent unknown-outcome idempotency ref и Blob download lifecycle остаются UI-owned. Transport ratchet обновлён до 221 sites / 65 files / 18 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 15:34 - Frontend package 0.0.232: четыре direct nutrition transport site перенесены в приватный typed adapter с сохранением consent gating, AbortSignal/date query, read projections, полных command envelopes, conditional If-Match, fresh UUID, drafts/read-only и exact three-cache fanout. Transport ratchet обновлён до 225 sites / 66 files / 19 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 15:24 - Frontend package 0.0.231: четыре direct AI-appeals transport site перенесены в приватный typed adapter с сохранением signals/params, exact create/reply bodies, fresh UUID, expectedVersion, data/error и UI draft/cache semantics. Transport ratchet обновлён до 229 sites / 67 files / 20 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 15:05 - Frontend package 0.0.230: три direct inventory-ingest review transport site перенесены в приватный typed feature adapter с сохранением barcode/q, scope, signals, projections и pending-command UUID/object retry; multipart uploads не изменены. Transport ratchet обновлён до 233 sites / 68 files / 21 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 14:55 - Frontend package 0.0.229: два direct recommendation command transport site перенесены в приватный typed entity adapter с сохранением exact bodies/params, fresh UUID, void/data/error и cache/UI semantics; transport ratchet обновлён до 236 sites / 69 files / 22 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 14:43 - Frontend package 0.0.228: два direct account-security transport site перенесены в приватный typed entity adapter без изменения signal/body/data/error и critical re-auth UI semantics; transport ratchet обновлён до 238 sites / 70 files / 23 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 14:32 - Frontend package 0.0.227: profiles direct PUT перенесён в существующий profile entity adapter без изменения wire/UI semantics; transport ratchet обновлён до 240 sites / 71 files / 24 contexts. Root, design-system и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 14:25 - Frontend package 0.0.226: direct transport requests зафиксированы inspectable AST baseline 241/72/25 с read/command и literal/computed классификацией; regression gate включён в frontend check. Root, design-system, runtime, routes и contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 14:10 - Frontend package 0.0.225: устранён shopping runtime SCC и добавлен нулевой runtime-cycle ratchet с type-only/assets исключениями, alias resolution и fail-closed локальными imports. Root, design-system, UI и wire contracts не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 13:51 - Frontend package 0.0.224: design route audit теперь проверяет canonical URLs вместо 33 route-group placeholders, сохраняет exact 119-route inventory и очищает stale resume data. Root, design-system и product behavior не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 13:44 - Frontend package 0.0.223: stale route-matrix inventory теперь учитывает две intentional public legal catalog routes и материализует dynamic legal slug; root, design-system и product behavior не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 13:35 - Frontend package 0.0.222: canonical consent entity ownership closes the final two legacy legal query-key factory sites while preserving the shared legal aggregate cache, content and wire behavior. Root and design-system versions remain unchanged.

0.0.48 (root unchanged) - 06.11.2026 | 13:25 - Frontend package 0.0.221: canonical cross-context entity roots and explicit ordered invalidations close the production raw query-key baseline to 0 / 0 / 0. Root scripts, design-system, routes, contracts and runtime behavior remain unchanged.

0.0.48 (root unchanged) - 06.11.2026 | 13:13 - Frontend package 0.0.220: private recipe owner closes remaining cooking invalidation ownership and lowers query snapshot to 8 / 3 / 3. Root scripts, design-system, routes, contracts and runtime behavior remain unchanged.

0.0.48 (root unchanged) - 06.11.2026 | 13:07 - Frontend package 0.0.219: private recipe owner adds exact cooking list/attempt/recipe read projections and lowers query snapshot to 22 / 4 / 4. Root scripts, design-system, routes, contracts and runtime behavior remain unchanged.

0.0.48 (root unchanged) - 06.11.2026 | 13:00 - Frontend package 0.0.218: private recipe owner adds exact public/personal/statistics detail projections and lowers query snapshot to 25 / 4 / 4. Root scripts, design-system, routes, contracts and runtime behavior remain unchanged.

0.0.48 (root unchanged) - 06.11.2026 | 12:52 - Frontend package 0.0.217: private recipe owner adds exact filtered workspace-list and broad refresh ownership and lowers query snapshot to 32 / 5 / 4. Root scripts, design-system, routes, contracts and runtime behavior remain unchanged.

0.0.48 (root unchanged) - 06.11.2026 | 12:45 - Frontend package 0.0.216: private recipe owner adds exact editor workspace/offline/recovery projections and lowers query snapshot to 37 / 6 / 4. Root scripts, design-system, routes, contracts and runtime behavior remain unchanged.

0.0.48 (root unchanged) - 06.11.2026 | 12:37 - Frontend package 0.0.215: private recipe owner adds exact scoped community, broad community and public-detail refresh projections and lowers query snapshot to 42 / 7 / 4. Root scripts, design-system, routes, contracts and runtime behavior remain unchanged.

0.0.48 (root unchanged) - 06.11.2026 | 12:28 - Frontend package 0.0.214: private recipe owner adds exact cooking reminder preferences/root projections and lowers query snapshot to 47 / 8 / 4. Root scripts, design-system, routes, contracts and runtime behavior remain unchanged.

0.0.48 (root unchanged) - 06.11.2026 | 12:21 - Frontend package 0.0.213: private recipe owner adds exact public feed/comments infinite-query projections and lowers query snapshot to 50 / 9 / 4. Root scripts, design-system, routes, contracts and runtime behavior remain unchanged.

0.0.48 (root unchanged) - 06.11.2026 | 12:01 - Frontend package 0.0.212: private recipe owner adds exact catalog/family-detail/prepared leaf projections and lowers query snapshot to 52 / 10 / 4. Root scripts, design-system, routes, contracts and runtime behavior remain unchanged.

0.0.48 (root unchanged) - 06.11.2026 | 11:54 - Frontend package 0.0.211: private recipe report owner сохраняет distinct paginated-list/detail cache projections и снижает query snapshot до 55 / 13 / 4. Root scripts, design-system, routes, contracts и runtime behavior не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 11:47 - Frontend package 0.0.210: private shopping owner завершает static catalog/purchase query ownership и снижает query snapshot до 57 / 14 / 4. Root scripts, design-system, routes, contracts и runtime behavior не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 11:37 - Frontend package 0.0.209: private shopping owner сохраняет distinct list/detail/history/recipe-preview cache projections и снижает query snapshot до 60 / 16 / 4. Root scripts, design-system, routes, contracts и runtime behavior не изменены.

0.0.48 (root unchanged) - 06.11.2026 | 11:29 - Frontend package 0.0.208: private shopping receipt owner сохраняет distinct capabilities/detail/duplicates cache projections и снижает query snapshot до 64 / 17 / 4. Root scripts, design-system, routes, contracts и command semantics не изменены.

0.0.48 (root unchanged) - 11.06.2026 | 11:18 - Frontend package 0.0.207: private AI owner завершает capabilities/history query ownership без смешивания payloads или изменения preview/run behavior; query snapshot снижен до 67 / 19 / 4. Root scripts, design-system, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.06.2026 | 11:12 - Frontend package 0.0.206: private AI owner фиксирует filtered history и distinct history/conversation refresh projections без cache-shape или behavior changes; query snapshot снижен до 70 / 20 / 5. Root scripts, design-system, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.06.2026 | 11:06 - Frontend package 0.0.205: private AI owner фиксирует distinct conversation detail/history refresh projections без смешивания cached payloads или изменения commands/UI; query snapshot снижен до 75 / 21 / 5. Root scripts, design-system, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.06.2026 | 10:59 - Frontend package 0.0.204: private AI owner фиксирует distinct family-sharing projection без смешивания с canonical balance cache или изменения commands/UI; query snapshot снижен до 78 / 22 / 5. Root scripts, design-system, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.06.2026 | 10:52 - Frontend package 0.0.203: private finance owner завершает exact detail/list/overview cache ownership без изменения transport, optimistic command или UI; query snapshot снижен до 81 / 23 / 5. Root scripts, design-system, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.06.2026 | 10:45 - Frontend package 0.0.202: private finance owner фиксирует distinct range overview/account budgets projections и broad roots без изменения transport, commands или UI; query snapshot снижен до 88 / 24 / 6. Root scripts, design-system, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.06.2026 | 10:38 - Frontend package 0.0.201: private finance owner фиксирует exact filtered expenses list и distinct expenses/overview refresh prefixes без изменения transport, commands или UI; query snapshot снижен до 94 / 25 / 6. Root scripts, design-system, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.06.2026 | 10:30 - Frontend package 0.0.200: private finance owner фиксирует exact prices history/catalog projections и broad refresh prefix без изменения transport, commands или UI; query snapshot снижен до 99 / 26 / 6. Root scripts, design-system, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.06.2026 | 00:39 - Frontend package 0.0.199: private finance owner фиксирует exact read-only analytics cache projection без изменения transport или UI; query snapshot снижен до 103 / 27 / 6. Root scripts, design-system, commands, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.06.2026 | 00:31 - Frontend package 0.0.198: existing family/meal-plan owners фиксируют два remaining exact meal-plan projections без объединения разных family cache lifecycles; query snapshot снижен до 104 / 28 / 6. Root scripts, design-system, transports, commands, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.06.2026 | 00:20 - Frontend package 0.0.197: canonical `entities/preserve` объединяет exact preserve projections и broad root между preserve workflows и recipe cooking, оставляя multi-domain computed loop явным debt; query snapshot снижен до 106 / 29 / 7. Root scripts, design-system, transports, commands, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.06.2026 | 00:11 - Frontend package 0.0.196: private subscription settings owner сохраняет exact account-scoped cache tuple для overview read/write; query debt snapshot снижен до 114 / 32 / 7. Root scripts, design-system, transports, commands, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.06.2026 | 00:01 - Frontend package 0.0.195: canonical `entities/product` фиксирует пять exact product cache projections без переноса transport или изменения cached response shapes; query debt snapshot снижен до 115 / 33 / 8. Root scripts, design-system, commands, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 18:48 - Frontend package 0.0.194: canonical `entities/meal-plan` объединяет exact plan queries и broad/account invalidations между meal-plan и subscription, сохраняя раздельные recipe projections; query debt snapshot снижен до 120 / 36 / 10. Root scripts, design-system, transports, commands, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 18:40 - Frontend package 0.0.193: canonical `entities/entitlement` объединяет account-scoped capability cache между meal-plan и receipt creation; query debt snapshot снижен до 129 / 37 / 10. Root scripts, design-system, transports, commands, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 18:31 - Frontend package 0.0.192: canonical `entities/ai-balance` объединяет account-scoped query/cache invalidation между AI и subscription; query debt snapshot снижен до 131 / 37 / 10. Root scripts, design-system, transports, commands, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 18:18 - Frontend package 0.0.191: export cache ownership объединено в canonical entity для exports feature и account lifecycle; query debt snapshot снижен до 142 / 37 / 10. Root scripts, design-system, transports, export/deletion workflows, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 18:11 - Frontend package 0.0.190: account lifecycle/preview scoped keys и lifecycle refresh используют private feature owner; raw exports projection сохранена. Query debt snapshot снижен до 143 / 38 / 11. Root scripts, design-system, transports, lifecycle commands/gates, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 18:01 - Frontend package 0.0.189: moderation overview/queue/item/support cache keys и broad/scoped invalidations используют private feature owner; query debt snapshot снижен до 147 / 38 / 11. Root scripts, design-system, staff session, transports, transitions, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 17:51 - Frontend package 0.0.188: nutrition settings/analytics scoped keys и broad refresh используют private feature owner; query debt snapshot снижен до 161 / 42 / 12. Root scripts, design-system, consent gating, transports, commands, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 17:44 - Frontend package 0.0.187: Family Notes list/detail/history cache keys и account-scoped refresh используют private feature owner; query debt snapshot снижен до 167 / 43 / 13. Root scripts, design-system, transports, note commands/drafts, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 17:32 - Frontend package 0.0.186: diary day/source queries и broad refresh используют private feature key owner; query debt snapshot снижен до 173 / 46 / 14. Root scripts, design-system, transports, diary commands/invalidations, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 17:25 - Frontend package 0.0.185: Family Chat scoped query и broad refresh используют private feature key owner; query debt snapshot снижен до 177 / 47 / 15. Root scripts, design-system, transports, chat commands/drafts, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 17:16 - Frontend package 0.0.184: support list/meta/detail cache keys и invalidations используют private feature owner; query debt snapshot снижен до 180 / 48 / 16. Root scripts, design-system, transports, support commands/state machine, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 17:07 - Frontend package 0.0.183: AI appeals list/detail cache keys и invalidations используют private feature owner; query debt snapshot снижен до 186 / 49 / 17. Root scripts, design-system, transports, appeal/support commands, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 16:56 - Frontend package 0.0.182: exports account-scoped history query и invalidation используют private feature key owner; query debt snapshot снижен до 190 / 50 / 18. Root scripts, design-system, transports, protected export workflow, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 16:39 - Frontend package 0.0.181: home/recipes recommendation projections используют canonical recommendation entity owners; auth raw-key context завершён, query debt snapshot снижен до 193 / 51 / 19. Root scripts, design-system, transports, actions, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 16:31 - Frontend package 0.0.180: account-scoped home projection использует private auth/home owner; query debt snapshot снижен до 196 / 52 / 20. Root scripts, design-system, recommendations, transports, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 16:24 - Frontend package 0.0.179: registration manifest и reset-link check используют private auth lifecycle owner; query debt snapshot снижен до 197 / 52 / 20. Root scripts, design-system, legal settings legacy, transports, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 16:13 - Frontend package 0.0.178: user/staff session lists используют отдельный canonical session-list owner с сохранённым moderator→staff mapping; query debt snapshot снижен до 199 / 53 / 20. Root scripts, design-system, current-session keys, transports, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 16:04 - Frontend package 0.0.177: settings security и critical re-auth используют раздельные canonical account-security entity keys; query debt snapshot снижен до 202 / 54 / 20. Root scripts, design-system, transports, commands, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 15:48 - Frontend package 0.0.176: notification center/settings и family notice используют canonical notification entity keys; query debt snapshot снижен до 206 / 56 / 21. Root scripts, design-system, transports, mutations, WebPush, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 15:35 - Frontend package 0.0.175: exact family workflow projections используют private feature owner; query debt snapshot снижен до 216 / 58 / 23. Root scripts, design-system, cross-domain notification root, transports, commands, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 15:22 - Frontend package 0.0.174: legacy preserves/cooking location projections используют exact entity owners без cache convergence; query debt snapshot снижен до 228 / 61 / 23. Root scripts, design-system, result shapes, scope semantics, transports, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 15:10 - Frontend package 0.0.173: exact inventory list/batch/location/cooking-review projections используют canonical entity factories; query debt snapshot снижен до 232 / 62 / 23. Root scripts, design-system, legacy location tuples, transports, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 14:53 - Frontend package 0.0.172: exact inventory attention/history/product-search caches и broad invalidations используют canonical entity owners; query debt snapshot снижен до 236 / 65 / 24. Root scripts, design-system, dynamic multi-root loops, transports, mutations, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 14:42 - Frontend package 0.0.171: factory-compatible inventory location caches и broad invalidation используют canonical entity owners; exact query debt snapshot снижен до 247 / 67 / 24. Root scripts, design-system, incompatible tuples, transports, mutations, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 14:29 - Frontend package 0.0.170: staff auth write и moderator 401 recovery используют canonical staff-session key; exact query debt snapshot снижен до 253 / 67 / 24. Root scripts, design-system, transports, moderator commands/UI/routes, user-session и sessions-list keys не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 14:13 - Frontend package 0.0.169: broad inventory invalidations переведены на canonical inventory root, exact query debt snapshot снижен до 258 / 68 / 24; root scripts, design-system, scoped keys, transports, mutations, UI, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 14:02 - Frontend package 0.0.168: Pro overview read/cache ownership переведён на canonical entity, exact query debt snapshot снижен до 268 / 68 / 24; root scripts, design-system, mutations, UI, routes, exports и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 13:52 - Frontend package 0.0.167: remaining profile/follow read-cache ownership переведён на canonical profile/recommendation entities, exact query debt snapshot снижен до 275 / 69 / 25; root scripts, design-system, mutations, UI, routes, exports и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 13:40 - Frontend package 0.0.166: profile pages GET/cache ownership переведён на canonical profile entity, exact query debt snapshot снижен до 278 / 70 / 26; root scripts, design-system, feature-owned PUT, UI, routes, exports и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 13:30 - Frontend package 0.0.165: achievements/public-progress переведён на canonical profile read query-key/API owners, exact query debt snapshot снижен до 281 / 71 / 27; root scripts, design-system, UI, routes, feature exports и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 13:16 - Frontend package 0.0.164: community following переведён на canonical recommendation query-key/API owners, exact query debt snapshot снижен до 285 / 72 / 28; root scripts, design-system, public APIs, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 13:02 - Frontend package 0.0.163: finance-cost entity переведён на canonical query-key/API owners, exact query debt snapshot снижен до 288 / 73 / 29; root scripts, design-system, consumer APIs, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 12:54 - Frontend package 0.0.162: search переведён на приватные query-key/API owners, exact query debt snapshot снижен до 289 / 74 / 30; root scripts, design-system, public API, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 12:40 - Frontend package 0.0.161: news переведён на приватные query-key/API owners, exact query debt snapshot снижен до 290 / 75 / 31; root scripts, design-system, public API, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 12:24 - Frontend package 0.0.160: personalization переведён на приватные query-key/API owners, exact query debt snapshot снижен до 294 / 76 / 32; root scripts, design-system, routes и contracts не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 12:21 - Frontend package 0.0.159: добавлен query-key AST ratchet с exact production baseline и regression fixtures; root scripts, design-system, runtime, routes, contracts и bundle не изменены.

0.0.48 (root unchanged) - 11.05.2026 | 11:49 - Frontend package 0.0.158: architecture gate использует TypeScript AST/module resolution и временные regression fixtures для всех module-edge форм, aliases, CSS и mock boundary. Root scripts, design-system, runtime, routes, contracts и bundle не изменены.

0.0.48 - 11.03.2026 | 14:21 - Frontend package 0.0.157: consumer contract синхронизирован с backend OpenAPI 0.0.65 (288 операций), regenerated client проверен normalized diff. Финальный reliability checkpoint обновил только устаревшие Edge desktop/mobile assertions для legal-заглушки `[Тут будут данные]`, независимых push/email capabilities и theme hydration; focused повтор 6/6, полный check 181/181 + ops 6/6, build budget и audit 0. VPS restart и immutable frontend rollback/roll-forward завершены all-component verify без изменения данных.

0.0.47 - 11.02.2026 | 18:20 - Frontend package 0.0.156: в настройках уведомлений добавлено явное подключение/отключение session-bound Web Push без автоматического permission prompt. Существующий offline worker обрабатывает минимизированный push payload и открывает только allowlisted same-origin маршруты; unsupported/denied/unavailable/error состояния остаются восстановимыми. OpenAPI snapshot 0.0.64 и generated client синхронизированы с тремя additive push endpoints; общий ApiClient обеспечивает строгую Zod-валидацию и CSRF без временного transport API.

0.0.46 - 11.02.2026 | 16:39 - Workspace синхронизирован с production-safe OCR preview контрактом backend: ответ требует `requiresReview: true`, чек нельзя сохранить без явного подтверждения ручной проверки, а клиентский лимит изображений приведён к CDR-лимиту 12 Мп. Frontend package поднят до 0.0.155.

0.0.44 - 02.11.2026 | 09:09 - Registration consent controls now remain reviewable when draft documents are available, expose a recoverable legal-manifest error, and unlock submit only for the explicit approved/demonstration build policy plus both acknowledgements. The test deploy declares demonstration evidence; production defaults fail-closed to approved. Account/offline settings retain the shared application shell, and confirmed theme, contrast, typography and malformed CSS values now use design-system tokens. Recipe, family, QR capability and locale states lead to implemented destinations or explain readonly behavior instead of rendering dead/misleading controls. Wire contracts are unchanged.

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

0.0.45 - 11.02.2026 | 14:24 - Workspace синхронизирован с backend 0.0.160, OpenAPI 0.0.63 и schema v33; README/TESTs фиксируют fail-closed media boundary, binary download и отдельный multipart transport. Frontend package поднят до 0.0.154.
