# VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md

## 문서 목적
이 문서는 Work Archive를 **개인 기록 중심의 local-first 앱**에서, 향후 **공용 작품 카탈로그 / 공개 프로필 / 작품 집계 / 커뮤니티 / 티어 보드**까지 수용할 수 있는 서비스로 확장하기 위한 제품-도메인-운영 통합 아키텍처를 정의한다.

이 문서는 특히 다음 질문에 답한다.
- 왜 개인 기록과 공용 카탈로그를 분리해야 하는가
- 왜 UGC 검증 파이프라인이 필요한가
- 현재 Work Archive 구조에 어떤 방식으로 가장 안전하게 도입할 수 있는가
- 보안, 운영, 악성 행위 대응, 감사, 롤백, 확장성까지 고려한 구조는 무엇인가

이 문서는 현재 코드 현실을 직접 설명하는 문서가 아니라, **현재 구조를 존중하면서 다음 단계의 제품 아키텍처를 고정하는 제품 설계 문서**다.

---

## 1. 핵심 정의

### 1-1. 제품의 두 평면
Work Archive는 앞으로 아래 두 평면을 분리해서 다뤄야 한다.

#### A. Personal Archive Plane
개인 기록 레이어다.
- 내가 본 작품
- 내 상태
- 내 별점
- 내 한줄평 / 리뷰
- 내 즐겨찾기
- 내 티어 보드 연결
- local-first 저장과 sync의 대상

#### B. Shared Catalog Plane
서비스 전체가 공유하는 공용 작품 레이어다.
- canonical 작품 메타데이터
- 제목 / 원제 / 별칭
- 저자 / 제작진 / 스튜디오
- 타입 / 연재 상태 / 권수 / 화수
- 외부 source 식별자
- 작품 집계와 공개 레이어의 기준 entity

핵심 원칙은 다음과 같다.

> 개인 기록은 즉시 저장 가능해야 하고,
> 공용 카탈로그는 검증된 데이터만 승격되어야 한다.

즉, **sync는 개인 데이터 정합성 문제**이고, **promotion은 공용 데이터 신뢰도 문제**다. 둘은 같은 파이프라인이 아니다.

---

## 2. 현재 구조와 왜 잘 맞는가

Work Archive는 이미 다음 특징을 갖고 있다.
- local-first 구조
- guest / authenticated archive 분리
- IndexedDB + sync queue
- 수동 sync와 conflict handling
- 향후 Catalog / UserRecord / Import / PublicLayer / TierBoard 분리 지향

따라서 새 구조는 기존 앱을 부정하는 것이 아니라, **현재 구조 위에 공용 카탈로그 계층을 추가하는 방향**으로 설계해야 한다.

---

## 3. 새 아키텍처의 한 줄 정의

**Verified Catalog Promotion Pipeline on top of a Local-first Personal Archive**

즉,
- 개인 기록은 자유롭고 빠르게 저장한다.
- 공용 카탈로그는 source-backed verification, trust-weighted consensus, moderation-by-exception, revision history, audit trail을 통해서만 승격한다.

---

## 4. 핵심 문제 정의

UGC 기반 카탈로그 시스템은 아래 딜레마를 갖는다.

### 4-1. 자유도 vs 오염도
유저가 자유롭게 작품을 만들 수 있으면 빠르게 데이터가 쌓이지만,
- 장난 입력
- 오타
- 중복 작품
- 스팸 / 봇
- 악성 수정

같은 문제가 함께 들어온다.

### 4-2. 관리자의 병목
모든 작품 등록을 관리자가 승인해야 하면,
- 등록이 느려지고
- 운영 리소스가 늘어나고
- 제품 성장성이 급격히 떨어진다.

### 4-3. Work Archive에 맞는 정답
Work Archive는 **개인 기록 앱의 자유도**를 유지해야 하므로,
사용자가 작품을 기록하는 행위 자체를 막으면 안 된다.

