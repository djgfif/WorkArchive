# Commercial UI Completion Report

Last updated: 2026-05-17

## 변경 요약

- `COMMERCIAL_WEB_UI_AUDIT.md`를 새로 작성해 화면별 장점, 문제, 미달 지점, P0/P1/P2, 수정 대상, 완료 기준을 고정했다.
- `PRODUCT_UI_DESIGN_STANDARD.md`를 새로 작성해 Work Archive의 local-first 제품 성격, 화면 archetype, Mantine 기반 surface/button/badge/state/mobile/accessibility 기준을 명문화했다.
- `COMMERCIAL_UI_COMPLETION_AUDIT.md`를 현재 구현 기준의 요구사항별 증거 매트릭스로 갱신하고, `COMMERCIAL_UI_COMPLETION_ROADMAP.md`는 완료 후 backlog와 guardrail 문서로 정리했다.
- 공통 primitive에 `LoadingState`, `LoadingRows`를 추가해 dense screen의 loading을 단순 텍스트가 아닌 구조화된 placeholder로 표시하게 했다.
- Main product nav에서 Tier Boards를 낮은 위계의 `보드 + 준비 중` 상태로 표시하고, Community는 계속 primary nav에서 제외했다.
- Works library 검색을 고급 필터 밖으로 꺼내 항상 노출하고, 상태/유형/태그/정렬은 접힌 advanced filter로 유지했다.
- Home, Works, Detail, Edit, Insights, Sync의 주요 loading state를 공통 skeleton 패턴으로 교체했다.
- Home 최근 기록과 Profile 개인 기록 요약의 로드 실패 상태에 `다시 불러오기`, `작품 목록 열기`, `작품 추가` action을 추가해 IndexedDB 장애 후 복구 경로를 일관화했다.
- AccountLayout을 데스크톱 sticky side nav와 모바일 상단 section nav로 분리하고, 계정/동기화 상태 배지를 관리 화면에 노출했다.
- Profile route를 공개 표면이 아닌 개인 기록 요약 화면으로 정리하고, Account CTA도 `프로필` 대신 `기록 요약` 맥락으로 맞췄다. 최근 기록과 `이어 기록하기` CTA를 추가해 계정 요약에서 실제 기록 화면으로 바로 돌아갈 수 있게 했다.
- 320px 모바일 헤더에서 계정 메뉴와 테마 토글은 drawer로 낮추고, 상단에는 compact `작품 추가` CTA만 유지해 가로 overflow를 제거했다.
- Theme toggle의 accessible name을 “다크/라이트 모드로 전환”으로 명확히 했다.
- 변경된 UI contract에 맞춰 App/AppPrimitives 테스트 기대값을 갱신했다.
- Works filter chip 제거, 적용 필터 개수 요약, 고급 필터 접힘 상태, 검색 상시 노출, URL query 정리를 검증하는 테스트를 추가했다.
- Works 대량 목록은 grid/list별 초기 표시 수를 제한하고 `더 보기` action으로 확장하는 점진 렌더링을 추가했다.
- Insights 분포 row에서 Works query로 이어지는 `보기` 링크를 추가하고, 매체/장르/태그/상태/별점 분포가 실제 목록 탐색으로 연결되는지 테스트로 고정했다. 별점 분포는 `rating` query로 정확한 값 필터에 연결된다. 집계 로드 실패 상태에는 재시도, 작품 목록, 작품 추가 action을 제공한다.
- Work Detail의 빠른 기록, 진행도, 타임라인, 권별 기록 action에 성공 feedback을 추가했다. 타임라인은 감상 흐름 중심으로 저장 정보와 분리하고, 기록이 많은 경우 최신 흐름 요약과 접힌 전체 목록으로 밀도를 낮췄다.
- 제품 피드백 정책은 `FeedbackMessage` 기반 inline feedback으로 고정했다. 전역 toast는 현재 범위에 넣지 않고, error는 다음 action을 제공하며 success는 최신 action 결과를 교체하거나 완료 상태에 붙인다.
- Work Edit 저장 후 상세 화면으로 돌아갈 때 성공 피드백 신호를 전달해 수정 완료 맥락이 즉시 사라지지 않게 했다.
- Auth shell과 로그인/회원가입/비밀번호 재설정 화면에 local-first 안내, 계정 동기화 범위, 복구 시 데이터 유지 안내를 추가하고 제출 중 loading/feedback 접근성을 정리했다. Auth submit 오류는 입력/인증 실패/네트워크/서버 문제를 화면 맥락별 메시지로 정규화한다.
- Auth 오류 메시지 localizer와 실패 로그인 화면 테스트를 추가해 API 원문이 그대로 노출되지 않도록 고정했다.
- Guest transfer review는 로딩/이관/건너뛰기 실패 메시지를 관리 화면 맥락에 맞게 구분하고, 로딩 실패 시 `다시 확인`과 `Works에서 확인` action을 제공한다.
- Settings provider readiness에 공개/사용 가능/key 필요 요약을 추가하고, 로그인 세션 영역을 한국어 보안 관리 패턴과 명확한 revoke action copy로 정리했다.
- Tier Boards와 Community placeholder에 현재 가능한 대체 행동 CTA를 추가하고, placeholder가 구현 완료 기능처럼 보이지 않는지 테스트로 고정했다.

