# Meal frontend — deployment runbook

Этот документ описывает воспроизводимый выпуск клиентского Next.js-приложения на тестовый production-стенд. Backend и admin выпускаются из собственных репозиториев; исходники соседних репозиториев не копируются в artifact frontend.

## Быстрая карта деплоя

1. В `meal_frontend` заливаются Next.js client, его design-system и frontend-тесты. Backend/admin и shared Compose остаются в своих репозиториях.
2. Push в `main` запускает `.github/workflows/deploy.yml`: full quality/build gates → standalone image `ghcr.io/en1ere/meal_frontend:sha-<full-sha>` → immutable digest → Environment `test`.
3. `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_API_MODE=real` и `BACKEND_ORIGIN=http://backend:3001` фиксируются на image build; их runtime-изменение без нового image не сработает.
4. CI вызывает `sudo /usr/local/sbin/meal-deploy frontend <image@digest> <git-sha>`; source, `.next` и `node_modules` на VPS вручную не копируются.
5. Container слушает `3000`, на host доступен только `127.0.0.1:3000`; Nginx отдаёт public HTTPS, а `/api/` на том же origin идёт на backend `3001`.
6. Smoke: local `/healthz`, public `/`, `/recipes`, каталог `/legal`, все 11 allowlisted legal routes, неизвестный legal slug с 404, login/logout, authenticated read и все темы с reload.
7. Frontend rollout не ходит в БД и не запускает migrations; при verify failure helper возвращает previous frontend digest.

## Текущий inventory

| Компонент                     | Значение                                                        |
| ----------------------------- | --------------------------------------------------------------- |
| Public origin                 | `https://abstract-usable-gazebo.ruweb.place`                    |
| Admin origin                  | `https://admin.abstract-usable-gazebo.ruweb.place`              |
| Backend health                | `/health/live`, `/health/ready`                                 |
| Установленный release         | Immutable digest из `/srv/meal/deployment/images.env`           |
| Целевая root/app версия       | `0.0.42` / `0.0.151`                                            |
| Связанные runtime-компоненты  | backend `0.0.151` / schema v31; admin `0.0.127`                 |
| Runtime                       | Node.js 24, Docker Compose, loopback `127.0.0.1:3000`           |
| Traffic                       | Nginx завершает TLS; `/api/` проксируется в backend на loopback |

Inventory фиксирует проверенное состояние, а не автоматически обновляемый source of truth. Перед выпуском повторно получить версии из package manifests и разрешённые значения с сервера. Пароли, TOTP secret/recovery codes, root credentials, DB URL и содержимое environment-файлов в Git не записываются.

### Развёрнутая container-архитектура

- GitHub Actions собирает Linux image из `main`, публикует его в GHCR без `latest` и передаёт deploy-helper только immutable digest через GitHub Environment `test` production-like технического стенда.
- Single-host Docker Compose запускает frontend непривилегированным пользователем; host Nginx сохраняет TLS и проксирует на loopback `127.0.0.1:3000`.
- `GET /healthz` проверяет только Next process и не зависит от backend. Backend `/health/live` и `/health/ready` проверяются отдельными gates.
- Runtime root filesystem read-only; временные `/tmp` и `/app/front/.next/cache` предоставляются ограниченными tmpfs. Persistent frontend volume не требуется.
- Server helper `/usr/local/sbin/meal-deploy` обязан сериализовать общий rollout lock, хранить предыдущий проверенный digest, ждать health/smoke и возвращать digest при неуспехе. Workflow не содержит SSH-ключей, host keys или иных значений secrets.

Container runtime, helper, digest inventory, PostgreSQL restore и общий post-deploy verify подтверждены на VPS 29 октября 2026 года. Legacy `meal-frontend.service` отключён и не стартует после reboot.

Технические origins из inventory остаются текущими production-like адресами. Плановые `https://meal.royalexander.online` и `https://admin.meal.royalexander.online` имеют статус `pending_dns`: до появления обеих A-записей и выпуска сертификата их нельзя подставлять в Nginx или origin-переменные.

### Evidence выпуска 28 октября 2026 года

