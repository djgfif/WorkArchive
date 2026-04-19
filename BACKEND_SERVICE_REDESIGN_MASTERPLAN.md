# BACKEND_SERVICE_REDESIGN_MASTERPLAN.md

## 문서 목적
이 문서는 Work Archive 백엔드를 단순한 기능형 CRUD 서버가 아니라, **실제 웹서비스형 플랫폼 백엔드**로 재설계하기 위한 마스터플랜이다.

현재 백엔드는 다음 수준까지는 이미 도달해 있다.
- NestJS + Prisma + PostgreSQL 기반의 API 서버
- 인증(Auth), 작품(Works), 동기화(Sync), 헬스체크(Health) 구조
- Prisma 마이그레이션, Docker, Swagger, ValidationPipe, 테스트 기반

즉, “동작 가능한 웹앱 백엔드” 수준은 이미 넘어섰다.

그러나 Work Archive의 최종 목표는 단순한 개인 기록 앱이 아니다.
최종적으로는 다음을 수용해야 한다.
- 개인 취향 아카이브
- 검색/가져오기 기반 작품 등록
- 작품 단위 공개 집계
- 티어 보드
- 공개 프로필
- 커뮤니티 확장
- 공유 가능한 미디어 플랫폼

따라서 현재의 백엔드 구조를 그대로 유지한 채 기능만 추가하는 방식으로는 한계가 있다.
이 문서는 그 한계를 정리하고, 향후 어떤 구조로 옮겨가야 하는지를 정의한다.

---

## 1. 현재 백엔드 상태 요약

### 현재 기술 기반
- Framework: NestJS
- ORM: Prisma
- Database: PostgreSQL
- Auth: 이메일/비밀번호 + JWT
- Sync: 로컬 우선 기반 수동 sync
- Docs: Swagger
- Runtime: Docker Compose 기반 로컬 실행 지원

### 현재 모듈 구조
- AuthModule
- WorksModule
- SyncModule
- HealthModule
- PrismaModule

### 현재 장점
1. 동작 가능한 API 서버가 이미 존재한다.
2. 인증, works CRUD, sync가 연결되어 있다.
3. ValidationPipe, Swagger, 헬스체크가 있다.
4. 로컬 우선 프론트와 연결 가능한 서버 역할을 한다.

### 현재 한계
1. 핵심 도메인이 `User + Work`에 과도하게 몰려 있다.
2. 작품 공용 메타데이터와 개인 기록 데이터가 분리되어 있지 않다.
3. 가져오기(import) 기반 UX를 뒷받침할 검색/후보/매칭 백엔드 구조가 없다.
4. 티어 보드, 공개 프로필, 작품 집계, 커뮤니티를 수용할 별도 레이어가 없다.
5. 운영 품질은 기반 수준은 있으나, 플랫폼형 운영 수준까지는 아직 아니다.

---

## 2. 핵심 진단

### 현재 구조의 본질적 문제
현재 `Work` 모델은 다음 두 종류의 데이터를 한 번에 담고 있다.

#### A. 공용 작품 데이터
- 제목
- 작가/원작자
- 장르
- 설명
- 썸네일
- 타입

#### B. 개인 기록 데이터
- 상태
- 별점
- 한줄평
- 리뷰
- 즐겨찾기
- 티어

이 구조는 초기에 빠르게 기능을 만드는 데는 유리했지만, 실제 서비스형 플랫폼으로 가기에는 문제가 크다.

### 왜 문제가 되는가
같은 작품을 여러 사용자가 기록할 수 있는 순간, 아래 요구가 생긴다.
- "원피스"라는 작품은 하나의 공용 작품으로 존재해야 한다.
- 사용자 A와 사용자 B는 같은 작품에 대해 서로 다른 상태/별점/리뷰를 남긴다.
- 작품 단위로 평균 별점, 기록한 사용자 수, 대표 한줄평을 보여주려면 공용 작품 레이어가 있어야 한다.
- 외부 API에서 가져온 메타데이터를 정리하고 canonical 작품으로 확정하는 과정이 필요하다.

즉, 장기적으로는 **작품 자체**와 **내 기록**을 분리해야 한다.

---

## 3. 최종적으로 필요한 도메인 분리

### 3-1. Catalog / Canonical Work Layer
역할:
- 서비스 전체에서 공용으로 참조되는 작품 메타데이터 관리

예상 책임:
- 제목 / 원제
- 표지 / 썸네일
- 작가 / 원작자 / 각색 / 그림 / 제작진
- 장르
- 설명
- 타입
- 권수 / 화수
- 연재 / 완결 상태
- 외부 source 식별자

핵심 원칙:
- 한 작품은 서비스 전체에서 가능한 한 하나의 canonical entity로 유지한다.
- 같은 작품을 여러 유저가 각각 따로 메타데이터를 들고 있지 않게 한다.

---

### 3-2. User Work Record Layer
역할:
- 특정 사용자의 개인 기록 데이터 관리

예상 책임:
- 상태
- 별점
- 한줄평
- 리뷰
- 즐겨찾기
- 공개 여부
- 재감상 여부
- 개인 메모
- 삭제 / 휴지통 상태

