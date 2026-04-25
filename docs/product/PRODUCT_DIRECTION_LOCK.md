# PRODUCT_DIRECTION_LOCK.md

| Field | Value |
| --- | --- |
| Status | `canonical` |
| Role | `product direction lock` |
| Source of truth | user-stated product intent, current local-first architecture, current README/CURRENT_STATUS, current Quick Add/import behavior |
| Last verified against | `2026-04-25` user direction review |
| When to update | only when the product's primary purpose or guest/login/data-boundary policy intentionally changes |

이 문서는 Work Archive의 제품 본질과 구현 방향을 고정한다. 여러 차례 리팩터링과 확장 문서가 추가되면서 방향이 흐려질 수 있으므로, 앞으로 모든 기획/구현/문서 판단은 이 문서를 우선 기준으로 삼는다.

## 1. Product Essence

Work Archive의 1순위 목적은 다음이다.

```text
내가 본 작품들을 정리하고, 상태를 기록하고, 리뷰와 감상을 남기는 개인 작품 아카이브
```

즉, Work Archive는 기본적으로 다음을 위한 웹사이트다.

- 내가 본 작품 정리
- 내가 볼 작품 관리
- 감상 상태 기록
- 별점 / 한줄평 / 상세 리뷰 작성
- 진행도 기록
- 즐겨찾기 / 티어 / 분류
- 나중에 다시 찾기 쉬운 개인 아카이브 구성

아래는 1순위가 아니다.

- 커뮤니티
- 공개 프로필
- 공개 리뷰 플랫폼
- 공용 카탈로그 검수 플랫폼
- SNS형 작품 추천 서비스
- 서버 중심 미디어 데이터베이스

커뮤니티와 공개 기능은 **미래에 할 수도 있는 부가 기능**이다. 지금은 나중에 구현하기 편하도록 경계만 잡아둔다.

## 2. Primary Product Promise

```text
로그인하지 않아도 내 작품 기록을 만들고 관리할 수 있다.
로그인하면 백업/동기화/사용자 키 저장 같은 계정 기능이 추가된다.
```

로그인은 제품 사용의 필수 조건이 아니다.

로그인하지 않은 사용자를 차별하지 않는다. 꼭 로그인이 필요한 기능이 아니라면 guest도 동일하게 사용할 수 있어야 한다.

## 3. Guest-first / Login-optional Policy

### 3-1. Guest must support core archive features

게스트도 아래 핵심 기능을 사용할 수 있어야 한다.

- 작품 수동 추가
- 작품 검색 후보 사용
- 작품 수정
- 작품 삭제 / 복원
- 목록 검색 / 필터 / 정렬
- 리뷰 / 별점 / 진행도 / 즐겨찾기 기록
- 로컬 저장
- 디자인상 동일한 주요 화면 접근

### 3-2. Login-only features are limited to truly account-bound behavior

로그인이 필요한 기능은 아래처럼 계정 또는 개인 보안과 직접 관련된 기능으로 제한한다.

- 서버 동기화
- 계정 간/기기 간 백업
- user-scoped API key 저장, 예: Aladin TTBKey
- 계정 설정
- guest -> account 선택 import
- 미래의 private cloud backup
- 미래의 공개 프로필/커뮤니티 참여 기능

### 3-3. Do not gate non-account features behind login

아래 기능은 로그인 여부로 막지 않는다.

- 기본 작품 기록 작성
- 수동 추가
- 로컬 기록 관리
- key가 필요 없는 외부 검색 provider 사용
- 서버 key만으로 동작하는 공개 provider 검색, 정책상 허용되는 경우

## 4. Personal Data And Server Data Boundary

개개인의 작품 데이터와 서버의 공용 데이터는 별개다.

### 4-1. Personal archive data

개인 기록 데이터는 사용자의 아카이브에 속한다.

예:

- title
- author / creator override
- type
- status
- rating
- shortReview
- review
- progress
- favorite
- tier
- local edits
- deleted/restored state

