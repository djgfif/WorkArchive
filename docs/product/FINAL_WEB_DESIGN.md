# FINAL_WEB_DESIGN.md

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `target product vision` |
| Source of truth | 최종 사용자 경험과 디자인 원칙 |
| Last verified against | vision document refreshed on `2026-04-22` |
| When to update | 최종 사용자 경험, 브랜드 톤, 화면 원칙이 달라질 때 |

이 문서는 Work Archive가 장기적으로 지향하는 **최종 사용자 경험과 디자인 원칙**을 정의한다. 현재 구현 상태나 near-term 실행 순서는 다루지 않는다.

## 1. Product Promise

Work Archive는 단순한 기록 폼 모음이 아니라, **내 취향을 빠르게 남기고 오래 보관하며 필요하면 공유할 수 있는 개인 미디어 아카이브**처럼 느껴져야 한다.

## 2. Experience Principles

- **Content First**: 작품과 개인 기록이 주인공이어야 한다.
- **Fast Capture**: 기록 시작과 저장까지의 마찰이 낮아야 한다.
- **Calm Premium**: 차분하고 정돈된 서비스 경험이어야 한다.
- **Archive, Not Admin**: 관리자 도구처럼 보이면 안 된다.
- **Expansion Ready**: 공유, 공개 프로필, 티어 보드, 커뮤니티가 붙어도 위계가 무너지지 않아야 한다.

## 3. Core Product Feel

사용자가 느껴야 하는 핵심 인상:

- 지금 바로 기록할 수 있다
- 내 기록이 쌓이고 정리된다
- 다시 방문했을 때 이어서 보기 쉽다
- 언젠가 공유해도 부끄럽지 않은 아카이브처럼 보인다

## 4. Page-Level Experience

### Home

- 소개 페이지가 아니라 행동 시작점이어야 한다.
- 검색, 빠른 추가, 최근 기록, 핵심 통계가 우선이다.
- 긴 설명문보다 다음 행동이 먼저 보여야 한다.

### Library / Works

- 작품 관리의 중심 공간이어야 한다.
- 헤비 유저도 빠르게 탐색하고 정리할 수 있어야 한다.
- 리스트/그리드/필터/정렬의 전환이 즉각적이어야 한다.

### Quick Add

- 수동 입력보다 검색과 선택이 중심이어야 한다.
- 후보 선택 후 개인 기록만 최소 입력하는 경험이 이상적이다.
- 저장 후 이어서 추가하거나 방금 기록을 확인하는 흐름이 자연스러워야 한다.

### Work Detail

- 작품 정보보다 **내 감상 기록**이 먼저 읽혀야 한다.
- 상태, 별점, 한줄평, 리뷰, 수정 행동이 상단에서 분명해야 한다.
- 텍스트 위계는 메타데이터보다 감상 문장을 먼저 밀어줘야 한다.

### Auth / Account

- 메인 제품과 다른 맥락으로 느껴져야 한다.
- 인증은 입력 집중형이어야 하고, 계정은 관리 중심이어야 한다.

## 5. Visual Direction

- 기본 톤은 차분한 다크 아카이브
- 순수 블랙보다 dark gray / deep navy 계열 surface 우선
- 카드와 포스터보다 텍스트 위계가 먼저 읽히는 구조
- 여백과 위계를 통해 고급스러운 인상 유지
- accent는 절제해서 사용
- 장식보다 구조 완성도 우선
- 과한 네온, 과한 글래스 효과, 사이버펑크식 과장은 피함

## 6. Writing And Interaction Principles

- 기술 설명보다 사용자 행동을 먼저 안내한다.
- CTA는 짧고 명확해야 한다.
- 상태 메시지는 사용자가 무엇을 해야 하는지 알려줘야 한다.
- empty / loading / error 상태도 제품 톤을 유지해야 한다.

## 7. Responsive And Accessibility Principles

- 모바일에서도 핵심 기록 흐름이 끊기지 않아야 한다.
- 키보드 중심 입력과 탐색을 방해하지 않아야 한다.
- 대비, 포커스 표시, 읽기 순서를 기본 품질로 본다.
- 다크 모드에서도 명도 대비와 장시간 읽기 피로를 함께 고려한다.

## 8. Relationship To Other Docs

- 현재 구현 상태는 [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)에서 본다.
- 근거리 제품 우선순위는 [`COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md`](./COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md)에서 본다.
- 프론트 상세 실행 계획은 [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)에서 본다.
- UI 시스템 규칙은 [`CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md`](./CLEAN_PROFESSIONAL_WEB_UI_SYSTEM.md)에서 본다.
