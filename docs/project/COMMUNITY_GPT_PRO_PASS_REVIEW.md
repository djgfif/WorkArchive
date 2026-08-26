# Community GPT Pro PASS Review

<!-- prettier-ignore -->
| Field | Value |
| --- | --- |
| Status | `OPEN — current working tree requires fresh runtime, browser, and GitHub CI evidence` |
| Role | `adversarial acceptance rubric and recursive-improvement record` |
| Scope | `Community alpha UI, design, function, accessibility, privacy, security, scalability, and operations` |
| Source of truth | current repository tree, `COMMUNITY_ALPHA_PLAN.md`, public permission boundary; evidence is valid only for its recorded commit |
| When to update | any Community behavior, permission, UI, moderation, pagination, release evidence, or review verdict changes |

## Verdict Rule

`PASS` is allowed only when every `P0` and `P1` row below has direct current
evidence, no unresolved high-impact finding remains, desktop and mobile core
flows pass in a real browser, and repository gates pass on the reviewed tree. A
test, document, screenshot, or static checker proves only the behavior it
actually exercises. Missing, indirect, mock-only, or stale evidence is `OPEN`,
not a pass.

Verdicts:

- `PASS`: current direct evidence proves the requirement.
- `FAIL`: current evidence contradicts the requirement.
- `OPEN`: evidence is missing, indirect, mock-only, or blocked.
- `N/A`: explicitly out of approved alpha scope with a documented reason.

## Current Review Reset — 2026-08-26

The historical rounds below remain useful evidence for the commits they named,
but they do not prove the current working tree. The release profile now changes
at container startup, the web/API profile match is health-checked, and revoked
Community APIs have a distinct user-facing state. Every rubric row is reset to
`OPEN` until the final commit passes fresh repository, container, browser, and
GitHub checks.

## Acceptance Rubric

| ID       | Priority | Area                       | PASS requirement                                                                                                                                                        | Required evidence                                                                       | Verdict |
| -------- | -------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------- |
| UX-01    | P0       | First visit                | A guest understands the feed, privacy boundary, and how to participate without guessing.                                                                                | Desktop and mobile first-visit screenshots plus CTA navigation check.                   | OPEN    |
| UX-02    | P1       | Core flow                  | Signed-in publish, reaction, report, delete, spoiler reveal/hide, sorting, pagination, retry, empty, and error states are usable and recoverable.                       | Browser flow against migrated API; focused interaction tests.                           | OPEN    |
| UX-03    | P1       | Trust                      | The composer shows exactly what becomes public before publication and never implies that the private archive is uploaded.                                               | Composer screenshot and request-payload assertion.                                      | OPEN    |
| UI-01    | P1       | Responsive UI              | No clipping, horizontal overflow, hidden action, or overlapping fixed navigation at 1440x900, 1024x768, 390x844, and 320x568.                                           | Current screenshots and DOM overflow measurements at every viewport.                    | OPEN    |
| UI-02    | P1       | Visual hierarchy           | Page purpose, composer/guest CTA, feed controls, post identity, content, spoiler boundary, and actions have a clear reading order in light and dark themes.             | Current paired screenshots and token inspection.                                        | OPEN    |
| UI-03    | P2       | Consistency                | Community uses Studio tokens, rationed indigo, rating-only amber, Pretendard/JetBrains Mono, and existing primitives.                                                   | CSS/source inspection and rendered screenshots.                                         | OPEN    |
| A11Y-01  | P0       | Keyboard and semantics     | Every control is keyboard reachable with a visible focus state; tabs, menus, switches, spoiler state, busy state, and feedback expose meaningful semantics.             | Keyboard walkthrough, DOM/accessibility inspection, automated checks where available.   | OPEN    |
| A11Y-02  | P1       | Reflow and targets         | Content reflows at 320px and interactive targets remain usable without precision tapping.                                                                               | Mobile screenshots and target-size measurements.                                        | OPEN    |
| A11Y-03  | P1       | Perception                 | Text/action contrast, spoiler concealment, image alternatives, and state changes do not rely on color alone.                                                            | Screenshot inspection plus semantic/source checks.                                      | OPEN    |
| FUNC-01  | P0       | Publication                | Only a newly authored body, explicit spoiler flag, and optional bounded work snapshot can be published.                                                                 | API DTO/service tests and captured request payload.                                     | OPEN    |
| FUNC-02  | P0       | Authorization              | Guest writes fail; delete is author-only; reactions are current-user idempotent; report and moderation rules cannot be bypassed.                                        | Controller/e2e tests against migrated runtime plus service tests.                       | OPEN    |
| FUNC-03  | P1       | State integrity            | Concurrent hide/restore/report resolution cannot create contradictory state or duplicate effective moderation decisions.                                                | Conditional-write implementation and concurrency-focused tests.                         | OPEN    |
| FUNC-04  | P1       | Feed correctness           | Latest/popular pagination has deterministic ordering, no duplicate rendering, and defined behavior when scores change.                                                  | Query tests with tied timestamps/scores and browser pagination check.                   | OPEN    |
| SEC-01   | P0       | Private boundary           | Community cannot read, infer, or publish private archive IDs, reviews, ratings, progress, tags, sync state, credentials, sessions, or raw user IDs.                     | Public response/payload tests and permission-boundary gate.                             | OPEN    |
| SEC-02   | P0       | Untrusted content          | Text renders without HTML execution; remote thumbnails cannot make readers contact an author-controlled host or reach private networks.                                 | Source-backed dataflow review and hostile URL tests.                                    | OPEN    |
| SEC-03   | P0       | Abuse resistance           | Public reads and every mutation have bounded input, rate limits, duplicate/report constraints, and fail-closed storage behavior.                                        | Runtime configuration, middleware tests, DTO tests, and 429 smoke evidence.             | OPEN    |
| SEC-04   | P1       | Moderation audit           | Moderator-only transitions are atomic, auditable, append-only through product APIs, and do not grant private-record access.                                             | Authorization and transaction tests; BOLA/public-boundary gates.                        | OPEN    |
| SEC-05   | P1       | Account lifecycle          | Community foreign keys and audit retention do not unexpectedly block account deletion or erase evidence contrary to policy.                                             | Migration/schema review and account-deletion integration test.                          | OPEN    |
| SCALE-01 | P1       | Query scale                | Feed/reports use bounded page sizes and indexes that match filters/order; no unbounded related-row loads occur.                                                         | Query/schema inspection and representative query plan or migrated integration evidence. | OPEN    |
| SCALE-02 | P1       | Client scale               | Large local libraries and long feeds avoid unbounded UI work, duplicate posts, stale async overwrites, and one global busy lock across unrelated cards.                 | Focused tests and browser run with representative volume.                               | OPEN    |
| SCALE-03 | P2       | Evolution                  | Community remains feature-bounded; API types, persistence, moderation, and UI can evolve without importing private feature internals or breaking local-first ownership. | Boundary/import-cycle gates and architecture review.                                    | OPEN    |
| OPS-01   | P0       | Release runtime            | The migration applies and guest/authenticated/moderator flows pass against a real PostgreSQL/API runtime.                                                               | Migration command, API health, and browser/e2e evidence for the reviewed tree.          | OPEN    |
| OPS-02   | P1       | Observability and rollback | Rate-limit/moderation failures are observable; retention, takedown, rollback, and operator ownership are documented and exercised.                                      | Release evidence artifacts, runbook, metrics/log checks, rollback rehearsal.            | OPEN    |
| QA-01    | P0       | Repository gates           | Lint, typecheck, unit/integration tests, build, docs, architecture, i18n, migration, authorization, BOLA, and public-repository safety pass.                            | Fresh command output on the final tree.                                                 | OPEN    |

