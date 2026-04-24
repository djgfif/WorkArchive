# BACKEND_SERVICE_REDESIGN_MASTERPLAN.md

| Field | Value |
| --- | --- |
| Status | `canonical` |
| Role | `target backend structure` |
| Source of truth | current API modules, Prisma schema, `WorksService` orchestration, product expansion strategy |
| Last verified against | `2026-04-24` working tree |
| When to update | 백엔드 도메인 경계, migration slice, target module map이 바뀔 때 |

이 문서는 Work Archive 백엔드의 **목표 구조 기준**이다. 현재 구현 상태 설명은 `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`에서 보고, 여기서는 어디로 더 분리해 가야 하는지를 정의한다.

## Goal

현재의 flat `Works` API를, local-first 개인 기록을 유지하면서도 catalog/public/tier/community 확장을 수용할 수 있는 **도메인 분리형 백엔드 구조**로 옮긴다.

## Current Baseline

- 현재 모듈: `Auth`, `Health`, `Catalog`, `UserRecords`, `Imports`, `Works`, `Sync`, `Prisma`
- 현재 모델 축: `CatalogWork` compatibility layer와 `CatalogTitle`/`CatalogRelease`/`CatalogExternalRef` 공용 catalog layer, `UserWorkRecord`/`UserReleaseRecord` 개인 기록 layer가 함께 존재한다.
- `CatalogWork`와 `UserWorkRecord`는 이미 분리돼 있고, `CatalogTitle`/`CatalogRelease` read path도 일부 노출돼 있다.
- 다만 현재 `WorksModule`은 flat API 계약을 유지하기 위한 compatibility façade다.
- 현재 create/update는 `CatalogService`와 `UserRecordsService`를 함께 호출하며 사실상 `1:1` split-only 중간 단계를 유지한다.
- sync create는 `catalogTitleId`와 `importDraft`를 받아 catalog/user-record 경계로 진입할 수 있지만, 여전히 compatibility catalog work를 함께 만든다.

즉, 현재 구조는 **분리된 데이터 모델 위에 flat compatibility API가 남아 있는 단계**다.

## Committed Now

### 1. Core Modules Stay Explicit

다음은 기반 모듈로 유지한다.

- `Auth`
- `Users`
- `Health`
- `Prisma`
- `Sync`

### 2. Record Plane And Shared Plane Must Split Further

장기적으로는 아래 경계를 더 분명히 한다.

- `Catalog`
- `UserRecords`
- `Imports`
- `PublicLayer`
- `TierBoards`

핵심 원칙:

- 작품 자체와 개인 기록은 분리한다.
- sync는 개인 기록 정합성 문제다.
- public aggregate는 private record path와 분리한다.

### 3. `Works` Is A Compatibility Layer, Not A Growth Target

새 기능이 필요하더라도 flat `Works` 계약과 compatibility 계층에 계속 책임을 누적하는 방향을 기본값으로 삼지 않는다.

- `Works`는 현재 사용자-facing API 호환 계층이다.
- 도메인 지식은 가능한 한 `Catalog`, `UserRecords`, `Imports` 쪽으로 이동한다.
- 새로운 public/community 요구사항은 `Works`가 아니라 별도 도메인 경계에서 받는다.

## Next

### Migration Slice 1

- 현재 `CatalogWork`와 `UserWorkRecord`의 책임 문서화
- Quick Add / import 흐름을 지원할 `Imports` 경계 정의
- catalog 후보와 개인 저장 흐름을 제품/백엔드 양쪽에서 분리

### Migration Slice 2

- 현재 `1:1` split-only 구조에서 재사용 가능한 catalog 조건 정의
- flat `Works` API를 한 번에 제거하지 않고, 점진 분해 전략 준비
- public aggregate를 붙이기 전 read path 분리 기준 정리

## Later / Exploratory

- `PublicProfiles`
- `PublicWorks`
- `Community`
- `Insights`
- `Jobs`
- `Audit`
- moderation and governance plane

## Dependencies

- import-first Quick Add 방향
- verified catalog strategy
- security roadmap의 권한/공개 데이터 경계 강화
- 현재 manual sync 계약 유지

## Exit Criteria

- 새 기능이 어느 도메인 경계에 속하는지 문서만 보고도 판단할 수 있다.
- `Works` compatibility layer가 확장 기본값이 아니게 된다.
- catalog/public/community 확장이 private record와 구분된 구조로 설명된다.
- 실제 구현 착수 전 필요한 migration slices가 문서에 정리된다.
