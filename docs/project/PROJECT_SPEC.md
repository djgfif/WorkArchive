# PROJECT_SPEC.md

## 1. 프로젝트 개요

### 프로젝트명
Work Archive

### 한 줄 소개
소설, 애니, 만화, 라이트노벨, 웹소설 등 감상한 작품을 기록하고,
별점, 한줄평, 리뷰, 티어리스트, 감상 상태를 관리할 수 있는 로컬 우선 웹앱.

### 핵심 목표
1. 인터넷이 없어도 작품 기록/수정/조회가 가능해야 한다.
2. 나중에 백엔드 동기화를 붙일 수 있어야 한다.
3. 프론트엔드와 백엔드를 분리해 백엔드 학습에도 도움이 되어야 한다.
4. 지금은 1인 사용 기준이지만, 나중에 멀티 유저 구조로 확장 가능해야 한다.
5. 정적 프론트 배포와 컨테이너형 백엔드 배포가 가능해야 한다.

---

## 2. 제품 목표

### 현재 목표
- 로컬 우선 개인 기록 앱 완성
- 백엔드 CRUD/API/DB/Auth/동기화 구조 학습
- 언제든 배포 가능한 구조 확보

### 현재 하지 않을 것
- 소셜 기능
- 실시간 협업
- 추천 알고리즘
- 외부 작품 DB 대규모 연동
- CRDT/복잡한 충돌 해결
- 관리자 페이지

---

## 3. 핵심 사용자
- 1차: 개발자인 본인
- 2차: 향후 개인 포트폴리오 방문자
- 3차: 나중에 소수 사용자

---

## 4. 핵심 기능

### 4-1. 작품 관리
- 작품 등록
- 작품 수정
- 작품 삭제
- 작품 목록 조회
- 작품 상세 조회

### 4-2. 작품 기록 필드
- 제목
- 매체 타입
- 작가/원작자
- 장르
- 설명
- 썸네일(초기에는 선택, 1차는 URL 또는 로컬 미리보기 중심)
- 감상 상태
- 별점
- 한줄평
- 상세 리뷰
- 티어
- 즐겨찾기 여부
- 생성일/수정일

### 4-3. 필터/정렬/검색
- 제목 검색
- 타입 필터
- 상태 필터
- 장르 필터
- 별점순 정렬
- 최근 수정순 정렬
- 제목순 정렬

### 4-4. 티어리스트
- S/A/B/C/D 기본 티어
- 티어별 작품 이동
- 티어 미지정 작품 보기

### 4-5. 로컬 우선 동작
- 앱 시작 시 IndexedDB에서 데이터 로드
- 등록/수정/삭제 시 먼저 로컬 DB 반영
- UI는 항상 로컬 DB 기준으로 즉시 갱신
- 서버 동기화는 별도 큐 처리

### 4-6. 백엔드 학습 요소
- REST API
- DTO 검증
- PostgreSQL 스키마 설계
- ORM 마이그레이션
- 인증/인가 기초
- 동기화 엔드포인트 설계
- Docker 기반 로컬 개발
- Swagger/OpenAPI 문서화
- 테스트 자동화

---

## 5. 비기능 요구사항

### 성능
- 목록 조회 시 초기 렌더 빠를 것
- 검색/필터는 클라이언트 로컬 DB 기준으로 즉시 반응할 것

### 오프라인
- 네트워크 없이 주요 기능 동작
- 새로고침 후에도 데이터 유지

### 유지보수
- 프론트/백 분리
- 모듈형 구조
- 타입 안전성 유지
- 테스트 가능한 구조

### 배포성
- 프론트는 정적 배포 가능
- 백엔드는 컨테이너 배포 가능
- 환경 변수 분리 가능

---

## 6. 기술 방향

### 프론트엔드
- React
- TypeScript
- Vite
- React Router
- Zustand 또는 TanStack Query는 선택
- Dexie(IndexedDB 래퍼) 사용

### 백엔드
- NestJS
- Prisma
- PostgreSQL
- Docker Compose

### 테스트
- 프론트: Vitest + React Testing Library
- 백엔드: Jest + e2e 테스트

### 문서화
- Swagger/OpenAPI 자동 문서화

---

## 7. 핵심 도메인 모델

### Work
- id
- userId (초기 로컬 모드에서는 nullable 가능)
- type
- title
- author
- genres[]
- description
- thumbnailUrl
- status
- rating
- shortReview
- review
- tier
- favorite
- createdAt
- updatedAt
- deletedAt
- localOnly
- syncStatus
- serverVersion

### User
- id
- email
- passwordHash
- nickname
- createdAt
- updatedAt

### SyncQueueItem
- id
- entityType
- entityId
- operationType
- payload
- createdAt
- retryCount
- lastError

---

## 8. 구현 우선순위

### MVP
1. 로컬 DB 기반 작품 CRUD
2. 목록/상세/검색/필터
3. 별점/한줄평/리뷰/티어
4. NestJS 백엔드 CRUD
5. PostgreSQL 연결
6. Swagger 문서
7. 로컬 -> 서버 수동 동기화

### 2차
1. JWT 로그인
2. 사용자별 데이터 분리
3. 자동 동기화
4. 썸네일 업로드
5. PWA/서비스워커

### 3차
1. 통계 페이지
2. 배포 자동화
3. 외부 API 연동