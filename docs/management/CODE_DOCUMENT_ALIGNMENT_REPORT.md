# CODE_DOCUMENT_ALIGNMENT_REPORT.md

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `alignment report` |
| Source of truth | 현재 소스 트리, package manifests, 핵심 엔트리 파일 |
| Last verified against | `2026-04-21` working tree |
| When to update | 코드 현실과 문서 해석 사이의 중요한 간격이 바뀔 때 |

이 문서는 현재 코드와 문서 사이의 중요한 간격을 설명한다. 모든 차이를 없애는 것이 목적이 아니라, 어떤 차이가 intentional한지 명확히 하는 것이 목적이다.

## 1. Currently Aligned

- 저장소 실제 스택은 React `19` + Vite `6` + Dexie 프론트, NestJS `11` + Prisma `6` API, npm workspaces 모노레포다.
- 현재 프론트 라우트는 `MainProductLayout`, `AuthLayout`, `AccountLayout`, `MinimalLayout`의 4개 맥락으로 분리되어 있다.
- 현재 API 모듈은 `Auth`, `Health`, `Works`, `Sync`, `Prisma` 중심이다.
- 현재 상태 문서와 루트 README는 guest/auth archive 분리, manual sync, placeholder 페이지 존재를 기준 현실로 본다.

## 2. Intentional Gaps

### Mantine

- 여러 제품/프론트 문서는 Mantine 전환을 목표로 둔다.
- 현재 코드는 이미 `MantineProvider`, theme, shared page primitives 일부를 포함한다.
- 다만 화면 대부분은 여전히 `global.css`와 수동 클래스 조합 의존이 크다.
- 따라서 Mantine 관련 문서는 “미도입”이 아니라 “foundation은 도입됐고 migration은 진행 중”으로 읽어야 한다.

### Authentication Strategy

- 제품 전략 문서는 `게스트 유지 + 구글 로그인 메인` 방향을 제안한다.
- 현재 코드는 이메일/비밀번호 인증과 `localStorage` 기반 token 저장을 사용한다.
- 현재 프론트에는 `/account/transfer` guest review/import 흐름이 이미 구현돼 있다.
- 따라서 인증 전략 문서는 future product strategy이며 현재 구현 설명이 아니다.

### Product Expansion

- `Tier Boards`, `Insights`, `Community`, catalog/public/community 확장 문서는 제품 확장 구조를 설명한다.
- 현재 코드에서는 이 영역이 placeholder 또는 미구현 상태다.
- 따라서 이 문서들은 exploratory/expansion 문서다.

### Security

- 보안 로드맵은 refresh token cookie, strict CORS, rate limiting, Swagger 제한을 목표로 둔다.
- 현재 코드는 refresh/access token을 브라우저 `localStorage`에 저장하고, CORS는 빈 값 또는 `*`에서 wildcard fallback을 허용하며, Swagger는 기본 활성화 상태다.
- 따라서 보안 문서는 current state가 아니라 required hardening backlog다.

### Validation Surface

- `npm run typecheck`는 이번 문서 정리 패스에서 통과를 확인했다.
- `npm run test --workspace @work-archive/web`는 이번 패스에서 `13` files, `39` tests 통과를 확인했다.
- root `npm run test`와 API workspace test는 이번 패스에서 완료 여부를 재확정하지 못했다.
- 따라서 문서에는 “테스트 스크립트 존재”와 “빠른 회귀 확인 완료”를 구분해 적는다.

## 3. Reading Rule

- 현재 코드 현실이 필요하면 [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)를 먼저 본다.
- 현재 프론트 판단이 필요하면 [`../frontend/FRONTEND_BLUEPRINT_V1.md`](../frontend/FRONTEND_BLUEPRINT_V1.md)를 먼저 본다.
- 구조 목표가 필요하면 `FOUNDATION_MASTERPLAN` 또는 `BACKEND_SERVICE_REDESIGN_MASTERPLAN`을 본다.
- 제품 비전이나 확장 전략이 필요하면 product 문서를 본다.
- reference 문서는 현재 상태 판단에 사용하지 않는다.

## 4. Update Triggers

다음 중 하나가 바뀌면 이 문서를 갱신한다.

1. 현재 스택과 package version의 해석이 달라질 때
2. 현재 라우트/레이아웃/모듈 기준 문서가 바뀔 때
3. target roadmap 문서가 current reality처럼 읽히기 쉬워질 때
4. 검증 표면의 신뢰도 설명이 달라질 때