- Public origin вернул `HTTP/2 200`, а immutable symlink указывает на release из inventory.
- Авторизованный профиль `Test Administrator` (`admin@meal-planner.test`) открыл защищённую оболочку; пароль и session-cookie в evidence не сохранялись.
- `/recipes` загрузил корректное пустое состояние без browser console errors.
- Все четыре темы доступны; `Кофе · светлая` сохранилась после reload.
- `NEXT_PUBLIC_API_MODE=real`, `BACKEND_ORIGIN=http://127.0.0.1:3001` и runtime marker `NEXT_PUBLIC_APP_VERSION=0.0.137` подтверждены на процессе.
- Backend `0.0.128` после schema v29 отвечал `200` на live/ready; сначала были переключены обратно совместимые frontend/admin, затем выполнены backup, migration и backend rollout.
- Read-only production acceptance для root/app `0.0.28` / `0.0.137` прошёл `24/24` на desktop/mobile Edge: mutation requests `0`, runtime errors `0`. Evidence сохранён как `/var/backups/meal-planner/deployment-evidence/frontend-0.0.28-0.0.137.json`, SHA-256 `7224c36bd572e9e69d5e61ffbf97bfc946c461fc52fac431a3861f2a39c4bce4`, mode `0600`.
- Связанный admin `0.0.117` переключён на immutable release `20261028-0757`: root и `/admin/queues/recipes` возвращают `200`, password → mandatory MFA и `coffee-light` / `nature-dark` smoke прошли без runtime errors.

Эта запись не содержит credentials и не заменяет серверный журнал выпуска.

## Release gates

Переключение `current` запрещено, пока не выполнены все применимые пункты:

1. `npm ci`, `npm run check`, `npm run build` и `npm run test:performance:budget` завершились успешно на Node/npm из `package.json`.
2. `npm run ops:readiness` подтвердил структуру provider-neutral manifests. Статус `blocked` ожидаем, пока внешние решения не приняты; `npm run ops:readiness:require-ready` обязан завершаться ненулевым кодом при открытых blockers.
3. Backend `/health/live` и `/health/ready` отвечают `200`, а backend runbook подтверждает schema v31 и backup/restore evidence.
4. GHCR artifact адресуется digest, содержит standalone server, `.next/static`, `public` и runtime legal documents. `.env*`, QA-output, test traces и secrets не входят в image.
5. `NEXT_PUBLIC_API_MODE=real`, `NEXT_PUBLIC_APP_VERSION` совпадает с `front/package.json`, а `BACKEND_ORIGIN=http://backend:3001`. Все три значения заданы при build: public variables встраиваются в browser bundle, а rewrite destination сериализуется Next config в standalone server.
6. Юридический gate `draft_blocked` остаётся явным blocker публичного коммерческого запуска. Revision-aware moderation contract реализован и развёрнут, но его live mutation-приёмка требует доступного admin TOTP либо отдельно согласованного re-enrollment.

## Build-time и runtime interface

Build args production image:

- `NEXT_PUBLIC_API_MODE=real`;
- `NEXT_PUBLIC_APP_VERSION=<front/package.json version>`;
- `BACKEND_ORIGIN=http://backend:3001`.

Runtime container environment ограничен процессными настройками:

- `NODE_ENV=production`;
- `NEXT_TELEMETRY_DISABLED=1`;
- `HOSTNAME=0.0.0.0`;
- `PORT=3000`.

Изменение `NEXT_PUBLIC_*` либо `BACKEND_ORIGIN` только в runtime environment не перенастраивает уже собранный image. Для другого backend origin нужен новый digest либо отдельно согласованный runtime-proxy refactor. Эти значения не являются secrets, но secrets всё равно не выводятся в CI logs и не копируются в image.

## Сборка immutable artifact

Из чистого checkout точной revision quality gate выполняется до image build:

```sh
npm ci
npm run check
npm run build
npm run test:performance:budget
npm run ops:readiness
```

Image собирается BuildKit из корня:

