# Commercial Web UI Audit

Last reviewed: 2026-05-17

## Scope

This audit covers the local-first Work Archive web frontend: Home, Works, Work Create, Work Edit, Work Detail, Insights, Account, Sync, Settings, Auth, Tier Boards, Community, and shared placeholder patterns.

## Home

### 현재 장점

- 검색, 작품 추가, 작품 보기, 최근 기록, 이어가기, 통계가 첫 화면에 있다.
- guest와 authenticated copy가 분리되어 local-first 저장 성격을 설명한다.
- 최근 기록 row에 표지, 상태, 별점, 진행도, 최근 수정일, 마지막 감상일이 함께 보인다.
- 최근 기록 로드 실패 시 `다시 불러오기`, `작품 목록 열기`, `작품 추가` action을 제공한다.

### 현재 문제

- 최근 기록 loading이 단순 텍스트였고, 첫 사용자가 보는 구조적 placeholder가 약했다.
- 데스크톱 12-column 의도를 inline grid span으로 처리해 작은 화면에서 implicit column 위험이 있었다.

### 실제 서비스 기준 미달 지점

- 매일 들어오는 hub라면 로딩 중에도 “곧 최근 기록이 들어올 자리”가 보여야 한다.
- 모바일에서 검색과 CTA가 먼저 안정적으로 쌓여야 한다.

### 개선 우선순위

- P0: mobile-safe layout, structured loading.
- P1: 최근 기록 없음/로드 실패의 다음 행동 CTA와 재시도 테스트 유지.
- P2: 최근 기록별 빠른 기록 CTA는 상세/목록 안정화 후 검토.

### 수정 대상 파일

- `apps/web/src/features/home/pages/HomePage.tsx`
- `apps/web/src/shared/components/AppPrimitives.tsx`

### 완료 기준

- 320px~430px 폭에서 hero, 검색, CTA, 최근 기록이 가로 overflow 없이 보인다.
- loading, empty, error, populated state가 서로 다른 의미로 보인다.

## Works

### 현재 장점

- 검색, 상태, 유형, 태그, 정렬, active/trash scope, grid/list view가 URL query와 연결되어 있다.
- 삭제는 soft-delete이며 휴지통 복원 흐름이 있다.
- grid는 media library에 가깝고 list는 관리 row 역할을 한다.
- 목록 로드 실패 시 `다시 불러오기`와 `작품 추가` action을 제공해 에러 화면에서 막히지 않는다.
- 대량 목록은 grid/list별 초기 표시 수를 제한하고 `더 보기`로 확장해 100개 수준의 기록에서도 초기 DOM을 과도하게 키우지 않는다.

### 현재 문제

- 검색이 고급 필터 collapse 안에 들어가면 모바일에서 핵심 탐색 도구가 숨겨질 수 있었다.
- loading state가 단순 message 중심이었다.
- 필터가 많이 걸린 상황은 `N개 적용` badge와 `적용된 필터` 접근성 그룹으로 요약된다.
- 수천 단위 데이터셋에서는 별도 virtualization 측정이 필요하지만, 현재 상용 기준의 개인 기록 규모는 점진 렌더링으로 방어한다.

### 실제 서비스 기준 미달 지점

- 검색은 이 제품의 핵심 조작이므로 항상 노출되어야 한다.
- active/trash와 view mode가 명확해야 하며, 필터가 닫혀 있어도 적용 조건은 보여야 한다.

### 개선 우선순위

- P0: 검색 상시 노출, 고급 필터 접힘, skeleton loading.
- P1: filter chip 제거, 적용 필터 개수 요약, 목록 로드 실패 복구 action, 대량 목록 점진 렌더링 테스트 유지.
- P2: 수천 단위 실제 데이터셋에서 virtualization 필요 여부 측정.

### 수정 대상 파일

- `apps/web/src/features/works/pages/WorksListPage.tsx`
- `apps/web/src/features/works/components/WorksToolbar.tsx`
- `apps/web/src/features/works/components/WorksList.tsx`
- `apps/web/src/features/works/components/PosterTile.tsx`
- `apps/web/src/features/works/components/WorkListRow.tsx`
- `apps/web/src/features/works/components/WorksTrashList.tsx`

### 완료 기준

- 작품 0개, 필터 결과 없음, 휴지통 비어 있음, loading, error가 서로 다르게 안내된다.
- 검색은 접힌 고급 필터와 무관하게 바로 사용할 수 있다.
- 60개를 넘는 grid 목록은 초기 렌더를 제한하고 사용자가 `더 보기`로 확장할 수 있다.

## Work Create

### 현재 장점

