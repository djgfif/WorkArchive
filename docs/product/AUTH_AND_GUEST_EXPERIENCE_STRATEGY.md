# AUTH_AND_GUEST_EXPERIENCE_STRATEGY.md

| Field | Value |
| --- | --- |
| Status | `active` |
| Role | `exploratory strategy` |
| Source of truth | future auth/guest product strategy |
| Last verified against | strategy document refreshed on `2026-04-21` |
| When to update | 인증 전략의 우선순위나 선행 조건이 바뀔 때 |

이 문서는 Work Archive의 **향후 인증/게스트 전략**을 다룬다. 현재 구현 설명이 아니라, 공개 전후 제품 전략 검토 문서다.

## Goal

게스트 모드의 강점을 유지하면서, 계정 전환 경험을 더 자연스럽게 만들고 장기적으로는 구글 로그인 중심 구조를 검토한다.

## Current Baseline

- 현재 구현은 이메일/비밀번호 인증이다.
- access/refresh token은 브라우저 `localStorage`에 저장된다.
- 게스트와 로그인 아카이브는 분리돼 있으며, 이관 UX는 없다.
- 로그인해도 기존 게스트 기록이 자동으로 합쳐지지 않는다.

## Committed Now

- 게스트 모드는 제품 강점으로 유지한다.
- “로그인 자체”보다 “기록을 잃지 않고 계정으로 옮기는 경험”을 중요한 문제로 본다.
- 이 문서는 전략 고정용이며, 현재 milestone에서 바로 구글 로그인 구현을 커밋하지는 않는다.

## Next

- 게스트 기록 존재 여부를 인식하는 전환 UX 정의
- 계정 전환 시 사용자가 혼동하지 않도록 copy와 flow 정리
- 현재 이메일/비밀번호 흐름에서도 게스트 유지 가치를 더 명확히 설명

## Later / Exploratory

- `Google로 계속하기` 중심 구조
- 이메일/비밀번호를 보조 수단으로 낮추는 전략
- 계정 병합 정책 고도화
- 다기기/백업/공개 기능과 연결되는 계정 가치 제시

## Dependencies

- guest -> account 데이터 이관 설계
- 보안 로드맵의 세션 저장 구조 개선
- 제품 공개 전략과 계정 가치 정의

## Exit Criteria

- 전략 문서를 current implementation으로 오독하지 않게 된다.
- 게스트 유지, 계정 전환, 구글 로그인 검토의 우선순위가 분명해진다.
- 실제 구현 착수 전 필요한 선행 조건이 문서에 명확히 적힌다.