```sh
docker build \
  --build-arg NEXT_PUBLIC_APP_VERSION=<front-version> \
  --build-arg NEXT_PUBLIC_API_MODE=real \
  --build-arg BACKEND_ORIGIN=http://backend:3001 \
  -t <registry>/<repository>:sha-<revision> .
```

Публикуется только commit tag `sha-<full-sha>` для поиска, а deployment всегда использует возвращённый registry digest. Mutable `latest` и semver tags запрещены. Перед image build и повторно перед deploy workflow fail-closed сверяет source SHA с актуальным tip `main`, поэтому более старый сериализованный run не может откатить новый release. Standalone server запускается из `/app/front`, потому что server-only legal renderer читает traced `../docs/legal`; смена working directory ломает legal routes.

Записать release metadata вне Git: git revision, root/app версии, UTC build time, Node/npm версии и SHA-256 архива. Не использовать изменяемый каталог как release id.

Рекомендуемый layout:

```text
/srv/meal/frontend/
  releases/<UTC>-<root-version>-<front-version>/
  current -> releases/<release-id>
```

Владельцем файлов и процесса является непривилегированный пользователь `meal`. Upload выполняется во временное имя внутри `/srv/meal/frontend/releases`, checksum проверяется до распаковки/переименования. Сборка не выполняется от root на сервере.

## Pre-traffic проверка

1. Получить candidate image по точному digest и проверить metadata/SBOM/provenance.
2. Не меняя active digest, запустить candidate на свободном loopback-порту с тем же build contract и read-only/tmpfs hardening.
3. Проверить `/about`, `/pricing`, `/auth`, redirect защищённого `/settings`, same-origin `/api`, отсутствие console/page errors и `404` на `/dev/mailbox` и `/dev/ui`.
4. Переключить все четыре темы: `coffee-light`, `coffee-dark`, `nature-light`, `nature-dark`; после reload выбор сохраняется без вспышки другой темы.
5. Убедиться, что candidate не отправляет mutation requests во время анонимной read-only acceptance.

Read-only production acceptance запускается только с явно созданным target-файлом вне Git и новым output path:

```sh
node scripts/production-acceptance.mjs --target <target.json>
node scripts/production-acceptance.mjs --execute --target <target.json> --output <new-evidence.json>
```

Target содержит только публичные HTTPS origins, точные release versions, timestamp acknowledgement и `allowMutations: false`. Скрипт блокирует любой не-GET/HEAD/OPTIONS запрос. Он не заменяет authenticated smoke.

По умолчанию Playwright использует совместимый браузер из собственного cache. Если в release-runner уже установлен управляемый Chromium/Edge, задайте его только абсолютным путём через `PLAYWRIGHT_EXECUTABLE_PATH`; относительный путь отклоняется до запуска acceptance. Это не меняет target, read-only набор методов или состав проверок.

Минимальная форма target (значения версий заменить на проверенные release manifests):

```json
{
    "version": "meal-frontend-production-acceptance-v1",
    "publicOrigin": "https://abstract-usable-gazebo.ruweb.place",
    "adminOrigin": "https://admin.abstract-usable-gazebo.ruweb.place",
    "apiOrigin": "https://abstract-usable-gazebo.ruweb.place",
    "release": {
        "frontendRoot": "0.0.0",
        "frontendApp": "0.0.0",
        "backend": "0.0.0",
        "admin": "0.0.0",
        "openapiSnapshot": "0.0.0"
    },
    "allowMutations": false,
    "acknowledgedAt": "2026-10-27T00:00:00.000Z"
}
```

## Переключение immutable digest

1. Под общим deployment lock сохранить предыдущий проверенный frontend digest для rollback.
2. Обновить только frontend image reference и выполнить `docker compose pull` плюс `docker compose up -d --no-deps`.
3. Дождаться container health `/healthz` и убедиться в отсутствии restart loop.
4. Проверить backend readiness до и после переключения.
5. Выполнить post-deploy smoke. При любом обязательном FAIL немедленно перейти к rollback; не чинить файлы внутри immutable release.

## Post-deploy smoke