- 직접 입력과 검색으로 채우기 split이 있고 기본 경로는 빠른 직접 입력이다.
- 제목 필수 검증, provider readiness, candidate duplicate check, 저장 후 다음 행동이 있다.
- 검색 후보 적용 후 채워진 정보와 사용자가 채우면 좋은 개인 기록 필드가 요약된다.
- 후보 검색 중에는 목록과 미리보기 자리가 skeleton으로 유지되어 검색 결과가 들어올 구조를 예측할 수 있다.
- 장르와 개인 태그는 Mantine `TagsInput`으로 입력/삭제할 수 있어 쉼표 문자열 편집보다 실제 chip 입력 흐름에 가깝다.

### 현재 문제

- 후보 검색과 직접 입력의 상태 copy는 provider별 실패 조건이 늘어날 때 계속 정리되어야 한다.

### 실제 서비스 기준 미달 지점

- 후보 검색 실패, 외부 provider 미준비, 직접 추가 fallback이 항상 같은 위계로 이해되어야 한다.

### 개선 우선순위

- P0: 직접 입력 title-only save path 유지.
- P1: 검색 실패와 provider 상태 copy 유지.
- P2: token input의 추천/중복 처리 UX는 실제 태그 사용량이 늘어난 뒤 조정.

### 수정 대상 파일

- `apps/web/src/features/works/components/AddWorkFlow.tsx`
- `apps/web/src/features/works/components/AddWorkSearchPanel.tsx`
- `apps/web/src/features/works/pages/WorkCreatePage.tsx`

### 완료 기준

- 초보 사용자는 제목만 넣고 저장할 수 있고, 꼼꼼한 사용자는 검색 후보로 정보를 채운 뒤 개인 기록을 덧붙일 수 있다.

## Work Edit

### 현재 장점

- 전체 수정과 review focus mode가 나뉜다.
- 우측 preview가 입력 상태, 표지 fallback, badge, 태그 preview를 보여준다.
- 제목 검증과 submit feedback이 있다.
- 저장 후 상세 화면으로 돌아갈 때 성공 피드백이 남아 수정 완료 맥락을 확인할 수 있다.
- review focus mode는 상태 안내를 `role="status"`로 노출하고 첫 감상 입력으로 초점을 이동한다.

### 현재 문제

- 저장 성공 피드백은 상세 화면 inline feedback으로 남고, 전역 toast는 현재 제품 정책상 도입하지 않는다.

### 실제 서비스 기준 미달 지점

- form submit feedback과 상세 화면 inline feedback 정책은 `FeedbackMessage` 기반으로 계속 같은 톤을 유지해야 한다.

### 개선 우선순위

- P0: title validation, submitting disabled 유지.
- P1: review focus mode의 상태 안내, focus 이동, 입력 설명 연결 유지.
- P2: global notification이 필요한 cross-route event가 생기면 inline feedback과 중복되지 않게 별도 설계.

### 수정 대상 파일

- `apps/web/src/features/works/pages/WorkEditPage.tsx`
- `apps/web/src/features/works/components/WorkForm.tsx`

### 완료 기준

- 전체 수정과 리뷰 집중 수정의 목적이 다르게 느껴지고, 리뷰 집중 진입 시 현재 상태와 초점 위치가 명확하며, 모바일에서 입력 필드와 저장 action이 overflow 없이 유지된다.

## Work Detail

### 현재 장점

- hero가 표지, 제목, 작가, 상태, 별점, 진행도, 주요 CTA를 한 번에 보여준다.
- 개인 감상 기록이 작품 metadata보다 위에 있다.
- 빠른 기록, 진행도, 타임라인, 권별 기록, 관련 작품, danger zone이 분리되어 있다.
- 타임라인은 감상 날짜 흐름만 요약하고, 추가/수정 같은 저장 정보는 metadata 영역으로 분리한다. 기록이 많은 경우 최신 흐름만 먼저 보여주고 전체 타임라인은 접힌 상태로 둔다.

### 현재 문제

- loading은 구조화되었고, timeline/release가 많은 작품도 기본 화면 길이를 줄였다.
- 빠른 저장 성공 피드백은 5초 후 자동 정리되며, 반복 action은 최신 inline feedback으로 교체된다.

### 실제 서비스 기준 미달 지점

- 상세 화면은 DB page가 아니라 personal record dossier이므로 개인 기록 위계가 계속 우선되어야 한다.

### 개선 우선순위

- P0: structured loading, danger zone 분리 유지.
- P1: quick save success feedback의 5초 자동 정리와 최신 action 교체 정책 유지.
- P2: 매우 긴 수동 타임라인에서 paging 또는 더 보기 검토.

### 수정 대상 파일

- `apps/web/src/features/works/pages/WorkDetailPage.tsx`
- `apps/web/src/features/works/components/WorkDetailPanel.tsx`

### 완료 기준