이 데이터는 기본적으로 개인 기록이다. 서버에 동기화되더라도 **사용자의 private record**다.

### 4-2. Server/catalog data

서버/catalog 데이터는 작품 식별과 검색을 돕는 별도 plane이다.

예:

- CatalogTitle
- CatalogRelease
- CatalogExternalRef
- provider metadata
- verified catalog candidate
- public aggregate candidate

이 데이터는 개인 기록과 같은 것이 아니다.

### 4-3. Sync is not catalog promotion

```text
sync = 내 개인 기록을 백업/동기화하는 문제
catalog promotion = 어떤 작품 정보를 공용 catalog로 올릴지 검수하는 문제
community = 공개/집계/소통 기능
```

이 세 가지를 같은 저장 경로로 섞지 않는다.

## 5. Search Policy

현재 코드에서는 guest 상태에서 외부 검색이 제한되고 preview/manual 후보로 fallback된다. 이 상태는 제품 최종 방향과 완전히 일치하지 않는다.

최종 방향은 아래와 같다.

### 5-1. Providers that do not need user credentials should work for guests

별도 사용자 key가 필요 없는 provider는 로그인하지 않아도 사용할 수 있어야 한다.

예상 대상:

- AniList
- Google Books
- Open Library
- TVmaze
- manual provider

위 provider가 서버 key 또는 사용자 key 없이 정책상 사용할 수 있다면 guest에게도 제공한다.

### 5-2. Server-scoped providers can be available to guests if policy allows

서버 환경 변수만 필요한 provider는 제품 정책과 비용/쿼터/보안 조건을 검토한 뒤 guest에게도 제공할 수 있다.

예상 대상:

- TMDB
- Naver Book
- Kakao Book
- KOBIS

단, 비용/쿼터/악용 가능성이 있다면 rate limit 또는 제한을 둘 수 있다.

### 5-3. User-scoped providers require login only when user credential storage is required

사용자 개인 key 저장이 필요한 provider는 로그인 기능이 필요할 수 있다.

예:

- Aladin TTBKey 저장

하지만 이 경우에도 로그인하지 않은 사용자는 다른 public/no-key provider 또는 수동 추가를 사용할 수 있어야 한다.

### 5-4. Current mismatch to fix

현재 구현에서는 `/imports/search`가 backend `JwtAuthGuard` 뒤에 있고, frontend도 guest에서는 external search를 쓰지 않는다. 따라서 guest는 실제 no-key provider 검색을 받지 못하고 preview 후보만 본다.

이것은 향후 수정 대상이다.

## 6. Manual Add Policy

수동 추가는 핵심 기능이다.

검색 후보가 없거나, 외부 provider가 틀리거나, 사용자가 직접 기록하고 싶을 때는 검색을 거치지 않고도 작품을 추가할 수 있어야 한다.

### 6-1. Required manual add behavior

- 검색 없이 직접 제목을 입력해 저장할 수 있어야 한다.
- 최소 필수값은 제목과 타입 정도로 제한한다.
- 나머지는 선택 입력이어야 한다.
- 수동 추가는 guest와 logged-in user 모두에게 제공한다.
- 수동 추가된 기록은 catalog identity 없이 local-first로 저장한다.
- 나중에 사용자가 원하면 catalog/search candidate와 연결할 수 있는 후속 기능을 둘 수 있다.

### 6-2. Current mismatch to fix

현재 Quick Add는 preview/manual 후보 fallback은 있지만, 사용자가 검색 없이 바로 저장하는 명확한 direct manual add path가 부족하다.

이것은 향후 수정 대상이다.

## 7. Quick Add Policy

Quick Add는 검색을 통한 빠른 추가 기능이다. 하지만 Quick Add가 수동 추가를 대체해서는 안 된다.

Quick Add의 역할:

