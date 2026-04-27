# PRODUCT_DIRECTION_LOCK.md

| Field                 | Value                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Status                | `canonical`                                                                                                                      |
| Role                  | `product direction lock`                                                                                                         |
| Source of truth       | user-stated product intent, current local-first architecture, current README/CURRENT_STATUS, current Quick Add/import behavior   |
| Last verified against | `2026-04-26` personal-only direction lock                                                                                        |
| When to update        | only when the product's primary purpose, personal-only policy, guest/login policy, or data-boundary policy intentionally changes |

이 문서는 Work Archive의 제품 본질과 구현 방향을 고정한다. 여러 차례 리팩터링과 확장 문서가 추가되면서 방향이 흐려질 수 있으므로, 앞으로 모든 기획/구현/문서 판단은 이 문서를 우선 기준으로 삼는다.

## 1. Product Essence

Work Archive의 1순위 목적은 다음이다.

```text
내가 본 작품들을 정리하고, 상태를 기록하고, 리뷰와 감상을 남기는 순수 개인용 작품 아카이브
```

Work Archive는 기본적으로 다음을 위한 개인 도구다.

- 내가 본 작품 정리
- 내가 볼 작품 관리
- 감상 상태 기록
- 별점 / 한줄평 / 상세 리뷰 작성
- 진행도 기록
- 즐겨찾기 / 개인 태그 / 티어 / 분류
- 나중에 다시 찾기 쉬운 개인 아카이브 구성
- 내 데이터를 잃지 않기 위한 export / import / 선택형 백업

아래는 제품 목표가 아니다.

- 공개 프로필
- 공개 리뷰 플랫폼
- 커뮤니티
- 공용 카탈로그 검수 플랫폼
- SNS형 작품 추천 서비스
- 서버 중심 미디어 데이터베이스

공개/커뮤니티 기능은 무기한 보류한다. 현재 제품은 순수 개인용으로 완성하는 것을 목표로 한다. 미래에 공유 기능을 만들더라도 기본 제품 방향을 바꾸는 것이 아니라, 사용자가 명시적으로 선택하는 export/share 기능에 한정한다.

## 2. Primary Product Promise

```text
로그인하지 않아도 이 기기에서 내 작품 기록을 만들고 관리할 수 있다.
로그인하면 선택형 백업/동기화/사용자 키 저장 같은 개인 계정 기능이 추가된다.
```

로그인은 제품 사용의 필수 조건이 아니다. 꼭 계정이 필요한 기능이 아니라면 guest도 동일하게 사용할 수 있어야 한다.

## 3. Personal-only Policy

Work Archive는 당분간 순수 개인용 아카이브 앱으로 개발한다.

만드는 것:

- local-first 개인 기록
- 수동 추가
- 검색으로 정보 채우기
- 표지 중심 작품 목록
- 내 기록 중심 상세 화면
- 별점 / 상태 / 한줄평 / 상세 감상
- 진행도 / 즐겨찾기 / 개인 태그 / 티어
- JSON export / import
- CSV export
- 선택형 private backup / sync
- user-scoped API key 저장, 예: Aladin TTBKey
- 개인 통계 / minimal Insights

지금 만들지 않는 것:

- public profile
- public review
- follow / like / comment
- community timeline
- public tier board
- catalog moderation workflow
- public aggregate ranking
- social recommendation feed
- user-to-user messaging

개인 기록을 공개하거나 소셜 기능과 연결하는 흐름은 현재 제품 범위에서 제외한다.

## 4. Guest-first / Login-optional Policy

게스트도 아래 핵심 기능을 사용할 수 있어야 한다.

- 작품 수동 추가
- 작품 검색 후보 사용
- 작품 수정
- 작품 삭제 / 복원
- 목록 검색 / 필터 / 정렬
- 리뷰 / 별점 / 진행도 / 즐겨찾기 기록
- 로컬 저장
- 데이터 export
- 디자인상 동일한 주요 화면 접근