- 첫 화면에서 내 감상, 상태, 별점, 진행도가 먼저 보이고 metadata는 낮은 위계로 정리된다.

## Insights

### 현재 장점

- 실제 IndexedDB 기반 집계가 있고 전체 기록, 평균 별점, 올해 완료, 즐겨찾기, 중단률을 계산한다.
- 매체, 장르, 태그, 상태, 별점, 월별 완료, 높은 평가, 방치 작품 섹션이 있다.
- 오래 방치한 작품은 제목이 포함된 `이어 기록하기` 링크로 상세 화면에 바로 돌아갈 수 있다.
- 집계 로드 실패 시 `다시 불러오기`, `작품 목록 열기`, `작품 추가` action을 제공한다.

### 현재 문제

- loading이 구조화되지 않았다.
- 분포 row는 Works query로 이어지고, 별점 bucket도 `rating` query로 정확한 별점 값 필터에 연결된다.

### 실제 서비스 기준 미달 지점

- 사용자가 “다음에 무엇을 할지” 바로 떠올리려면 stale/high-rated/tag gaps가 행동으로 이어져야 한다.

### 개선 우선순위

- P0: no-data CTA, structured loading, 집계 로드 실패 복구 action 유지.
- P1: 방치 작품 상세 이동과 accessible continue action 유지.
- P2: 분포 drill-down이 늘어날 경우 Works query chip/URL contract를 계속 테스트로 고정.

### 수정 대상 파일

- `apps/web/src/features/insights/pages/InsightsPage.tsx`
- `apps/web/src/features/insights/services/personal-insights.service.ts`

### 완료 기준

- 데이터가 없을 때는 추가/태그/별점 입력으로 이어지고, 데이터가 있을 때는 내 취향과 관리할 기록이 보인다.

## Account

### 현재 장점

- AccountLayout이 제품 영역과 분리되어 있고 account/sync/settings nav가 있다.
- Account overview는 계정 상태, 동기화, 설정, 개인 기록 요약을 분리한다.
- `/profile`은 외부 노출 화면이 아니라 개인 기록 요약 화면으로 정리했고, 계정 영역 CTA도 `기록 요약`으로 맞췄다.
- 기록 요약 화면에서 최근 기록과 `이어 기록하기` CTA를 제공해 개인 요약에서 실제 기록 흐름으로 돌아갈 수 있다.
- 기록 요약 로드 실패 시 `다시 불러오기`, `작품 목록 열기`, `작품 추가` action을 제공한다.
- 모바일 계정 nav와 빠른 작업은 별도 그룹으로 분리되어 좁은 폭에서도 로그인/로그아웃, 테마, 기록 요약 CTA가 눌리지 않는다.

### 현재 문제

- 기록 요약 화면은 향후 확장 시에도 공개/SNS 기능으로 오해되지 않게 유지해야 한다.

### 실제 서비스 기준 미달 지점

- 계정 영역은 링크 모음이 아니라 settings/control center처럼 보여야 한다.

### 개선 우선순위

- P0: account/sync/settings 접근성 유지.
- P1: 모바일 section nav, 빠른 작업 그룹, 개인 기록 요약 로드 실패 복구 action 유지.
- P2: 기록 요약이 더 커질 경우 최근 활동 범위와 계정 관리 항목의 분리 수준 재검토.

### 수정 대상 파일

- `apps/web/src/app/layouts/AccountLayout.tsx`
- `apps/web/src/features/profile/pages/AccountOverviewPage.tsx`
- `apps/web/src/features/profile/pages/ProfilePage.tsx`

### 완료 기준

- 사용자가 작품 탐색과 계정 관리의 맥락을 혼동하지 않고, 모바일에서도 계정 관리 CTA를 한 번에 식별하고 조작할 수 있다.

## Sync

### 현재 장점

- pending, failed, conflict, retry, local keep, remote apply, field merge가 구현되어 있다.
- guest 모드 안내와 로그인 CTA가 있다.
- 충돌 field comparison은 핵심 차이를 먼저 보여주고, 전체 비교 필드는 접힌 상세 영역으로 제공한다.
- 실패 항목은 인증 만료, 네트워크, 서버 검증, 서버 오류, 미분류로 진단하고 다음 행동 안내와 필요한 링크를 함께 제공한다.
- 수동 동기화 run 실패 시 `확인 필요` summary, 실패/충돌/보류 metric, `다시 동기화` action을 상단에 제공한다.

### 현재 문제

- sync run 결과 요약과 실패 복구 action은 테스트로 고정되었고, 향후 대량 충돌에서는 pagination 정책 검토가 필요하다.

### 실제 서비스 기준 미달 지점

- 동기화 문제 발생 시 다음 행동이 바로 보여야 한다.