## Recursive Review Log

Each round records `evidence → failure/counterexample → correction → stronger
evidence`. Failed rounds remain visible instead of being rewritten as passes.

### Round 0 — Baseline

- Branch: `codex/community`; clean synchronized baseline: `6d51e224`.
- Docker was unavailable at the start, so runtime evidence was initially
  `OPEN`.
- The independent Codex Security workbench could not create a scan context
  while traversing `apps/site/node_modules/.bin/eslint`. No standalone report
  is claimed from that workflow.

### Round 1 — Adversarial failures

- An author-controlled work thumbnail could make every reader contact an
  arbitrary host. Public image URLs were therefore a reader-side tracking and
  SSRF-boundary failure.
- Moderation transitions used read-then-write logic, allowing two concurrent
  operators to create contradictory or duplicate effective decisions.
- The moderation audit actor foreign key could block account deletion, while
  exports and deletion previews omitted Community-owned data.
- Reaction and moderation `POST` routes documented `200` but emitted Nest's
  default `201`.
- Popular sorting counted related reaction rows at read time; a long feed also
  had stale async response and global busy-state races.
- The UI contained symbol placeholders and ambiguous action labels that did
  not meet the Studio or accessibility bar.

### Round 2 — Corrections

- API publication now rejects unapproved thumbnail hosts and strips URL
  credentials/fragments; the client displays only policy-approved proxied
  images. A hostile tracker URL returns `400`, while an allowed AniList URL is
  normalized before storage.
- Hide, restore, and report resolution use conditional writes. Losing
  transitions create no audit record; repeated hide is idempotent.
- Audit actors are nullable with `ON DELETE SET NULL`; account deletion
  anonymizes retained moderator/audit references, reports Community cascade
  counts, and exports authored posts, reactions, and reports.
