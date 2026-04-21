# VERIFIED_CATALOG_PROMOTION_ARCHITECTURE.md

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `exploratory architecture` |
| Source of truth | future catalog/public/community expansion strategy |
| Last verified against | exploratory architecture document refreshed on `2026-04-21` |
| When to update | catalog/public/community 확장 방향과 선행 조건이 바뀔 때 |

이 문서는 Work Archive의 **다음 단계 제품/도메인 확장 전략**을 다룬다. 현재 데이터 모델을 설명하는 문서가 아니라, catalog/public/community로 확장할 때의 방향을 고정한다.

## Goal

local-first 개인 기록 구조를 유지하면서, 장기적으로 공용 catalog와 공개 레이어를 안전하게 얹을 수 있는 확장 방향을 정의한다.

## Current Baseline

- 현재 저장소는 `User` + `Work` 중심 구조다.
- 개인 기록, 작품 메타데이터, sync 상태가 `Work`에 함께 들어 있다.
- public profile, catalog aggregate, moderation, promotion pipeline은 아직 없다.

## Committed Now

- 개인 기록 plane과 공용 catalog plane은 장기적으로 분리해야 한다.
- sync 문제와 catalog promotion 문제는 같은 파이프라인이 아니라는 점을 명시적으로 고정한다.
- 이 문서는 현재 구현 계획이 아니라 확장 방향 문서다.

## Next

- 백엔드 문서에서 `Catalog / UserRecord / Import / PublicLayer` 경계 구체화
- Quick Add와 import 흐름이 개인 기록 저장과 catalog 제안을 분리하도록 제품 경계 정리
- public aggregate를 만들기 전에 현재 `Work` 모델에 과도한 책임을 더하지 않기

## Later / Exploratory

- verified catalog
- submission and promotion pipeline
- public profile / public works
- community aggregate
- moderation and audit trail

## Dependencies

- 백엔드 도메인 재설계
- import-first Quick Add
- 공개/비공개 데이터 경계 설계
- 보안 로드맵의 권한 모델 분리

## Exit Criteria

- 현재 데이터 모델 설명과 확장 구조 문서가 혼동되지 않는다.
- catalog/public/community 방향이 exploratory라는 사실이 분명하다.
- 실제 착수 전에 필요한 선행 조건이 문서에 정리된다.
