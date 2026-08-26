# Product Constitution

| Field                 | Value                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| Status                | `canonical`                                                                                                   |
| Role                  | `sole product-direction authority`                                                                            |
| Source of truth       | explicit product intent, local-first data architecture, user-trust and release review                         |
| Last verified against | `2026-08-26` repository, browser, navigation, and Community scope audit                                       |
| When to update        | primary purpose, data planes, publication contract, product hierarchy, or approval rules intentionally change |

이 문서는 Work Archive의 **유일한 제품 방향 기준**이다. 구현, 로드맵,
디자인, 실험 문서는 이 헌법을 구체화할 수 있지만 암묵적으로 변경할 수 없다.
코드가 먼저 존재한다는 사실은 제품 승인이나 배포 승인이 아니다.

## 1. Purpose

Work Archive는 사용자가 자신이 읽고 본 작품의 역사를 빠르게 기록하고,
안전하게 소유하며, 나중에 다시 발견하도록 돕는 개인 미디어 아카이브다.

핵심 루프는 다음 세 단계다.

1. 몇 초 안에 최소 기록을 남긴다.
2. 필요할 때 상태, 진행도, 별점, 감상, 표지와 메타데이터를 보강한다.
3. 시간의 흐름, 재독·재감상, 검색과 회고를 통해 기록을 다시 발견한다.

따라서 원칙은 `manual-first`가 아니라 **capture-first, enrich-later**다.
직접 입력은 항상 살아 있어야 하지만, 신뢰할 수 있는 검색 보조도 핵심 루프를
빠르게 한다면 동등하게 유효하다.

## 2. Ownership And Durability

- IndexedDB의 개인 아카이브가 클라이언트 원본이다.
- 계정과 네트워크 없이도 최소 기록 생성, 수정, 탐색, export가 가능해야 한다.
- 로그인은 private backup, sync, 계정 설정, 명시적 공개 기능을 추가한다.
- import, restore, sync, conflict 처리는 기록을 조용히 이동·병합·덮어쓰지 않는다.
- 사용자는 저장 위치, 동기화 상태, 충돌 영향과 복구 경로를 이해할 수 있어야 한다.
- export와 복원 가능성은 부가 기능이 아니라 장기 신뢰 계약이다.

## 3. Data Dimensions And Planes

데이터를 하나의 `private/public` 축으로 단순화하지 않는다. 각 기능은 아래 네
차원을 별도로 정의한다.

- locality: device, account server, public server 중 어디에 저장되는가
- visibility: 본인, 링크 보유자, 공개 중 누가 볼 수 있는가
- control: 생성, 수정, 삭제, 신고, moderation 권한은 누구에게 있는가
- durability: export, restore, revocation, retention은 어떻게 동작하는가

제품 plane은 다음처럼 분리한다.

| Plane                       | Default        | Contract                                   |
| --------------------------- | -------------- | ------------------------------------------ |
| Guest archive               | local, private | 계정·네트워크 없이 작동                    |
| Account archive             | private        | 명시적 활성화 후 backup/sync               |
| Catalog and search assist   | reference data | 개인 기록 입력을 돕고 원본을 대체하지 않음 |
| Community                   | public, opt-in | 새로 작성한 공개 데이터만 별도 저장        |
| Credentials and diagnostics | restricted     | 공개 plane과 절대 결합하지 않음            |

## 4. Publication Contract

개인 기록은 자동으로 공개되지 않는다. 모든 공개는 개별 행동이어야 하며,
실행 전에 실제로 공개될 필드를 보여준다.

- 공개 기본값은 `off`다.
- 기존 private review를 자동 복사하거나 추천하지 않는다.
- 공개 대상은 그 행동에서 새로 작성한 내용과 사용자가 확인한 최소 snapshot뿐이다.
- 삭제와 공개 철회는 지원하지만, 이미 타인에게 노출·복사된 정보까지 회수할 수
  있다고 약속하지 않는다. 공개는 **revocable, not fully recoverable**이다.
- 공개 데이터에도 export, deletion, retention, 신고와 moderation 계약이 필요하다.

## 5. Product Hierarchy

기능 우선순위는 아래 순서를 따른다.

1. 개인 아카이브 핵심: capture, edit, search, organize, backup, restore
2. 개인 회고: timeline, reread/rewatch, insights, archive health
3. 파생 도구: tier board, collection, 선택형 공개 감상
4. 공개·소셜 실험: profile, follow, comment, ranking, recommendation network

상위 계층의 신뢰성과 도달성이 하위 계층보다 우선한다. 파생 기능은 개인
아카이브를 입력 재료로 사용할 수 있지만, 그 저장 경로나 정보 구조를 지배하지
않는다. 공개·소셜 기능은 기본 제품 정체성이 아니라 검증이 필요한 실험이다.