## 화면별 개선 내용

- Home: 최근 기록 영역 loading을 row skeleton으로 바꾸고, inline grid span 대신 Mantine `Grid.Col`로 데스크톱/모바일 layout 안정성을 높였다. 최근 기록 로드 실패 시 재시도, 작품 목록, 작품 추가 action을 제공한다.
- Works: 검색을 상시 노출하고 고급 필터는 기본 접힘으로 전환해 모바일에서 핵심 탐색 도구가 묻히지 않게 했다.
- Works: 적용 중인 검색/상태/유형/별점/정렬 chip이 고급 필터가 닫힌 상태에서도 보이고, `N개 적용` badge와 `적용된 필터` 접근성 그룹으로 모바일에서도 조건 수를 빠르게 파악할 수 있다. 개별 제거 시 URL query와 결과 목록이 함께 정리되는지 테스트로 고정했다. 목록 로드 실패 상태에는 `다시 불러오기`와 `작품 추가` action을 제공한다.
- Works: 60개를 넘는 grid 목록은 초기 DOM을 제한하고 현재 표시 수를 보여준 뒤 `더 보기`로 확장한다. 75개 fixture에서 마지막 항목이 초기 렌더에서 제외되고 action 후 표시되는지 테스트로 고정했다.
- Work Create/Edit: 기존 title-only save, 검색 후보 적용, cover fallback 흐름은 유지했다. 장르/개인 태그 입력은 Mantine `TagsInput` 기반 chip 입력으로 전환해 쉼표 문자열 편집 부담을 줄였고, 저장 payload는 기존 배열 파싱 계약을 유지한다. 검색 후보 로딩은 목록과 미리보기 skeleton으로 구조화해 결과가 들어올 자리를 유지한다. 긴 편집 폼은 모바일 하단 고정 저장 action으로 저장/취소 접근성을 보강했다. 리뷰 집중 수정은 상태 안내를 노출하고 감상 입력에 초점을 이동한다. 편집 저장 후 상세 화면에 inline 성공 피드백이 남아 전환 후에도 저장 완료를 확인할 수 있다.
- Work Detail: detail/edit loading을 구조화하고 danger zone 분리, 개인 기록 우선 구조를 유지했다. 빠른 기록과 진행도 저장은 성공 시 inline feedback을 보여주고 5초 뒤 자동 정리한다. 긴 타임라인은 최신 감상 흐름 요약을 먼저 보여준 뒤 전체 이력/추가 폼을 펼치게 했다.
- Insights: 집계 loading을 dashboard skeleton으로 바꿨고 개인-only dashboard framing은 유지했다. 분포 row의 `보기` 링크로 Works filtered view에 진입할 수 있고, 오래 방치한 작품은 제목이 포함된 `이어 기록하기` 링크로 상세 화면에 바로 돌아갈 수 있다. 집계 로드 실패 시 `다시 불러오기`, `작품 목록 열기`, `작품 추가` action을 제공한다.
- Account/Sync/Settings: 모바일 계정 nav를 상단 section nav로 분리하고 빠른 작업을 별도 full-width 그룹으로 정리해 좁은 폭에서 로그인/로그아웃, 테마, 기록 요약 CTA가 눌리지 않게 했다. 계정 홈에서는 동기화 주의 상태를 badge와 CTA로 드러냈다. Profile route는 개인 기록 요약으로 제한해 공개/SNS 표면처럼 보이지 않게 했고, 최근 기록/이어가기 CTA로 실제 기록 흐름과 연결했다. 개인 기록 요약 로드 실패 시 재시도, 작품 목록, 작품 추가 action을 제공한다. Sync loading을 구조화했고 pending/failed/conflict/merge 관리 흐름은 유지했다. 수동 동기화 실패 run은 `확인 필요` summary, 실패/충돌/보류 metric, `다시 동기화` action으로 상단에서 다음 행동을 보여준다. 실패 항목은 인증 만료, 네트워크, 서버 검증, 서버 오류, 미분류로 진단하고 다음 행동 안내와 필요한 링크를 제공한다. 충돌 비교는 핵심 차이만 먼저 보여주고 전체 필드 비교는 접힌 상세 영역으로 낮춰 관리 화면 밀도를 보정했다.
- Settings: provider readiness와 login sessions가 관리 콘솔처럼 상태 요약, 현재/다른 기기 구분, 위험 action copy를 제공한다.
- Auth: focused form shell을 유지하면서 local-first/계정 동기화 안내, field helper text, submit loading, role 기반 feedback과 context-aware error copy를 보강했다. Guest transfer review의 실패/재시도 흐름도 테스트로 고정했다.
- Placeholder: Tier Boards는 준비 중 상태로 낮은 위계에 두고 Community는 범위 밖 기능으로 유지했다. 두 placeholder 모두 지금 할 수 있는 대체 행동을 제공한다.

