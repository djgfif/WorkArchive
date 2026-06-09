# Work Archive 개선 실행 로드맵

| 항목 | 내용 |
| --- | --- |
| 작성일 | 2026-06-06 |
| 기준 | 정적 코드 리딩 기반 평가 (빌드/테스트 재현은 미수행) |
| 범위 | 신기능이 아닌 **구조적 부채 상환 + 확장 대비** 중심 |
| 공수 표기 | S = 1~3일, M = 1~2주, L = 2주+ (1인 기준 추정) |

이 로드맵은 부채를 "방치 시 비용이 커지는 순서"로 배열했다. 각 단계는 앞 단계가 끝나야 시작 가능한 게 아니라, **우선순위와 의존성**으로 묶여 있다.

---

## Phase 0 — 즉시 정리 (1~2주, 저위험·고명확성)

레거시 흔적 제거로 의도를 명확히 하고 공격 표면을 줄이는 단계. 기능 변화 없음.

### 0-1. 비밀번호 인증 레거시 제거 — `P1` · `S`

- **대상**: `users.passwordHash`, `users.refreshTokenHash`, `PasswordResetToken` 모델, `/auth/password-reset/*` 라우트(현재 `410 Gone`)
- **이유**: Google OAuth 전용으로 전환 완료. 남은 컬럼/모델은 혼동과 공격 표면.
- **작업**: 미사용 최종 확인 → Prisma migration으로 drop → rate limiter 목록·configure-app에서 password-reset 경로 제거
- **완료 기준**: 스키마에 비밀번호 관련 흔적 0개, 전체 테스트 통과, BOLA/ASVS 문서 동기화
- **위험**: 낮음 (이미 비활성 경로). 단, 마이그레이션 롤백 플랜 준비

### 0-2. 스타일 토큰 단일 소스화 — `P2` · `M`

- **대상**: `global.css` + 페이지별 클래스 + `var(--accent)` 직접 참조 혼재
- **작업**: 디자인 토큰을 한 곳(Mantine theme 또는 CSS 변수 레이어)으로 수렴 → placeholder 화면 정리 또는 명시적 "미구현" 표기
- **완료 기준**: 색·간격·타이포의 단일 출처 확립, 직접 hex/`var(--accent)` 산발 참조 제거
- **비고**: 시각적 일관성 ROI가 가장 높은 항목

---

## Phase 1 — 핵심 부채 상환 (3~5주, 중위험)

가장 큰 구조 부채인 `Works` 호환 계층을 끊는다. 로드맵 전체의 중심.

### 1-1. API 계약 v2 분리 — `P1` · `L`

- **현재 문제**: split domain(Catalog/UserRecord)을 만들었으나 외부 API는 여전히 flat `Work` 계약 + `catalogTitleId → importDraft → legacy fallback` 과도기 경로 유지
- **작업 순서**:
  1. `CatalogTitle`/`UserRecord` 중심 v2 계약 정의 (orval로 클라이언트 재생성)
  2. 프론트 read path를 v2로 전환 (flat `Work` 의존 제거)
  3. create/update path의 `legacy fallback` 분기 제거
  4. v1 계약 deprecation 데드라인 공지 → 제거
- **완료 기준**: `WorksService` 내 compatibility 분기 0개, sync create가 `importDraft` 없이 동작
- **의존성**: 0-1과 병행 가능. 1-2의 선행
- **위험**: 중. 계약 테스트(이미 보유한 `works.e2e-spec`)로 회귀 방어

### 1-2. 카탈로그 1:1 결합 해소 — `P2` · `L`

- **대상**: 현재 catalog가 공유 public catalog가 아니라 user record와 강결합된 1:1 과도기 구조
- **작업**: 동일 작품의 카탈로그 엔트리 공유(dedup/merge) → 검증 상태(`CatalogVerificationStatus`) 활용한 promotion 흐름
- **완료 기준**: 한 `CatalogTitle`에 다수 `UserWorkRecord` 연결, 중복 카탈로그 병합 정책 테스트 고정
- **의존성**: 1-1 이후 권장