핵심 원칙:
- 같은 작품이라도 사용자마다 다른 기록을 가질 수 있다.
- 개인 기록은 공용 작품 데이터와 분리한다.

---

### 3-3. Import / Candidate / Match Layer
역할:
- 외부 API 기반 검색 결과를 서비스 내부 구조로 연결

예상 책임:
- 외부 작품 검색
- 후보 정규화
- 중복 감지
- canonical work와 매칭
- 유저가 최종 후보를 검증/선택한 결과 저장

핵심 원칙:
- 작품 추가 UX는 수동 입력보다 가져오기 중심이어야 한다.
- 백엔드는 이 흐름을 지원하는 검색/후보/매칭 구조를 가져야 한다.

---

### 3-4. Tier Board Layer
역할:
- 티어 보드를 독립 기능으로 관리

예상 책임:
- 티어 보드 생성
- 보드별 공개 범위
- 레인(SSS/S/A 등) 구조
- 작품 항목 배치
- 주제별 보드 관리

핵심 원칙:
- 티어는 작품 필드가 아니라 별도 기능이다.
- 일반 작품 CRUD와 같은 모델로 섞지 않는다.

---

### 3-5. Public Layer
역할:
- 개인 기록을 공개 가능한 레이어로 변환

예상 책임:
- 공개 프로필
- 공개 작품 리스트
- 공개 리뷰 / 공개 한줄평
- 공개 티어 보드
- 공개 범위 정책

핵심 원칙:
- private data와 public presentation을 분리한다.
- 공개는 개인 기록 위에 자연스럽게 얹히는 구조여야 한다.

---

### 3-6. Community / Aggregate Layer
역할:
- 커뮤니티/작품 집계 기능 제공

예상 책임:
- 작품별 기록한 사용자 수
- 평균 별점
- 좋아요 많은 한줄평
- 인기 리뷰
- 공개된 티어 보드 연결
- 추천/인기 집계

핵심 원칙:
- 초기에는 시끄러운 SNS형보다 작품 단위 정보형 허브로 시작한다.
- Aggregate는 별도 질의 모델 또는 별도 서비스 계층을 통해 관리할 가능성을 열어둔다.

---

## 4. 백엔드 구조 재정의 방향

현재 모듈 구조:
- Auth
- Works
- Sync
- Health

장기적으로는 아래 구조를 지향해야 한다.

### 4-1. Core Modules
- AuthModule
- UsersModule
- HealthModule
- PrismaModule
- SyncModule

### 4-2. Catalog / Record Modules
- CatalogModule
- UserRecordsModule
- ImportsModule

### 4-3. Product Expansion Modules
- TierBoardsModule
- PublicProfilesModule
- PublicWorksModule
- CommunityModule
- InsightsModule

### 4-4. Support / Platform Modules
- SearchModule
- ReactionsModule
- AuditModule
- JobsModule

즉, `WorksModule` 하나로 모든 것을 처리하는 구조에서 벗어나,
도메인에 따라 책임을 나누는 구조로 가야 한다.

---

## 5. 현재 Prisma 모델에서의 방향 전환

### 현재 모델의 문제
현재 `Work`는 아래 역할을 동시에 수행한다.
- 작품 메타데이터
- 개인 기록
- 삭제 상태
- sync 상태
- 일부 미래 기능 필드

이 상태에서 기능이 더 늘어나면 `Work`는 점점 비대해지고, 공용/개인/공개 데이터가 뒤섞이게 된다.

### 지향 구조 예시

#### CanonicalWork
- id
- title
- originalTitle
- description
- thumbnailUrl
- type
- externalSourceKey
- externalSourceName
- publicationStatus
- volumeCount
- episodeCount
- createdAt
- updatedAt

#### CanonicalWorkContributor
- id
- workId
- name
- role (original_author / adapter / artist / studio / director ...)

#### CanonicalWorkGenre
- id
- workId
- genreName

#### UserWorkRecord
- id
- userId
- canonicalWorkId
- status
- rating
- shortReview
- review
- favorite
- visibility
- createdAt
- updatedAt
- deletedAt
- syncStatus
- serverVersion

#### TierBoard / TierLane / TierEntry
별도 도메인

즉, 지금의 `Work`는 장기적으로 분해될 가능성이 높다.

---

## 6. 가져오기 중심 UX를 위한 백엔드 요구사항

프론트엔드는 이미 다음 UX 방향을 갖고 있다.
- 검색
- 후보 선택
- 자동 채움 검토
- 개인 기록 입력
- 저장

이 흐름을 실제 서비스 수준으로 만들기 위해 백엔드는 다음 기능을 준비해야 한다.

### 6-1. 검색 API
- 외부 API 연동
- title/creator 기반 검색
- type 필터 지원 가능

### 6-2. 후보 정규화
- 서로 다른 소스의 필드를 하나의 공통 DTO로 정리
- title / originalTitle / creators / type / counts / description / thumbnail 정규화

### 6-3. 중복 감지
- title 정규화
- source key 비교
- 기존 canonical work 후보 매칭
- 이미 기록한 작품과의 연결

