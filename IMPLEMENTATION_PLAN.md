# IMPLEMENTATION_PLAN.md

## 1. 전체 아키텍처

이 프로젝트는 모노레포로 구성한다.

- apps/web: 프론트엔드
- apps/api: 백엔드
- packages/shared-types: 프론트/백 공용 타입
- packages/eslint-config: 공용 lint 설정
- packages/tsconfig: 공용 tsconfig

### 아키텍처 원칙
1. 프론트는 로컬 DB를 1차 저장소로 사용한다.
2. 백엔드는 동기화 대상이자 원격 저장소 역할을 한다.
3. UI는 네트워크 성공 여부와 상관없이 로컬 상태를 먼저 반영한다.
4. 서버 동기화는 별도 유스케이스로 분리한다.
5. 초기 충돌 해결 정책은 Last Write Wins + Tombstone 삭제 방식으로 단순화한다.

---

## 2. 프론트엔드 설계

### 2-1. 구조
apps/web/src
- app/
  - router/
  - providers/
  - layouts/
- features/
  - works/
    - components/
    - hooks/
    - services/
    - db/
    - utils/
    - pages/
  - tierlist/
  - sync/
  - auth/
- shared/
  - components/
  - lib/
  - utils/
  - constants/
  - types/

### 2-2. 프론트 책임
- IndexedDB 스키마 정의
- 작품 CRUD
- 검색/정렬/필터
- 낙관적 UI
- 동기화 큐 생성
- 수동/자동 동기화 실행
- 서버 오류 표시

### 2-3. IndexedDB 설계
Dexie를 사용해 DB를 감싼다.

테이블:
- works
- syncQueue
- appMeta

works 인덱스 예시:
- id
- type
- title
- status
- rating
- updatedAt
- syncStatus
- deletedAt

### 2-4. 상태 관리
- 서버 상태 캐시는 최소화
- 로컬 DB를 사실상 single source of truth로 사용
- 화면 컴포넌트는 hooks를 통해 DB 접근

### 2-5. 페이지
- /
- /works
- /works/new
- /works/:id
- /works/:id/edit
- /tierlist
- /settings
- /sync

---

## 3. 백엔드 설계

### 3-1. 구조
apps/api/src
- main.ts
- app.module.ts
- common/
  - dto/
  - filters/
  - interceptors/
  - guards/
- modules/
  - health/
  - works/
  - auth/
  - sync/
  - users/
- prisma/
- config/

### 3-2. 백엔드 책임
- REST API 제공
- DTO 검증
- 비즈니스 규칙 검증
- PostgreSQL 영속화
- 사용자 인증/인가
- 동기화 API 제공
- Swagger 문서 자동 생성
- 테스트 지원

### 3-3. 모듈
#### works
- 작품 CRUD
- 목록 조회
- 필터 쿼리
- soft delete

#### auth
- 회원가입
- 로그인
- access token / refresh token
- 현재 사용자 조회

#### sync
- push: 로컬 변경분 업로드
- pull: 서버 변경분 다운로드
- 충돌 처리 규칙 적용

#### health
- /health 체크

---

## 4. 데이터베이스 설계

### 4-1. 테이블
#### users
- id UUID PK
- email unique
- password_hash
- nickname
- created_at
- updated_at

#### works
- id UUID PK
- user_id FK
- type
- title
- author
- description
- thumbnail_url
- status
- rating
- short_review
- review
- tier
- favorite boolean
- created_at
- updated_at
- deleted_at nullable
- version integer default 1

#### work_genres
- work_id FK
- genre text

### 4-2. 정책
- soft delete 사용
- updated_at은 모든 수정 시 갱신
- version 컬럼 증가
- 삭제는 tombstone 유지

---

## 5. API 설계

### 5-1. Works API
- GET /works
- GET /works/:id
- POST /works
- PATCH /works/:id
- DELETE /works/:id

### 5-2. Auth API
- POST /auth/register
- POST /auth/login
- POST /auth/refresh
- GET /auth/me

### 5-3. Sync API
- POST /sync/push
- POST /sync/pull

#### push request 예시
- clientLastSyncAt
- changes[]:
  - entityType
  - operation
  - payload
  - localUpdatedAt

#### pull request 예시
- since
- cursor

---

## 6. 동기화 전략

### 6-1. 1차 목표
초기에는 실시간 자동 동기화가 아니라 수동 동기화 버튼 기반으로 구현한다.

### 6-2. 로컬 변경 흐름
1. 사용자가 작품 생성/수정/삭제
2. 프론트가 IndexedDB works 업데이트
3. 프론트가 syncQueue에 이벤트 적재
4. UI는 즉시 갱신

### 6-3. 서버 동기화 흐름
1. 사용자가 sync 실행
2. syncQueue push
3. 서버에서 저장/충돌 판단
4. 서버 최신 데이터 pull
5. 프론트 로컬 DB merge
6. 성공한 queue 항목 제거

### 6-4. 충돌 해결
초기 버전은 아래 규칙만 사용
- deletedAt이 있으면 삭제 우선
- 둘 다 수정이면 updatedAt 최신값 우선
- 충돌 발생 시 sync 로그에 표시

### 6-5. 제외할 것
- 협업 편집
- CRDT
- field-level merge
- websocket 실시간 sync

---

## 7. 인증 전략

### 7-1. 단계적 도입
1차 MVP에서는 게스트 로컬 모드 허용
2차에서 계정 시스템 도입

### 7-2. 2차 인증
- 이메일/비밀번호 회원가입
- bcrypt 기반 비밀번호 해시
- JWT access/refresh
- works는 user_id 기준 소유권 분리

---

## 8. 테스트 전략

### 프론트
- Dexie repository 단위 테스트
- 폼 검증 테스트
- 검색/정렬/필터 테스트
- 작품 CRUD UI 테스트

### 백엔드
- service unit test
- controller e2e test
- prisma integration test
- auth flow test
- sync conflict test

---

## 9. 개발 환경

### 필수 도구
- Node.js LTS
- npm workspaces
- Docker Desktop
- PostgreSQL via Docker Compose

### 실행 방식
- web: npm run dev --workspace web
- api: npm run start:dev --workspace api
- db: docker compose up -d

---

## 10. 배포 대비 전략

### 프론트
- vite build 결과물 정적 배포 가능하게 유지
- 환경 변수 분리
- API base URL 외부화

### 백엔드
- Dockerfile 작성
- .env 분리
- 헬스체크 엔드포인트 제공
- DB 마이그레이션 자동화 고려

### 추후 배포 경로
- 프론트: 정적 호스팅
- 백엔드: 컨테이너 호스팅
- DB: 관리형 PostgreSQL 또는 자체 호스팅

---

## 11. 구현 순서

### Phase 0
- 모노레포 세팅
- lint / format / tsconfig 공통화
- docker compose
- prisma 초기화
- vite 초기화

### Phase 1
- 프론트 로컬 DB 스키마
- 작품 CRUD
- 목록/상세/폼
- 검색/정렬/필터
- 티어리스트

### Phase 2
- Nest works CRUD
- Prisma schema/migration
- Swagger
- e2e test 기초

### Phase 3
- syncQueue
- 수동 동기화
- pull/push API
- 충돌 로그

### Phase 4
- auth
- 사용자별 데이터
- protected routes
- 토큰 갱신

### Phase 5
- PWA
- 썸네일 업로드
- 통계 페이지
- 배포 구성