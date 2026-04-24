# COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `product priority summary` |
| Source of truth | 현재 구현 현실, [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md), [`FINAL_WEB_DESIGN.md`](./FINAL_WEB_DESIGN.md) |
| Last verified against | `2026-04-24` working tree |
| When to update | 근거리 제품 우선순위, 사용자 가치 설명, frontend 실행 문서와의 역할 분리가 바뀔 때 |

이 문서는 Work Archive를 **현재 동작하는 기능형 웹앱에서 더 정돈된 서비스형 제품으로 끌어올리기 위한 near-term priority summary**다. 상세 구현 단계는 `FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`에서 관리하고, 여기서는 왜 그 순서가 제품 가치에 맞는지만 설명한다.

## Goal

현재 구현을 유지한 채, 핵심 사용자 흐름의 완성도와 정보 구조를 다듬어 상용 서비스에 가까운 제품 인상을 만든다.

## Current Baseline

- Home / Works / Work Detail / Auth / Account 흐름은 실제로 동작한다.
- local-first, guest/auth archive 분리, manual sync가 현재 제품의 핵심 현실이다.
- 로그인 직후 guest 기록 검토/선택 import 흐름이 이미 존재한다.
- Quick Add는 이미 external provider 검색을 사용하지만, 저장은 계속 local-first이고 provider readiness UX는 부분 구현 상태다.
- `Tier Boards`, `Insights`, `Community`는 확장 목적지이지만 구현 성숙도는 낮다.
- Mantine foundation은 도입됐지만 스타일 인프라는 여전히 `global.css`와 수동 클래스 조합에 크게 의존한다.

## Why This Order

상세 실행 순서는 [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)에서 고정하고, 제품 관점에서는 아래 가치 순서로 읽는다.

1. 시각적 노이즈 제거:
사용자가 처음 받는 인상을 정리하고, 장식보다 콘텐츠를 먼저 읽게 만든다.

2. 디자인 토큰 정리:
화면마다 다른 색과 간격이 튀지 않게 만들어 제품 신뢰감을 높인다.

3. 공통 UI 계층 정리:
기능 추가 속도와 일관성을 함께 확보한다.

4. 핵심 페이지 재구성:
Home, Works, Work Detail, Auth, Account의 실제 사용자 가치가 더 빨리 읽히게 만든다.

5. 다크 모드 완성도 향상:
차분하고 고급스러운 톤을 고정해 제품 인상을 끌어올린다.

## Committed Now

### 1. Core Product Surfaces First

가장 먼저 품질을 올릴 표면:

- Home
- Works
- Work Detail
- Auth
- Account / Sync / Settings

이 우선순위는 현재 사용자가 실제로 머무는 표면과 동일해야 한다.

### 2. Product Copy Must Follow Content-First

- 제품 메시지는 기능 나열보다 다음 행동을 먼저 안내해야 한다.
- Work Detail은 작품 정보보다 내 감상 기록이 주역이어야 한다.
- Auth는 입력 집중형, Account는 관리형 톤을 유지해야 한다.

### 3. Placeholder Discipline

- 확장 목적지라도 제품 톤을 해치지 않게 정리한다.
- placeholder는 명확한 현재 상태, 다음 CTA, 기대 가능한 방향을 가져야 한다.
- placeholder가 핵심 구현 화면보다 더 화려하거나 더 강한 위계를 가져서는 안 된다.

### 4. Detailed Frontend Execution Lives Elsewhere

아래 문서가 프론트 상세 실행 기준이다.

- [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)

이 문서는 단계별 기술 체크리스트를 반복하지 않는다.

## Next

- provider readiness, ranking, duplicate detection을 포함한 Quick Add 신뢰도 개선
- 게스트 기록 -> 계정 전환 UX 설계
- 공개 프로필과 개인 프로필의 경계 정리
- tier board 기능 착수를 위한 제품 경계 고정
- 남은 보안 backlog 우선순위 재정리

## Later / Exploratory

- 공개 레이어
- 작품 집계와 community surface
- tier board 공유/편집 경험
- catalog/public architecture
- 구글 로그인 중심 auth 전환

## References

- Mantine theme 기준: [Theme object](https://mantine.dev/theming/theme-object/)
- Mantine styling 기준: [Styles API](https://mantine.dev/styles/styles-api/)
- 다크 모드 참고: [Lovable dark mode guide](https://lovable.dev/guides/dark-mode-website-examples-guide/)
- 다크 모드 참고: [iCreationsLAB dark mode guide](https://icreationslab.com/dark-mode-web-design-a-complete-guide/)

## Dependencies

- [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)
- [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)
- [`../backend/SECURITY_HARDENING_ROADMAP.md`](../backend/SECURITY_HARDENING_ROADMAP.md)
- 현재 route/layout 의미 유지

## Exit Criteria

- 제품 문서와 코드가 같은 핵심 사용자 흐름을 우선순위 상단에 둔다.
- 프론트 상세 단계 설명은 frontend 문서에만 있고, product 문서는 사용자 가치 중심으로 읽힌다.
- 확장 목적지와 현재 구현 화면의 책임 구분이 문서상 분명하다.
