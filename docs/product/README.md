# docs/product/

제품 방향과 웹 UX 비전을 다루는 영역입니다. 이 폴더의 문서는 현재 코드 현실을 설명하기보다, 앞으로 지향할 제품 경험과 상용화 방향을 설명합니다.

## 포함 대상
- [`FINAL_WEB_DESIGN.md`](./FINAL_WEB_DESIGN.md)
- [`COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](./COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)
- [`VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md`](./VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md)
- [`CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md`](./CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md)
- [`AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md`](./AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md)

## 역할
- 최종 제품 포지셔닝과 웹 경험 비전 정의
- 상용 수준 디자인/UX 개선 로드맵 정리
- 개인 기록과 공용 카탈로그를 분리하는 차세대 제품 아키텍처 정의
- Mantine 중심의 깔끔하고 전문적인 웹 UI 시스템 기준 정리
- 게스트 유지 + 구글 로그인 메인 전략의 인증/계정 경험 방향 고정
- 티어 보드를 복잡한 분석 툴이 아니라 가볍고 공유 가능한 커스텀 보드로 정의
- 현재 구현과 미래 제품 목표를 분리해서 읽도록 안내

## 읽는 순서
1. [`FINAL_WEB_DESIGN.md`](./FINAL_WEB_DESIGN.md)
2. [`COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](./COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)
3. [`VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md`](./VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md)
4. [`CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md`](./CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md)
5. [`AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md`](./AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md)
6. 아래의 **Tier Board MVP Strategy** 섹션
7. 아래의 **Tier Board Domain Model Draft** 섹션
8. 현재 구현과 비교가 필요하면 [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
9. 백엔드 목표 구조와 연결해서 보려면 [`../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md`](../backend/BACKEND_SERVICE_REDESIGN_MASTERPLAN.md)

## Source Of Truth 메모
- 현재 구현된 제품 현실의 기준은 이 폴더가 아니라 [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)입니다.
- 이 폴더의 문서는 active 상태의 제품 비전 / 제품 아키텍처 문서로 유지합니다.

---

## Tier Board MVP Strategy

### 최종 결론
Work Archive의 티어 보드는 아래 방향으로 고정합니다.

> **티어 보드는 복잡한 분석 툴이 아니라, 이미지 카드들을 자유롭게 올리고 줄에 배치해서 바로 공유할 수 있는 가벼운 커스텀 보드 기능으로 간다.**

즉,
- 작품 상세의 보조 필드가 아니라 별도 기능으로 봅니다.
- 자동 제안이나 복잡한 수치 시스템보다, 빠르고 직관적인 편집 경험을 우선합니다.
- 작품 카드뿐 아니라 커스텀 카드도 지원해서, 히로인 순위 / 전투력 보드 / 캐릭터 순위까지 무리 없이 수용합니다.
- 가장 중요한 가치는 **가벼움 / 자유도 / 공유성**입니다.

### 왜 이 방향이 맞는가
- 티어메이커류 기능은 만들기 쉽고, 한눈에 보이고, 공유하기 쉬워야 살아남습니다.
- 전투력 보드나 히로인 순위는 엄밀한 데이터보다 이미지, 이름, 줄 위치, 직관적인 비교가 더 중요합니다.
- Work Archive 본체는 이미 기록/상태/별점/리뷰처럼 구조적인 기능이 많기 때문에, 티어 보드까지 무거워지면 전체 서비스가 복잡해집니다.

### MVP 핵심 원칙
1. **기능은 단순하게**
   - 보드 생성
   - 줄 생성/수정/삭제
   - 카드 추가
   - 드래그 앤 드롭
   - 공개/비공개
   - 링크 공유
   - 이미지 export
2. **자유도는 높게**
   - 줄 이름 자유 수정
   - 카드 이미지 자유 업로드
   - 카드 제목 자유 입력
   - 보드 설명 자유 입력
3. **공유성을 강하게**
   - 공개 링크
   - 공개/비공개 설정
   - 이미지 export

### 가장 좋은 MVP 구조
#### 1) Board
- 제목
- 설명
- 공개 범위
- 줄 목록
- 카드 목록

#### 2) Lane
- 기본 S~F 템플릿 제공
- 사용자 정의 줄 이름 허용
- 예: `S/A/B/C`, `최상위/상위/중위/하위`, `GOAT/Great/Mid/Pass`

#### 3) Card
카드는 두 종류만 우선 지원합니다.
- **라이브러리 작품 카드**: 기존 작품에서 가져오고, 썸네일/제목 자동 사용
- **커스텀 카드**: 이미지 업로드 + 제목 입력

이 두 가지면 아래를 모두 커버할 수 있습니다.
- 작품 티어
- 캐릭터 티어
- 히로인 순위
- 전투력 보드
- 자유형 밈 보드

### 보드 타입 최소화
처음부터 타입을 많이 늘리지 않습니다. MVP는 두 개면 충분합니다.
- `classic_tier`: S~F형 또는 자유 줄 티어형
- `ranking`: 1위 ~ N위 순위형

즉,
- 작품 티어보드 → `classic_tier`
- 전투력 보드 → `classic_tier` + 줄 이름 커스텀
- 2025 히로인 순위 → `ranking`

### 전투력 보드는 단순하게 처리
별도 수치/스탯 시스템을 넣지 않습니다.

예:
- 보드 제목: `Fate 전투력 티어`
- 줄: `최상위 / 상위 / 중위 / 하위`
- 카드: `세이버 이미지 + 이름`, `길가메시 이미지 + 이름`

이 정도면 충분합니다. 전투력 보드는 분석 툴이 아니라, **이미지 + 이름 + 줄 위치**만으로도 충분히 재미있고 직관적입니다.

### 공유 기능은 강하게
- 공개 링크: `/tier-boards/:slug`
- 공개 범위: `private`, `link_only`, `public`
- 이미지 export: PNG/JPG 저장

티어 보드의 핵심은 편집 기능보다 **공유 결과물**입니다.

### Work Archive와의 연결 방식
- **작품 보드**는 라이브러리와 연결합니다.
  - 내 라이브러리에서 작품 바로 불러오기
  - 썸네일/제목 자동 사용
- **캐릭터/전투력/히로인 순위 보드**는 복잡하게 연결하지 않고, 커스텀 카드 중심으로 처리합니다.

즉,
- 작품 보드 → 라이브러리 연동
- 캐릭터/순위 보드 → 커스텀 카드 중심

### 하지 말아야 할 것
MVP 단계에서 아래는 넣지 않습니다.
- 복잡한 전투력 수치 시스템
- 과한 태그/배지 시스템
- 캐릭터 전용 상세 도메인
- 복잡한 자동 추천
- 과도한 관계 설정

### 단계별 구현 우선순위
#### Phase 1
- `TierBoard`, `TierLane`, `TierBoardCard` 별도 도메인
- 보드 목록
- 보드 생성
- 줄 생성/수정/삭제
- 드래그 앤 드롭

#### Phase 2
- 라이브러리 작품 카드 추가
- 커스텀 카드 추가
- 이미지 업로드
- 카드 제목 입력

#### Phase 3
- 공개 링크
- 공개 범위
- 이미지 export
- 공개 보기 화면

#### Phase 4
- 프로필 공개 탭 연동
- 커뮤니티 노출
- 보드 복제/포크 같은 확장 기능 검토

### 최종 정리
Work Archive의 티어 보드는 아래처럼 이해하면 됩니다.
- 작품 필드의 `tier`를 넘어서, 별도 목적지의 **독립 보드 기능**으로 갑니다.
- 복잡한 분석 툴이 아니라, **가볍고 자유롭고 공유 가능한 커스텀 보드**로 만듭니다.
- MVP에서는 기능을 늘리기보다, 이미지/제목/줄 커스텀/드래그/공유에 집중합니다.
- 작품 티어는 라이브러리와 연결하고, 전투력/히로인/캐릭터 순위는 커스텀 카드로 처리합니다.
- 핵심 가치는 **가벼움 / 자유도 / 공유성**입니다.

한 줄로 정리하면,

> **Work Archive의 티어 보드는 작품과 커스텀 이미지 카드를 자유롭게 배치해 바로 공유할 수 있는 가벼운 랭킹 캔버스다.**

---

## Tier Board Domain Model Draft

### 목적
이 섹션은 위 MVP 전략을 실제 구현 가능한 수준의 도메인 모델 초안으로 내리는 것을 목표로 한다.

핵심 원칙은 아래와 같다.
- 복잡한 캐릭터/전투력 전용 도메인을 먼저 만들지 않는다.
- 보드는 가볍고 범용적인 `Board / Lane / Card` 구조로 시작한다.
- 작품 보드는 라이브러리 연동으로 처리하고, 나머지는 커스텀 카드로 수용한다.
- 확장 가능성은 열어두되, MVP의 단순함을 해치지 않는다.

---

### 1. 핵심 엔티티

#### A. TierBoard
보드 자체를 나타낸다.

권장 필드:
- `id`
- `ownerId`
- `slug`
- `title`
- `description`
- `boardType`
- `visibility`
- `coverImageUrl` nullable
- `createdAt`
- `updatedAt`
- `publishedAt` nullable

설명:
- `slug`는 공유 URL용이다.
- `boardType`은 `classic_tier` 또는 `ranking` 두 가지로 시작한다.
- `visibility`는 `private`, `link_only`, `public` 세 가지로 시작한다.
- `coverImageUrl`은 공유 썸네일이나 대표 이미지용이다.

---

#### B. TierLane
보드 안의 줄이다.

권장 필드:
- `id`
- `boardId`
- `title`
- `description` nullable
- `colorToken` nullable
- `orderIndex`
- `createdAt`
- `updatedAt`

설명:
- `title`은 `S`, `A`, `B`, `C`일 수도 있고, `최상위`, `상위`, `중위`, `하위`처럼 자유 이름일 수도 있다.
- `description`은 MVP에서 선택 사항이지만, 나중에 줄 의미를 조금 더 분명히 할 때 유용하다.
- `colorToken`은 실제 색상값보다 theme token 또는 preset key를 저장하는 쪽이 유지보수에 유리하다.

---

#### C. TierBoardCard
보드 위에 놓이는 실제 카드다.

권장 필드:
- `id`
- `boardId`
- `laneId` nullable
- `orderIndex`
- `cardSourceType`
- `workId` nullable
- `titleOverride` nullable
- `subtitle` nullable
- `imageUrl` nullable
- `note` nullable
- `createdAt`
- `updatedAt`

설명:
- `laneId`가 nullable인 이유는, 편집 중 아직 아무 줄에도 배치되지 않은 카드 풀(pool)을 지원하기 위해서다.
- `cardSourceType`은 최소 아래 두 가지로 시작한다.
  - `library_work`
  - `custom`
- `workId`는 라이브러리 작품 카드일 때만 사용한다.
- `titleOverride`는 라이브러리 카드도 표시 이름을 다르게 쓰고 싶을 때를 대비한 선택 필드다.
- `imageUrl`은 라이브러리 카드면 기본 썸네일을 복사/캐시하거나, 커스텀 카드면 업로드한 이미지 URL을 저장한다.
- `note`는 MVP에서는 꼭 필요하지 않지만, 카드에 한 줄 메모를 붙이고 싶을 때를 대비한 아주 가벼운 확장 필드다.

---

### 2. 최소 Enum 초안

#### BoardType
- `classic_tier`
- `ranking`

#### Visibility
- `private`
- `link_only`
- `public`

#### CardSourceType
- `library_work`
- `custom`

MVP에서는 여기서 멈추는 것이 좋다.

---

### 3. 관계 구조

#### TierBoard 1:N TierLane
- 하나의 보드에는 여러 줄이 있다.

#### TierBoard 1:N TierBoardCard
- 하나의 보드에는 여러 카드가 있다.

#### TierLane 1:N TierBoardCard
- 하나의 줄에는 여러 카드가 있다.
- 단, 카드가 아직 풀 상태라면 `laneId`는 비어 있을 수 있다.

#### Work 1:N TierBoardCard(optional)
- 하나의 작품이 여러 보드에서 재사용될 수 있다.
- 단, 모든 카드가 작품을 참조할 필요는 없다.

즉 핵심은:
- 보드는 줄과 카드를 가진다.
- 카드는 작품을 참조할 수도 있고, 완전히 커스텀일 수도 있다.

---

### 4. MVP 저장 원칙

#### 1) 카드 위치 저장
카드 위치는 우선 단순하게 저장한다.
- `laneId`
- `orderIndex`

이 두 값이면 대부분의 정렬/드래그 요구를 커버할 수 있다.

#### 2) 라이브러리 카드 표시 데이터
라이브러리 카드는 기본적으로 `workId`를 참조하되, 화면에서는 아래를 사용한다.
- 기본 제목: Work.title
- 기본 이미지: Work.thumbnailUrl

단, 필요하면 아래 override를 허용한다.
- `titleOverride`
- `imageUrl`

즉 “참조 + 선택적 덮어쓰기” 구조가 유연하다.

#### 3) 커스텀 카드 저장 데이터
커스텀 카드는 최소 아래만 있으면 된다.
- `titleOverride` 또는 `title` 역할 필드
- `imageUrl`

즉 별도 커스텀 엔티티를 두지 않고, `TierBoardCard` 안에서 바로 처리하는 것이 MVP에는 가장 단순하다.

---

### 5. UI 관점 도메인 해석

#### Board List
필요 데이터:
- 보드 제목
- 설명
- 대표 이미지
- visibility
- updatedAt
- 카드 수

즉 `TierBoard` 단독 정보 + 카드 수 집계면 충분하다.

#### Board Editor
필요 데이터:
- `TierBoard`
- `TierLane[]`
- `TierBoardCard[]`
- 라이브러리 작품 검색 결과(optional)

핵심은 중앙 보드 상태를 단순하게 유지하는 것이다.

#### Public View
필요 데이터:
- 제목
- 설명
- 줄 순서
- 카드 순서
- 각 카드의 표시 제목/이미지
- 작성자 최소 정보

공개 보기 화면은 편집용 메타데이터보다 **보여주는 결과물**에 집중한다.

---

### 6. MVP에서 의도적으로 제외하는 것
이 초안은 아래를 의도적으로 제외한다.
- 캐릭터 전용 엔티티
- 전투력 수치/스탯 테이블
- 복잡한 태그/배지 도메인
- 카드 간 관계 그래프
- 자동 추천/자동 정렬 엔진
- 세분화된 permission 모델

이유는 분명하다.
- 티어 보드는 가벼워야 한다.
- 초기 성공 조건은 복잡한 정확성이 아니라 빠른 제작과 공유다.

---

### 7. 추후 확장 포인트
MVP 이후 확장이 필요하면 아래 순서가 자연스럽다.

#### Phase A
- `note` 활성화
- 대표 이미지 자동 생성
- 보드 복제

#### Phase B
- `cardSourceType = character` 같은 새 source type 확장
- 카드별 링크/원작 연결
- 공개 프로필 탭 연동

#### Phase C
- 커뮤니티 피드/인기 보드
- 포크/리믹스
- 댓글/반응

즉 현재 구조는 단순하지만, 확장 여지는 충분하다.

---

### 8. 구현팀을 위한 최종 정리
도메인 모델을 아주 짧게 줄이면 이렇다.

- `TierBoard`: 보드 메타
- `TierLane`: 줄
- `TierBoardCard`: 카드
- 카드 소스는 두 가지만 시작
  - `library_work`
  - `custom`
- 위치는 `laneId + orderIndex`로 처리
- 공유는 `slug + visibility`로 처리

즉,

> **티어 보드 MVP는 Board / Lane / Card 3개 엔티티와, library_work / custom 2개 카드 소스만으로 시작하는 것이 가장 적절하다.**

이 구조면 지금 정한 제품 방향인 **가벼움 / 자유도 / 공유성**을 유지하면서도, 실제 구현에 들어갈 수 있다.