## 6. Expansion Test

새 기능은 구현 전에 다음 질문에 답해야 한다.

1. 핵심 루프의 어느 단계가 더 빨라지거나 더 안전해지는가?
2. 개인 기록과 새 데이터 plane의 경계는 무엇인가?
3. guest와 offline 사용이 불필요하게 약화되지 않는가?
4. 사용자가 공개·삭제·충돌의 결과를 실행 전에 이해할 수 있는가?
5. 성공과 중단 기준은 무엇이며, 실패하면 핵심 제품에서 제거 가능한가?
6. desktop과 mobile에서 동일한 핵심 능력에 도달할 수 있는가?

답이 없거나 제품 계층을 뒤집는 기능은 구현량과 무관하게 승인되지 않는다.

## 7. Experience And Design

- 인터페이스는 차분하고 content-first여야 하며 장식보다 기록을 우선한다.
- 단순함은 기능을 숨기는 것이 아니라 다음 행동과 현재 상태를 분명히 하는 것이다.
- 경고의 강도는 위험에 비례한다. 일반 안내는 조용하게, 데이터 손실·공개·삭제·
  충돌은 의도적인 마찰과 명확한 확인으로 다룬다.
- 색상 절제는 상태 표현의 부재가 아니다. 오류, 경고, 성공, 공개 상태는
  의미론적으로 구분한다.
- low-data 경험은 고정된 작품 수보다 사용 가능한 신호와 기능의 신뢰도를 기준으로
  점진적으로 열린다.

## 8. Release Profiles

| Runtime identifier               | Allowed                                                                     | Default                                |
| -------------------------------- | --------------------------------------------------------------------------- | -------------------------------------- |
| `personal-archive`               | 개인 기록, 회고, backup/sync, private tier board                            | enabled                                |
| `community-reflection-alpha`     | 짧은 공개 감상, 단일 feed, 단일 reaction, report/moderation                 | disabled until release evidence passes |
| `community-social-experiment`    | boards, public profiles, comments, follows, taste/trending, recommendations | disabled and not production-approved   |

라우트나 API가 저장소에 존재해도 해당 release profile이 승인·활성화되지 않으면
사용자에게 노출하지 않는다.

런타임 집행 계약은 다음과 같다.

- 프로필이 없으면 웹과 API 모두 `personal-archive`로 fail closed한다.
- 오타가 난 웹 프로필은 `personal-archive`로 축소되며, API의 잘못된 명시적
  프로필은 요청을 허용하지 않는 설정 오류다.
- 운영 컨테이너에서는 잘못된 웹 프로필도 시작 실패로 처리한다. 정적 호스팅의
  잘못된 런타임 값만 브라우저에서 `personal-archive`로 축소한다.
- 웹 번들에는 프로필을 굽지 않는다. 컨테이너 시작 시 `/tmp`에 생성한
  `work-archive-config.js`를 `no-store`로 제공한다.
- Compose는 하나의 `PRODUCT_RELEASE_PROFILE` 값을 웹과 API 런타임에 함께 전달하고, 웹 healthcheck가 공개 API 프로필과 일치하는지 확인한다.
- `community-reflection-alpha`는 `/community`와
  `/community/reflections` API만 연다.
- 게시판·리뷰·댓글·프로필·팔로우·taste/trending은
  `community-social-experiment`에서만 라우트와 API가 열린다.
- 짧은 감상과 게시판 글은 `CommunityPost.surface`로 구분한다. 기존 미분류 공개 글은
  좁은 alpha로 승격하지 않고 `board`로 보수적으로 분류한다.

## 9. Governance

- 제품 목적, 공개 plane, 기본 navigation, 데이터 권리 계약의 변경은 코드보다
  먼저 이 문서를 수정하고 decision record를 남긴다.
- 실험 문서는 범위, 성공 지표, 중단 기준, 데이터 경계, release gate를 명시한다.
- 현재 구현 문서는 사실을 기록하며, 존재하는 코드를 사후 승인하는 근거가 아니다.
- archived 문서는 현재 기준 또는 source of truth가 될 수 없다.
- 제품 방향의 `canonical` 문서는 이 파일 하나만 허용한다. 보안, 구조, 운영,
  현재 상태 문서는 각자의 좁은 영역에서만 canonical일 수 있다.
- 검증되지 않은 확장은 production blocked 상태를 유지한다.

## Decision Rule

불확실할 때는 더 많은 기능보다 사용자의 기록 소유권, 핵심 루프의 속도,
되돌릴 수 있는 선택, 제품 plane의 분리를 우선한다.
