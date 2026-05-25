# docs/frontend/

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `navigation` |
| Source of truth | [`FRONTEND_BLUEPRINT_V1.md`](./FRONTEND_BLUEPRINT_V1.md) |
| Last verified against | `2026-04-24` working tree |
| When to update | 프론트 기준 문서 구성과 읽기 순서가 바뀔 때 |

이 폴더는 현재 프론트 기준, 남은 구조 과제, Mantine 전환 상세 실행 계획을 다룬다.

## Read In This Order

1. [`FRONTEND_BLUEPRINT_V1.md`](./FRONTEND_BLUEPRINT_V1.md)
2. [`../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`](../project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md)
3. [`FRONTEND_FOUNDATION_MASTERPLAN.md`](./FRONTEND_FOUNDATION_MASTERPLAN.md)
4. [`FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](./FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)

## Document Roles

- 현재 프론트 canonical: [`FRONTEND_BLUEPRINT_V1.md`](./FRONTEND_BLUEPRINT_V1.md)
- 목표 구조 canonical: [`FRONTEND_FOUNDATION_MASTERPLAN.md`](./FRONTEND_FOUNDATION_MASTERPLAN.md)
- 프론트 5단계 상세 실행 로드맵: [`FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md`](./FRONTEND_UI_REFACTOR_EXECUTION_PLAN.md)

## Design Workflow Rule

프론트엔드 디자인, 화면 구조 탐색, 디자인 시스템 정의, 화면 시안, 스타일 가이드는 **`stich MCP 서버 (Stitch)`를 우선 사용한다.**

예외:

- 기존 화면의 작은 CSS 수정
- 단순 spacing 조정
- 비주얼 탐색이 필요 없는 순수 로직 작업

위 작업은 `stich MCP 서버` 의무 대상이 아니다.

## Playwright E2E Environment

WSL2/Ubuntu에서 `npm run test:e2e:web`가 Chromium 실행 전에
`libnspr4.so`, `libnss3.so`, `libnssutil3.so`, `libasound.so.2` 같은 shared
library 누락으로 실패하면 앱 코드 문제가 아니라 Playwright browser runtime
의존성 문제다.

권장 설치:

```bash
sudo npx playwright install-deps chromium-headless-shell
```

설치 전후 확인:

```bash
npx playwright install-deps chromium-headless-shell --dry-run
ldd ~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell | rg "not found"
npm run test:e2e:web
```

`--dry-run`이 missing dependency 없이 종료하고, `ldd ... | rg "not found"`가
아무 줄도 출력하지 않아야 한다. Ubuntu 24.04 기준 핵심 누락 패키지는
`libnspr4`, `libnss3`, `libasound2t64`이며, Playwright dry-run은 fonts,
`xvfb`, `x11-xkb-utils`, `xfonts-*`, `xserver-common`까지 요구할 수 있다.
직접 apt 패키지를 고정하기보다 Playwright의 `install-deps` 결과를 기준으로
환경을 맞춘다.

현재 CI는 web Playwright e2e를 실행하지 않는다. CI에
`npm run test:e2e:web`를 추가할 때는 그 전에
`npx playwright install --with-deps chromium` 또는
`npx playwright install-deps chromium-headless-shell` 단계를 추가한다.
