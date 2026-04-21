# BACKEND_SERVICE_REDESIGN_MASTERPLAN.md

| Field | Value |
| --- | --- |
| Status | `canonical` |
| Role | `target backend structure` |
| Source of truth | current API modules, Prisma schema, product expansion strategy |
| Last verified against | `2026-04-21` working tree |
| When to update | 백엔드 도메인 경계, migration slice, target module map이 바뀔 때 |

이 문서는 Work Archive 백엔드의 **목표 구조 기준**이다. 현재 구현 상태 설명은 `CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md`에서 보고, 여기서는 어디로 나눠 가야 하는지를 정의한다.

## Goal

현재의 기능형 `Works` 중심 API를, local-first 개인 기록을 유지하면서도 catalog/public/tier/community 확장을 수용할 수 있는 **도메인 분리형 백엔드 구조**로 옮긴다.

## Current Baseline

- 현재 모듈: `Auth`, `Works`, `Sync`, `Health`, `Prisma`
- 현재 모델: `User`, `Work`
- 현재 `Work`는 작품 메타데이터, 개인 기록, soft delete, sync 상태를 함께 가진다.
- 현재 구조는 개인 기록 앱 백엔드로는 충분하지만, 공용 catalog나 public aggregate를 붙이기에는 책임이 과도하게 몰려 있다.

## Committed Now

### 1. Core Modules Stay Explicit

다음은 기반 모듈로 유지한다.

- `Auth`
- `Users`
- `Health`
- `Prisma`
- `Sync`

### 2. Record Plane And Shared Plane Must Split

장기적으로는 아래 경계를 분명히 한다.

- `Catalog`
- `UserRecords`
- `Imports`
- `PublicLayer`
- `TierBoards`

핵심 원칙:

- 작품 자체와 개인 기록은 분리한다.
- sync는 개인 기록 정합성 문제다.
- public aggregate는 private record path와 분리한다.

### 3. Do Not Keep Expanding `Work`

새 기능이 필요하더라도 현재 `Work` 모델에 계속 필드를 누적하는 방향을 기본값으로 삼지 않는다. `Work`는 현재 구조의 편의적 집합체로 보고, 이후 분해 대상으로 취급한다.

## Next

### Migration Slice 1

- `Work` 안에서 개인 기록 의미와 작품 metadata 의미를 문서상 먼저 분리
- Quick Add / import 흐름을 지원할 `Imports` 경계 정의
- catalog 후보와 개인 저장 흐름을 제품/백엔드 양쪽에서 분리

### Migration Slice 2

- `Catalog`와 `UserRecords`의 최소 책임 정의
- 현재 `Works` API를 한 번에 제거하지 않고, 호환 계층 또는 점진 분해 전략 준비
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
- `Work`를 무한 확장하는 방향이 기본값이 아니게 된다.
- catalog/public/community 확장이 private record와 구분된 구조로 설명된다.
- 실제 구현 착수 전 필요한 migration slices가 문서에 정리된다.
