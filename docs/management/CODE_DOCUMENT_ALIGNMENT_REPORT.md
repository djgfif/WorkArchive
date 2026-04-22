# CODE_DOCUMENT_ALIGNMENT_REPORT.md

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `alignment report` |
| Source of truth | 현재 소스 트리, package manifests, 핵심 엔트리 파일, current canonical docs |
| Last verified against | `2026-04-22` working tree |
| When to update | 코드 현실과 문서 해석 사이의 intentional gap이 바뀔 때 |

이 문서는 현재 코드와 문서 사이에 **의도적으로 남아 있는 간격**만 설명한다. 이미 정정된 현재 상태를 다시 반복하는 문서가 아니다.

## 1. Currently Aligned

- 저장소 실제 스택은 React `19` + Vite `6` + Dexie 프론트, NestJS `11` + Prisma `6` API, npm workspaces 모노레포다.
- 현재 프론트 라우트는 `MainProductLayout`, `AuthLayout`, `AccountLayout`, `MinimalLayout`의 4개 맥락으로 분리되어 있다.
- 현재 인증은 access token local storage + refresh cookie 구조다.
- 현재 백엔드는 `CatalogWork` + `UserWorkRecord` split model 위에 flat `Works` API를 유지하는 과도기 구조다.
- 현재 상태 문서와 루트 README는 guest/auth archive 분리, manual sync, placeholder 페이지 존재를 기준 현실로 본다.

## 2. Intentional Gaps

### Frontend CSS Debt

- 여러 프론트/제품 문서는 Mantine와 shared primitives 중심 구조를 목표로 둔다.
- 현재 코드는 이미 `MantineProvider`, theme, shared wrappers를 포함한다.
- 다만 화면 대부분은 여전히 `global.css`, `var(--accent)` 직접 참조, 페이지별 클래스 조합 의존이 크다.
- 따라서 frontend roadmap 문서는 “미도입”이 아니라 “foundation은 도입됐고 migration이 남아 있다”는 의미로 읽어야 한다.

### Quick Add Preview Seam

- 제품/백엔드 문서는 import-first Quick Add 방향을 유지한다.
- 현재 프론트의 `importsService`는 아직 `preview-manual` adapter만 사용한다.
- 즉, Quick Add는 UX와 경계는 존재하지만 외부 metadata truth source는 아직 연결되지 않았다.

### Placeholder Surfaces

- `Tier Boards`, `Insights`, `Community` 확장 문서는 제품 확장 구조를 설명한다.
- 현재 코드에서는 이 영역이 placeholder 또는 미구현 상태다.
- 따라서 해당 문서들은 current implementation이 아니라 expansion 문서다.

### Flat Works Compatibility Layer

- 백엔드 재설계 문서는 catalog/user record/public layer 분리를 목표로 둔다.
- 현재 코드는 이미 split model을 도입했지만, `WorksModule`은 여전히 flat 계약을 유지하는 compatibility façade다.
- 따라서 backend 문서는 “분리 예정”이 아니라 “분리는 시작됐고 compatibility 계층이 남아 있다”는 의미로 읽어야 한다.

## 3. Reading Rule

- 현재 코드 현실이 필요하면 [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)를 먼저 본다.
- 현재 프론트 판단이 필요하면 [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)를 먼저 본다.
- 프론트 상세 실행 단계가 필요하면 [`../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](../frontend/FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)를 본다.
- 제품 비전이나 확장 전략이 필요하면 product 문서를 본다.
- reference 문서는 현재 상태 판단에 사용하지 않는다.

## 4. Update Triggers

다음 중 하나가 바뀌면 이 문서를 갱신한다.

1. 현재 스택과 package version의 해석이 달라질 때
2. 현재 라우트/레이아웃/세션 저장 기준 문서가 바뀔 때
3. Quick Add seam, placeholder surfaces, flat `Works` compatibility layer의 성격이 달라질 때
4. roadmap 문서가 다시 current reality처럼 읽히기 쉬워질 때