---

## Phase 2 — 수평 확장 대비 (2~4주, 다중 인스턴스 배포 직전 필수)

단일 인스턴스에서는 동작하지만, 스케일아웃 시 무력화되는 항목들.

### 2-1. Circuit breaker Redis 전환 — `P1` · `M`

- **현재 문제**: provider 장애 격리가 process-local memory → 다중 인스턴스에서 격리 효과 소실
- **작업**: in-memory circuit state → Redis 공유 상태 (이미 `REDIS_URL` 런타임 의존성 존재)
- **완료 기준**: 인스턴스 간 circuit 상태 공유, 부하 테스트(`qa:sync-load`) 확장 검증
- **트리거**: **수평 확장 배포의 선결 조건**. 단일 인스턴스 운영 중이면 P2로 유보 가능

### 2-2. Rate limiter 분산 백엔드 확인 — `P2` · `S`

- **점검**: `createSecurityRateLimiters`가 인스턴스 로컬 카운터인지 Redis 기반인지 확인 → 로컬이면 우회 가능하므로 Redis store로 전환
- **완료 기준**: 멀티 인스턴스에서 rate limit 일관 적용

---

## Phase 3 — 동기화 고도화 (2~3주, 다기기 사용 증가 시)

### 3-1. 자동 충돌 병합 정책 — `P2` · `M`

- **현재**: SyncPage 수동 해결(로컬 유지/원격 적용/필드 병합)은 구현됨. 자동 판단은 미구현
- **작업**: 필드별 LWW(last-write-wins) 기본값 + 텍스트 리뷰 필드는 수동 예외 → 자동 병합 가능 케이스만 무인 처리
- **완료 기준**: 충돌 자동 병합 케이스 테스트 고정, 수동 해결로 falls back 하는 경계 명확화
- **트리거**: 다기기 동시 편집 빈도 상승 시점

### 3-2. 게스트→계정 자동 병합 / 다기기 이관 UX — `P3` · `M`

- 현재 로그인 직후 review/import 단계까지만. 자동 병합 정책과 이관 UX는 후속

---

## Phase 4 — 운영 검증 (상시)

### 4-1. CI required checks 강제 — `P1` · `S`

- `validate` workflow는 존재하나 required checks 적용은 GitHub 설정 의존 → main 브랜치 보호 규칙으로 강제
- **완료 기준**: lint/typecheck/test/build 미통과 PR 머지 차단

### 4-2. 본인 환경 빌드/테스트 재현 — `P1` · `S`

- 이번 평가는 정적 리딩 기반. 문서상 통과 기록(2026-06-04)을 실제 환경에서 재확인
- **완료 기준**: `npm run lint && typecheck && test && build` + `docker compose` 기동 확인

---

## 우선순위 요약

| 우선순위 | 즉시 착수 | 비고 |
| --- | --- | --- |
| **지금 (P1)** | 0-1 레거시 제거, 1-1 API v2 분리, 4-1 CI 강제, 4-2 환경 재현 | 부채/위험 최대 |
| **다음 (P2)** | 0-2 스타일 토큰, 1-2 카탈로그 분리, 2-1 circuit breaker, 3-1 자동 병합 | 확장·일관성 |
| **이후 (P3)** | 3-2 게스트 병합/이관 | 사용 패턴 의존 |

## 권장 실행 순서

1. **Sprint 1 (2주)**: 0-1 + 4-1 + 4-2 → 빠른 정리·검증으로 기반 확보
2. **Sprint 2~3 (4주)**: 1-1 API v2 (중심 부채) + 0-2 스타일 병행
3. **Sprint 4 (2주)**: 2-1 circuit breaker (스케일아웃 계획 있으면 앞당김)
4. **Sprint 5+**: 1-2 카탈로그 분리, 3-1 자동 병합 (사용 신호 보며)
