# BACKEND_RECORDING_WEB_PHASE1_CODEX_PLAN.md

| Field | Value |
| --- | --- |
| Status | `proposed` |
| Role | `phase 1 execution brief for Codex` |
| Scope | 기록 웹 정상화에 필요한 백엔드 1차 구현 범위 |
| Out of scope | 커뮤니티, 티어 보드, 인사이트, 공개 프로필, 공개 집계 |
| Principle | 프론트는 최소 수정, 기존 local-first 구조 유지 |

## 1. Goal

이 문서의 목적은 Work Archive를 **기록 웹으로서 안정적으로 동작하게 만드는 1차 백엔드 작업 범위**를 정의하는 것이다.

현재 프로젝트는 이미 local-first 구조와 기본 API를 갖고 있다. 따라서 1차 목표는 새 기능을 크게 늘리는 것이 아니라 아래를 안정화하는 데 있다.

- 작품 추가
- 작품 조회
- 작품 수정
- 작품 삭제 및 복원
- 로그인 후 기록 지속
- sync push / pull 안정성
- guest -> account 전환 시 기록 보존

즉, 이번 단계의 성공 기준은 **사용자가 자신의 기록을 잃지 않고, 로컬과 서버 사이에서 일관되게 기록을 관리할 수 있는가**다.

---

## 2. Product Rule For Phase 1

이번 단계에서는 아래 규칙을 고정한다.

### Keep

- local-first 구조 유지
- 프론트의 IndexedDB 중심 저장 구조 유지
- `Works` flat API compatibility layer 유지
- guest archive / user archive 분리 구조 유지
- 수동 sync 구조 유지

### Do Not Expand Yet

- 커뮤니티 기능
- 티어 보드 실기능
- 인사이트 고도화
- 공개 프로필 / 공개 기록
- 자동 sync
- 다중 디바이스 고급 정책
- 대규모 shared public catalog 전략

즉, 이번 단계는 **기록 기능 안정화**만 본다.

---

## 3. Phase 1 Success Criteria

아래 시나리오가 모두 안정적으로 통과해야 한다.

### Core Record Flow

1. 로그인 사용자가 작품을 생성할 수 있다.
2. 생성한 작품이 목록과 상세에 즉시 반영된다.
3. 작품을 수정하면 목록/상세/sync payload가 일관되게 갱신된다.
4. 작품 삭제 시 soft delete 처리되고 active 목록에서 사라진다.
5. 삭제된 작품은 서버/로컬 기준이 일치한다.

### Session / Auth Flow

6. 로그인 후 새로고침해도 세션이 복구된다.
7. access token 만료 후 refresh 흐름이 동작한다.
8. 로그아웃 후 인증이 필요한 API가 차단된다.

### Sync Flow

9. 로컬 create/update/delete queue가 서버에 push 된다.
10. 서버 pull 결과가 로컬 기록과 충돌 없이 반영된다.
11. 중복 push, 재시도, 이미 반영된 변경에 대해 idempotent 하게 동작한다.
12. 충돌 시 최소한 현재 구조에서 해석 가능한 일관된 conflict 응답을 돌려준다.

### Guest Transfer Flow

13. guest 기록이 존재하는 상태에서 로그인하면 user archive로 안전하게 넘길 수 있다.
14. guest import 이후 중복/누락/잘못된 queue 상태가 남지 않는다.

---

## 4. Work Priority Order

Codex 작업 우선순위는 반드시 아래 순서를 따른다.

### Priority A — Must stabilize first

1. `WorksModule`
2. `SyncModule`
3. `AuthModule`
4. `Guest transfer path` 관련 서버 계약 점검

### Priority B — After A is stable

5. `ImportsModule` 최소 구현

### Priority C — Explicitly deferred

6. community / public / tier / insights 확장
7. full public catalog 전략
8. auto sync

---

## 5. Codex Task Breakdown

## Task 1. Freeze The Current API Contract

### Objective

현재 프론트가 의존하는 기록 API 계약을 1차 기준으로 고정한다.

### Required endpoints

- `GET /api/works`
- `GET /api/works/:id`
- `POST /api/works`
- `PATCH /api/works/:id`
- `DELETE /api/works/:id`
- `POST /api/sync/push`
- `POST /api/sync/pull`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Codex instructions

- Do not redesign the outward `works` response shape in phase 1.
- Keep flat response compatibility for frontend safety.
- Add or update DTO tests if needed, but do not break the current contract unless absolutely required for correctness.

### Exit criteria

- Swagger and tests clearly define current request/response shapes.
- No accidental response-shape regressions.

---

## Task 2. Harden `WorksModule` For Record Integrity

### Objective

기록 CRUD의 서버 동작을 예측 가능하고 안정적으로 만든다.

### Required work

- verify create / read / update / delete behavior against `UserWorkRecord` + `CatalogWork` split model
- ensure `findAll` only returns active records
- ensure `findOne` rejects deleted records
- ensure `remove` is soft delete only
- verify update with empty payload returns current record safely
- validate title normalization and empty-title rejection consistently
- confirm unauthorized access to another user's record is impossible

### Tests to add or reinforce

- create work success
- create work rejects blank title
- list returns only current user's active works
- get one rejects deleted record
- update increments `serverVersion`
- delete sets `deletedAt`
- another user cannot read/update/delete the record

### Exit criteria

- `works.e2e-spec` covers full CRUD and ownership rules.
- `works.service.spec` covers transformation and update edge cases.