```sh
curl --fail --silent https://abstract-usable-gazebo.ruweb.place/health/live
curl --fail --silent https://abstract-usable-gazebo.ruweb.place/health/ready
curl --fail --silent https://abstract-usable-gazebo.ruweb.place/healthz
curl --fail --silent --output /dev/null https://abstract-usable-gazebo.ruweb.place/
curl --fail --silent --output /dev/null https://abstract-usable-gazebo.ruweb.place/about
curl --fail --silent --output /dev/null https://abstract-usable-gazebo.ruweb.place/auth
```

Затем в чистом browser context:

1. Анонимные `/`, `/about`, `/pricing`, `/community` доступны; неизвестный route возвращает `404`.
2. `/settings` переводит анонимного пользователя на `/auth` и не принимает внешний `returnTo`.
3. Вход тестовой user-учётной записью, reload защищённого route и logout работают; credentials не фиксируются в отчёте.
4. Same-origin API отвечает текущим контрактом без CORS/mixed-content ошибок.
5. Все четыре темы работают на desktop/mobile и переживают reload.
6. `/dev/mailbox` и `/dev/ui` возвращают `404` в production.
7. Нет неожиданных 4xx/5xx, console/page errors, бесконечных запросов или повторной активации mock service worker.

Сквозные mutation-сценарии рецептов/модерации выполняются по revision-aware контракту: `review` описывает проверенную редакцию, `publication` — активную публичную редакцию. Публичная ссылка существует только при `publication != null`.

## Порядок revision-aware rollout

1. Сначала выпустить совместимые admin и frontend candidates. Frontend принимает старые ответы только когда одновременно отсутствуют обе оси `review` и `publication`; частичный или смешанный ответ отклоняется strict parser. Новые поля в запросы старому backend не добавляются.
2. Проверить login, workspace readback и отсутствие неожиданных mutation requests, затем остановить writers по backend runbook.
3. Выполнить backup gate, применить migration 029/schema v29 и выпустить backend `0.0.128`.
4. Возобновить writers только после live/ready, schema evidence и authenticated smoke: r1 publish → r2 reject при сохранённой r1 → r3 publish с заменой публикации; hide/unpublish дают `publication: null`; archive/restore не публикует рецепт повторно.
5. При rollback сначала откатить backend на совместимую версию, затем admin/frontend. Откат клиента первым запрещён: старый клиент не понимает независимые оси редакции и публикации.

## Rollback

Rollback приложения безопасен только при сохранённой совместимости с уже применённой DB schema:

1. Не откатывать миграции автоматически.
2. Под тем же deployment lock вернуть ранее проверенный immutable frontend digest.
3. Выполнить `docker compose pull` и `docker compose up -d --no-deps` только для frontend.
4. Повторить backend live/ready и минимальный public/auth/protected smoke.
5. Зафиксировать release ids, время, причину и evidence; не удалять failed release до разбора.

Если предыдущий frontend несовместим с текущим backend/OpenAPI, rollback запрещён: требуется forward fix или совместимый переходный backend.

## Наблюдение и обслуживание

- До container rollout: `systemctl status meal-frontend.service`, `journalctl -u meal-frontend.service` без вывода environment values.
- После rollout: `docker compose ps meal-frontend`, ограниченный `docker compose logs meal-frontend` и container health; команды выполняет deploy/operations user без вывода environment values.
- Ingress/TLS/UFW: общий безопасный контур описан в `meal_backend/docs/DEPLOYMENT.md`; frontend runbook не дублирует credentials.
- Контролировать restart count, HTTP 5xx, latency, disk/inodes и срок TLS certificate.
- Старые releases удалять только после подтверждённого rollback window; никогда не удалять target, полученный из непроверенной переменной/glob.
- Test users/data очищать по backend runbook после smoke. Browser staff/user sessions завершать через UI; не удалять production cookies вручную как доказательство logout.

## Открытые production gates

- legal documents: `draft_blocked`;
- внешние email/push/payment/storage/scanner/AI providers и reconciliation;
- off-host backup, RPO/RTO, capacity/worker/alerting evidence;
- physical iOS/Android, Firefox/WebKit и screen-reader acceptance;
- OS security updates и согласованное reboot window на VPS.

Технический `200` и успешная сборка не закрывают эти gates.
