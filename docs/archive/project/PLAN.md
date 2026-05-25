# PLAN.md

| Field | Value |
| --- | --- |
| Status | `reference` |
| Role | `historical reference` |
| Source of truth | milestone 기반 초기 실행 계획 |
| Last verified against | legacy planning document preserved on `2026-04-21` |
| When to update | 기본적으로 갱신하지 않음. 역사 문맥 설명이 필요할 때만 상단 metadata 조정 |

> 이 문서는 historical reference다. 현재 roadmap으로 읽지 말고, 초기 milestone 흐름을 확인할 때만 사용한다.
>
> 현재 실행 기준은 [`CURRENT_EXECUTION_PLAN.md`](../../project/CURRENT_EXECUTION_PLAN.md), 현재 코드 현실은 [`CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md), 통합 실행 로드맵은 [`EXECUTION_ROADMAP.md`](../../project/EXECUTION_ROADMAP.md)를 따른다.

## 운영 원칙
- 이 문서가 구현 범위의 단일 기준이다.
- 각 마일스톤 완료 후 반드시 validation 명령을 실행한다.
- 마일스톤 외 범위로 확장하지 않는다.
- 실패 시 원인을 수정하고 다시 검증한 뒤에만 종료한다.

---

## Milestone 0 - Monorepo & Tooling

### 목표
프론트/백/공용 패키지 구조를 갖춘 모노레포를 생성한다.

### 완료 조건
- apps/web 생성
- apps/api 생성
- packages/shared-types 생성
- npm workspaces 동작
- 공통 tsconfig/eslint/prettier 설정 완료
- docker compose로 postgres 실행 가능
- root scripts 정리 완료

### Validation
- npm install
- npm run lint
- npm run typecheck
- docker compose up -d
- docker compose ps

---

## Milestone 1 - Frontend Local-First MVP

### 목표
백엔드 없이도 돌아가는 로컬 우선 작품 기록 앱을 완성한다.

### 완료 조건
- Dexie DB 생성
- works repository 구현
- 작품 추가/수정/삭제 가능
- 작품 목록/상세/수정 페이지 구현
- 검색/정렬/필터 구현
- 티어 설정 가능
- 리뷰/한줄평 저장 가능
- 새로고침 후 데이터 유지

### Validation
- npm run lint --workspace web
- npm run typecheck --workspace web
- npm run test --workspace web
- web 앱 수동 검수:
  - 생성
  - 수정
  - 삭제
  - 필터
  - 정렬
  - 새로고침 유지

---

## Milestone 2 - Backend CRUD Foundation

### 목표
NestJS + Prisma + PostgreSQL 기반의 works CRUD API를 구현한다.

### 완료 조건
- Nest app 초기화
- Prisma schema 작성
- migration 적용
- works module/controller/service 구현
- DTO validation 적용
- Swagger 문서 생성
- health endpoint 구현

### Validation
- npm run lint --workspace api
- npm run typecheck --workspace api
- npm run test --workspace api
- npm run test:e2e --workspace api
- API 수동 검수:
  - GET /health
  - POST /works
  - GET /works
  - GET /works/:id
  - PATCH /works/:id
  - DELETE /works/:id

---

## Milestone 3 - Sync Queue and Manual Sync

### 목표
프론트 로컬 변경을 서버와 수동 동기화할 수 있게 만든다.

### 완료 조건
- syncQueue 테이블 구현
- 로컬 변경 시 queue 적재
- /sync/push 구현
- /sync/pull 구현
- 수동 동기화 버튼 구현
- 성공 항목 queue 제거
- 실패 항목 재시도 가능
- 기본 충돌 처리 구현

### Validation
- web/api lint/typecheck/test 전부 통과
- 수동 테스트:
  - 로컬 생성 후 push 성공
  - 로컬 수정 후 push 성공
  - 로컬 삭제 후 push 성공
  - 서버 변경 pull 성공
  - 충돌 케이스 로그 확인

---

## Milestone 4 - Authentication

### 목표
사용자 계정과 사용자별 데이터 분리를 구현한다.

### 완료 조건
- register/login API
- JWT access/refresh
- auth guard
- works 소유권 분리
- /auth/me 구현
- 프론트 로그인 화면 구현
- 비로그인 시 게스트 로컬 모드 유지 가능

### Validation
- api auth tests 통과
- web auth flow tests 통과
- 수동 테스트:
  - 회원가입
  - 로그인
  - 로그인 후 내 데이터만 조회
  - 로그아웃
  - 게스트 모드 복귀

---

## Milestone 5 - Production Readiness

### 목표
언제든 배포 가능한 수준으로 정리한다.

### 완료 조건
- .env.example 정리
- Dockerfile 작성
- 프론트 build 성공
- API production build 성공
- README 정리
- Swagger 접근 경로 문서화
- seed script 준비
- 에러 처리/로깅 정리

### Validation
- npm run build --workspace web
- npm run build --workspace api
- docker compose up --build
- README대로 신규 환경 재현 가능