---

## Task 3. Harden `SyncModule` For Local-First Reliability

### Objective

로컬 큐 기반 sync가 기록 웹의 핵심 동작으로서 안정적으로 동작하게 만든다.

### Required work

- verify push ordering by `createdAt`
- verify duplicate push becomes no-op or already-applied result where appropriate
- verify missing remote record handling for create/update/delete
- verify `serverVersion` and `updatedAt` conflict policy remains consistent
- verify tombstone sync behavior for deleted records
- verify pull returns deterministic `nextSince`
- ensure sync responses are explicit enough for frontend queue cleanup

### Tests to add or reinforce

- push create from local-only record
- push update for existing record
- push delete tombstone
- push same change twice -> applied / no-op semantics remain stable
- conflict when server version is newer
- pull since returns only records newer than cursor
- pull includes deleted records as delete operations

### Important constraint

Do not implement auto sync in phase 1.

### Exit criteria

- sync e2e tests cover create/update/delete/conflict/no-op paths.
- queue cleanup can be driven by stable server responses.

---

## Task 4. Stabilize Auth Around Session Continuity

### Objective

기록이 계정과 연결되는 경험이 끊기지 않도록 인증과 세션 복구를 안정화한다.

### Required work

- verify refresh cookie issuance on register/login/refresh
- verify `me` endpoint under valid access token
- verify logout invalidates refresh path
- ensure expired or invalid refresh token returns clean unauthorized response
- keep current structure: access token response + refresh cookie

### Tests to add or reinforce

- register returns session response and sets cookie
- login returns session response and sets cookie
- refresh rotates session correctly
- invalid refresh token rejected
- logout clears cookie and invalidates session
- `me` requires valid bearer token

### Exit criteria

- refresh-based session recovery is reliable.
- auth failure cases are explicit and consistent for frontend handling.

---

## Task 5. Verify Guest -> Account Transfer Server Assumptions

### Objective

guest에서 로그인 사용자로 기록을 넘기는 과정에서 서버와 충돌하지 않도록 계약을 점검한다.

### Required work

- inspect current transfer/import contract expectations from frontend
- ensure imported records can be pushed without broken ownership or version assumptions
- document duplicate-handling rule for phase 1
- if needed, add a minimal server-side helper endpoint only when current contract is insufficient

### Phase 1 rule

중복 병합을 복잡하게 자동화하지 않는다. 우선은 **안전한 import와 명시적 충돌 회피**가 우선이다.

### Exit criteria

- guest-imported records can sync to the authenticated user safely.
- no orphaned ownership or invalid record version state remains after transfer.

---

## Task 6. Add Minimal Observability For Debugging

### Objective

기록 유실처럼 보이는 문제를 추적하기 쉽게 만든다.

### Required work

- add structured logs for sync push / pull summary
- log auth refresh failures at an actionable level
- log work create/update/delete failure reasons
- keep logs privacy-safe and avoid dumping sensitive review content or raw tokens

### Exit criteria

- common failure paths can be diagnosed from local server logs.

---

## 6. Test Matrix Codex Must Complete

Codex should not stop at implementation. It must leave the repository with reinforced tests.

### Backend test minimum

#### Works

- create success
- create invalid input
- list scoped by user
- get one scoped by user
- update success
- update invalid input
- delete success
- deleted record hidden from active reads

#### Auth

- register
- login
- refresh
- invalid refresh
- logout
- me authorized / unauthorized

#### Sync

- push create
- push update
- push delete
- pull since
- conflict response
- duplicate/no-op semantics

### Command expectation

- `npm run test --workspace @work-archive/api`
- `npm run test:e2e --workspace @work-archive/api`

Codex should aim to keep `typecheck`, `test`, and e2e green for the API workspace before moving to phase 2.

---

## 7. Non-Goals For This Phase

Codex must explicitly avoid the following unless a bug fix absolutely requires touching them.

- redesigning frontend routes
- replacing local-first architecture with server-first architecture
- changing IndexedDB ownership model
- introducing community/public schemas
- building ranking/tier/community APIs
- implementing fully shared multi-user catalog semantics
- adding automatic merge intelligence for guest transfer

---

## 8. Recommended Execution Order For Codex

1. Inspect current backend tests and identify missing coverage.
2. Stabilize `WorksModule` and expand CRUD/ownership tests.
3. Stabilize `SyncModule` and expand conflict/no-op tests.
4. Stabilize `AuthModule` session recovery behavior and tests.
5. Verify guest transfer assumptions and patch minimal gaps only.
6. Add logs and final cleanup.
7. Run API test suite and e2e suite.
8. Produce a short implementation summary with:
   - files changed
   - contract changes
   - risk notes
   - deferred items

---

## 9. Definition Of Done

Phase 1 is done when all conditions below are true.

- The recording web can reliably create, read, update, and soft-delete records.
- Authenticated sessions can be recovered through refresh flow.
- Local queued changes can sync without frequent ambiguity.
- Conflicts produce explicit, stable responses.
- Guest-to-account transfer does not obviously corrupt ownership or version state.
- Backend tests meaningfully protect the above behavior.
- No community/public expansion work was mixed into this phase.

---

## 10. One-Line Instruction For Codex

> Make the existing record web reliable before making it bigger. Preserve the current frontend contract, keep the local-first architecture, and harden works/auth/sync flows with tests before building any expansion features.