따라서 정답은,
- 개인 기록은 즉시 저장
- 공용 카탈로그 등재는 별도 승격 파이프라인

으로 분리하는 것이다.

---

## 5. 핵심 설계 원칙

### 5-1. 개인 기록은 canonical work가 없어도 저장 가능해야 한다
카탈로그에 아직 없는 작품이어도 사용자는 기록할 수 있어야 한다.

### 5-2. 공용 카탈로그는 별도 엔티티다
개인 기록 모델과 공용 작품 모델을 섞지 않는다.

### 5-3. 검증은 boolean이 아니라 상태 머신이다
`is_public` 같은 단일 플래그로는 운영이 불가능하다.

### 5-4. 검증은 source / consensus / moderation을 결합한다
- 신뢰 가능한 source proof
- 다수 유저의 반복 제안
- 운영자의 예외 처리

### 5-5. 운영자는 모든 입력을 승인하지 않는다
운영자는 **모호성 해소와 악성 행위 대응**만 담당한다.

### 5-6. 모든 공용 변경은 되돌릴 수 있어야 한다
canonical metadata는 revision / rollback / audit trail을 가져야 한다.

---

## 6. 도메인 구조

### 6-1. Personal Archive Plane
핵심 엔티티:
- UserWorkRecord

책임:
- 상태
- 별점
- 한줄평
- 리뷰
- 즐겨찾기
- 공개 범위
- soft delete
- sync status

### 6-2. Shared Catalog Plane
핵심 엔티티:
- CanonicalWork
- WorkAlias
- CanonicalWorkContributor
- CanonicalWorkSource

책임:
- 작품 canonical metadata 관리
- 검색 기준 데이터 제공
- 공개 집계의 기준 entity 역할

### 6-3. Promotion Pipeline Plane
핵심 엔티티:
- CatalogSubmission
- CatalogSubmissionProof
- SubmissionSupport

책임:
- 유저 또는 외부 소스 기반 작품 후보 입력
- proof 검증
- dedupe
- consensus score 계산
- moderation queue 연결

### 6-4. Governance Plane
핵심 엔티티:
- CanonicalWorkRevision
- AuditEvent

책임:
- 공용 메타데이터 변경 이력
- rollback
- 운영 추적
- abuse 대응 근거 보관

---

## 7. 상태 머신 설계

### 7-1. CatalogSubmission 상태
권장 상태:
- submitted
- proof_pending
- proof_verified
- proof_failed
- dedupe_pending
- consensus_pending
- review_required
- approved
- merged
- rejected
- suppressed

설명:
- `submitted`: 새 후보가 들어온 상태
- `proof_pending`: source 검증 진행 중
- `proof_verified`: 외부 source proof 확보
- `proof_failed`: source proof 실패
- `dedupe_pending`: 기존 canonical work와 중복 검사 중
- `consensus_pending`: source는 약하지만 다수 유저 신호를 대기하는 상태
- `review_required`: 자동 판정 불가, 운영자 판단 필요
- `approved`: 새 canonical 생성 승인
- `merged`: 기존 canonical에 병합
- `rejected`: 거절
- `suppressed`: 스팸 / 악성 입력으로 차단

### 7-2. CanonicalWork 상태
권장 상태:
- active
- deprecated
- merged
- quarantined
- tombstoned

### 7-3. CanonicalWorkRevision 상태
권장 상태:
- proposed
- trusted_auto_apply
- needs_review
- applied
- rolled_back
- rejected

---

## 8. 승격 파이프라인 상세

### Step 1. Local Archive Sandbox
사용자는 작품을 바로 기록할 수 있다.

핵심 원칙:
- 개인 기록은 즉시 저장
- canonical 등록 실패가 개인 기록 저장 실패로 이어지지 않음
- `내 기록 저장`과 `공용 작품 제안`은 UX 상에서도 구분됨

