# Production readiness scaffolds

After the repository split, API/database/worker validators are executed in `meal_backend` using its README. The manifests kept here document provider-neutral frontend release requirements; they do not provision infrastructure or inspect a sibling checkout. Their structural validator is owned and executed by this repository.

The repository keeps versioned release manifests in `config/production-readiness`. They remain intentionally `blocked`:
a syntactically valid manifest does not prove a runtime, rollback, external provider, KPI or cacheable route.

- `cache-policy.v1.json` keeps private, security-sensitive and dynamic responses uncached. Only fingerprinted static
  assets have an immutable policy. Public route caching stays empty until a route-by-route data and invalidation review.
- `deployment-strategy.v2.json` records the accepted single-host Docker Compose, GHCR, host-Nginx and immutable-digest
  decisions, schema v29 and the pre-traffic gates. It remains blocked until the container runtime, restricted server
  helper and previous-digest rollback have produced evidence. The v1 file remains historical and is not accepted by the
  current validator.
- `kpi-catalog.v1.json` reserves the approved product-metric groups but defines no KPI, formula, dimension, target or
  privacy threshold without an owner decision and validated data source.
- `browser-support.v1.json` binds automated coverage to Chromium, Firefox and WebKit plus the required physical
  iOS/Android and assistive-technology acceptance. Exact release versions and evidence are recorded only at release.
- `security-headers.v1.json` fixes the minimum HTTPS/header posture and the report-only-to-enforced CSP rollout. Header
  ownership, production origins, report endpoint and an external probe are still required.
- `scheduler.v1.json` mirrors worker topology v1, keeps every task disabled and defines no schedules/provider until
  leases, telemetry and alerting are accepted.
- `payment-methods.v1.json` defines only the safe provider boundary for listing and revoking saved methods. It permits
  opaque provider references and display metadata, never sensitive card data; no user API or UI is implied.

Run `npm run ops:readiness` in `meal_frontend` to validate every manifest. `npm run ops:readiness:require-ready` deliberately returns a non-zero status until later versioned manifests are introduced and approved. The frontend validator proves only the structure and fail-closed status of these manifests; backend schema, grants, workers, Helmet/no-store and backup evidence are independently verified in `meal_backend`. Exact release evidence joins those results without a filesystem dependency between repositories.

The payment-method boundary intentionally stops before an HTTP contract. Provider selection must confirm whether
listing is authoritative at the provider or synchronized locally, what identifier can be detached, and how an unknown
detach result is reconciled. Only then may a separately reviewed user API and UI be added. Revocation must preserve
historical payments and must not be treated as a refund or subscription cancellation.

Deployment order is fail closed: verify the immutable artifact and schema-v29 compatibility, keep workers disabled,
verify headers and browser evidence on the inactive slot, prove backup/restore evidence, then perform a manually
verified traffic switch. The manifests do not execute any of these steps.

## Read-only production browser acceptance

The frontend production-acceptance runner `node scripts/production-acceptance.mjs` only prints a blocked plan by default. Supplying `--target target.json` validates and
prints a plan, but still does not start a browser. A run requires all of `--execute`, `--target` and a new `--output`
path. The target must contain three exact public HTTPS origins, exact release versions, an acknowledgement timestamp and
`allowMutations: false`.

During an explicit run, every non-GET/HEAD/OPTIONS request is aborted and makes the run fail. The runner uses anonymous
browser contexts, stores no credentials and writes a contract-compatible evidence object only when all checks pass.
Never point the existing mutation-oriented `e2e` suite at production. Full release, smoke and rollback steps are in `DEPLOYMENT.md`.