- 외부/내부 후보 검색
- 후보 선택
- 중복 감지
- 메타데이터 자동 채움
- 개인 기록 입력 보조

Quick Add 저장 원칙:

- 저장은 local-first가 기본이다.
- authenticated 사용자도 기본 저장 경로는 `Dexie -> syncQueue`다.
- 서버 direct create는 기본 경로가 아니다.
- `catalogMatch.id`가 있으면 local record에 `catalogTitleId`를 저장한다.
- external unmatched candidate는 identity-only `importDraft`를 저장한다.
- manual/direct record는 catalog/import identity 없이 저장한다.

## 8. Community Policy

커뮤니티는 미래 확장이다.

현재 구현 우선순위가 아니다.

미래에 커뮤니티를 구현하더라도 아래 원칙을 지킨다.

- 개인 기록은 기본 private다.
- 공개 여부는 사용자가 명시적으로 선택한다.
- public profile / public review / shared tier board는 private archive와 분리한다.
- catalog promotion은 별도 submission/moderation pipeline을 사용한다.
- community 기능은 개인 기록 저장 경로를 바꾸지 않는다.

## 9. Backend Direction

백엔드는 개인 아카이브를 보조하는 구조로 관리한다.

- `UserRecords`: 개인 기록 plane
- `Sync`: 개인 기록 동기화 plane
- `Imports`: 검색/후보 plane
- `Catalog`: 작품 식별/metadata plane
- `PublicLayer`: 미래 공개/커뮤니티 plane
- `Works`: compatibility layer

`Works`는 성장 경로가 아니다. 새 도메인 기능은 가능한 한 `Catalog`, `Imports`, `UserRecords`, `Sync`, `PublicLayer` 중 알맞은 경계에 둔다.

## 10. Implementation Priorities From This Direction

이 제품 방향에 따라 다음 구현 우선순위를 적용한다.

### Priority 1. Manual add

검색 없이 직접 작품을 추가하는 경로를 만든다.

### Priority 2. Guest search parity

로그인이 필요 없는 provider는 guest도 사용할 수 있게 한다.

### Priority 3. Quick Add UX polish

검색 기반 추가 흐름을 더 보기 좋고 빠르게 만든다.

### Priority 4. Works list and review UX

내 작품 목록, 리뷰, 상세 기록, 수정 흐름을 완성한다.

### Priority 5. Sync reliability

로그인 사용자를 위한 sync 상태와 conflict 해결을 강화한다.

### Priority 6. Catalog boundary cleanup

개인 기록과 서버/catalog identity를 더 명확히 분리한다.

### Priority 7. Public/community expansion

개인 아카이브가 안정화된 뒤 공개/커뮤니티 기능을 검토한다.

## 11. Codex Guardrail

Codex나 다른 자동 구현 도구에 작업을 줄 때 아래 문장을 포함한다.

```text
Work Archive의 본질은 개인 local-first 작품 기록/리뷰 아카이브다. 로그인은 선택이며, 꼭 계정이 필요한 기능이 아니면 guest도 사용할 수 있어야 한다. 개인 기록 데이터와 서버/catalog/community 데이터는 별개 plane으로 유지한다. 수동 추가는 핵심 기능이며, key가 필요 없는 검색 provider는 비로그인 사용자에게도 제공하는 방향으로 구현한다. 커뮤니티는 미래 확장일 뿐 현재 기본 경로가 아니다.
```

## 12. Exit Criteria

이 문서가 지켜지면 다음이 가능해야 한다.

- 로그인하지 않아도 작품 기록 앱으로 쓸 수 있다.
- 검색이 안 되거나 provider가 틀려도 수동 추가가 가능하다.
- 로그인은 백업/동기화/개인 key 저장을 위한 선택 기능으로 느껴진다.
- 개인 기록과 공용 catalog/community 기능이 섞이지 않는다.
- 커뮤니티가 없더라도 제품의 핵심 가치가 완성된다.