### Step 2. Source-backed Verification
공용 작품 제안은 source-backed verification을 우선한다.

권장 전략:
- allowlist 기반 source만 1차 신뢰 소스로 인정
- 공식 API가 있으면 API 우선
- 없으면 source adapter 기반 스크래핑
- source별 parsing / mapping 규칙 분리
- 결과는 proof record로 남김

예상 source 예시:
- 네이버 시리즈
- 카카오페이지
- 문피아
- 리디
- Google Books
- AniList
- TMDB

### Step 3. Dedupe + Risk Scoring
제안 데이터는 바로 canonical로 만들지 않고,
중복 / 악성 / 오탐 가능성을 점수화한다.

권장 계산 요소:
- normalized title / author / type fingerprint
- alias similarity
- source entity id
- fuzzy match
- account age
- reputation
- 동일 IP / 동일 device cluster 패널티
- 제출 빈도 이상치

결과:
- confidenceScore
- riskScore
- duplicateCandidateScore

### Step 4. Trust-weighted Consensus
source proof가 약한 경우에는 community signal을 사용한다.

권장 방식:
- 단순 인원 수가 아니라 가중치 기반 점수
- 예: 신규 계정은 낮은 점수, 정상 활동 유저는 기본 점수, trusted editor는 높은 점수
- source proof와 community support를 함께 계산

예:
- 공식 source proof + 고신뢰 match → 자동 approve
- source 없음 + 반복 제안 다수 → review queue
- riskScore 높음 → suppressed

### Step 5. Moderation by Exception
운영자는 모든 제안을 승인하지 않는다.
운영자는 아래만 다룬다.
- merge ambiguity
- duplicate resolution
- abuse response
- source mismatch
- ambiguous metadata

즉, 관리자 큐는 **승인 대기열**이 아니라 **예외 처리 큐**여야 한다.

### Step 6. Revision / Rollback / Governance
공용 메타데이터 변경은 revision 기반으로 처리한다.

권장 원칙:
- append-only revision
- trusted 범위의 변경만 auto-apply
- moderator / trusted editor / system worker action은 audit log 기록
- rollback 가능
- abusive edit는 bulk revert 가능

---

## 9. 보안 설계 원칙

### 9-1. 인증 / 세션
- refresh token은 localStorage 대신 HttpOnly cookie 기반으로 전환하는 것을 목표로 한다.
- refresh rotation과 device/session 단위 관리가 필요하다.
- access token 수명은 짧게 유지한다.

### 9-2. API 보호
- submission / support / revision propose endpoint는 authenticated only
- moderation endpoint는 moderator only
- 로그인 / 회원가입 / refresh / submission create에 rate limit 적용
- catalog submission에는 quota와 abuse detection 적용

### 9-3. Scraper / Adapter 보안
- arbitrary URL fetch를 허용하지 않는다.
- source allowlist 기반으로만 outbound request 수행
- timeout, retry, circuit breaker 적용
- SSRF 방어

### 9-4. 감사 / 추적
- requestId
- actor / target / action 기준 audit trail
- IP / user-agent는 raw 보관보다 hash 기반 저장 선호

---

## 10. 운영 설계 원칙

### 10-1. Observability
필수 항목:
- structured logging
- requestId
- submission lifecycle logs
- worker job logs
- moderation decision logs
- promotion success/failure metrics
- queue backlog metrics

### 10-2. Jobs / Queue
승격 파이프라인은 동기 요청 처리로 끝내지 않는다.

필수 job 예시:
- source verification job
- dedupe scoring job
- consensus aggregation job
- moderation notification job
- source revalidation job
- rollback repair job

### 10-3. 장애 대응
- source adapter 장애 시 degraded mode 허용
- verification failure와 source unavailable을 구분
- dead-letter queue
- retry / exponential backoff
- idempotent promotion 처리

### 10-4. 데이터 수명주기
- rejected / suppressed submission retention policy
- tombstoned canonical work 처리 기준
- deleted personal record와 public aggregate 분리