- Mutation status codes now match the documented `200` contract.
- `reactionCount` is transactionally maintained and indexed with status,
  creation time, and id. Feed request ids and per-card busy sets prevent stale
  overwrite and unrelated-card locking.
- Composer copy explicitly previews the public fields. Placeholder symbols
  were replaced with clear Korean labels, real product primitives, or omission
  when no asset exists.
- Runtime and build-tool dependency pins were advanced to patched releases. A
  clean `npm ci` reproduces both full-tree and production-only `npm audit`
  results with zero vulnerabilities.

### Round 3 — Runtime, scale, and browser proof

- PostgreSQL applied all 37 migrations. Integration and API e2e suites passed
  against the migrated database.
- Live HTTP checks proved guest read `200`, guest write `401`, hostile thumbnail
  `400`, cross-owner delete `404`, idempotent reactions, self-report rejection,
  moderator queue visibility, hide/restore/resolve, and owner deletion.
- Request 121 in the guest mutation rate-limit burst returned `429` with limit,
  remaining, and reset headers. A structured `http.rate_limit_exceeded`
  security event was persisted.
- With 10,000 valid UUID posts, browser pagination grew from 20 to 40 without
  duplicates. PostgreSQL used covering index-only scans for popular and latest
  feeds; measured execution was `0.052 ms` and `0.036 ms`, respectively.
- Browser artifacts `04`–`10` cover guest/authenticated, dark/light, desktop,
  1024px, 390px, 320px, spoiler, loading, empty, error, and retry-recovery
  states. Measured horizontal overflow was zero at every required viewport.
- Primary targets measured at least 44px; spoiler reveal measured 49.25px.
  The accessibility tree exposed named headings, links, buttons, tabs,
  combobox, textbox, switch, spoiler, and reaction states. The selected-browser
  keyboard probe exposed the 2px indigo focus outline; roving tab focus is the
  only intentional `tabIndex=-1` state.
- Stopping the API after a loaded page produced the bounded Korean timeout
  state and `다시 시도`; restarting the healthy API and activating retry
  restored the feed.
- A transactional rollback rehearsal on the disposable integration database
  removed both new schema changes, verified absence, rolled back, and verified
  `reactionCount` and nullable audit actors were restored.
- Synthetic runtime users and their cascaded Community rows were deleted after
  verification; the cleanup query returned zero matching rows.

### Round 4 — Final repository gates

- `npm run lint`, `npm run typecheck`, and `npm run test` passed. API: 93 suites
  and 785 tests; web: 80 files and 510 tests; site and shared packages passed.
- Production build and bundle budget passed; the largest JS chunk was 585,138
  bytes against the 650,000-byte limit.
- Web boundaries, import cycles, documentation links, hardcoded-copy checks,
  resource parity, and all 2,506 reviewed translation-pack keys passed.
- Migration safety, input/auth surface, BOLA matrix, public boundary, retention,
  user-data rights, account-deletion rehearsal, production dependency audit,
  and public-repository safety all passed.

### Round 5 — Production-image counterexample and correction

- A clean Docker rebuild exposed a packaging failure that source tests could
  not detect: npm installed `@prisma/adapter-pg` under the API workspace, while
  the runtime image copied only root `node_modules`. The API therefore failed
  fast with `MODULE_NOT_FOUND` and never became healthy.
- The runtime image now copies the pruned API workspace dependencies and runs a
  build-time `require.resolve` assertion from the compiled API path. A fresh
  `docker compose --env-file .env.compose up -d --build` then completed with
  PostgreSQL and API healthy and the web container running.
- The rebuilt `/community` route rendered its named heading with zero browser
  console entries. Artifacts `11`–`12` capture the final Docker-served screen
  before and after dismissing the service-worker update prompt.
- The first rebuilt dependency layer also surfaced high-severity findings in
  development-only tooling. Cloudflare/Vite/Vinext, React server components,
  and affected transitive packages were advanced to patched versions. A clean
  reinstall, full repository test/build, and both audit modes then returned
  zero vulnerabilities.

## Benchmark Decisions

- [GitHub Discussions](https://github.com/orgs/community/discussions): adopted
  immediate topic/participation clarity and feed-adjacent controls.
- [Microsoft Q&A](https://learn.microsoft.com/ko-kr/answers/): adopted explicit
  action hierarchy and recoverable system states.
- [Apple Support Community](https://discussions.apple.com/welcome): adopted a
  readable single-column discussion rhythm and restrained primary CTA.
- Dense category/search structures were not copied because the approved alpha
  does not yet have the content volume needed to justify them. Studio tokens,
  rationed indigo, local-first ownership, and Korean copy remain authoritative.

## Final Verdict

`OPEN`. Historical evidence cannot be promoted across a changed runtime contract.
The current tree needs a successful GitHub verify run plus fresh container and
browser evidence before any row, and therefore the overall review, can return to
`PASS`.