로그인이 필요한 기능은 계정 또는 개인 보안과 직접 관련된 기능으로 제한한다.

- 서버 동기화
- 계정 간/기기 간 백업
- user-scoped API key 저장, 예: Aladin TTBKey
- 계정 설정
- guest -> account 선택 import
- private cloud backup

## 5. Personal Data And Server Data Boundary

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
- personalTags
- tier
- local edits
- deleted/restored state
- reading / watching timeline

이 데이터는 기본적으로 개인 기록이다. 서버에 동기화되더라도 사용자의 private record다.

서버/catalog 데이터는 작품 식별과 검색을 돕는 별도 보조 plane이다.

예:

- CatalogTitle
- CatalogRelease
- CatalogExternalRef
- provider metadata
- search candidate identity

이 데이터는 개인 기록과 같은 것이 아니다. 공용 catalog platform을 만드는 것이 현재 목표가 아니다.

```text
sync = 내 개인 기록을 백업/동기화하는 문제
catalog identity = 검색 후보를 식별하고 중복을 줄이는 보조 정보
public/community = 현재 제품 범위 밖
```

## 6. Search Policy

검색은 작품 추가를 빠르게 돕는 입력 보조 기능이다. 검색이 수동 추가를 대체해서는 안 된다.

별도 사용자 key가 필요 없는 provider는 로그인하지 않아도 사용할 수 있어야 한다.

예상 대상:

- AniList
- Google Books
- Open Library
- TVmaze
- manual provider

서버 환경 변수만 필요한 provider는 개인용 정책과 비용/쿼터/보안 조건을 검토한 뒤 guest에게도 제공할 수 있다.

예상 대상:

- TMDB
- Naver Book
- Kakao Book
- KOBIS

사용자 개인 key 저장이 필요한 provider는 로그인 기능이 필요할 수 있다. 예: Aladin TTBKey 저장.

하지만 이 경우에도 로그인하지 않은 사용자는 다른 public/no-key provider 또는 수동 추가를 사용할 수 있어야 한다.

## 7. Manual Add Policy

수동 추가는 핵심 기능이다.

- 검색 없이 직접 제목을 입력해 저장할 수 있어야 한다.
- 최소 필수값은 제목과 타입 정도로 제한한다.
- 나머지는 선택 입력이어야 한다.
- 수동 추가는 guest와 logged-in user 모두에게 제공한다.
- 수동 추가된 기록은 catalog identity 없이 local-first로 저장한다.
- 나중에 사용자가 원하면 catalog/search candidate와 연결할 수 있는 후속 기능을 둘 수 있다.

## 8. Quick Add Policy

Quick Add는 검색을 통한 빠른 추가 기능이다. 하지만 Quick Add가 수동 추가를 대체해서는 안 된다.

Quick Add의 역할:

- 외부/내부 후보 검색
- 후보 선택
- 중복 감지
- 메타데이터 자동 채움
- 개인 기록 입력 보조

Manual fallback 정책:

- manual provider 후보는 자동 검색 결과처럼 섞어 보여주지 않는다.
- 자동 검색에서 외부 후보가 없을 때는 후보 목록 대신 “직접 추가로 계속” fallback을 제공한다.
- 사용자가 검색 출처를 직접 추가 후보로 명시 선택한 경우에만 manual 후보를 후보 목록에 표시한다.
- manual 후보의 내부 fallback key는 외부 식별자로 표시하지 않는다.

Quick Add 저장 원칙:

- 저장은 local-first가 기본이다.
- authenticated 사용자도 기본 저장 경로는 `Dexie -> syncQueue`다.
- 서버 direct create는 기본 경로가 아니다.
- `catalogMatch.id`가 있으면 local record에 `catalogTitleId`를 저장한다.
- external unmatched candidate는 identity-only `importDraft`를 저장한다.
- manual/direct record는 catalog/import identity 없이 저장한다.

## 9. Design Direction