---

## 11. UX / 제품 흐름

### 11-1. 작품 추가 기본 흐름
최종 UX 원칙:

**검색 → 선택 → 자동 채움 → 개인 기록 입력 → 저장**

### 11-2. 실제 시나리오

#### Case A. canonical work가 이미 있는 경우
- canonical 검색
- 선택
- 개인 기록만 입력
- 저장

#### Case B. 외부 source 후보가 있는 경우
- 외부 후보 선택
- 자동 채움 확인
- 개인 기록 저장
- 서버는 canonical match / create 처리

#### Case C. 아무 후보가 없는 경우
- 직접 입력
- 개인 기록 저장
- 별도로 “공용 작품 제안” 가능

핵심 원칙:
- 공용 카탈로그 제안 실패가 개인 기록 저장 실패로 이어지면 안 된다.

---

## 12. API 경계 원칙

### 12-1. 기존 영역 유지
- `/api/works`: 개인 기록 CRUD
- `/api/sync/*`: 개인 기록 sync

### 12-2. 신규 영역
- `/api/catalog/*`: canonical work 검색 / 조회 / 제안 / revision
- `/api/moderation/*`: review / merge / reject / suppress / audit
- `/api/public/*`: 공개 작품 페이지 / 공개 프로필 / 공개 집계

핵심 원칙:
- `works`는 개인 기록 API다.
- `catalog`는 공용 카탈로그 API다.
- 두 영역은 책임이 다르다.

---

## 13. 단계별 구현 전략

### Phase 1. 도메인 분리 시작
- 기존 works 테이블은 개인 기록 의미로 재해석
- CanonicalWork / WorkAlias / CanonicalWorkSource 추가
- UserWorkRecord에 canonicalWorkId nullable 연결

### Phase 2. Catalog-first Quick Add
- canonical search API
- source adapter 최소 버전
- submission create API

### Phase 3. Promotion Pipeline 최소 구현
- CatalogSubmission
- CatalogSubmissionProof
- SubmissionSupport
- submission status machine

### Phase 4. Governance / 운영 강화
- CanonicalWorkRevision
- AuditEvent
- moderation API
- logging / metrics / queue 운영

### Phase 5. Public Layer 연결
- public work page
- aggregate API
- public profile / tier board 연결 기반 마련

---

## 14. 이 구조가 Work Archive에 주는 가치

### 14-1. 기록 UX를 해치지 않는다
개인 기록은 지금처럼 빠르고 자유롭게 유지된다.

### 14-2. 공용 데이터 품질을 높인다
카탈로그 오염을 방지하면서도 관리자 병목을 줄인다.

### 14-3. 향후 기능의 기반이 된다
- 공개 프로필
- 작품별 평균 별점
- 대표 한줄평
- 커뮤니티 허브
- 티어 보드 연결

### 14-4. 운영이 가능한 구조가 된다
단순 기능 구현이 아니라,
- 보안
- 감사
- 롤백
- 악성 대응
- 장애 대응

까지 포함한 서비스형 구조가 된다.

---

## 15. 최종 결론

Work Archive는 앞으로 다음 원칙을 제품 구조의 기준으로 삼는다.

1. 개인 기록과 공용 카탈로그를 분리한다.
2. 개인 기록은 local-first와 sync 중심으로 유지한다.
3. 공용 카탈로그는 검증 가능한 승격 파이프라인을 통해서만 생성/수정된다.
4. 운영자는 모든 입력을 승인하는 사람이 아니라, 예외를 처리하는 사람이다.
5. 모든 공용 변경은 revision / rollback / audit가 가능해야 한다.
6. 이 구조는 향후 공개 레이어와 커뮤니티 확장의 기반이 된다.

이 문서는 이후 Prisma 스키마 설계, 상태 전이표, API 경계 설계, moderation 정책, worker job 설계의 기준 문서로 사용한다.