### 6-4. 유저 검증 결과 저장
- 유저가 선택한 후보를 canonical work로 연결
- 필요 시 새 canonical work 생성
- 이후 UserWorkRecord 생성

핵심은,
프론트에서 보이는 검색형 UX 뒤에는 **검색 → 후보 → canonical 확정 → 개인 기록 생성** 흐름이 있어야 한다는 점이다.

---

## 7. 티어 보드 확장을 위한 백엔드 요구사항

현재는 티어가 작품 필드에 일부 남아 있을 수 있지만, 최종적으로는 별도 기능이어야 한다.

필요한 백엔드 구조:
- TierBoard
- TierLane
- TierEntry
- TierBoardVisibility
- TierBoardSharePolicy

핵심 요구사항:
- 주제별 자유 생성
- 템플릿 + 자유 수정
- 작품 레퍼런스 연결
- 공개 범위 선택
- 추후 프로필/커뮤니티 연결

즉, 티어는 백엔드 기준으로도 별도 bounded context로 다뤄야 한다.

---

## 8. 공개/커뮤니티를 위한 백엔드 요구사항

### 8-1. 공개 프로필
필요 요소:
- nickname / intro
- 공개 범위
- 공개 작품 목록
- 공개 리뷰
- 공개 통계
- 공개 티어 보드

### 8-2. 작품 공개 집계
필요 요소:
- 기록한 사용자 수
- 평균 별점
- 공개 한줄평 목록
- 대표 리뷰
- 관련 티어 보드 수

### 8-3. 반응 레이어
초기 요구사항:
- 좋아요
- 간단한 반응

추후 요구사항:
- 댓글
- 팔로우
- 추천 피드

핵심 원칙:
- 처음부터 SNS형으로 과도하게 가기보다,
  개인 기록 기반 공개 정보 계층부터 먼저 만든다.

---

## 9. 운영 품질 측면에서 필요한 개선

현재도 기반은 있다.
- ValidationPipe
- Swagger
- Health check
- 비교적 명확한 startup log

그러나 실제 서비스형 운영 품질로 가려면 추가로 필요하다.

### 필수 개선 영역
1. 예외 응답 포맷 통일
2. Request ID / correlation ID
3. structured logging
4. rate limiting
5. auth brute-force protection
6. pagination / cursor convention
7. audit trail
8. background jobs / queues
9. data lifecycle rules (trash, restore, delete)
10. public/private API separation

특히 Sync, Import, Aggregate, Community는 나중에 동기 요청 처리만으로는 부족할 수 있다.
따라서 jobs/queue를 수용할 구조를 미리 고려해야 한다.

---

## 10. 단계별 백엔드 재설계 우선순위

### Phase A. 도메인 재설계 문서화
목표:
- 현재 `Work` 중심 구조의 한계를 공식화
- Catalog / UserRecord / Import / TierBoard / PublicLayer 분리 정의

산출물:
- 도메인 모델 문서
- 전환 전략 문서

---

### Phase B. Works 분해 준비
목표:
- `WorksModule`의 책임을 분석
- 어떤 기능이 catalog인지, user-record인지 분리
- API 책임 분리 초안 작성

산출물:
- API boundary 정의
- Prisma 전환 초안

---

### Phase C. Import / Catalog 최소 구현
목표:
- 가져오기 중심 UX를 실제로 지지할 백엔드 시작점 마련

산출물:
- search/import DTO
- candidate normalization 구조
- canonical work 생성/연결의 최소 버전

---

### Phase D. Public Layer 최소 구현
목표:
- 공개 프로필 / 작품 공개 집계 / 공개 리뷰 최소 구조 확보

산출물:
- public profile API
- work aggregate API
- visibility 정책

---

### Phase E. Tier Board 도메인 분리
목표:
- tier를 작품 필드에서 독립된 bounded context로 분리

산출물:
- TierBoard schema
- tier board API 초안

---

### Phase F. 운영 품질 강화
목표:
- 실제 서비스 운영 품질 수준으로 끌어올리기

산출물:
- logging 표준화
- error envelope 표준화
- rate limit / audit / queue 준비

---

## 11. 지금 가장 중요한 결론

현재 백엔드는 **잘 만든 기능형 앱 백엔드**다.
하지만 Work Archive가 지향하는 방향은 단순한 개인 기록 CRUD 서버가 아니다.

최종적으로는:
- 공용 작품 데이터
- 개인 기록 데이터
- 검색/가져오기
- 공개 프로필
- 작품 집계
- 티어 보드
- 커뮤니티 확장

을 수용하는 **플랫폼형 백엔드**가 되어야 한다.

따라서 앞으로의 핵심은:

**`User + Work` 중심 구조에서**
**`Catalog / UserRecord / Import / TierBoard / PublicLayer` 중심 구조로 이동하는 것**

이다.

이 문서는 이후 백엔드 도메인 설계 문서, Prisma 재구성 설계, API boundary 분리, Codex용 단계별 백엔드 구현 프롬프트의 기준 문서로 사용한다.