### 개선 우선순위

- P0: structured loading, guest CTA, conflict action 유지.
- P1: failed diagnostic copy, run 실패 summary, 복구 CTA 유지.
- P2: 충돌 항목이 매우 많아질 경우 queue pagination 또는 bulk retry 정책 검토.

### 수정 대상 파일

- `apps/web/src/features/profile/components/settings/AccountBackupStatusSettingsSection.tsx`
- `apps/web/src/features/sync/hooks/useSyncDashboard.ts`

### 완료 기준

- pending/failed/conflict/empty/loading 상태를 사용자가 구분하고 다음 행동을 고를 수 있다.

## Settings

### 현재 장점

- appearance, local archive export/import, provider readiness/key vault, sessions, future settings가 구분되어 있다.
- 설정은 AccountPageTemplate 안에서 관리 맥락으로 표시된다.
- provider readiness는 공개/사용 가능/key 필요 개수를 요약하고, 세션 영역은 한국어 보안 관리 흐름으로 정리되어 있다.

### 현재 문제

- danger zone 패턴은 session revoke/import 같은 위험 동작에서 계속 일관화해야 한다.

### 실제 서비스 기준 미달 지점

- 설정은 기능 나열이 아니라 데이터 운영 console처럼 보여야 한다.

### 개선 우선순위

- P0: provider readiness/status clarity 유지.
- P1: dangerous session/data actions copy 유지.
- P2: settings future section은 구현된 기능처럼 보이지 않게 유지.

### 수정 대상 파일

- `apps/web/src/features/profile/pages/SettingsPage.tsx`
- `apps/web/src/features/profile/components/settings/SettingsSections.tsx`

### 완료 기준

- guest와 로그인 상태에서 가능한 설정 범위가 명확하다.

## Auth

### 현재 장점

- AuthLayout은 집중형 form shell이고 main product layout과 분리되어 있다.
- Login/Register/Reset이 AuthPageTemplate과 AuthForm을 공유한다.
- submit 중 disabled/loading state와 role 기반 feedback이 있다.
- local-first 저장, 선택적 계정 동기화, 공개 피드 없음이 auth shell과 화면별 안내에서 명확하다.
- 로그인/가입/비밀번호 재설정 submit 오류는 입력, 인증 실패, 네트워크, 서버 문제를 화면 맥락에 맞게 구분한다.
- guest transfer review는 로딩 실패, 이관 실패, 검토 완료 저장 실패를 구분하고 로딩 실패 시 재시도/Works 이동 action을 제공한다.

### 현재 문제

- guest transfer review는 Account layout 아래에 있어 Auth form과 시각 archetype이 다르므로 오류 tone이 관리 화면 패턴에 맞아야 한다.

### 실제 서비스 기준 미달 지점

- 인증 화면은 demo form이 아니라 신뢰할 수 있는 entry flow여야 한다.

### 개선 우선순위

- P0: submit 중복 방지, error feedback 유지.
- P1: guest transfer/local-first copy 유지.
- P2: guest transfer review에서 실제 충돌 항목이 많을 때 compact 비교 UI 검토.

### 수정 대상 파일

- `apps/web/src/app/layouts/AuthLayout.tsx`
- `apps/web/src/features/auth/components/AuthForm.tsx`
- `apps/web/src/features/auth/pages/*`

### 완료 기준

- 사용자는 로그인하지 않아도 local-first 기록을 시작할 수 있음을 이해하고, 로그인하면 동기화가 열리는 흐름을 이해한다.

## Placeholder Screens

### 현재 장점

- Tier Boards와 Community는 FutureFeaturePage로 정리되어 있고, Community는 현재 범위 밖임을 명확히 한다.
- 주요 CTA는 Works로 돌아간다.

### 현재 문제

- Tier Boards가 main nav에 보일 경우 준비 중 badge가 필요하다.
- placeholder도 버그나 빈 페이지처럼 보이지 않아야 한다.

### 실제 서비스 기준 미달 지점

- 기능이 없다는 사실을 숨기면 제품 신뢰가 떨어진다.

### 개선 우선순위

- P0: Tier Boards 준비 중 위계, Community global nav 제외.
- P1: 대체 행동 CTA 유지.
- P2: future roadmap link는 문서화 후 검토.

### 수정 대상 파일

- `apps/web/src/features/tier-boards/pages/TierBoardsPage.tsx`
- `apps/web/src/features/community/pages/CommunityPage.tsx`
- `apps/web/src/shared/components/FutureFeaturePage.tsx`
- `apps/web/src/app/layouts/MainProductLayout.tsx`

### 완료 기준

- 사용자가 placeholder를 클릭해도 “버그”가 아니라 “현재 제품 범위 안내”로 이해한다.
