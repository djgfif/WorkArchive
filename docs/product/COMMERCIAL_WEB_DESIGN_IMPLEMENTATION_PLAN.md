# COMMERCIAL_WEB_DESIGN_IMPLEMENTATION_PLAN.md

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `product/frontend roadmap` |
| Source of truth | 현재 구현 현실, [`FINAL_WEB_DESIGN.md`](./FINAL_WEB_DESIGN.md), frontend roadmap 문서 |
| Last verified against | `2026-04-21` working tree |
| When to update | 근거리 우선순위, 제품/프론트 범위, 완료 기준이 바뀔 때 |

이 문서는 Work Archive를 **현재 동작하는 기능형 웹앱에서 더 정돈된 서비스형 제품으로 끌어올리기 위한 near-term roadmap**이다.

## Goal

현재 구현을 유지한 채, 핵심 사용자 흐름의 완성도와 문서화된 구조 규칙을 높여 상용 서비스에 가까운 제품 인상을 만든다.

## Current Baseline

- Home / Works / Work Detail / Auth / Account 흐름은 실제로 작동한다.
- local-first, guest/auth archive 분리, manual sync가 현재 제품의 핵심 현실이다.
- 로그인 직후 guest 기록 검토/선택 import 흐름이 이미 존재한다.
- Quick Add는 구조는 있으나 외부 metadata 연동은 없다.
- `Tier Boards`, `Insights`, `Community`는 확장 목적지이지만 구현 성숙도는 낮다.
- Mantine foundation은 도입됐지만 스타일 인프라는 여전히 `global.css` 중심이다.

## Committed Now

### 1. Core Product Surfaces First

가장 먼저 품질을 올릴 표면:

- Home
- Works
- Work Detail
- Auth
- Account / Sync / Settings

### 2. Mantine-Based UI System

- Mantine를 명시적 목표로 유지한다.
- 다만 현재 구현도 이미 Mantine foundation 일부를 포함하므로, 남은 migration 범위를 기준으로 읽는다.
- 공통 layout / card / state / action 패턴을 Mantine 중심으로 정리한다.

### 3. Quick Add Positioning

- Quick Add는 수동 폼이 아니라 import-first 흐름으로 유지한다.
- 이번 단계에서는 UX 구조와 카피를 다듬고, 외부 metadata 연동은 다음 단계로 넘긴다.

### 4. Placeholder Discipline

- 확장 목적지라도 제품 톤을 해치지 않게 정리한다.
- placeholder는 명확한 역할, 다음 CTA, 현재 상태 설명을 가져야 한다.

## Next

- 외부 metadata 후보 연동을 위한 Quick Add 준비
- 게스트 기록 -> 계정 전환 UX 설계
- 공개 프로필과 개인 프로필의 경계 정리
- tier board 기능 착수를 위한 제품 경계 고정
- 보안 로드맵의 공개 전 필수 항목 착수

## Later / Exploratory

- 공개 레이어
- 작품 집계와 community surface
- tier board 공유/편집 경험
- catalog/public architecture
- 구글 로그인 중심 auth 전환

## Dependencies

- [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)
- [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)
- [`../backend/SECURITY_HARDENING_ROADMAP.md`](../backend/SECURITY_HARDENING_ROADMAP.md)
- 현재 route/layout 의미 유지

## Exit Criteria

- 핵심 사용자 흐름이 제품 문서와 코드에서 같은 우선순위로 설명된다.
- Mantine 전환이 “비전”이 아니라 실행 계획으로 명확히 고정된다.
- 확장 목적지와 현재 구현 화면의 책임 구분이 문서상 분명하다.
- 현재 구현 설명과 장기 비전 설명이 한 문서 안에서 섞이지 않는다.