## 남은 한계

- Tier Boards는 여전히 production 기능이 아니라 준비 중 placeholder다.
- Community는 의도적으로 이번 제품 범위 밖이다.

## 실행한 검증 명령과 결과

- `npm run lint`: 통과.
- `npm run typecheck`: 통과.
- `npm run test -w @work-archive/web -- App.test.tsx ProfilePage.test.tsx`: 최초 sandbox 실행은 Vite/esbuild `spawn EPERM`으로 실패. 승인된 재실행 후 통과.
  - Web targeted: 2 files, 5 tests passed.
- `npm run test -w @work-archive/web -- InsightsPage.test.tsx`: 통과.
  - Web targeted: 1 file, 3 tests passed.
- `npm run test -w @work-archive/web -- SyncPage.test.tsx`: 통과.
  - Web targeted: 1 file, 9 tests passed.
- `npm run test -w @work-archive/web -- WorksListPage.test.tsx`: 최초 sandbox 실행은 Vite/esbuild `spawn EPERM`으로 실패. 승인된 재실행 후 통과.
  - Web targeted: 1 file, 8 tests passed.
- `npm run test`: 최초 sandbox 실행은 Web Vitest 단계의 Vite/esbuild `spawn EPERM`으로 실패. 승인된 재실행 후 통과.
  - API: 13 suites, 109 tests passed.
  - Web: 28 files, 171 tests passed.
- `npm run build`: 최초 sandbox 실행은 Web Vite 단계의 Vite/esbuild `spawn EPERM`으로 실패. 승인된 재실행 후 통과.
  - Web production build: 841 modules transformed.
- Browser visual smoke:
  - Production build 정적 서버로 `Home` desktop 1360px, `Works` mobile 390px, `Account` mobile 390px, `Tier Boards` mobile 390px를 열어 ready state와 horizontal overflow 없음을 확인했다.
  - Screenshots were stored in the local OS temp directory and were not committed.
- 320px Chrome CDP visual metrics:
  - Production build에서 `Work Create`, `Work Detail`, `Work Edit`, `Sync`를 320px viewport로 열고 `documentElement.scrollWidth === innerWidth === 320`을 확인했다.
  - `Work Create`와 `Sync` ready-state screenshots were stored locally and were not committed.

## 후속 조치

- 수천 단위 실제 데이터셋에서는 browser performance budget을 측정해 full virtualization 필요 여부를 별도 판단한다.