순수 개인용 아카이브에 맞춰 화면 구조를 아래처럼 고정한다.

- Creation screens use form-first layouts.
- Search selection uses modal master-detail picker.
- Library browsing uses poster-first grid.
- Detail pages use section-based layouts centered on personal records.
- Cards must not contain more than a few essential metadata items.
- Do not use expandable cards for primary selection flows.
- Use accordion/disclosure only for secondary metadata.

작품 목록 카드는 표지 이미지가 중심이다. 기본 카드 정보는 제목, 상태, 별점, 즐겨찾기 정도로 제한하고 한줄평, 장르, 최근 수정일, 긴 진행도 텍스트는 상세 화면으로 보낸다.

## 10. Backend Direction

백엔드는 개인 아카이브를 보조하는 구조로 관리한다.

- `UserRecords`: 개인 기록 plane
- `Sync`: 개인 기록 동기화 plane
- `Imports`: 검색/후보 plane
- `Catalog`: 작품 식별/metadata 보조 plane
- `Works`: compatibility layer

`Works`는 성장 경로가 아니다. 새 도메인 기능은 가능한 한 `Catalog`, `Imports`, `UserRecords`, `Sync` 중 알맞은 경계에 둔다.

`PublicLayer` / community / moderation 계열 기능은 현재 제품 범위 밖이다.

## 11. Implementation Priorities From This Direction

### Priority 1. Personal archive core UX

- 직접 추가
- 검색으로 정보 채우기
- 표지 중심 목록
- 내 기록 중심 상세 화면
- empty / loading / error 상태 정리

### Priority 2. Data ownership and safety

- JSON export
- JSON import
- CSV export
- 로컬 데이터 초기화 / 복구 안내
- 휴지통 / 복원 UX

### Priority 3. Personal record depth

- 개인 태그
- 감상 timeline
- 재감상 / 재독 기록
- 진행도 고도화
- 개인 티어 / 컬렉션

### Priority 4. Optional private sync reliability

- sync 상태 설명
- conflict overwrite / merge resolution
- 로그인 직후 pull 정책
- 백업/동기화 실패 복구 UX

### Priority 5. Search quality and catalog assist

- provider ranking/search quality 개선
- source merge 표시
- 검색 실패 fallback UX
- catalog identity 연결 보조

### Priority 6. Minimal personal Insights

- 총 기록 수
- 매체별 기록 수
- 상태별 분포
- 별점 분포
- 올해 완료한 작품
- 개인 태그/장르 요약

### Out of scope. Public/community expansion

공개 프로필, 공개 리뷰, 커뮤니티, 팔로우, 댓글, moderation은 현재 로드맵에서 제외한다.

## 12. Codex Guardrail

Codex나 다른 자동 구현 도구에 작업을 줄 때 아래 문장을 포함한다.

```text
Work Archive의 본질은 순수 개인용 local-first 작품 기록/리뷰 아카이브다. 로그인은 선택이며, 꼭 계정이 필요한 기능이 아니면 guest도 사용할 수 있어야 한다. 개인 기록 데이터와 서버/catalog 보조 데이터는 별개 plane으로 유지한다. 수동 추가는 핵심 기능이며, 검색은 입력 보조 기능이다. 커뮤니티, 공개 프로필, 공개 리뷰, public/social 기능은 현재 제품 범위 밖이다.
```

## 13. Exit Criteria

이 문서가 지켜지면 다음이 가능해야 한다.

- 로그인하지 않아도 작품 기록 앱으로 쓸 수 있다.
- 검색이 안 되거나 provider가 틀려도 수동 추가가 가능하다.
- 로그인은 백업/동기화/개인 key 저장을 위한 선택 기능으로 느껴진다.
- 개인 기록과 검색/catalog 보조 데이터가 섞이지 않는다.
- 커뮤니티가 없어도 제품의 핵심 가치가 완성된다.
- 사용자는 자신의 데이터를 export/import할 수 있어야 한다.
